import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Wallet, DollarSign, TrendingUp, CheckCircle,
  Clock, ArrowDownToLine, BarChart3, ShoppingBag
} from "lucide-react";

interface Earning {
  id: string;
  auction_id: string;
  sale_amount: number;
  commission_amount: number;
  dealer_net: number;
  is_paid: boolean;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  admin_notes?: string;
}

interface AuctionLike {
  id: string;
  title: string;
  status: string;
  current_price: number;
  end_time: string;
}

export default function DealerWalletTab({ auctions = [] }: { auctions?: AuctionLike[] }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);

  useEffect(() => {
    if (user) fetchWalletData();
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    setLoading(true);

    const [earningsRes, withdrawalsRes] = await Promise.all([
      supabase.from("dealer_earnings").select("*")
        .eq("dealer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*")
        .eq("dealer_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setEarnings(((earningsRes.data || []) as any[]).map((e: any) => ({
      ...e,
      sale_amount: Number(e.sale_amount),
      commission_amount: Number(e.commission_amount),
      dealer_net: Number(e.dealer_net),
    })));
    setWithdrawals((withdrawalsRes.data || []) as Withdrawal[]);
    setLoading(false);
  };

  // Compute from dealer_earnings if available, otherwise from auctions
  const COMMISSION_RATE = 0.05;
  const computedEarnings = useMemo(() => {
    if (earnings.length > 0) return earnings;
    // Build from finalized auctions
    return auctions
      .filter(a => a.status === "finalized" && a.current_price > 0)
      .map(a => ({
        id: a.id,
        auction_id: a.id,
        title: a.title,
        sale_amount: a.current_price,
        commission_amount: +(a.current_price * COMMISSION_RATE).toFixed(2),
        dealer_net: +(a.current_price * (1 - COMMISSION_RATE)).toFixed(2),
        is_paid: false,
        created_at: a.end_time,
      }));
  }, [earnings, auctions]);

  const stats = useMemo(() => {
    const totalEarnings = computedEarnings.reduce((acc, e) => acc + e.dealer_net, 0);
    const totalSales = computedEarnings.length;
    const totalRevenue = computedEarnings.reduce((acc, e) => acc + e.sale_amount, 0);
    const totalCommission = computedEarnings.reduce((acc, e) => acc + e.commission_amount, 0);
    const paidEarnings = computedEarnings.filter(e => e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
    const unpaidEarnings = computedEarnings.filter(e => !e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
    const approvedWithdrawals = withdrawals.filter(w => w.status === "approved").reduce((acc, w) => acc + Number(w.amount), 0);
    const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
    const hasPendingWithdrawal = pendingWithdrawals.length > 0;

    return {
      totalEarnings, totalSales, totalRevenue, totalCommission,
      paidEarnings, unpaidEarnings, approvedWithdrawals,
      hasPendingWithdrawal, pendingWithdrawals
    };
  }, [computedEarnings, withdrawals]);

  const handleRequestWithdrawal = async () => {
    if (stats.unpaidEarnings <= 0) {
      toast({ title: "Sin saldo disponible", description: "Tu balance debe ser mayor a $0.", variant: "destructive" });
      return;
    }
    setRequestingWithdrawal(true);
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        dealer_id: user!.id,
        amount: stats.unpaidEarnings,
      } as any);
      if (error) throw error;
      toast({ title: "✅ Solicitud Enviada", description: `Retiro de $${stats.unpaidEarnings.toFixed(2)} solicitado. El admin lo procesará.` });
      fetchWalletData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setRequestingWithdrawal(false);
  };

  const statusMap: Record<string, { label: string; color: string; icon: string }> = {
    pending: { label: "Pendiente", color: "bg-warning/10 text-warning border-warning/20", icon: "⏳" },
    approved: { label: "Aprobado", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: "✅" },
    rejected: { label: "Rechazado", color: "bg-destructive/10 text-destructive border-destructive/20", icon: "❌" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Mi Billetera
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {stats.totalSales} venta{stats.totalSales !== 1 ? "s" : ""} · ${stats.totalEarnings.toFixed(2)} ganados · ${stats.unpaidEarnings.toFixed(2)} disponible
        </p>
      </div>

      {/* Balance Card — Prominent */}
      <Card className="border-2 border-emerald-500/30 rounded-sm bg-emerald-500/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-sm">
                <Wallet className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Saldo a Favor</p>
                <p className="text-3xl font-heading font-bold text-emerald-500">${stats.unpaidEarnings.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ganancias netas por cobrar</p>
              </div>
            </div>
            <Button
              onClick={handleRequestWithdrawal}
              disabled={requestingWithdrawal || stats.unpaidEarnings <= 0 || stats.hasPendingWithdrawal}
              className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-sm font-bold h-10 px-5"
            >
              {requestingWithdrawal ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Procesando...</>
              ) : stats.hasPendingWithdrawal ? (
                "⏳ Retiro pendiente"
              ) : (
                <><ArrowDownToLine className="h-4 w-4 mr-2" /> Solicitar Retiro</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ventas Totales", value: stats.totalSales.toString(), icon: ShoppingBag, color: "text-primary dark:text-[#A6E300]" },
          { label: "Ingresos Brutos", value: `$${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-foreground" },
          { label: "Comisión (5%)", value: `$${stats.totalCommission.toFixed(2)}`, icon: TrendingUp, color: "text-muted-foreground" },
          { label: "Total Pagado", value: `$${stats.approvedWithdrawals.toFixed(2)}`, icon: CheckCircle, color: "text-emerald-500" },
        ].map((stat, idx) => (
          <Card key={idx} className="border border-border rounded-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className={`text-lg font-heading font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Earnings Breakdown */}
      <Card className="border border-border rounded-sm">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            <p className="text-sm font-heading font-bold">Detalle de Ganancias</p>
            <Badge variant="outline" className="text-[10px] ml-auto">{computedEarnings.length} ventas</Badge>
          </div>
          {computedEarnings.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">Aún no tienes ventas</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">Cuando vendas un producto, verás el detalle aquí</p>
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold text-muted-foreground px-4 py-2.5">Fecha</th>
                    <th className="text-right font-semibold text-muted-foreground px-4 py-2.5">Venta</th>
                    <th className="text-right font-semibold text-muted-foreground px-4 py-2.5 hidden sm:table-cell">Comisión</th>
                    <th className="text-right font-semibold text-muted-foreground px-4 py-2.5">Neto</th>
                    <th className="text-right font-semibold text-muted-foreground px-4 py-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {computedEarnings.map((e) => (
                    <tr key={e.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {new Date(e.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">${e.sale_amount.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">-${e.commission_amount.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-500">${e.dealer_net.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {e.is_paid ? (
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pagado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">Pendiente</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      <Card className="border border-border rounded-sm">
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            <p className="text-sm font-heading font-bold">Historial de Retiros</p>
            <Badge variant="outline" className="text-[10px] ml-auto">{withdrawals.length} retiros</Badge>
          </div>
          {withdrawals.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">No has realizado retiros aún.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {withdrawals.map((w: any) => {
                const st = statusMap[w.status] || statusMap.pending;
                return (
                  <div key={w.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div>
                      <p className="text-sm font-bold">${Number(w.amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                      {st.icon} {st.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="bg-secondary/50 rounded-sm p-4 text-xs text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">ℹ️ ¿Cómo funciona tu billetera?</p>
        <ul className="list-disc ml-4 space-y-1">
          <li>Cuando se verifica el pago de un comprador, tu ganancia neta (95%) se acredita.</li>
          <li>El <strong className="text-emerald-500">Saldo a Favor</strong> muestra lo que te debemos — se actualiza automáticamente con cada venta y pago.</li>
          <li>Solicita un retiro y el admin lo procesará a tu cuenta bancaria registrada.</li>
          <li>Solo puedes tener un retiro pendiente a la vez.</li>
        </ul>
      </div>
    </div>
  );
}
