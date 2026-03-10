import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CreditCard, Eye, CheckCircle, XCircle, Loader2, Download,
  Search, Clock, DollarSign, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, ChevronsUpDown, AlertTriangle,
  Calendar, User, FileText, Bell, Mail, ArrowUpDown,
  Image as ImageIcon, Package, ExternalLink
} from "lucide-react";

interface Props {
  paymentProofs: any[];
  fetchAllData: () => Promise<void>;
  globalSearch?: string;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type SortField = "date" | "amount" | "status" | "buyer";
type SortDir = "asc" | "desc";

const AdminPaymentsTab = ({ paymentProofs, fetchAllData, globalSearch = "" }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // States
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Notification states
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);

  // Sync global search
  useEffect(() => { if (globalSearch) setSearch(globalSearch); }, [globalSearch]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = paymentProofs;
    const pending = all.filter((p: any) => p.status === "pending");
    const approved = all.filter((p: any) => p.status === "approved");
    const rejected = all.filter((p: any) => p.status === "rejected");
    return {
      total: all.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      totalUsd: approved.reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0),
      pendingUsd: pending.reduce((sum: number, p: any) => sum + Number(p.amount_usd || 0), 0),
    };
  }, [paymentProofs]);

  // ── Filtered & Sorted ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let data = [...paymentProofs];

    // Status filter
    if (statusFilter !== "all") data = data.filter((p: any) => p.status === statusFilter);

    // Search
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((p: any) =>
        (p.auction_title || "").toLowerCase().includes(s) ||
        (p.buyer_name || "").toLowerCase().includes(s) ||
        (p.reference_number || "").toLowerCase().includes(s) ||
        (p.operation_number || "").toLowerCase().includes(s)
      );
    }

    // Date range
    if (dateFrom) data = data.filter((p: any) => new Date(p.created_at) >= new Date(dateFrom));
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      data = data.filter((p: any) => new Date(p.created_at) <= to);
    }

    // Sort
    data.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "amount": cmp = Number(a.amount_usd || 0) - Number(b.amount_usd || 0); break;
        case "status": cmp = (a.status || "").localeCompare(b.status || ""); break;
        case "buyer": cmp = (a.buyer_name || "").localeCompare(b.buyer_name || ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [paymentProofs, statusFilter, search, dateFrom, dateTo, sortField, sortDir]);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, search, dateFrom, dateTo]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleCard = (id: string) =>
    setExpandedCards(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const toggleAllCards = () => {
    if (expandedCards.size > 0) setExpandedCards(new Set());
    else setExpandedCards(new Set(paginated.map((p: any) => p.id)));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const getSignedUrl = async (proofUrl: string): Promise<string | null> => {
    let filePath = proofUrl;
    if (proofUrl.startsWith("http")) {
      const marker = "/object/public/payment-proofs/";
      const idx = proofUrl.indexOf(marker);
      if (idx !== -1) {
        filePath = proofUrl.substring(idx + marker.length);
      } else {
        const signedMarker = "/object/sign/payment-proofs/";
        const sIdx = proofUrl.indexOf(signedMarker);
        if (sIdx !== -1) filePath = proofUrl.substring(sIdx + signedMarker.length).split("?")[0];
      }
    }
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(filePath, 864000);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const handleViewProof = async (proofUrl: string) => {
    setProofLoading(true);
    const url = await getSignedUrl(proofUrl);
    if (url) setProofImagePreview(url);
    else toast({ title: "Error al cargar comprobante", variant: "destructive" });
    setProofLoading(false);
  };

  const handleDownloadProof = async (proofUrl: string, reference: string) => {
    const url = await getSignedUrl(proofUrl);
    if (url) { const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.download = `comprobante-${reference}`; a.click(); }
    else toast({ title: "Error al descargar comprobante", variant: "destructive" });
  };

  const handlePaymentAction = async (proofId: string, auctionId: string, buyerUserId: string, auctionTitle: string, imageUrl: string | null, action: "approved" | "rejected") => {
    setProcessingPayment(proofId);
    const { error } = await supabase.from("payment_proofs").update({
      status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", proofId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (action === "approved") {
        supabase.functions.invoke("notify-payment-approved", {
          body: { buyerUserId, auctionTitle, auctionId, imageUrl },
        }).catch(() => { });
        toast({ title: "✅ Pago aprobado — Comprador notificado" });
      } else {
        toast({ title: "❌ Pago rechazado" });
      }
      fetchAllData();
    }
    setProcessingPayment(null);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; class: string; icon: any }> = {
      pending: { label: "Pendiente", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Clock },
      approved: { label: "Aprobado", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle },
      rejected: { label: "Rechazado", class: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: XCircle },
    };
    const s = map[status] || { label: status, class: "bg-muted text-muted-foreground border-border", icon: Clock };
    const Icon = s.icon;
    return <Badge variant="outline" className={`text-[10px] gap-1 font-bold ${s.class}`}><Icon className="h-3 w-3" />{s.label}</Badge>;
  };

  const hasFilters = search || statusFilter !== "all" || dateFrom || dateTo;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary dark:text-accent" /> Gestión de Cobros
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.total} comprobantes · ${stats.totalUsd.toLocaleString("es-MX")} aprobados · {stats.pending} pendientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.pending > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse font-bold">
              <AlertTriangle className="h-3 w-3 mr-1" />{stats.pending} por verificar
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Total", value: stats.total, icon: FileText, color: "text-primary dark:text-accent", bg: "bg-primary/5 dark:bg-accent/5", filter: "all" as StatusFilter },
          { label: "Pendientes", value: stats.pending, sub: stats.pendingUsd > 0 ? `$${stats.pendingUsd.toLocaleString("es-MX")}` : undefined, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5", filter: "pending" as StatusFilter },
          { label: "Aprobados", value: stats.approved, sub: `$${stats.totalUsd.toLocaleString("es-MX")}`, icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5", filter: "approved" as StatusFilter },
          { label: "Rechazados", value: stats.rejected, icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/5", filter: "rejected" as StatusFilter },
        ].map((s, i) => (
          <div
            key={i}
            className={`${s.bg} rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all ${statusFilter === s.filter ? "ring-2 ring-primary/20" : ""}`}
            onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)}
          >
            <s.icon className={`h-4 w-4 ${s.color} mb-1.5`} />
            <p className="text-lg font-heading font-bold leading-tight">{s.value}</p>
            {s.sub && <p className="text-[10px] text-muted-foreground font-mono">{s.sub}</p>}
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ═══ Filters Bar ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, comprador, referencia..."
            className="pl-9 h-9 text-xs bg-secondary/30 border-border rounded-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px] h-9 text-xs rounded-sm">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs rounded-sm w-[130px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs rounded-sm w-[130px]" />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setSearch(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm gap-1.5" onClick={toggleAllCards}>
          <ChevronsUpDown className="h-3.5 w-3.5" /> {expandedCards.size > 0 ? "Colapsar" : "Expandir"}
        </Button>
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-[85px] h-8 text-xs rounded-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}/pág</SelectItem>)}
          </SelectContent>
        </Select>
        {/* Sort buttons */}
        <div className="flex items-center gap-0.5 ml-auto">
          {([
            { field: "date" as SortField, label: "Fecha", icon: Calendar },
            { field: "amount" as SortField, label: "Monto", icon: DollarSign },
            { field: "buyer" as SortField, label: "Comprador", icon: User },
          ]).map(s => (
            <Button key={s.field} variant={sortField === s.field ? "secondary" : "ghost"} size="sm" className="h-8 text-[10px] rounded-sm px-2 gap-1" onClick={() => toggleSort(s.field)}>
              <s.icon className="h-3 w-3" />{s.label}
              {sortField === s.field && <ArrowUpDown className="h-2.5 w-2.5" />}
            </Button>
          ))}
        </div>
      </div>

      {/* ═══ Payment Cards ═══ */}
      {filtered.length === 0 ? (
        <Card className="border border-border rounded-sm">
          <CardContent className="p-12 text-center">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              {hasFilters ? "No hay pagos que coincidan con los filtros" : "No hay comprobantes registrados"}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {hasFilters ? "Intenta cambiar los filtros de búsqueda" : "Los comprobantes aparecerán aquí cuando los compradores suban sus pagos"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginated.map((proof: any) => {
            const isExpanded = expandedCards.has(proof.id);
            const isPending = proof.status === "pending";

            return (
              <Card key={proof.id} className={`border rounded-sm overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm ${isPending ? "border-amber-500/20 bg-amber-500/[0.02]" : ""}`}>
                <CardContent className="p-0">
                  {/* Row Header */}
                  <div className="flex items-center gap-0 cursor-pointer" onClick={() => toggleCard(proof.id)}>
                    {/* Status indicator */}
                    <div className={`w-1 self-stretch shrink-0 ${isPending ? "bg-amber-500" : proof.status === "approved" ? "bg-emerald-500" : "bg-red-500"}`} />

                    {/* Auction thumbnail in row */}
                    {proof.image_url ? (
                      <img src={proof.image_url} alt={proof.auction_title} className="w-12 h-12 sm:w-14 sm:h-14 object-cover shrink-0 ml-3 rounded-lg border border-border/50" />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 bg-secondary/50 flex items-center justify-center shrink-0 ml-3 rounded-lg border border-border/50">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-heading font-bold text-sm truncate max-w-[250px]">{proof.auction_title}</h4>
                        {proof.reference_number && (
                          <span className="font-mono text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{proof.reference_number}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{proof.buyer_name || "—"}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(proof.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(proof.created_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>

                    {/* Right side — amounts + status + actions */}
                    <div className="flex items-center gap-3 px-4 shrink-0">
                      <div className="text-right">
                        <p className="font-heading font-bold text-sm">${Number(proof.amount_usd).toLocaleString("es-MX")}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Bs. {Number(proof.amount_bs).toLocaleString("es-VE")}</p>
                      </div>
                      <div className="hidden sm:block">{statusBadge(proof.status)}</div>

                      {/* Inline actions for pending */}
                      {isPending && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon"
                            className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm"
                            disabled={processingPayment === proof.id}
                            title="Aprobar pago"
                            onClick={() => handlePaymentAction(proof.id, proof.auction_id, proof.buyer_id, proof.auction_title, proof.image_url || null, "approved")}
                          >
                            {processingPayment === proof.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 text-red-500 border-red-500/30 hover:bg-red-500/10 rounded-sm"
                            disabled={processingPayment === proof.id}
                            title="Rechazar pago"
                            onClick={() => handlePaymentAction(proof.id, proof.auction_id, proof.buyer_id, proof.auction_title, proof.image_url || null, "rejected")}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}

                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 bg-secondary/10 space-y-3">
                      {/* ── Product Preview ── */}
                      <div className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">
                        {proof.image_url ? (
                          <img src={proof.image_url} alt={proof.auction_title} className="w-20 h-20 rounded-lg object-cover border border-border/50 shrink-0" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 border border-border/50">
                            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Package className="h-3 w-3" /> Producto Asociado</p>
                          <h5 className="text-sm font-heading font-bold text-foreground truncate">{proof.auction_title}</h5>
                          {proof.dealer_name && (
                            <p className="text-[10px] text-muted-foreground">Vendedor: <span className="font-medium text-foreground/70">{proof.dealer_name}</span></p>
                          )}
                          <div className="flex items-center gap-3 text-xs">
                            {proof.starting_price > 0 && (
                              <span className="text-muted-foreground">Inicio: <span className="font-mono">${Number(proof.starting_price).toLocaleString("es-MX")}</span></span>
                            )}
                            {proof.current_price > 0 && (
                              <span className="text-primary dark:text-[#A6E300] font-bold">Ganada: <span className="font-mono">${Number(proof.current_price).toLocaleString("es-MX")}</span></span>
                            )}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm gap-1.5 shrink-0" onClick={() => window.open(`/auction/${proof.auction_id}`, "_blank")}>
                          <ExternalLink className="h-3 w-3" /> Ver
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Payment Info */}
                        <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Datos del Pago</p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Monto USD:</span>
                              <span className="font-bold">${Number(proof.amount_usd).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Monto Bs:</span>
                              <span className="font-mono">Bs. {Number(proof.amount_bs).toLocaleString("es-VE")}</span>
                            </div>
                            {proof.reference_number && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Referencia:</span>
                                <span className="font-mono font-bold">{proof.reference_number}</span>
                              </div>
                            )}
                            {proof.operation_number && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Operación:</span>
                                <span className="font-mono">{proof.operation_number}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Fecha:</span>
                              <span>{new Date(proof.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Estado:</span>
                              {statusBadge(proof.status)}
                            </div>
                            {proof.reviewed_at && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Revisado:</span>
                                <span>{new Date(proof.reviewed_at).toLocaleDateString("es-VE")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Comprobante */}
                        <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comprobante</p>
                          <div className="flex flex-col gap-1.5">
                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm justify-start gap-2 w-full" onClick={() => handleViewProof(proof.proof_url)} disabled={proofLoading}>
                              {proofLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Ver comprobante
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm justify-start gap-2 w-full" onClick={() => handleDownloadProof(proof.proof_url, proof.reference_number || proof.id)}>
                              <Download className="h-3.5 w-3.5" /> Descargar
                            </Button>
                          </div>
                          {/* Actions for pending */}
                          {isPending && (
                            <div className="border-t border-border pt-2 mt-2 flex gap-1.5">
                              <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs h-8 gap-1"
                                disabled={processingPayment === proof.id}
                                onClick={() => handlePaymentAction(proof.id, proof.auction_id, proof.buyer_id, proof.auction_title, proof.image_url || null, "approved")}
                              >
                                {processingPayment === proof.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                Aprobar
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 text-red-500 border-red-500/30 rounded-sm text-xs h-8 gap-1"
                                disabled={processingPayment === proof.id}
                                onClick={() => handlePaymentAction(proof.id, proof.auction_id, proof.buyer_id, proof.auction_title, proof.image_url || null, "rejected")}
                              >
                                <XCircle className="h-3.5 w-3.5" /> Rechazar
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Recordatorios */}
                        <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Acciones</p>
                          <div className="flex flex-col gap-1.5">
                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm justify-start gap-2 w-full" onClick={() => window.open(`/auction/${proof.auction_id}`, "_blank")}>
                              <Eye className="h-3.5 w-3.5" /> Ver subasta
                            </Button>
                            {isPending && proof.buyer_id && (
                              <>
                                <Button
                                  size="sm" variant="outline"
                                  className="text-xs h-8 rounded-sm justify-start gap-2 w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                  disabled={sendingReminder === proof.id}
                                  onClick={async () => {
                                    setSendingReminder(proof.id);
                                    try {
                                      const { data, error } = await supabase.functions.invoke("notify-payment-reminder", {
                                        body: {
                                          email: proof.buyer_email || null,
                                          name: proof.buyer_name,
                                          auctionTitle: proof.auction_title,
                                          auctionId: proof.auction_id,
                                          winningBid: proof.amount_usd,
                                          imageUrl: proof.image_url || null,
                                          userId: proof.buyer_id,
                                          operationNumber: proof.operation_number || null,
                                        },
                                      });
                                      if (error || data?.error) toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
                                      else toast({ title: "📧 Recordatorio de pago enviado" });
                                    } catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }); }
                                    setSendingReminder(null);
                                  }}
                                >
                                  {sendingReminder === proof.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                                  Recordar por correo
                                </Button>
                                <Button
                                  size="sm" variant="outline"
                                  className="text-xs h-8 rounded-sm justify-start gap-2 w-full border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                                  disabled={sendingNotification === proof.id}
                                  onClick={async () => {
                                    setSendingNotification(proof.id);
                                    try {
                                      const amount = `$${Number(proof.amount_usd).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
                                      const { data, error } = await supabase.functions.invoke("notify-push", {
                                        body: {
                                          user_id: proof.buyer_id,
                                          title: `⚠️ Pago pendiente: "${proof.auction_title}"`,
                                          message: `Hola ${proof.buyer_name}, recuerda completar tu pago de ${amount}. Sube tu comprobante en la plataforma.`,
                                          type: "payment_reminder",
                                          link: `/auction/${proof.auction_id}`,
                                        },
                                      });
                                      if (error || data?.error) toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
                                      else toast({ title: "🔔 Notificación enviada" });
                                    } catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }); }
                                    setSendingNotification(null);
                                  }}
                                >
                                  {sendingNotification === proof.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                                  Recordar por notificación
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══ Pagination ═══ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i + 1;
              else if (safePage <= 4) p = i + 1;
              else if (safePage >= totalPages - 3) p = totalPages - 6 + i;
              else p = safePage - 3 + i;
              return (
                <Button key={p} variant={p === safePage ? "default" : "outline"} size="sm" className="h-8 w-8 text-xs rounded-sm p-0" onClick={() => setPage(p)}>
                  {p}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
              Siguiente <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══ Proof Preview Dialog ═══ */}
      <Dialog open={!!proofImagePreview} onOpenChange={(open) => { if (!open) setProofImagePreview(null); }}>
        <DialogContent className="max-w-3xl p-2 bg-card">
          <DialogHeader><DialogTitle className="text-sm font-heading">Comprobante de Pago</DialogTitle></DialogHeader>
          {proofImagePreview && (
            <div className="flex items-center justify-center p-2">
              <img src={proofImagePreview} alt="Comprobante" className="max-h-[70vh] w-auto rounded-md object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentsTab;
