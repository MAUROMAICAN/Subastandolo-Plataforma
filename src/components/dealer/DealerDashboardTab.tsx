import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package, TrendingUp, Clock, CheckCircle, ChevronDown,
  DollarSign, Gavel, BarChart3, Wallet, ShoppingBag, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuctionWithImages } from "./types";

interface Props {
  auctions: AuctionWithImages[];
  setActiveTab: (tab: string) => void;
  setStatusFilter: (filter: string) => void;
  sections: any[];
}

export default function DealerDashboardTab({ auctions, setActiveTab, setStatusFilter, sections }: Props) {
  const { user } = useAuth();

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
    return { total, active, pending, finalized, totalBids, totalRevenue, avgPrice };
  }, [auctions]);

  const walletStats = useMemo(() => {
    const totalNet = dealerEarnings.reduce((acc, e) => acc + e.dealer_net, 0);
    const unpaid = dealerEarnings.filter(e => !e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
    const paid = dealerEarnings.filter(e => e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
    const totalCommission = dealerEarnings.reduce((acc, e) => acc + e.commission_amount, 0);
    return { totalNet, unpaid, paid, totalCommission };
  }, [dealerEarnings]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Panel del Dealer
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {metrics.active} activas · {metrics.pending} en revisión · {metrics.finalized} finalizadas · ${metrics.totalRevenue.toLocaleString("es-MX")} ingresos
        </p>
      </div>

      {/* Wallet Balance — Prominent */}
      {earningsLoaded && (
        <Card
          className="border-2 border-emerald-500/30 rounded-sm bg-emerald-500/5 cursor-pointer hover:border-emerald-500/50 transition-all group"
          onClick={() => setActiveTab("wallet")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-sm group-hover:scale-105 transition-transform">
                  <Wallet className="h-7 w-7 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Saldo a Favor</p>
                  <p className="text-2xl sm:text-3xl font-heading font-bold text-emerald-500">${walletStats.unpaid.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Total Ganado</p>
                  <p className="text-sm font-bold">${walletStats.totalNet.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Pagado</p>
                  <p className="text-sm font-bold text-emerald-500">${walletStats.paid.toFixed(2)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Subastas", value: metrics.total, icon: Package, color: "text-primary dark:text-[#A6E300]", filter: "all" },
          { label: "Activas", value: metrics.active, icon: TrendingUp, color: "text-success", filter: "active" },
          { label: "En Revisión", value: metrics.pending, icon: Clock, color: "text-warning", filter: "pending" },
          { label: "Finalizadas", value: metrics.finalized, icon: CheckCircle, color: "text-muted-foreground", filter: "finalized" },
        ].map((m, i) => (
          <Card key={i} className="border border-border rounded-sm cursor-pointer hover:bg-secondary/30 hover:border-primary/30 transition-all group" onClick={() => { setActiveTab("auctions"); setStatusFilter(m.filter); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <m.icon className={`h-5 w-5 ${m.color} group-hover:scale-110 transition-transform`} />
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 -rotate-90" />
              </div>
              <p className="text-2xl font-heading font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border border-border rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              <p className="text-xs text-muted-foreground">Ingresos Totales</p>
            </div>
            <p className="text-xl font-heading font-bold text-primary dark:text-[#A6E300]">${metrics.totalRevenue.toLocaleString("es-MX")}</p>
          </CardContent>
        </Card>
        <Card className="border border-border rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              <p className="text-xs text-muted-foreground">Total de Pujas</p>
            </div>
            <p className="text-xl font-heading font-bold">{metrics.totalBids}</p>
          </CardContent>
        </Card>
        <Card className="border border-border rounded-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              <p className="text-xs text-muted-foreground">Precio Promedio</p>
            </div>
            <p className="text-xl font-heading font-bold">${metrics.avgPrice.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Commission info */}
      <Card className="border border-border rounded-sm">
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
            <div className="bg-secondary/40 border border-border rounded-sm p-4 text-center">
              <div className="text-2xl mb-1">📢</div>
              <p className="text-xs font-bold text-foreground mb-1">Publicar</p>
              <p className="text-lg font-extrabold text-accent">¡GRATIS!</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-sm p-4 text-center">
              <div className="text-2xl mb-1">💰</div>
              <p className="text-xs font-bold text-foreground mb-1">Comisión por venta</p>
              <p className="text-lg font-extrabold text-accent">Solo 5%</p>
              <p className="text-[10px] text-muted-foreground">del valor final</p>
            </div>
            <div className="bg-secondary/40 border border-border rounded-sm p-4 text-center">
              <div className="text-2xl mb-1">🚫</div>
              <p className="text-xs font-bold text-foreground mb-1">Si no vendes</p>
              <p className="text-lg font-extrabold text-accent">$0</p>
              <p className="text-[10px] text-muted-foreground">Sin cargos ocultos</p>
            </div>
          </div>

          <div className="bg-secondary/30 border border-border rounded-sm p-4">
            <p className="text-xs font-bold text-foreground mb-2">📊 Ejemplo:</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Si tu producto se subasta en <strong className="text-foreground">$100</strong>, tú recibes <strong className="text-accent hover:underline cursor-help" title="Descontando el 5% de comisión">$95</strong> y nosotros gestionamos toda la seguridad de la transacción por solo <strong className="text-foreground">$5</strong>.
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
