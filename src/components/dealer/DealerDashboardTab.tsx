import { useState, useEffect, useMemo } from "react";
import { useBCVRate } from "@/hooks/useBCVRate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserReviews } from "@/hooks/useReviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package, TrendingUp, Clock, CheckCircle,
  DollarSign, Gavel, BarChart3, Wallet, ArrowRight,
  Truck, CreditCard, Activity
} from "lucide-react";

import UnifiedReputationCard from "@/components/UnifiedReputationCard";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";
import type { AuctionWithImages } from "./types";

interface Props {
  auctions: AuctionWithImages[];
  setActiveTab: (tab: string) => void;
  setStatusFilter: (filter: string) => void;
  sections: any[];
}

export default function DealerDashboardTab({ auctions, setActiveTab, setStatusFilter, sections }: Props) {
  const { user } = useAuth();
  const bcvRate = useBCVRate();
  const { dealerStats, buyerStats, unifiedStats } = useUserReviews(user?.id);

  // Earnings data — Bs amounts come directly from DB
  const [dealerEarnings, setDealerEarnings] = useState<any[]>([]);
  const [earningsLoaded, setEarningsLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from("dealer_earnings" as any)
        .select("auction_id, sale_amount, commission_amount, dealer_net, is_paid, created_at, bcv_rate, sale_amount_bs, commission_bs, dealer_net_bs")
        .eq("dealer_id", user.id)
        .then(({ data }: any) => {
          setDealerEarnings((data || []).map((e: any) => ({
            auction_id: e.auction_id,
            sale_amount: Number(e.sale_amount),
            commission_amount: Number(e.commission_amount),
            dealer_net: Number(e.dealer_net),
            is_paid: e.is_paid,
            created_at: e.created_at,
            sale_amount_bs: Number(e.sale_amount_bs) || 0,
            commission_bs: Number(e.commission_bs) || 0,
            dealer_net_bs: Number(e.dealer_net_bs) || 0,
          })));
          setEarningsLoaded(true);
        });
    }
  }, [user]);

  const fmtBs = (v: number) => `Bs. ${v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const metrics = useMemo(() => {
    const total = auctions.length;
    const active = auctions.filter(a => a.status === "active").length;
    const pending = auctions.filter(a => a.status === "pending" || a.status === "in_review").length;
    const finalized = auctions.filter(a => a.status === "finalized").length;
    const totalBids = auctions.reduce((sum, a) => sum + a.bids.length, 0);
    // Use Bs totals from dealerEarnings (DB source of truth)
    const totalRevenueBs = dealerEarnings.reduce((sum, e) => sum + e.sale_amount_bs, 0);
    const avgPriceBs = dealerEarnings.length > 0 ? totalRevenueBs / dealerEarnings.length : 0;
    const auctionsWithBids = auctions.filter(a => a.bids.length > 0).length;
    const conversionRate = auctionsWithBids > 0 ? Math.round((finalized / auctionsWithBids) * 100) : 0;
    return { total, active, pending, finalized, totalBids, totalRevenueBs, avgPriceBs, conversionRate };
  }, [auctions, dealerEarnings]);

  const walletStats = useMemo(() => {
    const COMMISSION_RATE = 0.10;
    const rate = bcvRate || 0;

    // Earnings from platform_earnings (funds already released)
    const availableBs = dealerEarnings.filter((e: any) => !e.is_paid).reduce((acc: number, e: any) => acc + e.dealer_net_bs, 0);
    const paidBs = dealerEarnings.filter((e: any) => e.is_paid).reduce((acc: number, e: any) => acc + e.dealer_net_bs, 0);

    // IDs of auctions already in platform_earnings
    const earningAuctionIds = new Set(dealerEarnings.map((e: any) => e.auction_id));

    // Auctions in intermediate states (NOT yet in platform_earnings)
    const intermediateAuctions = auctions.filter(a =>
      a.status === "finalized" && a.current_price > 0 && a.winner_id &&
      !earningAuctionIds.has(a.id) &&
      !["abandoned", "refunded"].includes(a.payment_status || "")
    );

    // Por Cobrar: buyer hasn't paid yet
    const pendingPaymentBs = intermediateAuctions
      .filter(a => { const ps = a.payment_status || "pending"; return ps === "pending" || ps === "under_review"; })
      .reduce((s, a) => s + a.current_price * (1 - COMMISSION_RATE) * rate, 0);

    // Retenido: buyer paid (escrow/verified) but not delivered yet
    const retainedBs = intermediateAuctions
      .filter(a => {
        const ps = a.payment_status || "";
        const ds = a.delivery_status || "pending";
        return (ps === "verified" || ps === "escrow") && ds !== "delivered";
      })
      .reduce((s, a) => s + a.current_price * (1 - COMMISSION_RATE) * rate, 0);

    const totalNetBs = availableBs + paidBs + pendingPaymentBs + retainedBs;
    return { totalNetBs, retainedBs, availableBs, pendingPaymentBs, paidBs };
  }, [dealerEarnings, auctions, bcvRate]);

  // Sales trend chart data (last 30 days)
  const trendData = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const finalized = auctions.filter(
      a => a.status === "finalized" && new Date(a.end_time).getTime() >= thirtyDaysAgo
    );
    // Group by day
    const dayMap: Record<string, number> = {};
    finalized.forEach(a => {
      const day = new Date(a.end_time).toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    // Generate last 14 days for chart
    const days: { day: string; ventas: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const label = d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" });
      days.push({ day: label, ventas: dayMap[label] || 0 });
    }
    return days;
  }, [auctions]);

  // Recent activity timeline
  const recentActivity = useMemo(() => {
    const activities: { type: string; label: string; time: Date; icon: any; color: string }[] = [];

    // Recent finalized auctions
    auctions
      .filter(a => a.status === "finalized")
      .slice(0, 5)
      .forEach(a => {
        activities.push({
          type: "sale",
          label: `Venta: ${a.title.slice(0, 40)}${a.title.length > 40 ? "…" : ""}`,
          time: new Date(a.end_time),
          icon: DollarSign,
          color: "#22c55e",
        });
      });

    // Recent shipped
    auctions
      .filter(a => a.delivery_status === "shipped")
      .slice(0, 3)
      .forEach(a => {
        activities.push({
          type: "shipped",
          label: `Envío: ${a.title.slice(0, 40)}${a.title.length > 40 ? "…" : ""}`,
          time: new Date(a.end_time),
          icon: Truck,
          color: "#8b5cf6",
        });
      });

    // Recent payment received
    auctions
      .filter(a => a.payment_status === "verified")
      .slice(0, 3)
      .forEach(a => {
        activities.push({
          type: "payment",
          label: `Pago verificado: ${a.title.slice(0, 36)}${a.title.length > 36 ? "…" : ""}`,
          time: new Date(a.end_time),
          icon: CreditCard,
          color: "#3b82f6",
        });
      });

    // Sort by time, most recent first
    return activities.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
  }, [auctions]);

  // Pending actions — MUST match DealerShipmentsTab logic exactly
  const shippable = auctions.filter(a => {
    const isEnded = new Date(a.end_time).getTime() <= Date.now();
    return (a.status === "finalized" || (a.status === "active" && isEnded)) && a.winner_id;
  });
  const pendingShipments = shippable.filter(a => a.delivery_status === "ready_to_ship" && !a.tracking_number).length;
  const pendingPayments = shippable.filter(a => ["pending", "under_review"].includes(a.payment_status || "")).length;

  return (
    <div className="space-y-5">
      {/* Header — admin style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {metrics.active} activas · {metrics.pending} en revisión · {metrics.finalized} finalizadas
            {earningsLoaded && ` · ${fmtBs(metrics.totalRevenueBs)} ingresos`}
          </p>
        </div>
        <span className="text-[10px] px-2 py-1 border border-border rounded-sm text-muted-foreground whitespace-nowrap">
          {new Date().toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      {/* Pending Action Alerts */}
      {(pendingShipments > 0 || pendingPayments > 0) && (
        <div className="flex flex-wrap gap-2">
          {pendingShipments > 0 && (
            <button
              onClick={() => setActiveTab("shipments")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/15 transition-all text-xs font-bold group"
            >
              <Truck className="h-3.5 w-3.5" />
              {pendingShipments} envío{pendingShipments !== 1 ? "s" : ""} pendiente{pendingShipments !== 1 ? "s" : ""}
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
          {pendingPayments > 0 && (
            <button
              onClick={() => { setActiveTab("auctions"); setStatusFilter("finalized"); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-all text-xs font-bold group"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {pendingPayments} pago{pendingPayments !== 1 ? "s" : ""} por cobrar
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      )}

      {/* Wallet Balance — Loading skeleton */}
      {(!earningsLoaded || bcvRate === null) && (
        <Card className="border-2 border-emerald-500/20 rounded-xl bg-emerald-500/5 animate-pulse">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <Wallet className="h-7 w-7 text-emerald-500/40" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 bg-emerald-500/10 rounded" />
                <div className="h-7 w-40 bg-emerald-500/10 rounded" />
                <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  Cargando billetera...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Balance — Four-state display */}
      {earningsLoaded && bcvRate !== null && (
        <Card
          className="border-2 border-emerald-500/30 rounded-xl bg-emerald-500/5 cursor-pointer hover:border-emerald-500/50 transition-all group"
          onClick={() => setActiveTab("wallet")}
        >
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-105 transition-transform">
                  <Wallet className="h-7 w-7 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Saldo Disponible para Retirar</p>
                  <p className="text-2xl sm:text-3xl font-heading font-bold text-emerald-500">
                    {fmtBs(walletStats.availableBs)}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
            </div>

            {/* Four-state breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 text-center">
                <DollarSign className="h-4 w-4 text-slate-400 mx-auto mb-1" />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">Por Cobrar</p>
                <p className="text-sm sm:text-base font-bold text-slate-500 dark:text-slate-400">
                  {fmtBs(walletStats.pendingPaymentBs)}
                </p>
                <p className="text-[10px] text-slate-500/60 dark:text-slate-400/60 mt-0.5">Comprador no ha pagado</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">Retenido</p>
                <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  {fmtBs(walletStats.retainedBs)}
                </p>
                <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-0.5">Esperando entrega</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">Disponible</p>
                <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {fmtBs(walletStats.availableBs)}
                </p>
                <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 mt-0.5">Listo para retiro</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                <DollarSign className="h-4 w-4 text-primary dark:text-[#A6E300] mx-auto mb-1" />
                <p className="text-[11px] text-primary dark:text-[#A6E300] font-semibold uppercase tracking-wide">Retirado</p>
                <p className="text-sm sm:text-base font-bold text-primary dark:text-[#A6E300]">
                  {fmtBs(walletStats.paidBs)}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">Pagado al dealer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bs explanation */}
      {earningsLoaded && bcvRate !== null && (
        <div className="bg-secondary/40 border border-border rounded-xl px-4 py-3 flex items-start gap-2.5">
          <span className="text-base mt-0.5">💱</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Los montos se reflejan en <strong className="text-foreground">bolívares (Bs)</strong> ya que cada subasta cierra a la tasa BCV del día de su finalización, y a esa tasa se cobra al comprador. Solo se aceptan pagos en Bs.
          </p>
        </div>
      )}

      {/* Metric Cards — admin-style KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Subastas", value: String(metrics.total), sub: `${metrics.active} activas`, icon: Package, gradient: "from-primary/20 to-primary/5", iconColor: "text-primary dark:text-[#A6E300]", filter: "all" },
          { label: "Activas", value: String(metrics.active), sub: `${metrics.total} total`, icon: TrendingUp, gradient: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500", filter: "active" },
          { label: "En Revisión", value: String(metrics.pending), sub: "pendientes de aprobación", icon: Clock, gradient: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500", filter: "pending" },
          { label: "Finalizadas", value: String(metrics.finalized), sub: `${pendingShipments} envíos pendientes`, icon: CheckCircle, gradient: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-500", filter: "finalized" },
        ].map((m, i) => (
          <Card key={i} className="border border-border rounded-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group" onClick={() => { setActiveTab("auctions"); setStatusFilter(m.filter); }}>
            <CardContent className={`p-4 bg-gradient-to-br ${m.gradient} rounded-sm`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm">
                  <m.icon className={`h-4.5 w-4.5 ${m.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-heading font-bold tracking-tight">{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{m.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue stats + Conversion — admin-style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ingresos Totales", value: earningsLoaded ? fmtBs(metrics.totalRevenueBs) : "...", sub: `${metrics.finalized} ventas`, icon: DollarSign, gradient: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500" },
          { label: "Total de Pujas", value: String(metrics.totalBids), sub: `${(metrics.totalBids / Math.max(metrics.total, 1)).toFixed(1)} por subasta`, icon: Gavel, gradient: "from-purple-500/20 to-purple-500/5", iconColor: "text-purple-500" },
          { label: "Precio Promedio", value: earningsLoaded ? fmtBs(metrics.avgPriceBs) : "...", sub: "por subasta finalizada", icon: BarChart3, gradient: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-500" },
          { label: "Tasa Conversión", value: `${metrics.conversionRate}%`, sub: "pujas → ventas", icon: TrendingUp, gradient: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500" },
        ].map((m, i) => (
          <Card key={i} className="border border-border rounded-sm">
            <CardContent className={`p-4 bg-gradient-to-br ${m.gradient} rounded-sm`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm">
                  <m.icon className={`h-4.5 w-4.5 ${m.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-heading font-bold tracking-tight">{m.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{m.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Trend Chart + Recent Activity — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mini Sales Trend */}
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <TrendingUp className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              Tendencia de Ventas
              <span className="text-[10px] font-normal text-muted-foreground ml-auto">Últimos 14 días</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {trendData.some(d => d.ventas > 0) ? (
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A6E300" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#A6E300" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide allowDecimals={false} />
                  <ReTooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 700 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ventas"
                    stroke="#A6E300"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#A6E300", stroke: "#0d1117", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center text-muted-foreground/40">
                <BarChart3 className="h-8 w-8 mb-2" />
                <p className="text-xs">Sin ventas en los últimos 14 días</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-heading">
              <Activity className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {recentActivity.length > 0 ? (
              <div className="space-y-1">
                {recentActivity.map((act, i) => {
                  const Icon = act.icon;
                  const timeAgo = getTimeAgo(act.time);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/30 transition-colors"
                    >
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: act.color + "15" }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: act.color }} />
                      </div>
                      <p className="text-xs text-foreground flex-1 min-w-0 truncate">{act.label}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[140px] flex flex-col items-center justify-center text-muted-foreground/40">
                <Activity className="h-8 w-8 mb-2" />
                <p className="text-xs">Sin actividad reciente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unified Reputation Card */}
      <UnifiedReputationCard
        unifiedStats={unifiedStats}
        dealerStats={dealerStats}
        buyerStats={buyerStats}
      />

      {/* Seller Performance Metrics */}
      {metrics.finalized > 0 && (
        <Card className="border border-border rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <BarChart3 className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              Rendimiento del Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            <p className="text-xs text-muted-foreground mb-4">Estas métricas reflejan tu desempeño y afectan tu reputación en la plataforma.</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(() => {
                const shipped = auctions.filter(a => a.delivery_status === "shipped" || a.delivery_status === "delivered").length;
                const shippableCount = auctions.filter(a => a.status === "finalized" && a.winner_id).length;
                const shippingRate = shippableCount > 0 ? Math.round((shipped / shippableCount) * 100) : 100;

                const cancelled = auctions.filter(a => a.payment_status === "abandoned" || a.payment_status === "refunded").length;
                const cancelRate = metrics.finalized > 0 ? Math.round((cancelled / metrics.finalized) * 100) : 0;

                const rating = dealerStats?.avgRating || 0;
                const positiveRate = dealerStats?.positivePercentage || 100;

                return [
                  {
                    label: "Envíos a Tiempo",
                    value: `${shippingRate}%`,
                    color: shippingRate >= 90 ? "text-emerald-500" : shippingRate >= 70 ? "text-amber-500" : "text-destructive",
                    bg: shippingRate >= 90 ? "bg-emerald-500/10 border-emerald-500/20" : shippingRate >= 70 ? "bg-amber-500/10 border-amber-500/20" : "bg-destructive/10 border-destructive/20",
                    icon: "🚚",
                    sub: `${shipped}/${shippableCount} enviados`,
                  },
                  {
                    label: "Cancelaciones",
                    value: `${cancelRate}%`,
                    color: cancelRate <= 5 ? "text-emerald-500" : cancelRate <= 15 ? "text-amber-500" : "text-destructive",
                    bg: cancelRate <= 5 ? "bg-emerald-500/10 border-emerald-500/20" : cancelRate <= 15 ? "bg-amber-500/10 border-amber-500/20" : "bg-destructive/10 border-destructive/20",
                    icon: "📉",
                    sub: `${cancelled} canceladas`,
                  },
                  {
                    label: "Rating Promedio",
                    value: rating > 0 ? rating.toFixed(1) : "—",
                    color: rating >= 4.5 ? "text-emerald-500" : rating >= 3.5 ? "text-amber-500" : "text-destructive",
                    bg: rating >= 4.5 ? "bg-emerald-500/10 border-emerald-500/20" : rating >= 3.5 ? "bg-amber-500/10 border-amber-500/20" : "bg-destructive/10 border-destructive/20",
                    icon: "⭐",
                    sub: `${positiveRate}% positivas`,
                  },
                  {
                    label: "Tasa Conversión",
                    value: `${metrics.conversionRate}%`,
                    color: metrics.conversionRate >= 70 ? "text-emerald-500" : metrics.conversionRate >= 40 ? "text-amber-500" : "text-destructive",
                    bg: metrics.conversionRate >= 70 ? "bg-emerald-500/10 border-emerald-500/20" : metrics.conversionRate >= 40 ? "bg-amber-500/10 border-amber-500/20" : "bg-destructive/10 border-destructive/20",
                    icon: "📊",
                    sub: "pujas → ventas",
                  },
                ].map((m, i) => (
                  <div key={i} className={`rounded-xl p-4 text-center border ${m.bg}`}>
                    <div className="text-xl mb-1">{m.icon}</div>
                    <p className={`text-2xl font-heading font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-[11px] font-bold text-foreground mt-1">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commission info */}
      <Card className="border border-border rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-heading">
            <DollarSign className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            Estructura de Costos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            En <strong className="text-foreground">Subastandolo.com</strong> queremos que ganes más. Por eso, nuestra estructura de costos es la más simple del mercado:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-secondary/40 border border-border rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">📢</div>
              <p className="text-xs font-bold text-foreground mb-1">Publicar</p>
              <p className="text-lg font-extrabold text-accent">¡GRATIS!</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">💰</div>
              <p className="text-xs font-bold text-foreground mb-1">Comisión por venta</p>
              <p className="text-lg font-extrabold text-accent">Solo 10%</p>
              <p className="text-[10px] text-muted-foreground">del valor final</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-xl p-4 text-center">
              <div className="text-2xl mb-1">🚫</div>
              <p className="text-xs font-bold text-foreground mb-1">Si no vendes</p>
              <p className="text-lg font-extrabold text-accent">$0</p>
              <p className="text-[10px] text-muted-foreground">Sin cargos ocultos</p>
            </div>
          </div>

          <div className="bg-secondary/30 border border-border rounded-xl p-4">
            <p className="text-xs font-bold text-foreground mb-2">📊 Ejemplo:</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Si tu producto se subasta en <strong className="text-foreground">$100</strong>, tú recibes <strong className="text-accent">$90</strong> en bolívares a la tasa BCV del cierre. <strong className="text-foreground">La comisión más baja del mercado.</strong>
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground italic border-t border-border pt-3">
            📌 Nota: El pago será a la tasa del Banco Central de Venezuela (BCV) cobrada al comprador al momento de cerrar la venta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Human-friendly time ago */
function getTimeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}
