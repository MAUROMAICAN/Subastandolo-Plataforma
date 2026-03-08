import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign, TrendingUp, Users, ShoppingBag, Search, Upload,
  CheckCircle, XCircle, Loader2, Wallet, ArrowDownCircle, ChevronDown, ChevronUp,
  FileText, CreditCard, Download, Receipt, ImageIcon, Hash, Calendar, Banknote
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface DealerSalesData {
  dealer_id: string;
  dealer_name: string;
  business_name: string;
  avatar_url: string | null;
  dealer_balance: number;
  account_status: string;
  total_sales: number;
  total_revenue: number;
  total_commission: number;
  total_dealer_net: number;
  total_paid: number;
  pending_balance: number;
  sales: {
    earning_id: string;
    auction_id: string;
    auction_title: string;
    operation_number: string | null;
    sale_amount: number;
    commission_amount: number;
    dealer_net: number;
    commission_percentage: number;
    created_at: string;
    bcv_rate: number | null;
    amount_bs: number | null;
    is_paid: boolean;
    has_proof: boolean;
  }[];
  withdrawals: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
    processed_at: string | null;
    admin_notes: string | null;
  }[];
  payments: {
    id: string;
    total_amount: number;
    payment_method: string;
    bank_name: string | null;
    reference_number: string | null;
    proof_url: string | null;
    notes: string | null;
    created_at: string;
    items: { earning_id: string; amount: number }[];
  }[];
  bank_account: {
    bank_name: string;
    account_type: string;
    account_number: string;
    identity_document: string;
    email: string;
    is_verified: boolean;
  } | null;
}

const ReceiptProofImage = ({ proofPath }: { proofPath: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const getUrl = async () => {
      let filePath = proofPath;
      if (proofPath.startsWith("http")) {
        const marker = "/object/public/payment-proofs/";
        const idx = proofPath.indexOf(marker);
        if (idx !== -1) filePath = proofPath.substring(idx + marker.length);
        else {
          const sm = "/object/sign/payment-proofs/";
          const si = proofPath.indexOf(sm);
          if (si !== -1) filePath = proofPath.substring(si + sm.length).split("?")[0];
        }
      }
      const { data, error: err } = await supabase.storage.from("payment-proofs").createSignedUrl(filePath, 864000);
      if (err || !data?.signedUrl) { setError(true); return; }
      setUrl(data.signedUrl);
    };
    getUrl();
  }, [proofPath]);

  if (error) return (
    <div className="text-center py-4">
      <p className="text-xs text-destructive">Error al cargar comprobante</p>
    </div>
  );

  if (!url) return (
    <div className="flex items-center justify-center py-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );

  const isPdf = proofPath.toLowerCase().endsWith(".pdf");

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.download = `comprobante-pago${isPdf ? ".pdf" : ""}`;
    a.click();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide">Comprobante adjunto</p>
        <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" onClick={handleDownload}>
          <Download className="h-3 w-3" /> Descargar
        </Button>
      </div>
      {isPdf ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-border rounded-sm p-3 hover:bg-secondary/30 transition-colors">
          <FileText className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-xs font-medium">Documento PDF</p>
            <p className="text-[10px] text-muted-foreground">Clic para abrir en nueva pestaña</p>
          </div>
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block border border-border rounded-sm overflow-hidden hover:opacity-90 transition-opacity">
          <img src={url} alt="Comprobante" className="w-full max-h-[300px] object-contain bg-secondary/20" />
        </a>
      )}
    </div>
  );
};

const AdminDealerSalesTab = ({ globalSearch = "" }: { globalSearch?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [dealers, setDealers] = useState<DealerSalesData[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { if (globalSearch) setSearch(globalSearch); }, [globalSearch]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedDealer, setExpandedDealer] = useState<string | null>(null);
  const [processingWithdrawal, setProcessingWithdrawal] = useState<string | null>(null);

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState<{ dealer: DealerSalesData } | null>(null);
  const [selectedEarnings, setSelectedEarnings] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [paymentBankName, setPaymentBankName] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<DealerSalesData["payments"][0] | null>(null);
  const [viewingReceiptDealer, setViewingReceiptDealer] = useState<DealerSalesData | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const [dealersRes, earningsRes, withdrawalsRes, bankRes, auctionsRes, proofsRes, bcvSettingRes, profilesRes, paymentsRes, paymentItemsRes, rolesRes] = await Promise.all([
      supabase.from("dealer_verification").select("user_id, business_name, dealer_balance, account_status, full_name").eq("status", "approved"),
      supabase.from("platform_earnings").select("*").order("created_at", { ascending: false }),
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("dealer_bank_accounts").select("*"),
      supabase.from("auctions").select("id, title, operation_number, funds_released_at, payment_status, current_price, created_by"),
      supabase.from("payment_proofs").select("auction_id, bcv_rate, amount_bs, amount_usd, status").eq("status", "approved"),
      supabase.from("site_settings").select("setting_value").eq("setting_key", "bcv_rate").single(),
      supabase.from("profiles").select("id, avatar_url, full_name"),
      supabase.from("dealer_payments").select("*").order("created_at", { ascending: false }),
      supabase.from("dealer_payment_items").select("*"),
      supabase.from("user_roles").select("user_id").eq("role", "dealer"),
    ]);

    const dealerList = dealersRes.data || [];
    const earnings = earningsRes.data || [];
    const withdrawals = withdrawalsRes.data || [];
    const banks = bankRes.data || [];
    const proofs = proofsRes.data || [];
    const currentBcvRate = Number(bcvSettingRes.data?.setting_value || 0);
    const auctionMap: Record<string, { title: string; operation_number: string | null; funds_released: boolean; payment_status: string; current_price: number; created_by: string }> = {};
    (auctionsRes.data || []).forEach((a: any) => {
      auctionMap[a.id] = { title: a.title, operation_number: a.operation_number, funds_released: !!a.funds_released_at, payment_status: a.payment_status, current_price: Number(a.current_price), created_by: a.created_by };
    });

    // Map auction_id -> payment proof info (bcv_rate, amount_bs)
    const proofMap: Record<string, { bcv_rate: number; amount_bs: number }> = {};
    proofs.forEach((p: any) => { proofMap[p.auction_id] = { bcv_rate: Number(p.bcv_rate), amount_bs: Number(p.amount_bs) }; });

    // Map user_id -> profile info (avatar + full_name)
    const profileMap: Record<string, { avatar_url: string | null; full_name: string }> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = { avatar_url: p.avatar_url, full_name: p.full_name || "Sin nombre" }; });

    // Map dealer_id -> payments with items
    const allPayments = (paymentsRes as any).data || [];
    const allPaymentItems = (paymentItemsRes as any).data || [];
    const paymentItemsByPayment: Record<string, { earning_id: string; amount: number }[]> = {};
    allPaymentItems.forEach((pi: any) => {
      if (!paymentItemsByPayment[pi.payment_id]) paymentItemsByPayment[pi.payment_id] = [];
      paymentItemsByPayment[pi.payment_id].push({ earning_id: pi.earning_id, amount: Number(pi.amount) });
    });

    // ── Merge dealer sources: verification + earnings + auction creators + role ──
    const dealerIdSet = new Set<string>();
    // 1. From dealer_verification (approved)
    dealerList.forEach((d: any) => dealerIdSet.add(d.user_id));
    // 2. From platform_earnings (any dealer with earnings)
    earnings.forEach((e: any) => { if (e.dealer_id) dealerIdSet.add(e.dealer_id); });
    // 3. From auctions (creators = dealers who sold)
    Object.values(auctionMap).forEach((a: any) => {
      if (a.created_by) dealerIdSet.add(a.created_by);
    });
    // 4. From user_roles (anyone with dealer role)
    (rolesRes.data || []).forEach((r: any) => { if (r.user_id) dealerIdSet.add(r.user_id); });

    // Build dealer verification lookup
    const dealerVerifMap: Record<string, any> = {};
    dealerList.forEach((d: any) => { dealerVerifMap[d.user_id] = d; });

    const dealerData: DealerSalesData[] = Array.from(dealerIdSet).map((dealerId) => {
      const verif = dealerVerifMap[dealerId];
      const profile = profileMap[dealerId];
      const dealerEarnings = earnings.filter((e: any) => e.dealer_id === dealerId);
      const dealerWithdrawals = withdrawals.filter((w: any) => w.dealer_id === dealerId);
      const bankAccount = banks.find((b: any) => b.user_id === dealerId);
      const totalPaid = dealerWithdrawals.filter((w: any) => w.status === "approved").reduce((acc: number, w: any) => acc + Number(w.amount), 0);

      // Use dealer_verification data if available, otherwise fallback to profile
      const dealerName = verif?.full_name || verif?.business_name || profile?.full_name || "Dealer";
      const businessName = verif?.business_name || profile?.full_name || "—";
      const dealerBalance = verif ? Number(verif.dealer_balance) || 0 : 0;
      const accountStatus = verif?.account_status || "active";

      return {
        dealer_id: dealerId,
        dealer_name: dealerName,
        business_name: businessName,
        avatar_url: profile?.avatar_url || null,
        dealer_balance: dealerBalance,
        account_status: accountStatus,
        total_sales: dealerEarnings.length,
        total_revenue: dealerEarnings.reduce((acc: number, e: any) => acc + Number(e.sale_amount), 0),
        total_commission: dealerEarnings.reduce((acc: number, e: any) => acc + Number(e.commission_amount), 0),
        total_dealer_net: dealerEarnings.reduce((acc: number, e: any) => acc + Number(e.dealer_net), 0),
        total_paid: totalPaid,
        pending_balance: dealerEarnings.filter((e: any) => !e.is_paid).reduce((acc: number, e: any) => acc + Number(e.dealer_net), 0),
        sales: dealerEarnings.map((e: any) => {
          const proof = proofMap[e.auction_id];
          const auctionInfo = auctionMap[e.auction_id];
          const saleAmount = Number(e.sale_amount);
          const bcvRate = proof?.bcv_rate || (currentBcvRate > 0 ? currentBcvRate : null);
          const amountBs = proof?.amount_bs || (bcvRate ? saleAmount * bcvRate : null);
          const isPaid = !!e.is_paid;
          return {
            earning_id: e.id,
            auction_id: e.auction_id,
            auction_title: auctionInfo?.title || "Subasta eliminada",
            operation_number: auctionInfo?.operation_number || null,
            sale_amount: saleAmount,
            commission_amount: Number(e.commission_amount),
            dealer_net: Number(e.dealer_net),
            commission_percentage: Number(e.commission_percentage),
            created_at: e.created_at,
            bcv_rate: bcvRate,
            amount_bs: amountBs,
            is_paid: isPaid,
            has_proof: !!proof,
          };
        }),
        withdrawals: dealerWithdrawals.map((w: any) => ({
          id: w.id,
          amount: Number(w.amount),
          status: w.status,
          created_at: w.created_at,
          processed_at: w.processed_at,
          admin_notes: w.admin_notes,
        })),
        payments: allPayments.filter((p: any) => p.dealer_id === dealerId).map((p: any) => ({
          id: p.id,
          total_amount: Number(p.total_amount),
          payment_method: p.payment_method,
          bank_name: p.bank_name,
          reference_number: p.reference_number,
          proof_url: p.proof_url,
          notes: p.notes,
          created_at: p.created_at,
          items: paymentItemsByPayment[p.id] || [],
        })),
        bank_account: bankAccount ? {
          bank_name: bankAccount.bank_name,
          account_type: bankAccount.account_type,
          account_number: bankAccount.account_number,
          identity_document: bankAccount.identity_document,
          email: bankAccount.email,
          is_verified: bankAccount.is_verified,
        } : null,
      };
    });

    setDealers(dealerData);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = dealers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d => d.dealer_name.toLowerCase().includes(q) || d.business_name.toLowerCase().includes(q));
    }
    if (statusFilter === "with_balance") result = result.filter(d => d.pending_balance > 0);
    if (statusFilter === "with_sales") result = result.filter(d => d.total_sales > 0);
    if (statusFilter === "no_sales") result = result.filter(d => d.total_sales === 0);
    return result.sort((a, b) => b.pending_balance - a.pending_balance);
  }, [dealers, search, statusFilter]);

  const totals = useMemo(() => ({
    totalRevenue: dealers.reduce((acc, d) => acc + d.total_revenue, 0),
    totalCommission: dealers.reduce((acc, d) => acc + d.total_commission, 0),
    totalOwed: dealers.reduce((acc, d) => acc + d.pending_balance, 0),
    totalPaid: dealers.reduce((acc, d) => acc + d.total_paid, 0),
    totalSales: dealers.reduce((acc, d) => acc + d.total_sales, 0),
    dealersWithBalance: dealers.filter(d => d.pending_balance > 0).length,
  }), [dealers]);

  const handleWithdrawalAction = async (withdrawalId: string, dealerId: string, action: "approved" | "rejected", amount: number) => {
    setProcessingWithdrawal(withdrawalId);
    const updateData: any = {
      status: action,
      processed_at: new Date().toISOString(),
      processed_by: user!.id,
    };

    const { error } = await supabase.from("withdrawal_requests").update(updateData).eq("id", withdrawalId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (action === "approved") {
        // Deduct from dealer balance
        const dealer = dealers.find(d => d.dealer_id === dealerId);
        if (dealer) {
          await supabase.from("dealer_verification").update({
            dealer_balance: Math.max(0, dealer.dealer_balance - amount),
          } as any).eq("user_id", dealerId);
        }
        toast({ title: "✅ Retiro aprobado", description: `Se pagaron $${amount.toFixed(2)} al dealer.` });
      } else {
        toast({ title: "❌ Retiro rechazado" });
      }
      fetchData();
    }
    setProcessingWithdrawal(null);
  };

  const selectedTotal = useMemo(() => {
    if (!paymentDialog) return 0;
    return paymentDialog.dealer.sales
      .filter(s => selectedEarnings.has(s.earning_id))
      .reduce((acc, s) => acc + s.dealer_net, 0);
  }, [paymentDialog, selectedEarnings]);

  const openPaymentDialog = (dealer: DealerSalesData) => {
    const unpaidEarnings = dealer.sales.filter(s => !s.is_paid);
    setPaymentDialog({ dealer });
    setSelectedEarnings(new Set(unpaidEarnings.map(s => s.earning_id)));
    setPaymentMethod("transfer");
    setPaymentBankName(dealer.bank_account?.bank_name || "");
    setPaymentReference("");
    setPaymentNotes("");
    setPaymentProofFile(null);
  };

  const handleManualPayment = async () => {
    if (!paymentDialog || selectedEarnings.size === 0) {
      toast({ title: "Selecciona al menos una operación", variant: "destructive" });
      return;
    }
    if (!paymentReference.trim()) {
      toast({ title: "Ingresa un número de referencia", variant: "destructive" });
      return;
    }

    setSubmittingPayment(true);
    const dealer = paymentDialog.dealer;
    const selectedSales = dealer.sales.filter(s => selectedEarnings.has(s.earning_id));
    const totalAmount = selectedSales.reduce((acc, s) => acc + s.dealer_net, 0);

    try {
      // Upload proof if provided
      let proofUrl: string | null = null;
      if (paymentProofFile) {
        const ext = paymentProofFile.name.split(".").pop();
        const path = `dealer-payments/${dealer.dealer_id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("payment-proofs").upload(path, paymentProofFile);
        if (uploadErr) throw uploadErr;
        proofUrl = path;
      }

      // Create dealer_payment record
      const { data: paymentData, error: paymentErr } = await supabase.from("dealer_payments").insert({
        dealer_id: dealer.dealer_id,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        bank_name: paymentBankName || null,
        reference_number: paymentReference,
        proof_url: proofUrl,
        notes: paymentNotes || null,
        created_by: user!.id,
      } as any).select("id").single();
      if (paymentErr) throw paymentErr;

      // Create payment items
      const items = selectedSales.map(s => ({
        payment_id: (paymentData as any).id,
        earning_id: s.earning_id,
        amount: s.dealer_net,
      }));
      const { error: itemsErr } = await supabase.from("dealer_payment_items").insert(items as any);
      if (itemsErr) throw itemsErr;

      // Mark earnings as paid
      for (const s of selectedSales) {
        await supabase.from("platform_earnings").update({
          is_paid: true,
          paid_at: new Date().toISOString(),
          paid_by: user!.id,
        } as any).eq("id", s.earning_id);
      }

      // Deduct from dealer balance
      const newBalance = Math.max(0, dealer.dealer_balance - totalAmount);
      await supabase.from("dealer_verification").update({
        dealer_balance: newBalance,
      } as any).eq("user_id", dealer.dealer_id);

      toast({ title: "✅ Pago registrado", description: `$${totalAmount.toFixed(2)} pagado a ${dealer.dealer_name} (${selectedSales.length} operaciones)` });
      setPaymentDialog(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSubmittingPayment(false);
  };

  const handleTogglePaid = async (earningId: string, isPaid: boolean, dealerId: string) => {
    // Check if dealer has bank account
    const dealer = dealers.find(d => d.dealer_id === dealerId);
    if (isPaid && dealer && !dealer.bank_account) {
      const confirmed = window.confirm(
        "⚠️ ALERTA: Este dealer NO tiene datos bancarios registrados.\n\n" +
        "Esto puede indicar que el cliente retiró el producto en tienda.\n\n" +
        "¿Confirma que desea marcar esta operación como pagada?\n\n" +
        "Se requiere autorización del administrador."
      );
      if (!confirmed) return;
    }

    const updateData: any = isPaid
      ? { is_paid: true, paid_at: new Date().toISOString(), paid_by: user!.id }
      : { is_paid: false, paid_at: null, paid_by: null };

    const { error } = await supabase.from("platform_earnings").update(updateData).eq("id", earningId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setDealers(prev => prev.map(d => {
        if (d.dealer_id !== dealerId) return d;
        return {
          ...d,
          sales: d.sales.map(s => s.earning_id === earningId ? { ...s, is_paid: isPaid } : s),
        };
      }));
      toast({
        title: isPaid ? "✅ Marcado como pagado" : "↩️ Desmarcado",
        description: isPaid && dealer && !dealer.bank_account
          ? "⚠️ Sin datos bancarios — Retiro en tienda autorizado"
          : undefined,
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-accent" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary dark:text-accent" /> Ventas de Dealers
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totals.totalSales} ventas · ${totals.totalRevenue.toFixed(2)} bruto · {totals.dealersWithBalance} con saldo pendiente
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{dealers.length} dealers activos</Badge>
      </div>

      {/* Summary Cards as Filter Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Ventas Totales", value: totals.totalSales, icon: ShoppingBag, color: "text-primary dark:text-accent", format: (v: number) => v.toString(), filter: "with_sales" },
          { label: "Ingresos Brutos", value: totals.totalRevenue, icon: DollarSign, color: "text-foreground", format: (v: number) => `$${v.toFixed(2)}`, filter: "with_sales" },
          { label: "Comisión Plataforma", value: totals.totalCommission, icon: TrendingUp, color: "text-primary dark:text-accent", format: (v: number) => `$${v.toFixed(2)}`, filter: "with_sales" },
          { label: "Por Pagar al Dealer", value: totals.totalOwed, icon: Wallet, color: "text-warning", format: (v: number) => `$${v.toFixed(2)}`, filter: "with_balance" },
          { label: "Total Pagado", value: totals.totalPaid, icon: CheckCircle, color: "text-primary dark:text-accent", format: (v: number) => `$${v.toFixed(2)}`, filter: "all" },
          { label: "Con Saldo", value: totals.dealersWithBalance, icon: Users, color: "text-destructive", format: (v: number) => v.toString(), filter: "with_balance" },
        ].map((stat, idx) => (
          <Card
            key={idx}
            className={`border rounded-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/40 ${statusFilter === stat.filter && statusFilter !== "all" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border"}`}
            onClick={() => setStatusFilter(prev => prev === stat.filter ? "all" : stat.filter)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] text-muted-foreground dark:text-gray-300 font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className={`text-lg font-heading font-bold ${stat.color}`}>{stat.format(stat.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar dealer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9 rounded-sm text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 rounded-sm text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los dealers</SelectItem>
            <SelectItem value="with_balance">Con saldo pendiente</SelectItem>
            <SelectItem value="with_sales">Con ventas</SelectItem>
            <SelectItem value="no_sales">Sin ventas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Dealer List */}
      {filtered.length === 0 ? (
        <Card className="border border-border rounded-sm">
          <CardContent className="p-12 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No se encontraron dealers.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(dealer => {
            const isExpanded = expandedDealer === dealer.dealer_id;
            return (
              <Card key={dealer.dealer_id} className="border border-border rounded-sm overflow-hidden">
                {/* Dealer Header Row */}
                <button
                  onClick={() => setExpandedDealer(isExpanded ? null : dealer.dealer_id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0">
                      {dealer.avatar_url && <AvatarImage src={dealer.avatar_url} alt={dealer.dealer_name} />}
                      <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-xs font-bold">{(dealer.dealer_name || "D").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{dealer.dealer_name}</p>
                      <p className="text-[10px] text-muted-foreground dark:text-gray-300 truncate">{dealer.business_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">Ventas</p>
                      <p className="text-xs font-bold">{dealer.total_sales}</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] text-muted-foreground">Ingresos</p>
                      <p className="text-xs font-bold">${dealer.total_revenue.toFixed(2)}</p>
                    </div>
                    <div className={`text-right px-3 py-1.5 rounded-sm ${dealer.pending_balance > 0 ? "bg-primary/10 dark:bg-accent/10 border border-primary/20 dark:border-accent/20" : "bg-primary/5 border border-primary/10"}`}>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Saldo a Favor</p>
                      <p className={`text-sm font-bold ${dealer.pending_balance > 0 ? "text-primary dark:text-accent" : "text-primary dark:text-accent"}`}>
                        ${dealer.pending_balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {dealer.pending_balance > 0 && (
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-[10px] h-7 px-2.5"
                          onClick={(e) => { e.stopPropagation(); openPaymentDialog(dealer); }}
                        >
                          <DollarSign className="h-3 w-3 mr-1" /> Pagar
                        </Button>
                      )}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/10 p-4 space-y-4">
                    {/* Summary Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {[
                        { label: "Ventas", value: dealer.total_sales.toString(), color: "text-foreground" },
                        { label: "Ingresos Brutos", value: `$${dealer.total_revenue.toFixed(2)}`, color: "text-foreground" },
                        { label: "Comisión", value: `$${dealer.total_commission.toFixed(2)}`, color: "text-muted-foreground" },
                        { label: "Neto Dealer", value: `$${dealer.total_dealer_net.toFixed(2)}`, color: "text-primary dark:text-accent" },
                        { label: "Pagado", value: `$${dealer.total_paid.toFixed(2)}`, color: "text-primary dark:text-accent" },
                      ].map((item, i) => (
                        <div key={i} className="bg-card border border-border rounded-sm p-2.5">
                          <p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wide">{item.label}</p>
                          <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Bank Account Info */}
                    {dealer.bank_account ? (
                      <div className="bg-card border border-border rounded-sm p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1 mb-2">
                          <CreditCard className="h-3 w-3" /> Cuenta Bancaria
                          {dealer.bank_account.is_verified ? (
                            <Badge variant="outline" className="text-[9px] ml-1 bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent border-primary/20">Verificada</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] ml-1 bg-warning/10 text-warning border-warning/20">Sin verificar</Badge>
                          )}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-muted-foreground">Banco:</span> <span className="font-medium">{dealer.bank_account.bank_name}</span></div>
                          <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium capitalize">{dealer.bank_account.account_type}</span></div>
                          <div><span className="text-muted-foreground">Cuenta:</span> <span className="font-mono font-medium">****{dealer.bank_account.account_number.slice(-4)}</span></div>
                          <div><span className="text-muted-foreground">Doc:</span> <span className="font-medium">{dealer.bank_account.identity_document}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-warning/5 border border-warning/20 rounded-sm p-3 text-xs text-warning flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Este dealer no ha registrado datos bancarios.
                      </div>
                    )}

                    {/* Sales History */}
                    {dealer.sales.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1 mb-2">
                          <ShoppingBag className="h-3 w-3" /> Historial de Ventas ({dealer.sales.length})
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-secondary/50 border-b border-border">
                                <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-2 py-2 w-10">✓</th>
                                <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Nº Op.</th>
                                <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Producto</th>
                                <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Venta USD</th>
                                <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Tasa BCV</th>
                                <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Monto Bs</th>
                                <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Comisión</th>
                                <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Neto</th>
                                <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2">Fecha</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {dealer.sales.map((sale, i) => (
                                <tr key={i} className={`transition-colors ${sale.is_paid ? "opacity-40 bg-secondary/30" : "hover:bg-secondary/20"}`}>
                                  <td className="px-2 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={sale.is_paid}
                                      onChange={() => handleTogglePaid(sale.earning_id, !sale.is_paid, dealer.dealer_id)}
                                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                      title={sale.is_paid ? "Marcar como no pagado" : "Marcar como pagado"}
                                    />
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground dark:text-gray-300 whitespace-nowrap">
                                    {sale.operation_number || "—"}
                                  </td>
                                  <td className="px-3 py-2 truncate max-w-[160px]">{sale.auction_title}</td>
                                  <td className="px-3 py-2 text-right font-bold">${sale.sale_amount.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right text-muted-foreground dark:text-gray-300 font-mono" title={!sale.has_proof ? "Estimado (sin comprobante)" : ""}>
                                    {sale.bcv_rate ? `${sale.bcv_rate.toFixed(2)}` : "—"}
                                    {sale.bcv_rate && !sale.has_proof && <span className="text-warning ml-0.5">*</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right font-bold text-primary dark:text-accent" title={!sale.has_proof ? "Estimado (sin comprobante)" : ""}>
                                    {sale.amount_bs ? `Bs ${sale.amount_bs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}` : "—"}
                                    {sale.amount_bs && !sale.has_proof && <span className="text-warning ml-0.5">*</span>}
                                  </td>
                                  <td className="px-3 py-2 text-right text-muted-foreground">${sale.commission_amount.toFixed(2)} ({sale.commission_percentage}%)</td>
                                  <td className="px-3 py-2 text-right font-bold text-primary dark:text-accent">${sale.dealer_net.toFixed(2)}</td>
                                  <td className="px-3 py-2 text-right text-muted-foreground">{new Date(sale.created_at).toLocaleDateString("es-MX")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {dealer.sales.some(s => !s.has_proof) && (
                            <p className="text-[9px] text-muted-foreground dark:text-gray-300 mt-1.5 italic">* Estimado — <span className="text-warning font-medium">Autorizado</span></p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Withdrawal History */}
                    {dealer.withdrawals.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1 mb-2">
                          <ArrowDownCircle className="h-3 w-3" /> Retiros / Pagos ({dealer.withdrawals.length})
                        </p>
                        <div className="space-y-2">
                          {dealer.withdrawals.map(w => {
                            const statusColors: Record<string, string> = {
                              pending: "bg-warning/10 text-warning border-warning/20",
                              approved: "bg-primary/10 text-primary dark:text-accent border-primary/20",
                              rejected: "bg-destructive/10 text-destructive border-destructive/20",
                            };
                            return (
                              <div key={w.id} className="flex items-center justify-between border border-border rounded-sm px-3 py-2.5 bg-card">
                                <div className="flex items-center gap-3">
                                  <p className="text-sm font-bold">${w.amount.toFixed(2)}</p>
                                  <p className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleDateString("es-MX")}</p>
                                  {w.admin_notes && <p className="text-[10px] text-muted-foreground dark:text-gray-300 italic hidden sm:block">— {w.admin_notes}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] ${statusColors[w.status] || ""}`}>
                                    {w.status === "pending" ? "Pendiente" : w.status === "approved" ? "Pagado" : "Rechazado"}
                                  </Badge>
                                  {w.status === "pending" && (
                                    <div className="flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-[10px] h-7 px-2"
                                        onClick={() => handleWithdrawalAction(w.id, dealer.dealer_id, "approved", w.amount)}
                                        disabled={processingWithdrawal === w.id}
                                      >
                                        {processingWithdrawal === w.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                        Pagar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive border-destructive/30 rounded-sm text-[10px] h-7 px-2"
                                        onClick={() => handleWithdrawalAction(w.id, dealer.dealer_id, "rejected", w.amount)}
                                        disabled={processingWithdrawal === w.id}
                                      >
                                        <XCircle className="h-3 w-3 mr-1" /> Rechazar
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Payment History */}
                    {dealer.payments.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1 mb-2">
                          <Receipt className="h-3 w-3" /> Comprobantes de Pago ({dealer.payments.length})
                        </p>
                        <div className="space-y-2">
                          {dealer.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between border border-border rounded-sm px-3 py-2.5 bg-card hover:bg-secondary/10 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-sm bg-primary/10 dark:bg-accent/10 flex items-center justify-center">
                                  <Receipt className="h-4 w-4 text-primary dark:text-accent" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold">${p.total_amount.toFixed(2)}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {p.payment_method === "transfer" ? "Transferencia" : p.payment_method === "cash" ? "Efectivo" : p.payment_method}
                                    {p.reference_number && <span className="font-mono ml-1">• Ref: {p.reference_number}</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("es-MX")}</p>
                                <Badge variant="outline" className="text-[9px] bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent border-primary/20">{p.items.length} ops</Badge>
                                <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-sm" onClick={() => { setViewingReceipt(p); setViewingReceiptDealer(dealer); }}>
                                  <FileText className="h-3 w-3 mr-1" /> Ver
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {dealer.total_sales === 0 && dealer.withdrawals.length === 0 && (
                      <p className="text-xs text-muted-foreground dark:text-gray-300 text-center py-4">Este dealer aún no tiene ventas ni retiros registrados.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Payment Dialog - Professional */}
      <Dialog open={!!paymentDialog} onOpenChange={open => { if (!open) setPaymentDialog(null); }}>
        <DialogContent className="max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-heading flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary dark:text-accent" /> Registrar Pago a Dealer
            </DialogTitle>
          </DialogHeader>
          {paymentDialog && (
            <div className="space-y-5">
              {/* Dealer Info */}
              <div className="bg-secondary/30 border border-border rounded-sm p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {paymentDialog.dealer.avatar_url && <AvatarImage src={paymentDialog.dealer.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary dark:text-accent font-bold">{(paymentDialog.dealer.dealer_name || "D").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{paymentDialog.dealer.dealer_name}</p>
                    <p className="text-[10px] text-muted-foreground">{paymentDialog.dealer.business_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Saldo pendiente</p>
                    <p className="text-lg font-bold text-warning">${paymentDialog.dealer.pending_balance.toFixed(2)}</p>
                  </div>
                </div>
                {paymentDialog.dealer.bank_account && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Banco:</span> <span className="font-medium">{paymentDialog.dealer.bank_account.bank_name}</span></div>
                    <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium capitalize">{paymentDialog.dealer.bank_account.account_type}</span></div>
                    <div><span className="text-muted-foreground">Cuenta:</span> <span className="font-mono font-medium">{paymentDialog.dealer.bank_account.account_number}</span></div>
                    <div><span className="text-muted-foreground">CI:</span> <span className="font-medium">{paymentDialog.dealer.bank_account.identity_document}</span></div>
                  </div>
                )}
                {!paymentDialog.dealer.bank_account && (
                  <div className="mt-3 pt-3 border-t border-warning/30 text-[11px] text-warning flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Sin datos bancarios — Posible retiro en tienda
                  </div>
                )}
              </div>

              {/* Select Operations */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide">Operaciones a Pagar</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-sm px-2"
                      onClick={() => setSelectedEarnings(new Set(paymentDialog.dealer.sales.filter(s => !s.is_paid).map(s => s.earning_id)))}>
                      Todas pendientes
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] rounded-sm px-2"
                      onClick={() => setSelectedEarnings(new Set())}>
                      Ninguna
                    </Button>
                  </div>
                </div>
                <div className="border border-border rounded-sm overflow-hidden max-h-[200px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-secondary/50 border-b border-border">
                        <th className="w-8 px-2 py-1.5"></th>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Nº Op.</th>
                        <th className="text-left px-2 py-1.5 font-semibold text-muted-foreground">Producto</th>
                        <th className="text-right px-2 py-1.5 font-semibold text-muted-foreground">Neto</th>
                        <th className="text-center px-2 py-1.5 font-semibold text-muted-foreground">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paymentDialog.dealer.sales.map(sale => (
                        <tr key={sale.earning_id} className={`transition-colors ${sale.is_paid ? "opacity-40" : "hover:bg-secondary/20 cursor-pointer"}`}
                          onClick={() => {
                            if (sale.is_paid) return;
                            setSelectedEarnings(prev => {
                              const next = new Set(prev);
                              next.has(sale.earning_id) ? next.delete(sale.earning_id) : next.add(sale.earning_id);
                              return next;
                            });
                          }}>
                          <td className="px-2 py-1.5 text-center">
                            <Checkbox
                              checked={selectedEarnings.has(sale.earning_id)}
                              disabled={sale.is_paid}
                              onCheckedChange={() => {
                                if (sale.is_paid) return;
                                setSelectedEarnings(prev => {
                                  const next = new Set(prev);
                                  next.has(sale.earning_id) ? next.delete(sale.earning_id) : next.add(sale.earning_id);
                                  return next;
                                });
                              }}
                              className="h-3.5 w-3.5"
                            />
                          </td>
                          <td className="px-2 py-1.5 font-mono text-muted-foreground">{sale.operation_number || "—"}</td>
                          <td className="px-2 py-1.5 truncate max-w-[140px]">{sale.auction_title}</td>
                          <td className="px-2 py-1.5 text-right font-bold">${sale.dealer_net.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center">
                            {sale.is_paid
                              ? <Badge variant="outline" className="text-[9px] bg-primary/10 dark:bg-accent/10 text-primary dark:text-accent border-primary/20">Pagado</Badge>
                              : <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">Pendiente</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-[10px] text-muted-foreground">{selectedEarnings.size} operaciones seleccionadas</p>
                  <p className="text-sm font-bold text-primary dark:text-accent">Total: ${selectedTotal.toFixed(2)}</p>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 flex items-center gap-1"><Banknote className="h-3 w-3" /> Método de pago</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 rounded-sm text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transfer">Transferencia bancaria</SelectItem>
                      <SelectItem value="mobile">Pago móvil</SelectItem>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 flex items-center gap-1"><Hash className="h-3 w-3" /> Nº de referencia *</label>
                  <Input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Número de referencia" className="h-9 rounded-sm text-xs font-mono" />
                </div>
              </div>

              {paymentMethod === "transfer" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Banco emisor</label>
                  <Input value={paymentBankName} onChange={e => setPaymentBankName(e.target.value)} placeholder="Nombre del banco" className="h-9 rounded-sm text-xs" />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Comprobante de pago (PDF, JPG, PNG)</label>
                <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setPaymentProofFile(e.target.files?.[0] || null)} className="h-9 rounded-sm text-xs" />
                {paymentProofFile && <p className="text-[10px] text-primary dark:text-accent">📎 {paymentProofFile.name}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                <Textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Observaciones adicionales..." className="rounded-sm text-xs" rows={2} />
              </div>

              {/* Summary */}
              <div className="bg-primary/5 border border-primary/20 dark:border-accent/20 rounded-sm p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wide">Total a Pagar</p>
                    <p className="text-xl font-heading font-bold text-primary dark:text-accent">${selectedTotal.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">{selectedEarnings.size} operaciones</p>
                    <p className="text-[10px] text-muted-foreground">{paymentMethod === "transfer" ? "Transferencia" : paymentMethod === "mobile" ? "Pago Móvil" : paymentMethod === "cash" ? "Efectivo" : "Otro"}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleManualPayment}
                disabled={submittingPayment || selectedEarnings.size === 0 || !paymentReference.trim()}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-sm h-11"
              >
                {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Confirmar Pago de ${selectedTotal.toFixed(2)}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={open => { if (!open) { setViewingReceipt(null); setViewingReceiptDealer(null); } }}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-heading flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary dark:text-accent" /> Comprobante de Pago
            </DialogTitle>
          </DialogHeader>
          {viewingReceipt && viewingReceiptDealer && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Receipt Header */}
              <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
                <p className="text-lg font-heading font-bold text-primary dark:text-accent">${viewingReceipt.total_amount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground dark:text-gray-300 mt-1">
                  Pagado a <span className="font-semibold text-foreground">{viewingReceiptDealer.dealer_name}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">{viewingReceiptDealer.business_name}</p>
              </div>

              {/* Receipt Details */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-border pb-1.5">
                  <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Fecha</span>
                  <span className="font-medium">{new Date(viewingReceipt.created_at).toLocaleString("es-MX")}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-1.5">
                  <span className="text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3" /> Método</span>
                  <span className="font-medium">{viewingReceipt.payment_method === "transfer" ? "Transferencia" : viewingReceipt.payment_method === "mobile" ? "Pago Móvil" : viewingReceipt.payment_method === "cash" ? "Efectivo" : viewingReceipt.payment_method}</span>
                </div>
                {viewingReceipt.bank_name && (
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Banco</span>
                    <span className="font-medium">{viewingReceipt.bank_name}</span>
                  </div>
                )}
                {viewingReceipt.reference_number && (
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-muted-foreground flex items-center gap-1"><Hash className="h-3 w-3" /> Referencia</span>
                    <span className="font-mono font-bold">{viewingReceipt.reference_number}</span>
                  </div>
                )}
                {viewingReceipt.notes && (
                  <div className="flex justify-between border-b border-border pb-1.5">
                    <span className="text-muted-foreground">Notas</span>
                    <span className="font-medium text-right max-w-[60%]">{viewingReceipt.notes}</span>
                  </div>
                )}
              </div>

              {/* Operations included */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide mb-1.5">
                  Operaciones incluidas ({viewingReceipt.items.length})
                </p>
                <div className="border border-border rounded-sm overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-secondary/50 border-b border-border">
                        <th className="text-left px-2 py-1 font-semibold text-muted-foreground">Operación</th>
                        <th className="text-right px-2 py-1 font-semibold text-muted-foreground">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewingReceipt.items.map((item, i) => {
                        const sale = viewingReceiptDealer.sales.find(s => s.earning_id === item.earning_id);
                        return (
                          <tr key={i}>
                            <td className="px-2 py-1.5">
                              <span className="font-mono text-muted-foreground">{sale?.operation_number || "—"}</span>
                              {sale && <span className="ml-1.5 text-foreground">{sale.auction_title}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right font-bold">${item.amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5 border-t border-primary/20">
                        <td className="px-2 py-1.5 font-bold text-primary dark:text-accent">TOTAL</td>
                        <td className="px-2 py-1.5 text-right font-bold text-primary dark:text-accent">${viewingReceipt.total_amount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Proof Image */}
              {viewingReceipt.proof_url && (
                <ReceiptProofImage proofPath={viewingReceipt.proof_url} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDealerSalesTab;
