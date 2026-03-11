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

  // Earnings data (fetched independently for dashboard overview)
  const [dealerEarnings, setDealerEarnings] = useState<any[]>([]);
  const [earningsLoaded, setEarningsLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from("dealer_earnings")
        .select("sale_amount, commission_amount, dealer_net, is_paid, created_at")
        .eq("dealer_id", user.id)
        .then(({ data }) => {
          setDealerEarnings((data || []).map((e: any) => ({
            sale_amount: Number(e.sale_amount),
            commission_amount: Number(e.commission_amount),
            dealer_net: Number(e.dealer_net),
            is_paid: e.is_paid,
            created_at: e.created_at,
          })));
          setEarningsLoaded(true);
        });
    }
  }, [user]);

  const metrics = useMemo(() => {
    const total = auctions.length;
    const active = auctions.filter(a => a.status === "active").length;
    const pending = auctions.filter(a => a.status === "pending" || a.status === "in_review").length;
    const finalized = auctions.filter(a => a.status === "finalized").length;
    const totalBids = auctions.reduce((sum, a) => sum + a.bids.length, 0);
    const totalRevenue = auctions
      .filter(a => a.status === "finalized" && a.current_price > 0)
      .reduce((sum, a) => sum + a.current_price, 0);
    const avgPrice = finalized > 0 ? totalRevenue / finalized : 0;
    // Conversion: finalized with a winner / auctions that had bids
    const auctionsWithBids = auctions.filter(a => a.bids.length > 0).length;
    const conversionRate = auctionsWithBids > 0 ? Math.round((finalized / auctionsWithBids) * 100) : 0;
    return { total, active, pending, finalized, totalBids, totalRevenue, avgPrice, conversionRate };
  }, [auctions]);

  const walletStats = useMemo(() => {
    const COMMISSION_RATE = 0.10;

    if (dealerEarnings.length > 0) {
      const totalNet = dealerEarnings.reduce((acc, e) => acc + e.dealer_net, 0);
      const paid = dealerEarnings.filter(e => e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
      const unpaid = dealerEarnings.filter(e => !e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
      const totalCommission = dealerEarnings.reduce((acc, e) => acc + e.commission_amount, 0);
      return { totalNet, retained: unpaid, available: 0, pendingPayment: 0, paid, totalCommission };
    }

    const finalizedWithSale = auctions.filter(a => a.status === "finalized" && a.current_price > 0 && a.winner_id);
    const netOf = (list: typeof finalizedWithSale) =>
      list.reduce((s, a) => s + a.current_price * (1 - COMMISSION_RATE), 0);
    const excludedStatuses = ["abandoned", "refunded"];
    const billableAuctions = finalizedWithSale.filter(a =>
      !excludedStatuses.includes(a.payment_status || "")
    );
    const pendingPaymentAuctions = billableAuctions.filter(a => {
      const ps = a.payment_status || "pending";
      return ps === "pending" || ps === "under_review";
    });
    const retainedAuctions = billableAuctions.filter(a => {
      const ps = a.payment_status || "";
      const ds = a.delivery_status || "pending";
      return (ps === "verified" || ps === "escrow") && ds !== "delivered";
    });
    const availableAuctions = billableAuctions.filter(a => {
      const ps = a.payment_status || "";
      const ds = a.delivery_status || "pending";
      if (ps === "released") return true;
      if (ds === "delivered" && (ps === "verified" || ps === "escrow")) return true;
      return false;
    });
    const paidTotal = 0;
    const pendingPaymentTotal = netOf(pendingPaymentAuctions);
    const retainedTotal = netOf(retainedAuctions);
    const availableTotal = netOf(availableAuctions);
    const totalNet = pendingPaymentTotal + retainedTotal + availableTotal + paidTotal;
    const totalCommission = finalizedWithSale.reduce((sum, a) => sum + a.current_price, 0) * COMMISSION_RATE;
    return { totalNet, retained: retainedTotal, available: availableTotal, pendingPayment: pendingPaymentTotal, paid: paidTotal, totalCommission };
  }, [dealerEarnings, auctions]);

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

  // Pending actions badges — aligned with wallet logic (handle null, require winner_id)
  const billable = auctions.filter(a => a.status === "finalized" && a.current_price > 0 && a.winner_id && !["abandoned", "refunded"].includes(a.payment_status || ""));
  const pendingShipments = billable.filter(a => {
    const ps = a.payment_status || "";
    const ds = a.delivery_status || "pending";
    return (ps === "verified" || ps === "escrow") && ds !== "shipped" && ds !== "delivered";
  }).length;
  const pendingPayments = billable.filter(a => {
    const ps = a.payment_status || "pending";
    return ps === "pending" || ps === "under_review";
  }).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Panel del Dealer
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {metrics.active} activas · {metrics.pending} en revisión · {metrics.finalized} finalizadas
          {bcvRate !== null && ` · Bs. ${(metrics.totalRevenue * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ingresos`}
        </p>
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
                    Bs. {(walletStats.available * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  Bs. {(walletStats.pendingPayment * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-500/60 dark:text-slate-400/60 mt-0.5">Comprador no ha pagado</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wide">Retenido</p>
                <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  Bs. {(walletStats.retained * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-amber-600/60 dark:text-amber-400/60 mt-0.5">Esperando entrega</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">Disponible</p>
                <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  Bs. {(walletStats.available * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 mt-0.5">Listo para retiro</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                <DollarSign className="h-4 w-4 text-primary dark:text-[#A6E300] mx-auto mb-1" />
                <p className="text-[11px] text-primary dark:text-[#A6E300] font-semibold uppercase tracking-wide">Retirado</p>
                <p className="text-sm sm:text-base font-bold text-primary dark:text-[#A6E300]">
                  Bs. {(walletStats.paid * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Subastas", value: metrics.total, icon: Package, color: "text-primary dark:text-[#A6E300]", filter: "all" },
          { label: "Activas", value: metrics.active, icon: TrendingUp, color: "text-success", filter: "active" },
          { label: "En Revisión", value: metrics.pending, icon: Clock, color: "text-warning", filter: "pending" },
          { label: "Finalizadas", value: metrics.finalized, icon: CheckCircle, color: "text-muted-foreground", filter: "finalized" },
        ].map((m, i) => (
          <Card key={i} className="border border-border rounded-xl cursor-pointer hover:bg-secondary/30 hover:border-primary/30 transition-all group" onClick={() => { setActiveTab("auctions"); setStatusFilter(m.filter); }}>
            <CardContent className="p-4 text-center">
              <m.icon className={`h-5 w-5 ${m.color} mx-auto mb-2 group-hover:scale-110 transition-transform`} />
              <p className="text-2xl font-heading font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue stats + Conversion */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ingresos Totales", value: bcvRate !== null ? `Bs. ${(metrics.totalRevenue * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "...", icon: DollarSign, color: "text-primary dark:text-[#A6E300]" },
          { label: "Total de Pujas", value: String(metrics.totalBids), icon: Gavel, color: "text-primary dark:text-[#A6E300]" },
          { label: "Precio Promedio", value: bcvRate !== null ? `Bs. ${(metrics.avgPrice * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "...", icon: BarChart3, color: "text-primary dark:text-[#A6E300]" },
          { label: "Tasa Conversión", value: `${metrics.conversionRate}%`, icon: TrendingUp, color: "text-emerald-500" },
        ].map((m, i) => (
          <Card key={i} className="border border-border rounded-xl">
            <CardContent className="p-4 text-center">
              <m.icon className={`h-4 w-4 ${m.color} mx-auto mb-1.5`} />
              <p className="text-xs text-muted-foreground mb-0.5">{m.label}</p>
              <p className={`text-lg font-heading font-bold ${i === 0 || i === 3 ? m.color : ''}`}>{m.value}</p>
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
