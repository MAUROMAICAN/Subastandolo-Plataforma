import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Trash2, Image as ImageIcon, Eye, Clock, CheckCircle,
  XCircle, TrendingUp, DollarSign, Package, Trophy, User, Phone,
  AlertTriangle, ChevronDown, ChevronUp, Pause, Truck, Camera,
  Edit3, Save, RotateCcw, Copy
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { maskName } from "@/lib/utils";
import type { AuctionWithImages, WinnerProfile } from "./types";
import AuctionPreviewModal from "./AuctionPreviewModal";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pendiente", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  in_review: { label: "En Revisión", color: "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20", icon: Eye },
  approved: { label: "Aprobada", color: "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20", icon: CheckCircle },
  active: { label: "Activa", color: "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20", icon: TrendingUp },
  paused: { label: "Pausada", color: "bg-warning/10 text-warning border-warning/20", icon: Pause },
  rejected: { label: "Rechazada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  finalized: { label: "Finalizada", color: "bg-muted text-muted-foreground border-border", icon: Trophy },
  archived: { label: "Archivada", color: "bg-secondary text-muted-foreground border-border", icon: Package },
};

interface Props {
  auctions: AuctionWithImages[];
  loading: boolean;
  statusFilter: string;
  setStatusFilter: (f: string) => void;
  expandedAuction: string | null;
  setExpandedAuction: (id: string | null) => void;
  winnerProfiles: Record<string, WinnerProfile>;
  shippingInfoMap: Record<string, any>;
  trackingNumber: Record<string, string>;
  setTrackingNumber: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  trackingFile: Record<string, File | null>;
  setTrackingFile: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
  trackingCompany: Record<string, string>;
  setTrackingCompany: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submittingTracking: string | null;
  handleSubmitTracking: (auctionId: string) => Promise<void>;
  fetchMyAuctions: () => void;
  onDuplicate: (data: { title: string; description: string; startingPrice: string; durationHours: string }) => void;
}

export default function DealerAuctionsTab({
  auctions, loading, statusFilter, setStatusFilter,
  expandedAuction, setExpandedAuction, winnerProfiles, shippingInfoMap,
  trackingNumber, setTrackingNumber, trackingFile, setTrackingFile,
  trackingCompany, setTrackingCompany, submittingTracking, handleSubmitTracking,
  fetchMyAuctions, onDuplicate,
}: Props) {
  const { toast } = useToast();

  const filteredAuctions = useMemo(() => {
    if (statusFilter === "all") return auctions;
    if (statusFilter === "archived") return auctions.filter(a => (a as any).archived_at);
    if (statusFilter === "finalized") return auctions.filter(a => a.status === "finalized" && !(a as any).archived_at);
    return auctions.filter(a => a.status === statusFilter);
  }, [auctions, statusFilter]);

  // ── Preview state ────────────────────────────────────────────
  const [previewAuction, setPreviewAuction] = useState<AuctionWithImages | null>(null);

  const handleDelete = async (auctionId: string) => {
    const { error } = await supabase.from("auctions").delete().eq("id", auctionId);
    if (!error) {
      fetchMyAuctions();
      toast({ title: "Subasta eliminada" });
    }
  };

  // ── Inline edit state ──────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    title: string; description: string; startingPrice: string; durationHours: string;
  }>({ title: "", description: "", startingPrice: "", durationHours: "24" });
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (auction: AuctionWithImages) => {
    setEditFields({
      title: auction.title,
      description: auction.description || "",
      startingPrice: String(auction.starting_price),
      durationHours: String((auction as any).requested_duration_hours || 24),
    });
    setEditingId(auction.id);
  };

  const handleSaveEdit = async (auctionId: string) => {
    if (!editFields.title.trim()) {
      toast({ title: "El título es obligatorio", variant: "destructive" }); return;
    }
    setSavingEdit(true);
    const { validateNoContactInfo } = await import("@/lib/contactDetector");
    const contactError = validateNoContactInfo(editFields.title, editFields.description);
    if (contactError) {
      toast({ title: "⚠️ Contenido no permitido", description: contactError, variant: "destructive" });
      setSavingEdit(false); return;
    }
    const { error } = await supabase.from("auctions").update({
      title: editFields.title.trim(),
      description: editFields.description.trim() || null,
      starting_price: parseFloat(editFields.startingPrice) || 0,
      requested_duration_hours: parseInt(editFields.durationHours) || 24,
    } as any).eq("id", auctionId);
    setSavingEdit(false);
    if (error) {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" }); return;
    }
    toast({ title: "✅ Publicación actualizada", description: "Los cambios han sido guardados." });
    setEditingId(null);
    fetchMyAuctions();
  };

  const handleReactivate = async (auction: AuctionWithImages) => {
    const newEndTime = new Date(Date.now() + ((auction as any).requested_duration_hours || 24) * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("auctions").update({
      status: "pending",
      current_price: 0,
      winner_id: null,
      winner_name: null,
      end_time: newEndTime,
      start_time: null,
      payment_status: "pending",
      delivery_status: "pending",
      tracking_number: null,
      tracking_photo_url: null,
      archived_at: null,
      funds_released_at: null,
      paid_at: null,
      delivered_at: null,
      dealer_ship_deadline: null,
      is_extended: false,
    } as any).eq("id", auction.id);
    if (error) {
      toast({ title: "Error al reactivar", description: error.message, variant: "destructive" });
    } else {
      fetchMyAuctions();
      toast({ title: "🔄 Subasta reenviada a revisión", description: "Tu producto será revisado nuevamente antes de publicarse." });
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Modal */}
      {previewAuction && (
        <AuctionPreviewModal auction={previewAuction} onClose={() => setPreviewAuction(null)} />
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "Todas", count: auctions.length },
          { key: "pending", label: "Pendientes", count: auctions.filter(a => a.status === "pending").length },
          { key: "in_review", label: "En Revisión", count: auctions.filter(a => a.status === "in_review").length },
          { key: "active", label: "Activas", count: auctions.filter(a => a.status === "active").length },
          { key: "paused", label: "Pausadas", count: auctions.filter(a => a.status === "paused").length },
          { key: "finalized", label: "Finalizadas", count: auctions.filter(a => a.status === "finalized" && !(a as any).archived_at).length },
          { key: "archived", label: "Archivadas", count: auctions.filter(a => (a as any).archived_at).length },
          { key: "rejected", label: "Rechazadas", count: auctions.filter(a => a.status === "rejected").length },
        ].filter(f => f.count > 0 || f.key === "all").map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs rounded-sm border transition-colors ${statusFilter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300] mx-auto" />
      ) : filteredAuctions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 text-sm">No hay subastas en esta categoría.</p>
      ) : (
        <div className="space-y-3">
          {filteredAuctions.map((auction) => {
            const sc = statusConfig[auction.status] || statusConfig.pending;
            const StatusIcon = sc.icon;
            const isExpanded = expandedAuction === auction.id;
            const isEnded = new Date(auction.end_time).getTime() <= Date.now();
            const winner = auction.winner_id ? winnerProfiles[auction.winner_id] : null;
            const mainImage = auction.images[0]?.image_url || auction.image_url;

            return (
              <Card key={auction.id} className="border border-border rounded-sm overflow-hidden">
                <CardContent className="p-0">
                  {/* Header */}
                  <div
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                    onClick={() => setExpandedAuction(isExpanded ? null : auction.id)}
                  >
                    {mainImage ? (
                      <img src={mainImage} alt={auction.title} className="w-16 h-16 rounded-sm object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-sm bg-secondary flex items-center justify-center shrink-0">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{auction.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Inicio: ${auction.starting_price.toLocaleString("es-MX")}
                        {auction.current_price > 0 && ` · Actual: $${auction.current_price.toLocaleString("es-MX")}`}
                        {` · ${auction.bids.length} pujas`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Creada: {new Date(auction.created_at).toLocaleDateString("es-MX")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {sc.label}
                      </Badge>
                      {/* Payment/Delivery status badges */}
                      {(auction.status === "finalized" || (auction.status === "active" && new Date(auction.end_time) <= new Date())) && auction.winner_id && (() => {
                        const a = auction as any;
                        const deliveryStatus = a.delivery_status || "pending";
                        const paymentStatus = a.payment_status || "pending";

                        if (deliveryStatus === "delivered") {
                          return (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">
                              <CheckCircle className="h-3 w-3 mr-1" /> Entregado
                            </Badge>
                          );
                        }
                        if (deliveryStatus === "shipped") {
                          return (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20 animate-pulse">
                              <Truck className="h-3 w-3 mr-1" /> En Camino
                            </Badge>
                          );
                        }
                        if (deliveryStatus === "ready_to_ship") {
                          return (
                            <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent-foreground border-accent/30 font-bold">
                              <Package className="h-3 w-3 mr-1" /> ¡Envía el producto!
                            </Badge>
                          );
                        }
                        if (paymentStatus === "under_review") {
                          return (
                            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">
                              <Clock className="h-3 w-3 mr-1" /> Pago en revisión
                            </Badge>
                          );
                        }
                        if (paymentStatus === "verified") {
                          return (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">
                              <CheckCircle className="h-3 w-3 mr-1" /> Pago verificado
                            </Badge>
                          );
                        }
                        if (paymentStatus === "pending") {
                          return (
                            <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                              <DollarSign className="h-3 w-3 mr-1" /> Pendiente de pago
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 space-y-4 bg-secondary/5">
                      {auction.images.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2">Fotos ({auction.images.length})</p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {auction.images.map((img, i) => (
                              <img key={img.id} src={img.image_url} alt={`Foto ${i + 1}`} className="w-20 h-20 rounded-sm object-cover shrink-0 border border-border" />
                            ))}
                          </div>
                        </div>
                      )}

                      {auction.description && (
                        <div>
                          <p className="text-xs font-medium mb-1">Descripción</p>
                          <p className="text-xs text-muted-foreground">{auction.description}</p>
                        </div>
                      )}

                      {auction.admin_notes && (
                        <div className="bg-warning/5 border border-warning/20 rounded-sm p-3">
                          <p className="text-xs font-medium text-warning mb-1">Notas del Administrador</p>
                          <p className="text-xs text-muted-foreground">{auction.admin_notes}</p>
                        </div>
                      )}

                      {auction.status === "active" && (
                        <div>
                          <p className="text-xs font-medium mb-1">Finalización</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(auction.end_time).toLocaleString("es-MX")}
                            {isEnded && <span className="text-destructive font-semibold ml-2">— FINALIZADA</span>}
                          </p>
                        </div>
                      )}

                      {auction.bids.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2">Pujas ({auction.bids.length})</p>
                          <div className="bg-card border border-border rounded-sm overflow-hidden max-h-48 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-secondary/50 border-b border-border">
                                  <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">#</th>
                                  <th className="px-3 py-1.5 text-left text-muted-foreground font-medium">Postor</th>
                                  <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Monto</th>
                                  <th className="px-3 py-1.5 text-right text-muted-foreground font-medium">Fecha</th>
                                </tr>
                              </thead>
                              <tbody>
                                {auction.bids.map((bid, index) => (
                                  <tr key={bid.id} className={`border-b border-border last:border-0 ${index === 0 ? "bg-primary/5" : ""}`}>
                                    <td className="px-3 py-1.5">{index === 0 ? "👑" : index + 1}</td>
                                    <td className="px-3 py-1.5">{maskName(bid.bidder_name)}</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-primary dark:text-[#A6E300]">${bid.amount.toLocaleString("es-MX")}</td>
                                    <td className="px-3 py-1.5 text-right text-muted-foreground">{new Date(bid.created_at).toLocaleDateString("es-MX")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Winner info */}
                      {(auction.status === "finalized" || (auction.status === "active" && isEnded)) && auction.winner_id && winner && (
                        <div className="bg-primary/5 border border-primary/10 rounded-sm p-3 space-y-2">
                          <p className="text-xs font-bold text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                            <Trophy className="h-3.5 w-3.5" /> Ganador de la Subasta
                          </p>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" /> {winner.full_name}</div>
                            {winner.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" /> {winner.phone}</div>}
                            <div className="flex items-center gap-1.5"><DollarSign className="h-3 w-3 text-muted-foreground" /> Precio final: ${auction.current_price.toLocaleString("es-MX")}</div>
                          </div>
                          <div className="bg-warning/10 border border-warning/30 rounded-sm p-3 mt-2 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground font-semibold leading-relaxed">No cobrar directamente. El departamento de cobranza y seguridad gestionará el pago. Envía el producto una vez confirmado el pago.</p>
                          </div>

                          {/* Tracking upload */}
                          {(auction as any).delivery_status === "ready_to_ship" && !(auction as any).tracking_number && (
                            <div className="bg-accent/5 border border-accent/20 rounded-sm p-4 space-y-3 mt-2">
                              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                <Truck className="h-4 w-4 text-primary dark:text-[#A6E300]" /> Confirmar Envío
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Completa los datos del envío para notificar al comprador automáticamente.
                              </p>
                              {(auction as any).dealer_ship_deadline && (
                                <p className={`text-[10px] ${new Date((auction as any).dealer_ship_deadline).getTime() < Date.now() ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                  ⏰ Plazo: {new Date((auction as any).dealer_ship_deadline).toLocaleString("es-MX")}
                                  {new Date((auction as any).dealer_ship_deadline).getTime() < Date.now() && " — VENCIDO"}
                                </p>
                              )}

                              {shippingInfoMap[auction.id] && (
                                <div className="bg-secondary/50 border border-border rounded-sm p-2.5 text-xs space-y-1">
                                  <p className="font-semibold text-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Datos del destinatario:</p>
                                  <p className="text-muted-foreground">{shippingInfoMap[auction.id].full_name} · CI: {shippingInfoMap[auction.id].cedula}</p>
                                  <p className="text-muted-foreground">{shippingInfoMap[auction.id].shipping_company} — {shippingInfoMap[auction.id].office_name}</p>
                                  <p className="text-muted-foreground">{shippingInfoMap[auction.id].city}, {shippingInfoMap[auction.id].state}</p>
                                </div>
                              )}

                              <div className="space-y-1">
                                <Label className="text-xs">Empresa de Envío *</Label>
                                <Select value={trackingCompany[auction.id] || ""} onValueChange={(v) => setTrackingCompany(prev => ({ ...prev, [auction.id]: v }))}>
                                  <SelectTrigger className="rounded-sm text-xs h-8"><SelectValue placeholder="Selecciona la empresa" /></SelectTrigger>
                                  <SelectContent>
                                    {["MRW", "Zoom", "Tealca", "Domesa", "Liberty Express", "Servientrega", "DHL", "FedEx", "Otra"].map(c => (
                                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Número de Guía *</Label>
                                <Input placeholder="Ej: 123456789" value={trackingNumber[auction.id] || ""} onChange={(e) => setTrackingNumber(prev => ({ ...prev, [auction.id]: e.target.value }))} className="rounded-sm text-xs h-8 font-mono" />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Foto del Comprobante *</Label>
                                <label className="flex items-center gap-2 border-2 border-dashed border-border rounded-sm p-3 cursor-pointer hover:border-primary/50 hover:bg-secondary/20 transition-colors text-xs">
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setTrackingFile(prev => ({ ...prev, [auction.id]: e.target.files?.[0] || null }))} />
                                  <Camera className="h-4 w-4 text-muted-foreground" />
                                  <span className={trackingFile[auction.id] ? "text-foreground font-medium" : "text-muted-foreground"}>
                                    {trackingFile[auction.id] ? trackingFile[auction.id]!.name : "Subir foto del comprobante de envío"}
                                  </span>
                                </label>
                              </div>

                              <Button
                                onClick={() => handleSubmitTracking(auction.id)}
                                disabled={submittingTracking === auction.id || !trackingCompany[auction.id] || !trackingNumber[auction.id]?.trim() || !trackingFile[auction.id]}
                                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm"
                              >
                                {submittingTracking === auction.id ? (
                                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                                ) : (
                                  <><Truck className="h-4 w-4 mr-2" /> Confirmar Envío</>
                                )}
                              </Button>

                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                📦 Al confirmar, el comprador recibirá una notificación automática con los detalles del envío.
                              </p>
                            </div>
                          )}

                          {(auction as any).tracking_number && (
                            <div className="bg-primary/5 border border-primary/20 rounded-sm p-3 mt-2">
                              <p className="text-xs font-bold text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" /> Envío registrado
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">Guía: <span className="font-mono font-bold text-foreground">{(auction as any).tracking_number}</span></p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="space-y-3 pt-1">
                        {/* Inline Edit Form — only for pending auctions */}
                        {editingId === auction.id && (
                          <div className="bg-card border border-primary/30 rounded-sm p-4 space-y-3 animate-fade-in">
                            <p className="text-xs font-bold text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                              <Edit3 className="h-3.5 w-3.5" /> Editar publicación
                            </p>
                            <div className="space-y-1">
                              <Label className="text-xs">Título *</Label>
                              <Input
                                value={editFields.title}
                                onChange={(e) => setEditFields(f => ({ ...f, title: e.target.value }))}
                                maxLength={200}
                                className="rounded-sm text-xs h-8"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Descripción</Label>
                              <textarea
                                value={editFields.description}
                                onChange={(e) => setEditFields(f => ({ ...f, description: e.target.value }))}
                                maxLength={2000}
                                rows={5}
                                lang="es"
                                spellCheck={true}
                                className="flex w-full rounded-sm border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Precio Inicial ($)</Label>
                                <Input
                                  type="number" min="1" step="0.01"
                                  value={editFields.startingPrice}
                                  onChange={(e) => setEditFields(f => ({ ...f, startingPrice: e.target.value }))}
                                  className="rounded-sm text-xs h-8"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Duración deseada</Label>
                                <select
                                  value={editFields.durationHours}
                                  onChange={(e) => setEditFields(f => ({ ...f, durationHours: e.target.value }))}
                                  className="flex h-8 w-full rounded-sm border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {["1", "2", "3", "4", "5", "6", "12", "24", "48", "72", "96", "120", "144"].map(h => (
                                    <option key={h} value={h}>{h === "24" ? "1 día" : h === "48" ? "2 días" : h === "72" ? "3 días" : h === "96" ? "4 días" : h === "120" ? "5 días" : h === "144" ? "6 días" : `${h}h`}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(auction.id)}
                                disabled={savingEdit}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-xs h-7 font-bold"
                              >
                                {savingEdit ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Guardando...</> : <><Save className="h-3 w-3 mr-1" />Guardar cambios</>}
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => setEditingId(null)}
                                className="rounded-sm text-xs h-7"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {auction.status === "pending" && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => editingId === auction.id ? setEditingId(null) : startEdit(auction)}
                                className="text-primary border-primary/30 dark:text-[#A6E300] hover:bg-primary/10 rounded-sm text-xs h-7"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                {editingId === auction.id ? "Cerrar editor" : "Editar"}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDelete(auction.id)} className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-sm text-xs h-7">
                                <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                              </Button>
                            </>
                          )}
                          {(auction.status === "finalized" || auction.status === "rejected") && !auction.winner_id && auction.bids.length === 0 && (
                            <Button variant="outline" size="sm" onClick={() => handleReactivate(auction)} className="text-primary border-primary/30 dark:text-[#A6E300] hover:bg-primary/10 rounded-sm text-xs h-7">
                              <RotateCcw className="h-3 w-3 mr-1" /> Reactivar Producto
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDuplicate({
                              title: auction.title,
                              description: auction.description || "",
                              startingPrice: String(auction.starting_price),
                              durationHours: String((auction as any).requested_duration_hours || 24),
                            })}
                            className="text-foreground border-border hover:bg-secondary/50 rounded-sm text-xs h-7"
                          >
                            <Copy className="h-3 w-3 mr-1" /> Publicación similar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewAuction(auction)}
                            className="text-primary border-primary/30 hover:bg-primary/10 rounded-sm text-xs h-7"
                          >
                            <Eye className="h-3 w-3 mr-1" /> Vista previa
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
      )}
    </div>
  );
}
