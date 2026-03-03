import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy, Search, Filter, Eye, Download, Calendar, Package,
  DollarSign, Truck, CreditCard, Clock, CheckCircle, XCircle,
  Loader2, ChevronDown, ChevronUp, User, MapPin, Phone, FileText
} from "lucide-react";
import type { AuctionExtended, WinnerInfo } from "./types";

interface Props {
  auctions: AuctionExtended[];
  winnerProfiles: Record<string, WinnerInfo>;
  dealerProfiles: Record<string, string>;
  paymentProofs: any[];
}

type SortField = "end_time" | "current_price" | "title";
type SortDir = "asc" | "desc";

const AdminWonAuctionsTab = ({ auctions, winnerProfiles, dealerProfiles, paymentProofs }: Props) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("end_time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Detail modal
  const [selectedAuction, setSelectedAuction] = useState<AuctionExtended | null>(null);
  const [shippingInfo, setShippingInfo] = useState<any>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // All auctions with a winner (regardless of status)
  const wonAuctions = useMemo(() => {
    return auctions.filter(a => !!a.winner_id);
  }, [auctions]);

  // Filtered & sorted
  const filtered = useMemo(() => {
    let list = [...wonAuctions];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.operation_number?.toLowerCase().includes(q) ||
        winnerProfiles[a.winner_id!]?.full_name?.toLowerCase().includes(q) ||
        dealerProfiles[a.created_by]?.toLowerCase().includes(q)
      );
    }

    if (paymentFilter !== "all") {
      if (paymentFilter === "verified") {
        list = list.filter(a => a.payment_status === "verified" || a.payment_status === "released");
      } else {
        list = list.filter(a => a.payment_status === paymentFilter);
      }
    }

    if (deliveryFilter !== "all") {
      list = list.filter(a => a.delivery_status === deliveryFilter);
    }

    if (dateFrom) {
      list = list.filter(a => new Date(a.end_time) >= new Date(dateFrom));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      list = list.filter(a => new Date(a.end_time) <= to);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "end_time") cmp = new Date(a.end_time).getTime() - new Date(b.end_time).getTime();
      else if (sortField === "current_price") cmp = a.current_price - b.current_price;
      else cmp = a.title.localeCompare(b.title);
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [wonAuctions, search, paymentFilter, deliveryFilter, dateFrom, dateTo, sortField, sortDir, winnerProfiles, dealerProfiles]);

  // Stats
  const stats = useMemo(() => {
    const total = wonAuctions.length;
    const totalRevenue = wonAuctions.reduce((s, a) => s + a.current_price, 0);
    const pendingPayment = wonAuctions.filter(a => a.payment_status === "pending").length;
    const verified = wonAuctions.filter(a => a.payment_status === "verified" || a.payment_status === "released").length;
    const delivered = wonAuctions.filter(a => a.delivery_status === "delivered").length;
    const shipped = wonAuctions.filter(a => a.delivery_status === "shipped" || a.delivery_status === "in_transit").length;
    return { total, totalRevenue, pendingPayment, verified, delivered, shipped };
  }, [wonAuctions]);

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
      if (url.startsWith("http")) {
        setProofUrl(url);
      } else {
        const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(url, 864000);
        setProofUrl(data?.signedUrl || null);
      }
    }

    setLoadingDetail(false);
  };

  const paymentLabel = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      pending: { label: "Pendiente", class: "bg-warning/10 text-warning border-warning/20" },
      under_review: { label: "En Revisión", class: "bg-amber-500/10 text-amber-600 border-amber-200" },
      verified: { label: "Verificado", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
      released: { label: "Liberado", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
      refunded: { label: "Reembolsado", class: "bg-destructive/10 text-destructive border-destructive/20" },
    };
    return map[status] || { label: status, class: "bg-muted text-muted-foreground dark:text-gray-300 border-border" };
  };

  const deliveryLabel = (status: string) => {
    const map: Record<string, { label: string; class: string }> = {
      pending: { label: "Pendiente", class: "bg-muted text-muted-foreground dark:text-gray-300 border-border" },
      ready_to_ship: { label: "Listo para enviar", class: "bg-blue-500/10 text-blue-600 border-blue-200" },
      shipped: { label: "Enviado", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
      in_transit: { label: "En tránsito", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
      delivered: { label: "Entregado", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
    };
    return map[status] || { label: status, class: "bg-muted text-muted-foreground dark:text-gray-300 border-border" };
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary dark:text-accent" /> Subastas Ganadas
        </h1>
        <Badge variant="outline" className="text-xs">{stats.total} total</Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Ganadas", value: stats.total, icon: Trophy, color: "text-primary dark:text-accent", action: () => { setPaymentFilter("all"); setDeliveryFilter("all"); } },
          { label: "Ingresos", value: `$${stats.totalRevenue.toLocaleString("es-MX")}`, icon: DollarSign, color: "text-primary dark:text-accent", action: () => { setPaymentFilter("all"); setDeliveryFilter("all"); } },
          { label: "Pago Pendiente", value: stats.pendingPayment, icon: Clock, color: "text-warning", action: () => { setPaymentFilter("pending"); setDeliveryFilter("all"); } },
          { label: "Pago Verificado", value: stats.verified, icon: CheckCircle, color: "text-primary dark:text-accent", action: () => { setPaymentFilter("verified"); setDeliveryFilter("all"); } },
          { label: "Enviados", value: stats.shipped, icon: Truck, color: "text-primary dark:text-accent", action: () => { setDeliveryFilter("shipped"); setPaymentFilter("all"); } },
          { label: "Entregados", value: stats.delivered, icon: Package, color: "text-primary dark:text-accent", action: () => { setDeliveryFilter("delivered"); setPaymentFilter("all"); } },
        ].map((s, i) => (
          <Card
            key={i}
            className="border border-border rounded-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
            onClick={s.action}
          >
            <CardContent className="p-3">
              <s.icon className={`h-4 w-4 ${s.color} mb-1`} />
              <p className="text-lg font-heading font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-border rounded-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, Nº operación, ganador, dealer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-sm text-xs"
              />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-9 rounded-sm text-xs">
                <SelectValue placeholder="Estado pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los pagos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="under_review">En revisión</SelectItem>
                <SelectItem value="verified">Verificado / Liberado</SelectItem>
                <SelectItem value="released">Solo Liberados</SelectItem>
                <SelectItem value="refunded">Reembolsado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger className="h-9 rounded-sm text-xs">
                <SelectValue placeholder="Estado envío" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los envíos</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="ready_to_ship">Listo para enviar</SelectItem>
                <SelectItem value="shipped">Enviado</SelectItem>
                <SelectItem value="in_transit">En tránsito</SelectItem>
                <SelectItem value="delivered">Entregado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-sm text-xs" placeholder="Desde" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-sm text-xs" placeholder="Hasta" />
          </div>
          {(search || paymentFilter !== "all" || deliveryFilter !== "all" || dateFrom || dateTo) && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{filtered.length} resultado(s)</span>
              <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => { setSearch(""); setPaymentFilter("all"); setDeliveryFilter("all"); setDateFrom(""); setDateTo(""); }}>
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="border border-border rounded-sm">
          <CardContent className="p-12 text-center">
            <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No hay subastas ganadas que coincidan con los filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3">Producto</th>
                  <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 hidden sm:table-cell">Nº Operación</th>
                  <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 hidden md:table-cell">Ganador</th>
                  <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 hidden lg:table-cell">Dealer</th>
                  <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("current_price")}>
                    <span className="flex items-center justify-end gap-1">Precio <SortIcon field="current_price" /></span>
                  </th>
                  <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3">Pago</th>
                  <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 hidden md:table-cell">Envío</th>
                  <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort("end_time")}>
                    <span className="flex items-center justify-center gap-1">Fecha <SortIcon field="end_time" /></span>
                  </th>
                  <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a) => {
                  const winner = winnerProfiles[a.winner_id!];
                  const ps = paymentLabel(a.payment_status);
                  const ds = deliveryLabel(a.delivery_status);

                  return (
                    <tr key={a.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => navigate(`/auction/${a.id}`)}
                        >
                          {a.image_url && (
                            <img src={a.image_url} alt={a.title} className="w-8 h-8 rounded-sm object-cover border border-border shrink-0 group-hover:opacity-80 transition-opacity" />
                          )}
                          <p className="font-medium truncate max-w-[180px] group-hover:text-primary transition-colors">{a.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="font-mono text-[10px] text-muted-foreground">{a.operation_number || "—"}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div>
                          <p className="font-medium">{winner?.full_name || "Desconocido"}</p>
                          {winner?.phone && <p className="text-[10px] text-muted-foreground">{winner.phone}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {dealerProfiles[a.created_by] || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold">${a.current_price.toLocaleString("es-MX")}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${ps.class}`}>{ps.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <Badge variant="outline" className={`text-[10px] ${ds.class}`}>{ds.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] text-muted-foreground">
                        {new Date(a.end_time).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2" onClick={() => openDetail(a)}>
                            <Eye className="h-3 w-3 mr-1" /> Detalle
                          </Button>
                          <Button variant="ghost" size="sm" className="text-[10px] h-7 px-2" onClick={() => navigate(`/auction/${a.id}`)}>
                            <Package className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Modal */}
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
              <div className="flex items-start gap-4">
                {selectedAuction.image_url && (
                  <img src={selectedAuction.image_url} alt={selectedAuction.title} className="w-20 h-20 rounded-sm object-cover border border-border" />
                )}
                <div className="flex-1 space-y-1">
                  <h3 className="font-heading font-bold text-sm">{selectedAuction.title}</h3>
                  <p className="text-[10px] text-muted-foreground dark:text-gray-300 font-mono">{selectedAuction.operation_number || "Sin Nº"}</p>
                  <p className="text-lg font-heading font-bold text-primary dark:text-accent">${selectedAuction.current_price.toLocaleString("es-MX")} USD</p>
                  <p className="text-[10px] text-muted-foreground">
                    Finalizada: {new Date(selectedAuction.end_time).toLocaleString("es-VE")}
                  </p>
                </div>
              </div>

              {/* Participants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                    <User className="h-3 w-3" /> Ganador
                  </p>
                  <p className="text-sm font-medium">{winnerProfiles[selectedAuction.winner_id!]?.full_name || "Desconocido"}</p>
                  {winnerProfiles[selectedAuction.winner_id!]?.phone && (
                    <p className="text-[10px] text-muted-foreground dark:text-gray-300 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {winnerProfiles[selectedAuction.winner_id!].phone}
                    </p>
                  )}
                </div>
                <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                    <Package className="h-3 w-3" /> Dealer
                  </p>
                  <p className="text-sm font-medium">{dealerProfiles[selectedAuction.created_by] || "Desconocido"}</p>
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Estado de Pago
                  </p>
                  <Badge variant="outline" className={paymentLabel(selectedAuction.payment_status).class}>
                    {paymentLabel(selectedAuction.payment_status).label}
                  </Badge>
                </div>
                <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Estado de Envío
                  </p>
                  <Badge variant="outline" className={deliveryLabel(selectedAuction.delivery_status).class}>
                    {deliveryLabel(selectedAuction.delivery_status).label}
                  </Badge>
                  {selectedAuction.tracking_number && (
                    <p className="text-[10px] font-mono text-foreground mt-1">Guía: {selectedAuction.tracking_number}</p>
                  )}
                </div>
              </div>

              {/* Shipping info */}
              {!loadingDetail && shippingInfo && (
                <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Datos de Envío
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
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
                <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Comprobante de Pago
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-[10px] h-7 rounded-sm" onClick={() => window.open(proofUrl, "_blank")}>
                      <Eye className="h-3 w-3 mr-1" /> Ver Comprobante
                    </Button>
                    <Button variant="outline" size="sm" className="text-[10px] h-7 rounded-sm" onClick={() => {
                      const a = document.createElement("a");
                      a.href = proofUrl;
                      a.target = "_blank";
                      a.download = `comprobante-${selectedAuction.operation_number || selectedAuction.id}`;
                      a.click();
                    }}>
                      <Download className="h-3 w-3 mr-1" /> Descargar
                    </Button>
                  </div>
                  <img src={proofUrl} alt="Comprobante" className="max-h-60 w-auto rounded-sm border border-border object-contain" />
                </div>
              )}

              {!loadingDetail && !proofUrl && (
                <div className="bg-secondary/30 border border-border rounded-sm p-3 text-center">
                  <p className="text-xs text-muted-foreground">No se ha subido comprobante de pago aún.</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Línea de Tiempo
                </p>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <p>Creada: {new Date(selectedAuction.created_at).toLocaleString("es-VE")}</p>
                  <p>Finalizada: {new Date(selectedAuction.end_time).toLocaleString("es-VE")}</p>
                  {selectedAuction.paid_at && <p>Pagada: {new Date(selectedAuction.paid_at).toLocaleString("es-VE")}</p>}
                  {selectedAuction.delivered_at && <p>Entregada: {new Date(selectedAuction.delivered_at).toLocaleString("es-VE")}</p>}
                  {selectedAuction.funds_released_at && <p>Fondos liberados: {new Date(selectedAuction.funds_released_at).toLocaleString("es-VE")}</p>}
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
