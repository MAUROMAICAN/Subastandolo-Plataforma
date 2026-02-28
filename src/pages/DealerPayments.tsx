import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, Search, Filter, DollarSign, Clock, CheckCircle,
  XCircle, ChevronDown, ChevronUp, Building2, User, Phone, Mail,
  CreditCard, Calendar, RefreshCw, Banknote, TrendingUp, AlertCircle,
  Eye, MoreVertical, Download, Printer
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type WithdrawalStatus = "all" | "pending" | "in_review" | "paid";

interface WithdrawalRequest {
  id: string;
  dealer_id: string;
  amount: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  // enriched
  dealer_name?: string;
  dealer_phone?: string;
  dealer_business?: string;
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  bank_email?: string;
  identity_document?: string;
  dealer_balance?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; dot: string }> = {
  pending:   { label: "Pendiente",    color: "bg-warning/10 text-warning border-warning/30",        icon: Clock,         dot: "bg-warning" },
  in_review: { label: "En Revisión",  color: "bg-primary/10 text-primary border-primary/30",         icon: Eye,           dot: "bg-primary" },
  paid:      { label: "Pagado",        color: "bg-primary/10 text-primary border-primary/30",         icon: CheckCircle,   dot: "bg-primary" },
  rejected:  { label: "Rechazado",    color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle,  dot: "bg-destructive" },
};

const DealerPayments = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WithdrawalStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WithdrawalRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin && user) fetchData();
  }, [isAdmin, user]);

  const fetchData = async () => {
    setLoading(true);
    const [withdrawalsRes, dealersRes, bankRes] = await Promise.all([
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("dealer_verification").select("user_id, full_name, phone, business_name, dealer_balance"),
      supabase.from("dealer_bank_accounts").select("*"),
    ]);

    const dealerMap: Record<string, any> = {};
    (dealersRes.data || []).forEach((d: any) => { dealerMap[d.user_id] = d; });

    const bankMap: Record<string, any> = {};
    (bankRes.data || []).forEach((b: any) => { bankMap[b.user_id] = b; });

    const enriched: WithdrawalRequest[] = (withdrawalsRes.data || []).map((w: any) => ({
      ...w,
      dealer_name: dealerMap[w.dealer_id]?.full_name || "Dealer",
      dealer_phone: dealerMap[w.dealer_id]?.phone || null,
      dealer_business: dealerMap[w.dealer_id]?.business_name || null,
      dealer_balance: dealerMap[w.dealer_id]?.dealer_balance || 0,
      bank_name: bankMap[w.dealer_id]?.bank_name || null,
      account_number: bankMap[w.dealer_id]?.account_number || null,
      account_type: bankMap[w.dealer_id]?.account_type || null,
      bank_email: bankMap[w.dealer_id]?.email || null,
      identity_document: bankMap[w.dealer_id]?.identity_document || null,
    }));

    setWithdrawals(enriched);
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setProcessing(id);
    const update: any = {
      status: newStatus,
      admin_notes: adminNote.trim() || null,
    };
    if (newStatus === "paid") {
      update.processed_at = new Date().toISOString();
      update.processed_by = user!.id;
    }

    const { error } = await supabase.from("withdrawal_requests").update(update).eq("id", id);
    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    } else {
      const labels: Record<string, string> = {
        in_review: "🔍 Marcado En Revisión",
        paid: "✅ Marcado como Pagado",
        rejected: "❌ Solicitud Rechazada",
        pending: "⏳ Devuelto a Pendiente",
      };
      toast({ title: labels[newStatus] || "Estado actualizado" });
      setSelected(null);
      setAdminNote("");
      fetchData();
    }
    setProcessing(null);
  };

  const filtered = useMemo(() => {
    return withdrawals.filter(w => {
      const matchStatus = statusFilter === "all" || w.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        w.dealer_name?.toLowerCase().includes(q) ||
        w.dealer_business?.toLowerCase().includes(q) ||
        w.id.includes(q) ||
        w.amount.toString().includes(q);
      return matchStatus && matchSearch;
    });
  }, [withdrawals, statusFilter, search]);

  // Summary metrics
  const totalPending = withdrawals.filter(w => w.status === "pending").length;
  const totalPendingAmount = withdrawals.filter(w => w.status === "pending").reduce((s, w) => s + w.amount, 0);
  const totalInReview = withdrawals.filter(w => w.status === "in_review").length;
  const totalPaid = withdrawals.filter(w => w.status === "paid").reduce((s, w) => s + w.amount, 0);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-nav-solid text-white sticky top-0 z-30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin")}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-sm h-8 gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Admin
          </Button>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            <h1 className="font-heading font-bold text-sm">Panel de Pagos a Dealers</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-sm h-8 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-warning/30 rounded-sm p-4 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-3 w-3 text-warning" /> Pendientes
            </p>
            <p className="text-2xl font-heading font-bold text-warning">{totalPending}</p>
            <p className="text-[10px] text-muted-foreground">${totalPendingAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-card border border-primary/30 rounded-sm p-4 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Eye className="h-3 w-3 text-primary" /> En Revisión
            </p>
            <p className="text-2xl font-heading font-bold text-primary">{totalInReview}</p>
            <p className="text-[10px] text-muted-foreground">solicitudes activas</p>
          </div>
          <div className="bg-card border border-primary/30 rounded-sm p-4 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-primary" /> Total Pagado
            </p>
            <p className="text-2xl font-heading font-bold text-primary">${totalPaid.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-muted-foreground">{withdrawals.filter(w => w.status === "paid").length} transacciones</p>
          </div>
          <div className="bg-card border border-border rounded-sm p-4 space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Total Solicitudes
            </p>
            <p className="text-2xl font-heading font-bold text-foreground">{withdrawals.length}</p>
            <p className="text-[10px] text-muted-foreground">historial completo</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por dealer, negocio, monto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as WithdrawalStatus)}>
            <SelectTrigger className="rounded-sm w-44">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_review">En Revisión</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
              <SelectItem value="rejected">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-[1fr_140px_120px_150px_160px] gap-4 px-4 py-2.5 bg-secondary/50 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Dealer</span>
            <span>Monto</span>
            <span>Estado</span>
            <span>Banco</span>
            <span>Fecha</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay solicitudes de retiro</p>
              {statusFilter !== "all" && <p className="text-xs mt-1">Prueba cambiando el filtro</p>}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((w) => {
                const sc = STATUS_CONFIG[w.status] || STATUS_CONFIG.pending;
                const StatusIcon = sc.icon;
                const isExpanded = expanded === w.id;

                return (
                  <div key={w.id} className="group">
                    {/* Main row */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px_150px_160px] gap-4 px-4 py-3.5 hover:bg-secondary/20 transition-colors cursor-pointer items-center"
                      onClick={() => setExpanded(isExpanded ? null : w.id)}
                    >
                      {/* Dealer info */}
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${sc.dot}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{w.dealer_name}</p>
                          {w.dealer_business && (
                            <p className="text-[10px] text-muted-foreground truncate">{w.dealer_business}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 md:hidden">#{w.id.slice(0, 8)}</p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <p className="text-sm font-bold text-foreground">${w.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-muted-foreground">USD</p>
                      </div>

                      {/* Status badge */}
                      <div>
                        <Badge className={`${sc.color} border rounded-sm text-[10px] gap-1 font-semibold`}>
                          <StatusIcon className="h-3 w-3" />
                          {sc.label}
                        </Badge>
                      </div>

                      {/* Bank */}
                      <div className="hidden md:block">
                        {w.bank_name ? (
                          <>
                            <p className="text-xs font-medium">{w.bank_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{w.account_number?.slice(-4) ? `···${w.account_number.slice(-4)}` : "—"}</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Sin datos bancarios</p>
                        )}
                      </div>

                      {/* Date */}
                      <div className="hidden md:flex items-center justify-between">
                        <div>
                          <p className="text-xs text-foreground">{formatDate(w.created_at)}</p>
                          {w.processed_at && (
                            <p className="text-[10px] text-primary">Pagado: {formatDate(w.processed_at)}</p>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    </div>

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="border-t border-border bg-secondary/10 px-4 py-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                          {/* Dealer info card */}
                          <div className="bg-card border border-border rounded-sm p-3 space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <User className="h-3 w-3" /> Datos del Dealer
                            </p>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="font-medium">{w.dealer_name}</span>
                              </div>
                              {w.dealer_business && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span>{w.dealer_business}</span>
                                </div>
                              )}
                              {w.dealer_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="font-mono">{w.dealer_phone}</span>
                                </div>
                              )}
                              {w.bank_email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{w.bank_email}</span>
                                </div>
                              )}
                              <div className="pt-1 border-t border-border">
                                <p className="text-muted-foreground">Balance actual:</p>
                                <p className="font-bold text-foreground">${(w.dealer_balance || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                          </div>

                          {/* Bank info card */}
                          <div className="bg-card border border-border rounded-sm p-3 space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Datos Bancarios
                            </p>
                            {w.bank_name ? (
                              <div className="space-y-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Banco</p>
                                  <p className="font-bold">{w.bank_name}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Nro. de Cuenta</p>
                                  <p className="font-mono font-bold">{w.account_number ? `····${w.account_number.slice(-4)}` : "—"}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-muted-foreground">Tipo</p>
                                    <p className="font-medium capitalize">{w.account_type}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Cédula/RIF</p>
                                    <p className="font-mono font-medium">{w.identity_document || "—"}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-warning p-2 bg-warning/5 border border-warning/20 rounded-sm">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>Este dealer no tiene datos bancarios registrados</span>
                              </div>
                            )}
                          </div>

                          {/* Action card */}
                          <div className="bg-card border border-border rounded-sm p-3 space-y-3">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <CreditCard className="h-3 w-3" /> Gestionar Pago
                            </p>

                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Monto solicitado</p>
                              <p className="text-xl font-heading font-bold text-primary">${w.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-medium text-muted-foreground">Nota interna (opcional)</label>
                              <Textarea
                                placeholder="Ej: Transferencia enviada el 20/02/2026..."
                                rows={2}
                                className="rounded-sm text-xs"
                                value={expanded === w.id ? adminNote : ""}
                                onChange={(e) => setAdminNote(e.target.value)}
                              />
                            </div>

                            <div className="space-y-2">
                              {w.status !== "in_review" && w.status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full rounded-sm text-xs h-8 border-primary/30 text-primary hover:bg-primary/5"
                                  disabled={processing === w.id}
                                  onClick={() => handleStatusChange(w.id, "in_review")}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                  Marcar En Revisión
                                </Button>
                              )}
                              {w.status !== "paid" && (
                                <Button
                                  size="sm"
                                  className="w-full rounded-sm text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                                  disabled={processing === w.id}
                                  onClick={() => handleStatusChange(w.id, "paid")}
                                >
                                  {processing === w.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle className="h-3.5 w-3.5 mr-1.5" />}
                                  Marcar como Pagado
                                </Button>
                              )}
                              {w.status !== "pending" && w.status !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full rounded-sm text-xs h-8 text-muted-foreground"
                                  disabled={processing === w.id}
                                  onClick={() => handleStatusChange(w.id, "pending")}
                                >
                                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                                  Devolver a Pendiente
                                </Button>
                              )}
                              {w.status !== "rejected" && w.status !== "paid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full rounded-sm text-xs h-8 border-destructive/30 text-destructive hover:bg-destructive/5"
                                  disabled={processing === w.id}
                                  onClick={() => handleStatusChange(w.id, "rejected")}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                  Rechazar Solicitud
                                </Button>
                              )}
                            </div>

                            {w.admin_notes && (
                              <div className="bg-secondary/50 border border-border rounded-sm p-2">
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase">Nota anterior:</p>
                                <p className="text-xs mt-0.5">{w.admin_notes}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer with request ID */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
                          <span>ID Solicitud: <span className="font-mono">{w.id}</span></span>
                          {w.processed_at && (
                            <span>Procesado: {formatDate(w.processed_at)}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer count */}
        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Mostrando {filtered.length} de {withdrawals.length} solicitudes
          </p>
        )}
      </div>
    </div>
  );
};

export default DealerPayments;
