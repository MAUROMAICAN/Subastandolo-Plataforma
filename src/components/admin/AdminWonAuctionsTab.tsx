import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Search, Eye, Download, Calendar, Package,
  DollarSign, Truck, CreditCard, Clock, CheckCircle,
  Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  User, MapPin, Phone, FileText, Mail, MessageSquare,
  ChevronsUpDown, XCircle, Bell, AlertCircle,
  Image as ImageIcon, ExternalLink
} from "lucide-react";
import type { AuctionExtended, WinnerInfo } from "./types";

interface Props {
  auctions: AuctionExtended[];
  winnerProfiles: Record<string, WinnerInfo>;
  dealerProfiles: Record<string, WinnerInfo>;
  fetchAllData: () => void;
  globalSearch: string;
}

type SortField = "end_time" | "current_price" | "title";
type SortDir = "asc" | "desc";

const AdminWonAuctionsTab = ({ auctions, winnerProfiles, dealerProfiles, fetchAllData, globalSearch }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");

  useEffect(() => { if (globalSearch) setSearch(globalSearch); }, [globalSearch]);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("end_time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination & expand
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activePanel, setActivePanel] = useState<"attention" | "process" | "noBid">("attention");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Detail modal
  const [selectedAuction, setSelectedAuction] = useState<AuctionExtended | null>(null);
  const [shippingInfo, setShippingInfo] = useState<any>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [sendingShipReminder, setSendingShipReminder] = useState<string | null>(null);
  const [sendingShipNotification, setSendingShipNotification] = useState<string | null>(null);

  // Show ONLY auctions that are CONFIRMED finalized WITH a winner.
  // NEVER show active or expired-but-not-finalized auctions here — they cause ghost entries.
  // The auto-repair in Admin.tsx will formalize them on next load.
  const wonAuctions = useMemo(() =>
    auctions.filter(a => !!a.winner_id && a.status === "finalized")
  , [auctions]);

  // Auctions that were finalized WITHOUT any bids (truly expired with no participants)
  const noBidAuctions = useMemo(() =>
    auctions.filter(a =>
      !a.winner_id && a.bids_count === 0 && a.status === "finalized"
    )
  , [auctions]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let list = [...wonAuctions];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.operation_number?.toLowerCase().includes(q) ||
        winnerProfiles[a.winner_id!]?.full_name?.toLowerCase().includes(q) ||
        dealerProfiles[a.created_by]?.full_name?.toLowerCase().includes(q)
      );
    }
    if (paymentFilter !== "all") {
      if (paymentFilter === "verified") {
        list = list.filter(a => a.payment_status === "verified" || a.payment_status === "released");
      } else {
        list = list.filter(a => a.payment_status === paymentFilter);
      }
    }
    if (deliveryFilter !== "all") list = list.filter(a => a.delivery_status === deliveryFilter);
    if (dateFrom) list = list.filter(a => new Date(a.end_time) >= new Date(dateFrom));
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59); list = list.filter(a => new Date(a.end_time) <= to); }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "end_time") cmp = new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
      else if (sortField === "current_price") cmp = a.current_price - b.current_price;
      else cmp = a.title.localeCompare(b.title);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [wonAuctions, search, paymentFilter, deliveryFilter, dateFrom, dateTo, sortField, sortDir, winnerProfiles, dealerProfiles]);

  const attentionList = useMemo(() => filtered.filter(a => a.payment_status === "pending" || a.payment_status === "under_review"), [filtered]);
  const processList = useMemo(() => filtered.filter(a => a.payment_status !== "pending" && a.payment_status !== "under_review"), [filtered]);
  const activeList = activePanel === "noBid" ? noBidAuctions : activePanel === "attention" ? attentionList : processList;

  useMemo(() => { setPage(1); }, [search, paymentFilter, deliveryFilter, dateFrom, dateTo, activePanel]);

  const totalPages = Math.max(1, Math.ceil(activeList.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = activeList.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Stats
  const stats = useMemo(() => {
    const total = wonAuctions.length;
    const totalRevenue = wonAuctions.reduce((s, a) => s + a.current_price, 0);
    const pendingPayment = wonAuctions.filter(a => a.payment_status === "pending").length;
    const underReview = wonAuctions.filter(a => a.payment_status === "under_review").length;
    const verified = wonAuctions.filter(a => a.payment_status === "verified" || a.payment_status === "released").length;
    const delivered = wonAuctions.filter(a => a.delivery_status === "delivered").length;
    const shipped = wonAuctions.filter(a => a.delivery_status === "shipped" || a.delivery_status === "in_transit").length;
    return { total, totalRevenue, pendingPayment, underReview, verified, delivered, shipped };
  }, [wonAuctions]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleAllCards = () => {
    if (expandedCards.size >= paginated.length) setExpandedCards(new Set());
    else setExpandedCards(new Set(paginated.map(a => a.id)));
  };

  const openDetail = async (auction: AuctionExtended) => {
    setSelectedAuction(auction);
    setLoadingDetail(true);
    setShippingInfo(null);
    setProofUrl(null);
    const [shipRes, proofRes] = await Promise.all([
      supabase.from("shipping_info").select("*").eq("auction_id", auction.id).maybeSingle(),
      supabase.from("payment_proofs").select("*").eq("auction_id", auction.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setShippingInfo(shipRes.data);
    if (proofRes.data?.proof_url) {
      const url = proofRes.data.proof_url;
      if (url.startsWith("http")) setProofUrl(url);
      else { const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(url, 864000); setProofUrl(data?.signedUrl || null); }
    }
    setLoadingDetail(false);
  };

  const paymentLabel = (status: string) => {
    const map: Record<string, { label: string; class: string; icon: any }> = {
      pending: { label: "Pendiente", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Clock },
      under_review: { label: "En Revisión", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: Search },
      verified: { label: "Verificado", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle },
      released: { label: "Liberado", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle },
      refunded: { label: "Reembolsado", class: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
    };
    return map[status] || { label: status, class: "bg-muted text-muted-foreground border-border", icon: Clock };
  };

  const deliveryLabel = (status: string) => {
    const map: Record<string, { label: string; class: string; icon: any }> = {
      pending: { label: "Pendiente", class: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20", icon: Package },
      ready_to_ship: { label: "Listo", class: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: Package },
      shipped: { label: "Enviado", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Truck },
      in_transit: { label: "En Tránsito", class: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Truck },
      delivered: { label: "Entregado", class: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle },
      returned: { label: "Devuelto", class: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
    };
    return map[status] || { label: status, class: "bg-muted text-muted-foreground border-border", icon: Package };
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const hasFilters = search || paymentFilter !== "all" || deliveryFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-4">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary dark:text-accent" /> Subastas Ganadas
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.total} ganadas · ${stats.totalRevenue.toLocaleString("es-MX")} ingresos · {stats.pendingPayment} pago pendiente · {stats.underReview} en revisión · {stats.delivered} entregadas · {noBidAuctions.length} sin pujas
          </p>
        </div>
        <Badge variant="outline" className="text-xs self-start sm:self-auto shrink-0 font-mono">
          {activeList.length} resultado{activeList.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {[
          { label: "Total", value: stats.total, icon: Trophy, color: "text-primary dark:text-accent", bg: "bg-primary/5 dark:bg-accent/5", action: () => { setPaymentFilter("all"); setDeliveryFilter("all"); } },
          { label: "Ingresos", value: `$${stats.totalRevenue.toLocaleString("es-MX")}`, icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5", action: () => { setPaymentFilter("all"); setDeliveryFilter("all"); } },
          { label: "Pago Pend.", value: stats.pendingPayment, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5", action: () => { setActivePanel("attention"); setPaymentFilter("pending"); setDeliveryFilter("all"); } },
          { label: "En Revisión", value: stats.underReview, icon: Search, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/5", action: () => { setActivePanel("attention"); setPaymentFilter("under_review"); setDeliveryFilter("all"); } },
          { label: "Verificados", value: stats.verified, icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5", action: () => { setActivePanel("process"); setPaymentFilter("verified"); setDeliveryFilter("all"); } },
          { label: "Enviados", value: stats.shipped, icon: Truck, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/5", action: () => { setActivePanel("process"); setDeliveryFilter("shipped"); setPaymentFilter("all"); } },
          { label: "Entregados", value: stats.delivered, icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5", action: () => { setActivePanel("process"); setDeliveryFilter("delivered"); setPaymentFilter("all"); } },
        ].map((s, i) => (
          <div
            key={i}
            className={`${s.bg} rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all`}
            onClick={s.action}
          >
            <s.icon className={`h-4 w-4 ${s.color} mb-1.5`} />
            <p className="text-lg font-heading font-bold leading-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ═══ Search + Filters Bar ═══ */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, Nº operación, ganador, dealer..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 rounded-sm text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[140px] rounded-sm text-xs">
                <SelectValue placeholder="Pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los pagos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="under_review">En revisión</SelectItem>
                <SelectItem value="verified">Verificado</SelectItem>
                <SelectItem value="released">Liberado</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deliveryFilter} onValueChange={v => { setDeliveryFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-[140px] rounded-sm text-xs">
                <SelectValue placeholder="Envío" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los envíos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="ready_to_ship">Listo</SelectItem>
                <SelectItem value="shipped">Enviado</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[155px] rounded-sm text-xs" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[155px] rounded-sm text-xs" />
          </div>
        </div>
        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm gap-1.5" onClick={toggleAllCards}>
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {expandedCards.size >= paginated.length ? "Colapsar" : "Expandir"}
            </Button>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="flex h-8 rounded-sm border border-input bg-background px-2 py-1 text-xs">
              <option value={25}>25/pág</option>
              <option value={50}>50/pág</option>
              <option value={100}>100/pág</option>
            </select>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => toggleSort("current_price")}>
                <DollarSign className="h-3 w-3" /> Precio {sortField === "current_price" && (sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => toggleSort("end_time")}>
                <Calendar className="h-3 w-3" /> Fecha {sortField === "end_time" && (sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
              </Button>
            </div>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setSearch(""); setPaymentFilter("all"); setDeliveryFilter("all"); setDateFrom(""); setDateTo(""); }}>
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Panel Tabs ═══ */}
      <div className="flex items-center gap-1.5 bg-secondary/30 p-1.5 rounded-lg border border-border">
        <button onClick={() => { setActivePanel("attention"); setPage(1); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activePanel === "attention" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">Requiere Atención</span>
          <span className="sm:hidden">Pendientes</span>
          <Badge variant="outline" className={`ml-1 text-[10px] ${activePanel === "attention" ? "border-amber-500/30 text-amber-600 dark:text-amber-400" : ""}`}>{attentionList.length}</Badge>
        </button>
        <button onClick={() => { setActivePanel("process"); setPage(1); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activePanel === "process" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
          <CheckCircle className="h-4 w-4" />
          <span className="hidden sm:inline">En Proceso / Completadas</span>
          <span className="sm:hidden">Procesadas</span>
          <Badge variant="outline" className={`ml-1 text-[10px] ${activePanel === "process" ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : ""}`}>{processList.length}</Badge>
        </button>
        <button onClick={() => { setActivePanel("noBid"); setPage(1); }} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${activePanel === "noBid" ? "bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
          <AlertCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Sin Pujas</span>
          <span className="sm:hidden">Sin Pujas</span>
          <Badge variant="outline" className={`ml-1 text-[10px] ${activePanel === "noBid" ? "border-slate-500/30 text-slate-600 dark:text-slate-300" : ""}`}>{noBidAuctions.length}</Badge>
        </button>
      </div>

      {/* ═══ No-Bid Auctions Panel ═══ */}
      {activePanel === "noBid" ? (
        noBidAuctions.length === 0 ? (
          <Card className="border border-border rounded-sm">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay subastas finalizadas sin pujas.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Las subastas que terminen sin recibir ofertas aparecerán aquí.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {noBidAuctions.slice((safePage - 1) * pageSize, safePage * pageSize).map((a) => {
              const dealer = dealerProfiles[a.created_by];
              const mainImage = a.images?.[0]?.image_url || a.image_url;
              const isExpanded = expandedCards.has(a.id);
              return (
                <Card key={a.id} className="border rounded-sm overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-0 cursor-pointer" onClick={() => toggleCard(a.id)}>
                      {/* Color bar */}
                      <div className="w-1 self-stretch shrink-0 bg-slate-500" />
                      {/* Thumbnail */}
                      {mainImage ? (
                        <img src={mainImage} alt={a.title} className="w-14 h-14 sm:w-16 sm:h-16 object-cover shrink-0 ml-3 rounded-lg border border-border/50" />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-secondary/50 flex items-center justify-center shrink-0 ml-3 rounded-lg border border-border/50">
                          <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 px-4 py-3">
                        <h4 className="font-heading font-bold text-sm truncate">{a.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{dealer?.full_name || "Dealer"}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(a.end_time).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />Inicio: ${a.starting_price?.toLocaleString("es-MX") || "0"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-4 shrink-0">
                        <Badge variant="outline" className="text-[10px] gap-1 bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20">
                          <AlertCircle className="h-3 w-3" /> Sin pujas
                        </Badge>
                        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" title="Ver subasta" onClick={() => navigate(`/auction/${a.id}`)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-secondary/10">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Dealer info */}
                          <div className="flex items-start gap-3 bg-card rounded-lg border border-border p-3">
                            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Dealer (Vendedor)</p>
                              <p className="text-sm font-bold truncate">{dealer?.full_name || "—"}</p>
                              {dealer?.phone && <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1"><Phone className="h-3 w-3" />{dealer.phone}</p>}
                              {dealer?.email && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{dealer.email}</p>}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {dealer?.phone && (
                                  <Button size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => {
                                      let phone = dealer.phone!.replace(/\D/g, '');
                                      if (phone.startsWith('0')) phone = phone.slice(1);
                                      const msg = encodeURIComponent(`Hola ${dealer.full_name}, te escribimos de Subastandolo respecto a la subasta "${a.title}" que finalizó sin pujas.`);
                                      window.open(`https://wa.me/58${phone}?text=${msg}`, '_blank');
                                    }}
                                  >
                                    <MessageSquare className="h-3 w-3" /> WhatsApp
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Auction details */}
                          <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Detalles</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Precio inicial:</span>
                                <span className="font-bold font-mono">${a.starting_price?.toLocaleString("es-MX") || "0"}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Finalización:</span>
                                <span>{new Date(a.end_time).toLocaleString("es-VE")}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Estado:</span>
                                <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-500 border-slate-500/20">Finalizada sin pujas</Badge>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm justify-start gap-2 w-full mt-2" onClick={() => navigate(`/auction/${a.id}`)}>
                              <ExternalLink className="h-3.5 w-3.5" /> Ver subasta
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (

        /* ═══ Won Auction Cards (existing panels) ═══ */
        activeList.length === 0 ? (
          <Card className="border border-border rounded-sm">
            <CardContent className="p-12 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay subastas en esta sección que coincidan con los filtros.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {paginated.map((a) => {
              const winner = winnerProfiles[a.winner_id!];
              const ps = paymentLabel(a.payment_status);
              const ds = deliveryLabel(a.delivery_status);
              const isExpanded = expandedCards.has(a.id);
              const PayStatusIcon = ps.icon;
              const DelStatusIcon = ds.icon;

              return (
                <Card key={a.id} className="border rounded-sm overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm">
                  <CardContent className="p-0">
                    {/* Row Header — always visible */}
                    <div className="flex items-center gap-0 cursor-pointer" onClick={() => toggleCard(a.id)}>
                      {a.image_url && (
                        <img src={a.image_url} alt="" className="w-16 h-16 object-cover border-r border-border shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-heading font-bold text-sm truncate max-w-[200px]">{a.title}</h4>
                          {a.operation_number && <span className="font-mono text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{a.operation_number}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{winner?.full_name || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="flex items-center gap-1"><Package className="h-3 w-3" />{dealerProfiles[a.created_by]?.full_name || "—"}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(a.end_time).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}</span>
                        </div>
                      </div>
                      {/* Right side: price + badges + actions */}
                      <div className="flex items-center gap-3 px-4 shrink-0">
                        <p className="font-heading font-bold text-sm">${a.current_price.toLocaleString("es-MX")}</p>
                        <div className="hidden sm:flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${ps.class}`}>
                            <PayStatusIcon className="h-3 w-3" />{ps.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${ds.class}`}>
                            <DelStatusIcon className="h-3 w-3" />{ds.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" title="Ver detalle" onClick={() => openDetail(a)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" title="Ver subasta" onClick={() => navigate(`/auction/${a.id}`)}>
                            <Package className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-secondary/10">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Winner info */}
                          <div className="flex items-start gap-3 bg-card rounded-lg border border-border p-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-accent/10 flex items-center justify-center shrink-0">
                              <Trophy className="h-5 w-5 text-primary dark:text-accent" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Ganador (Comprador)</p>
                              <p className="text-sm font-bold truncate">{winner?.full_name || "—"}</p>
                              {winner?.phone && <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1"><Phone className="h-3 w-3" />{winner.phone}</p>}
                              {winner?.email && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{winner.email}</p>}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {winner?.phone && (
                                  <Button
                                    size="sm"
                                    className="text-[10px] h-7 px-2 rounded-sm gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => {
                                      let phone = winner.phone!.replace(/\D/g, '');
                                      if (phone.startsWith('0')) phone = phone.slice(1);
                                      const msg = encodeURIComponent(`Hola ${winner.full_name}, te escribimos de Subastandolo respecto a la subasta "${a.title}".`);
                                      window.open(`https://wa.me/58${phone}?text=${msg}`, '_blank');
                                    }}
                                  >
                                    <MessageSquare className="h-3 w-3" /> WhatsApp
                                  </Button>
                                )}
                                {winner?.email && (
                                  <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1"
                                    onClick={() => { const sub = encodeURIComponent(`Subasta "${a.title}" - Subastandolo`); window.open(`mailto:${winner.email}?subject=${sub}`, '_blank'); }}>
                                    <Mail className="h-3 w-3" /> Email
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Dealer info */}
                          {(() => {
                            const dealer = dealerProfiles[a.created_by];
                            return (
                              <div className="flex items-start gap-3 bg-card rounded-lg border border-border p-3">
                                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Dealer (Vendedor)</p>
                                  <p className="text-sm font-bold truncate">{dealer?.full_name || "—"}</p>
                                  {dealer?.phone && <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1"><Phone className="h-3 w-3" />{dealer.phone}</p>}
                                  {dealer?.email && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{dealer.email}</p>}
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    {dealer?.phone && (
                                      <Button
                                        size="sm"
                                        className="text-[10px] h-7 px-2 rounded-sm gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        onClick={() => {
                                          let phone = dealer.phone!.replace(/\D/g, '');
                                          if (phone.startsWith('0')) phone = phone.slice(1);
                                          const msg = encodeURIComponent(`Hola ${dealer.full_name}, te escribimos de Subastandolo respecto a la subasta "${a.title}".`);
                                          window.open(`https://wa.me/58${phone}?text=${msg}`, '_blank');
                                        }}
                                      >
                                        <MessageSquare className="h-3 w-3" /> WhatsApp
                                      </Button>
                                    )}
                                    {dealer?.email && (
                                      <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1"
                                        onClick={() => { const sub = encodeURIComponent(`Subasta "${a.title}" - Subastandolo`); window.open(`mailto:${dealer.email}?subject=${sub}`, '_blank'); }}>
                                        <Mail className="h-3 w-3" /> Email
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Status */}
                          <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estados</p>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Pago</span>
                                <Badge variant="outline" className={`text-[10px] gap-1 ${ps.class}`}><PayStatusIcon className="h-3 w-3" />{ps.label}</Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> Envío</span>
                                <Badge variant="outline" className={`text-[10px] gap-1 ${ds.class}`}><DelStatusIcon className="h-3 w-3" />{ds.label}</Badge>
                              </div>
                              {a.tracking_number && (
                                <p className="text-[10px] font-mono text-muted-foreground">Guía: {a.tracking_number}</p>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Acciones rápidas</p>
                            <div className="flex flex-col gap-1.5">
                              <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm justify-start gap-2 w-full" onClick={() => openDetail(a)}>
                                <Eye className="h-3.5 w-3.5" /> Ver detalle completo
                              </Button>
                              <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm justify-start gap-2 w-full" onClick={() => navigate(`/auction/${a.id}`)}>
                                <Package className="h-3.5 w-3.5" /> Ir a la subasta
                              </Button>

                            </div>
                          </div>
                          {/* ═══ Abandonment Warning (48h) ═══ */}
                          {a.payment_status === "pending" && a.winner_id && (() => {
                            const hoursSinceEnd = (Date.now() - new Date(a.end_time).getTime()) / (1000 * 60 * 60);
                            return hoursSinceEnd >= 48;
                          })() && (
                              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                  <div>
                                    <p className="text-xs font-bold text-red-500">⚠️ Abandono de Pago (+48h)</p>
                                    <p className="text-[10px] text-red-400/80">Han pasado más de 48 horas sin pago.</p>
                                  </div>
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="text-xs h-8 rounded-sm w-full gap-2"
                                  onClick={async () => {
                                    if (!confirm("¿Marcar esta subasta como ABANDONADA? Se notificará al comprador y al dealer.")) return;
                                    const { error } = await supabase.from("auctions").update({ payment_status: "abandoned" } as any).eq("id", a.id);
                                    if (error) {
                                      console.error("Error marking as abandoned:", error);
                                      toast({ title: "Error", description: error.message || "No se pudo marcar como abandonada", variant: "destructive" });
                                      return;
                                    }
                                    supabase.functions.invoke("notify-payment-abandoned", {
                                      body: { auctionId: a.id, auctionTitle: a.title, buyerId: a.winner_id, dealerId: a.created_by, finalPrice: a.current_price },
                                    }).catch(() => { });
                                    toast({ title: "Subasta marcada como abandonada", description: "Se notificó al comprador y al dealer." });
                                    fetchAllData();
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Marcar como Abandonada
                                </Button>
                              </div>
                            )}
                          {a.payment_status === "abandoned" && (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" /> ABANDONADA — Pago no recibido
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">El dealer puede republicar esta subasta desde su panel.</p>
                            </div>
                          )}
                          {/* ═══ Recordatorios ═══ */}
                          {((a.payment_status === "pending" || a.payment_status === "under_review") || (a.delivery_status === "pending" || a.delivery_status === "ready_to_ship")) && (
                            <div className="bg-card rounded-lg border border-border p-3 space-y-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">📧 Recordatorios</p>
                              <div className="flex flex-col gap-1.5">
                                {/* Payment reminder - to buyer */}
                                {(a.payment_status === "pending" || a.payment_status === "under_review") && winner?.email && (
                                  <div className="flex gap-1.5">
                                    <Button size="sm" variant="outline"
                                      className="flex-1 text-[10px] h-7 rounded-sm gap-1 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                                      disabled={sendingReminder === a.id}
                                      onClick={async () => {
                                        setSendingReminder(a.id);
                                        try {
                                          const { data, error } = await supabase.functions.invoke("notify-payment-reminder", {
                                            body: { email: winner.email, name: winner.full_name, auctionTitle: a.title, auctionId: a.id, winningBid: a.current_price, imageUrl: a.image_url || null, userId: a.winner_id, operationNumber: a.operation_number || null, auctionDate: new Date(a.end_time).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) },
                                          });
                                          if (error || data?.error) toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
                                          else toast({ title: "📧 Recordatorio de pago enviado", description: `A ${winner.email}` });
                                        } catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }); }
                                        setSendingReminder(null);
                                      }}
                                    >
                                      {sendingReminder === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                                      Pago (Correo)
                                    </Button>
                                    <Button size="sm" variant="outline"
                                      className="flex-1 text-[10px] h-7 rounded-sm gap-1 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                                      disabled={sendingNotification === a.id}
                                      onClick={async () => {
                                        setSendingNotification(a.id);
                                        try {
                                          const amount = `$${a.current_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
                                          const { data, error } = await supabase.functions.invoke("notify-push", {
                                            body: { user_id: a.winner_id, title: `⚠️ Pago pendiente: "${a.title}"`, message: `Hola ${winner.full_name}, recuerda completar tu pago de ${amount}. Sube tu comprobante en la plataforma.`, type: "payment_reminder", link: `/auction/${a.id}` },
                                          });
                                          if (error || data?.error) toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
                                          else toast({ title: "🔔 Notificación enviada", description: `A ${winner.full_name}` });
                                        } catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }); }
                                        setSendingNotification(null);
                                      }}
                                    >
                                      {sendingNotification === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                                      Pago (Push)
                                    </Button>
                                  </div>
                                )}
                                {/* Shipping reminder - to dealer */}
                                {(a.delivery_status === "pending" || a.delivery_status === "ready_to_ship") && (() => {
                                  const dealer = dealerProfiles[a.created_by];
                                  return dealer ? (
                                    <div className="flex gap-1.5">
                                      <Button size="sm" variant="outline"
                                        className="flex-1 text-[10px] h-7 rounded-sm gap-1 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                                        disabled={sendingShipReminder === a.id}
                                        onClick={async () => {
                                          setSendingShipReminder(a.id);
                                          try {
                                            if (!dealer.email) { toast({ title: "Dealer sin email", variant: "destructive" }); setSendingShipReminder(null); return; }
                                            // Fetch buyer's shipping info for this auction
                                            const { data: shipData } = await supabase
                                              .from("shipping_info")
                                              .select("full_name, cedula, phone, shipping_company, state, city, office_name")
                                              .eq("auction_id", a.id)
                                              .maybeSingle();
                                            const { data, error } = await supabase.functions.invoke("notify-shipping-reminder", {
                                              body: { email: dealer.email, name: dealer.full_name, auctionTitle: a.title, auctionId: a.id, winningBid: a.current_price, imageUrl: a.image_url || null, userId: a.created_by, operationNumber: a.operation_number || null, buyerName: winner?.full_name || "el comprador", shippingInfo: shipData || null },
                                            });
                                            if (error || data?.error) toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
                                            else toast({ title: "📧 Recordatorio de envío enviado", description: `A ${dealer.email}` });
                                          } catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }); }
                                          setSendingShipReminder(null);
                                        }}
                                      >
                                        {sendingShipReminder === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                                        Envío (Correo)
                                      </Button>
                                      <Button size="sm" variant="outline"
                                        className="flex-1 text-[10px] h-7 rounded-sm gap-1 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
                                        disabled={sendingShipNotification === a.id}
                                        onClick={async () => {
                                          setSendingShipNotification(a.id);
                                          try {
                                            const amount = `$${a.current_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
                                            const { data, error } = await supabase.functions.invoke("notify-push", {
                                              body: { user_id: a.created_by, title: `📦 Envío pendiente: "${a.title}"`, message: `Hola ${dealer.full_name}, ${winner?.full_name || "el comprador"} ya pagó ${amount}. Procede con el envío.`, type: "shipping_reminder", link: `/auction/${a.id}` },
                                            });
                                            if (error || data?.error) toast({ title: "Error", description: error?.message || data?.error, variant: "destructive" });
                                            else toast({ title: "🔔 Notificación enviada al dealer", description: `A ${dealer.full_name}` });
                                          } catch (err: any) { toast({ title: "Error", description: err?.message, variant: "destructive" }); }
                                          setSendingShipNotification(null);
                                        }}
                                      >
                                        {sendingShipNotification === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
                                        Envío (Push)
                                      </Button>
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))
      }
      {/* ═══ Pagination ═══ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, activeList.length)} de {activeList.length}
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

      {/* ═══ Detail Modal ═══ */}
      <Dialog open={!!selectedAuction} onOpenChange={(open) => { if (!open) setSelectedAuction(null); }}>
        <DialogContent className="max-w-2xl bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary dark:text-accent" />
              Detalle de Subasta Ganada
            </DialogTitle>
          </DialogHeader>
          {selectedAuction && (
            <div className="space-y-4">
              {loadingDetail && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary dark:text-accent" />
                </div>
              )}

              {/* Product info */}
              <div className="flex items-start gap-4 bg-secondary/20 rounded-lg p-4 border border-border">
                {selectedAuction.image_url && (
                  <img src={selectedAuction.image_url} alt={selectedAuction.title} className="w-20 h-20 rounded-lg object-cover border border-border" />
                )}
                <div className="flex-1 space-y-1">
                  <h3 className="font-heading font-bold text-sm">{selectedAuction.title}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">{selectedAuction.operation_number || "Sin Nº"}</p>
                  <p className="text-xl font-heading font-bold text-primary dark:text-accent">${selectedAuction.current_price.toLocaleString("es-MX")} USD</p>
                  <p className="text-[10px] text-muted-foreground">
                    Finalizada: {new Date(selectedAuction.end_time).toLocaleString("es-VE")}
                  </p>
                </div>
              </div>

              {/* Participants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-3 w-3 text-primary dark:text-accent" /></div> Ganador
                  </p>
                  <p className="text-sm font-bold">{winnerProfiles[selectedAuction.winner_id!]?.full_name || "Desconocido"}</p>
                  {winnerProfiles[selectedAuction.winner_id!]?.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{winnerProfiles[selectedAuction.winner_id!].phone}</p>
                  )}
                  {winnerProfiles[selectedAuction.winner_id!]?.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{winnerProfiles[selectedAuction.winner_id!].email}</p>
                  )}
                  <div className="flex items-center gap-1.5 pt-1">
                    {winnerProfiles[selectedAuction.winner_id!]?.phone && (
                      <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1 bg-emerald-600/10 text-emerald-600 border-emerald-600/30 hover:bg-emerald-600/20"
                        onClick={() => {
                          let phone = winnerProfiles[selectedAuction.winner_id!].phone!.replace(/\D/g, '');
                          if (phone.startsWith('0')) phone = phone.slice(1);
                          const msg = encodeURIComponent(`Hola ${winnerProfiles[selectedAuction.winner_id!].full_name}, te escribimos de Subastandolo respecto a la subasta "${selectedAuction.title}".`);
                          window.open(`https://wa.me/58${phone}?text=${msg}`, '_blank');
                        }}
                      >
                        <MessageSquare className="h-3 w-3" /> WhatsApp
                      </Button>
                    )}
                    {winnerProfiles[selectedAuction.winner_id!]?.email && (
                      <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1"
                        onClick={() => {
                          const subject = encodeURIComponent(`Subasta "${selectedAuction.title}" - Subastandolo`);
                          window.open(`mailto:${winnerProfiles[selectedAuction.winner_id!].email}?subject=${subject}`, '_blank');
                        }}
                      >
                        <Mail className="h-3 w-3" /> Email
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center"><Package className="h-3 w-3 text-primary dark:text-accent" /></div> Dealer
                  </p>
                  <p className="text-sm font-bold">{dealerProfiles[selectedAuction.created_by]?.full_name || "Desconocido"}</p>
                  {(() => {
                    const dealer = dealerProfiles[selectedAuction.created_by];
                    return (
                      <>
                        {dealer?.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{dealer.phone}</p>}
                        {dealer?.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" />{dealer.email}</p>}
                        <div className="flex items-center gap-1.5 pt-1">
                          {dealer?.phone && (
                            <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1 bg-emerald-600/10 text-emerald-600 border-emerald-600/30 hover:bg-emerald-600/20"
                              onClick={() => {
                                let phone = dealer.phone!.replace(/\D/g, '');
                                if (phone.startsWith('0')) phone = phone.slice(1);
                                const msg = encodeURIComponent(`Hola ${dealer.full_name}, te escribimos de Subastandolo respecto a la subasta "${selectedAuction.title}".`);
                                window.open(`https://wa.me/58${phone}?text=${msg}`, '_blank');
                              }}
                            >
                              <MessageSquare className="h-3 w-3" /> WhatsApp
                            </Button>
                          )}
                          {dealer?.email && (
                            <Button variant="outline" size="sm" className="text-[10px] h-7 px-2 rounded-sm gap-1"
                              onClick={() => { const sub = encodeURIComponent(`Subasta "${selectedAuction.title}" - Subastandolo`); window.open(`mailto:${dealer.email}?subject=${sub}`, '_blank'); }}
                            >
                              <Mail className="h-3 w-3" /> Email
                            </Button>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Estado de Pago
                  </p>
                  <Badge variant="outline" className={`text-xs gap-1 ${paymentLabel(selectedAuction.payment_status).class}`}>
                    {(() => { const I = paymentLabel(selectedAuction.payment_status).icon; return <I className="h-3.5 w-3.5" />; })()}
                    {paymentLabel(selectedAuction.payment_status).label}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" /> Estado de Envío
                  </p>
                  <Badge variant="outline" className={`text-xs gap-1 ${deliveryLabel(selectedAuction.delivery_status).class}`}>
                    {(() => { const I = deliveryLabel(selectedAuction.delivery_status).icon; return <I className="h-3.5 w-3.5" />; })()}
                    {deliveryLabel(selectedAuction.delivery_status).label}
                  </Badge>
                  {selectedAuction.tracking_number && (
                    <p className="text-xs font-mono text-foreground mt-1">Guía: {selectedAuction.tracking_number}</p>
                  )}
                </div>
              </div>

              {/* Shipping info */}
              {!loadingDetail && shippingInfo && (
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Datos de Envío
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span className="text-muted-foreground">Nombre: </span><span className="font-medium">{shippingInfo.full_name}</span></div>
                    <div><span className="text-muted-foreground">Cédula: </span><span className="font-mono font-medium">{shippingInfo.cedula}</span></div>
                    <div><span className="text-muted-foreground">Teléfono: </span><span className="font-medium">{shippingInfo.phone || "—"}</span></div>
                    <div><span className="text-muted-foreground">Empresa: </span><span className="font-medium">{shippingInfo.shipping_company}</span></div>
                    <div><span className="text-muted-foreground">Estado: </span><span className="font-medium">{shippingInfo.state}</span></div>
                    <div><span className="text-muted-foreground">Ciudad: </span><span className="font-medium">{shippingInfo.city}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Oficina: </span><span className="font-medium">{shippingInfo.office_name}</span></div>
                  </div>
                </div>
              )}

              {/* Payment proof */}
              {!loadingDetail && proofUrl && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Comprobante de Pago
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm" onClick={() => window.open(proofUrl, "_blank")}>
                      <Eye className="h-3 w-3 mr-1" /> Ver
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm" onClick={() => {
                      const a = document.createElement("a"); a.href = proofUrl; a.target = "_blank";
                      a.download = `comprobante-${selectedAuction.operation_number || selectedAuction.id}`; a.click();
                    }}>
                      <Download className="h-3 w-3 mr-1" /> Descargar
                    </Button>
                  </div>
                  <img src={proofUrl} alt="Comprobante" className="max-h-60 w-auto rounded-lg border border-border object-contain" />
                </div>
              )}
              {!loadingDetail && !proofUrl && (
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-xs text-muted-foreground">No se ha subido comprobante de pago aún.</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="rounded-lg border border-border p-4 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Línea de Tiempo
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-border shrink-0" /> Creada: {new Date(selectedAuction.created_at).toLocaleString("es-VE")}</p>
                  <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary shrink-0" /> Finalizada: {new Date(selectedAuction.end_time).toLocaleString("es-VE")}</p>
                  {selectedAuction.paid_at && <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Pagada: {new Date(selectedAuction.paid_at).toLocaleString("es-VE")}</p>}
                  {selectedAuction.delivered_at && <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Entregada: {new Date(selectedAuction.delivered_at).toLocaleString("es-VE")}</p>}
                  {selectedAuction.funds_released_at && <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Fondos liberados: {new Date(selectedAuction.funds_released_at).toLocaleString("es-VE")}</p>}
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full rounded-sm text-xs" onClick={() => navigate(`/auction/${selectedAuction.id}`)}>
                Ver página de subasta →
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWonAuctionsTab;
