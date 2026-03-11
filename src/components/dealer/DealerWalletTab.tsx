import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useBCVRate } from "@/hooks/useBCVRate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Wallet, DollarSign, TrendingUp, CheckCircle,
  Clock, ArrowDownToLine, BarChart3, ShoppingBag, ChevronDown, ChevronUp,
  Banknote, Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Earning {
  id: string;
  auction_id: string;
  sale_amount: number;
  commission_amount: number;
  dealer_net: number;
  is_paid: boolean;
  created_at: string;
  sale_amount_bs: number;
  commission_bs: number;
  dealer_net_bs: number;
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
  const bcvRate = useBCVRate();

  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingWithdrawal, setRequestingWithdrawal] = useState(false);

  // Bank account state
  const [bankOpen, setBankOpen] = useState(false);
  const [bankAccount, setBankAccountData] = useState<{
    id?: string; bank_name: string; account_type: string; account_number: string;
    identity_document: string; email: string; is_verified: boolean;
  } | null>(null);
  const [bankForm, setBankForm] = useState({
    bank_name: "", account_type: "", account_number: "", identity_document: "", email: "",
  });
  const [savingBank, setSavingBank] = useState(false);
  const [loadingBank, setLoadingBank] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWalletData();
      fetchBankAccount();
    }
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    setLoading(true);

    const [earningsRes, withdrawalsRes] = await Promise.all([
      supabase.from("dealer_earnings" as any).select("*")
        .eq("dealer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*")
        .eq("dealer_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    // Bs columns come directly from DB — no local computation needed
    setEarnings(((earningsRes.data || []) as any[]).map((e: any) => ({
      ...e,
      sale_amount: Number(e.sale_amount),
      commission_amount: Number(e.commission_amount),
      dealer_net: Number(e.dealer_net),
      sale_amount_bs: Number(e.sale_amount_bs) || 0,
      commission_bs: Number(e.commission_bs) || 0,
      dealer_net_bs: Number(e.dealer_net_bs) || 0,
    })));
    setWithdrawals((withdrawalsRes.data || []) as Withdrawal[]);
    setLoading(false);
  };

  const fetchBankAccount = async () => {
    if (!user) return;
    setLoadingBank(true);
    const { data } = await supabase
      .from("dealer_bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setBankAccountData(data as any);
      setBankForm({
        bank_name: data.bank_name, account_type: data.account_type,
        account_number: data.account_number, identity_document: data.identity_document, email: data.email,
      });
    }
    setLoadingBank(false);
  };

  const banks = [
    "Banco de Venezuela", "Banesco", "Banco Mercantil", "BBVA Provincial",
    "Banco Nacional de Crédito (BNC)", "Banco del Tesoro", "Banco Bicentenario",
    "Banco Exterior", "Banco Caroní", "Banco Fondo Común (BFC)", "Banco Sofitasa",
    "Banco Plaza", "Banco Venezolano de Crédito", "Banplus",
    "Banco del Caribe (Bancaribe)", "Bancrecer", "Mi Banco", "100% Banco",
    "Bancamiga", "Banco Activo",
  ];

  const handleSaveBankAccount = async () => {
    if (!user) return;
    const { bank_name, account_type, account_number, identity_document, email } = bankForm;
    if (!bank_name || !account_type || !account_number || !identity_document || !email) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    if (account_number.length < 10 || account_number.length > 20) {
      toast({ title: "Número de cuenta inválido", description: "Debe tener entre 10 y 20 dígitos.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Correo electrónico inválido", variant: "destructive" });
      return;
    }
    setSavingBank(true);
    if (bankAccount?.id) {
      const { error } = await supabase.from("dealer_bank_accounts").update({
        bank_name, account_type, account_number, identity_document, email, is_verified: false,
      } as any).eq("id", bankAccount.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "💰 Datos bancarios actualizados" });
    } else {
      const { error } = await supabase.from("dealer_bank_accounts").insert({
        user_id: user.id, bank_name, account_type, account_number, identity_document, email,
      } as any);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "💰 Datos bancarios registrados" });
    }
    setSavingBank(false);
    fetchBankAccount();
  };

  const fmtBs = (v: number) => `Bs. ${v.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Use earnings directly (they now have pre-computed Bs amounts)
  const computedEarnings = earnings;

  const stats = useMemo(() => {
    const totalEarningsBs = computedEarnings.reduce((acc, e) => acc + e.dealer_net_bs, 0);
    const totalSales = computedEarnings.length;
    const totalRevenueBs = computedEarnings.reduce((acc, e) => acc + e.sale_amount_bs, 0);
    const totalCommissionBs = computedEarnings.reduce((acc, e) => acc + e.commission_bs, 0);
    const unpaidEarningsBs = computedEarnings.filter(e => !e.is_paid).reduce((acc, e) => acc + e.dealer_net_bs, 0);
    const unpaidEarningsUsd = computedEarnings.filter(e => !e.is_paid).reduce((acc, e) => acc + e.dealer_net, 0);
    const approvedWithdrawals = withdrawals.filter(w => w.status === "approved").reduce((acc, w) => acc + Number(w.amount), 0);
    const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
    const hasPendingWithdrawal = pendingWithdrawals.length > 0;

    return {
      totalEarningsBs, totalSales, totalRevenueBs, totalCommissionBs,
      unpaidEarningsBs, unpaidEarningsUsd, approvedWithdrawals,
      hasPendingWithdrawal, pendingWithdrawals
    };
  }, [computedEarnings, withdrawals]);

  const handleRequestWithdrawal = async () => {
    if (stats.unpaidEarningsUsd <= 0) {
      toast({ title: "Sin saldo disponible", description: "Tu balance debe ser mayor a Bs. 0.", variant: "destructive" });
      return;
    }
    setRequestingWithdrawal(true);
    try {
      const { error } = await supabase.from("withdrawal_requests").insert({
        dealer_id: user!.id,
        amount: stats.unpaidEarningsUsd,
      } as any);
      if (error) throw error;
      toast({ title: "✅ Solicitud Enviada", description: `Retiro de ${fmtBs(stats.unpaidEarningsBs)} solicitado. El admin lo procesará.` });
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

  if (loading || bcvRate === null) {
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
          {stats.totalSales} venta{stats.totalSales !== 1 ? "s" : ""} · {fmtBs(stats.totalEarningsBs)} ganados · {fmtBs(stats.unpaidEarningsBs)} disponible
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
                <p className="text-3xl font-heading font-bold text-emerald-500">
                  {fmtBs(stats.unpaidEarningsBs)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Tasa BCV al cierre de cada subasta
                </p>
              </div>
            </div>
            <Button
              onClick={handleRequestWithdrawal}
              disabled={requestingWithdrawal || stats.unpaidEarningsUsd <= 0 || stats.hasPendingWithdrawal}
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

      {/* ── Mi Cuenta de Cobros (collapsible) ── */}
      <Card className="border border-border rounded-sm overflow-hidden">
        <button
          onClick={() => setBankOpen(!bankOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            <span className="text-sm font-heading font-bold">Mi Cuenta de Cobros</span>
            {bankAccount?.is_verified && (
              <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Verificada</Badge>
            )}
            {bankAccount && !bankAccount.is_verified && (
              <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">Pendiente</Badge>
            )}
            {!bankAccount && !loadingBank && (
              <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">Sin configurar</Badge>
            )}
          </div>
          {bankOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {bankOpen && (
          <CardContent className="p-4 pt-0 border-t border-border space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs space-y-1 mt-3">
              <p className="font-semibold text-foreground">🔒 Regla de Seguridad</p>
              <p className="text-muted-foreground">Solo se realizarán pagos a cuentas cuya titularidad coincida con la identidad verificada del Dealer.</p>
            </div>
            {loadingBank ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Banco *</Label>
                  <Select value={bankForm.bank_name} onValueChange={v => setBankForm(p => ({ ...p, bank_name: v }))}>
                    <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Selecciona tu banco" /></SelectTrigger>
                    <SelectContent>
                      {banks.map(b => (<SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Tipo de Cuenta *</Label>
                  <Select value={bankForm.account_type} onValueChange={v => setBankForm(p => ({ ...p, account_type: v }))}>
                    <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corriente" className="text-xs">Corriente</SelectItem>
                      <SelectItem value="ahorros" className="text-xs">Ahorros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Número de Cuenta *</Label>
                  <Input value={bankForm.account_number} onChange={e => { const val = e.target.value.replace(/\D/g, "").slice(0, 20); setBankForm(p => ({ ...p, account_number: val })); }} placeholder="Ej: 01340123456789012345" className="rounded-xl text-xs h-9 font-mono" maxLength={20} />
                  <p className="text-[10px] text-muted-foreground">Entre 10 y 20 dígitos</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Cédula/RIF *</Label>
                  <Input value={bankForm.identity_document} onChange={e => setBankForm(p => ({ ...p, identity_document: e.target.value.slice(0, 20) }))} placeholder="Ej: V-12345678" className="rounded-xl text-xs h-9" maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Correo Asociado *</Label>
                  <Input type="email" value={bankForm.email} onChange={e => setBankForm(p => ({ ...p, email: e.target.value.slice(0, 100) }))} placeholder="correo@ejemplo.com" className="rounded-xl text-xs h-9" maxLength={100} />
                </div>
                <Button onClick={handleSaveBankAccount} disabled={savingBank} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold text-xs h-9">
                  {savingBank ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {bankAccount ? "Actualizar Datos Bancarios" : "Guardar Datos Bancarios"}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ventas Totales", value: stats.totalSales.toString(), icon: ShoppingBag, color: "text-primary dark:text-[#A6E300]" },
          { label: "Ingresos Brutos", value: fmtBs(stats.totalRevenueBs), icon: DollarSign, color: "text-foreground" },
          { label: "Comisión (10%)", value: fmtBs(stats.totalCommissionBs), icon: TrendingUp, color: "text-muted-foreground" },
          { label: "Total Retirado", value: fmtBs(stats.approvedWithdrawals * (bcvRate || 0)), icon: CheckCircle, color: "text-emerald-500" },
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
                      <td className="px-4 py-2.5 text-right font-medium">{fmtBs(e.sale_amount_bs)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">-{fmtBs(e.commission_bs)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-500">{fmtBs(e.dealer_net_bs)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {e.is_paid ? (
                          <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Retirado</Badge>
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
                      <p className="text-sm font-bold">{fmtBs(Number(w.amount) * (bcvRate || 0))}</p>
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
          <li>Cuando se verifica el pago de un comprador, tu ganancia neta (90%) se acredita.</li>
          <li>El <strong className="text-emerald-500">Saldo a Favor</strong> muestra lo que te debemos — se actualiza automáticamente con cada venta y pago.</li>
          <li>Solicita un retiro y el admin lo procesará a tu cuenta bancaria registrada.</li>
          <li>Solo puedes tener un retiro pendiente a la vez.</li>
        </ul>
      </div>
    </div>
  );
}
