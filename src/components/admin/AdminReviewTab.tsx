import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, CheckCircle, XCircle, Clock, AlertTriangle, ZoomIn, ChevronLeft, ChevronRight, X, ArrowLeftRight } from "lucide-react";
import type { AuctionExtended } from "./types";

interface Props {
  auctions: AuctionExtended[];
  fetchAllData: () => Promise<void>;
}

const AdminReviewTab = ({ auctions, fetchAllData }: Props) => {
  const { toast } = useToast();
  const [processingAuction, setProcessingAuction] = useState<string | null>(null);
  const [reviewEndTime, setReviewEndTime] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedImgKey, setSelectedImgKey] = useState<string | null>(null); // "auctionId:idx" format

  const pendingAuctions = auctions.filter(a => a.status === "pending" || a.status === "in_review");

  // Move image from one position to another and reassign sequential display_order
  const handleSwapImages = async (auction: AuctionExtended, fromIdx: number, toIdx: number) => {
    const images = [...auction.images];
    if (toIdx < 0 || toIdx >= images.length || fromIdx === toIdx) return;
    // Rearrange: remove from old position, insert at new position
    const [moved] = images.splice(fromIdx, 1);
    images.splice(toIdx, 0, moved);
    // Assign fresh sequential display_order to ALL images
    const updates = images.map((img, i) =>
      supabase.from("auction_images").update({ display_order: i } as any).eq("id", img.id)
    );
    const results = await Promise.all(updates);
    if (results.some(r => r.error)) {
      toast({ title: "Error al reordenar", variant: "destructive" });
      return;
    }
    // Update main image_url if position 0 changed
    const newMainUrl = images[0].image_url;
    if (newMainUrl !== auction.image_url) {
      await supabase.from("auctions").update({ image_url: newMainUrl } as any).eq("id", auction.id);
    }
    fetchAllData();
    toast({ title: "📸 Imágenes reordenadas" });
  };

  // Delete an image from an auction
  const handleDeleteImage = async (auction: AuctionExtended, imgId: string, imgIdx: number) => {
    if (auction.images.length <= 1) {
      toast({ title: "Debe haber al menos una imagen", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("auction_images").delete().eq("id", imgId);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    // If we deleted the main image (idx 0), update auction.image_url to the next one
    if (imgIdx === 0 && auction.images.length > 1) {
      await supabase.from("auctions").update({ image_url: auction.images[1].image_url } as any).eq("id", auction.id);
    }
    fetchAllData();
    toast({ title: "🗑️ Imagen eliminada" });
  };

  const handleAuctionReview = async (auctionId: string, action: "in_review" | "approved" | "rejected") => {
    setProcessingAuction(auctionId);

    if (action === "approved") {
      const auction = auctions.find(a => a.id === auctionId);
      const durationHours = parseInt(reviewEndTime[auctionId] || String((auction as any)?.requested_duration_hours || "24")) || 24;
      const notes = reviewNotes[auctionId] || null;

      // Use server-side RPC to calculate end_time with DB server clock (avoid client clock skew)
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("approve_auction", {
        p_auction_id: auctionId,
        p_duration_hours: durationHours,
        p_admin_notes: notes,
      });

      if (rpcError) {
        // Fallback: if RPC doesn't exist yet, use client-side calculation
        console.warn("RPC approve_auction not available, using fallback:", rpcError.message);
        const updateData: any = {
          status: "active",
          end_time: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
          start_time: new Date().toISOString(),
          requested_duration_hours: durationHours,
        };
        if (notes) updateData.admin_notes = notes;
        const { error } = await supabase.from("auctions").update(updateData).eq("id", auctionId);
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
          setProcessingAuction(null);
          return;
        }
      } else if (rpcResult?.error) {
        toast({ title: "Error", description: rpcResult.error, variant: "destructive" });
        setProcessingAuction(null);
        return;
      }

      toast({ title: "✅ Aprobada" });
    } else {
      // in_review or rejected — simple status update
      const updateData: any = { status: action };
      if (reviewNotes[auctionId]) updateData.admin_notes = reviewNotes[auctionId];
      const { error } = await supabase.from("auctions").update(updateData).eq("id", auctionId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setProcessingAuction(null);
        return;
      }
      toast({ title: action === "rejected" ? "❌ Rechazada" : "👁️ En revisión" });
    }

    // Send notification to dealer
    try {
      await supabase.functions.invoke("notify-auction-status", {
        body: { auction_id: auctionId, action, reason: reviewNotes[auctionId] || "" },
      });
      toast({ title: "📧 Notificación enviada al dealer" });
    } catch (e) {
      console.error("Error sending auction status notification:", e);
    }
    fetchAllData();
    setProcessingAuction(null);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Eye className="h-5 w-5 text-primary dark:text-accent" /> Revisión de Subastas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{pendingAuctions.length} subastas pendientes de moderación</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">{pendingAuctions.filter(a => a.status === "pending").length} pendientes</Badge>
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">{pendingAuctions.filter(a => a.status === "in_review").length} en revisión</Badge>
          </div>
        </div>
        {pendingAuctions.length === 0 ? (
          <Card className="border border-border rounded-sm"><CardContent className="p-12 text-center"><Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /><p className="text-sm font-medium text-muted-foreground">No hay subastas pendientes</p><p className="text-xs text-muted-foreground/70 mt-1">Todas las subastas han sido revisadas</p></CardContent></Card>
        ) : pendingAuctions.map(auction => (
          <Card key={auction.id} className="border border-border rounded-sm hover:border-primary/30 transition-all">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{auction.title}</h4>
                  <p className="text-xs text-muted-foreground">Dealer: <strong>{auction.dealer_name}</strong> · Precio: ${auction.starting_price.toLocaleString("es-MX")}</p>
                  {(auction as any).requested_duration_hours && (
                    <p className="text-xs text-primary dark:text-accent mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Duración solicitada: <strong>{(auction as any).requested_duration_hours}h ({((auction as any).requested_duration_hours / 24).toFixed(1)} días)</strong>
                    </p>
                  )}
                  {auction.description && <p className="text-xs text-muted-foreground dark:text-gray-300 mt-2 bg-secondary/30 p-2 rounded-sm">{auction.description}</p>}
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{auction.status === "pending" ? "Pendiente" : "En Revisión"}</Badge>
              </div>
              {auction.images.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-foreground/60 uppercase tracking-wider mb-1.5">📷 Imágenes ({auction.images.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {auction.images.map((img, idx) => {
                      const canReorder = auction.images.length > 1;
                      const selKey = `${auction.id}:${idx}`;
                      const isSelected = selectedImgKey === selKey;
                      const isSwapTarget = selectedImgKey !== null && selectedImgKey.startsWith(auction.id + ":") && !isSelected;
                      return (
                        <div
                          key={img.id}
                          className={`relative group shrink-0 rounded-sm transition-all cursor-pointer ${isSelected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background scale-95" : ""
                            } ${isSwapTarget ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background hover:ring-primary" : ""}`}
                          onClick={() => {
                            if (!canReorder) {
                              setLightboxImages(auction.images.map(i => i.image_url));
                              setLightboxIndex(idx);
                              return;
                            }
                            if (isSelected) {
                              setSelectedImgKey(null); // deselect
                              return;
                            }
                            if (selectedImgKey && selectedImgKey.startsWith(auction.id + ":")) {
                              const fromIdx = parseInt(selectedImgKey.split(":")[1], 10);
                              setSelectedImgKey(null);
                              handleSwapImages(auction, fromIdx, idx);
                              return;
                            }
                            setSelectedImgKey(selKey); // select
                          }}
                        >
                          <img
                            src={img.image_url}
                            className="w-24 h-24 rounded-sm object-cover border border-border group-hover:border-primary/50 transition-all"
                            alt=""
                            draggable={false}
                          />
                          {/* Overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-sm transition-all flex items-center justify-center pointer-events-none">
                            {isSelected
                              ? <ArrowLeftRight className="h-5 w-5 text-blue-400 opacity-100 animate-pulse" />
                              : isSwapTarget
                                ? <ArrowLeftRight className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                : <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                          {isSelected && <span className="absolute top-0.5 left-0.5 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold z-10">1º</span>}
                          {idx === 0 && <span className="absolute bottom-1 left-1 text-[7px] bg-primary/80 text-primary-foreground px-1 py-0.5 rounded font-bold z-10">PRINCIPAL</span>}
                          {/* Delete button */}
                          {canReorder && (
                            <button
                              className="absolute top-0.5 right-0.5 bg-red-600/90 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                              title="Eliminar imagen"
                              onClick={(e) => { e.stopPropagation(); handleDeleteImage(auction, img.id, idx); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {auction.images.length > 1 && (
                    <p className="text-[9px] text-muted-foreground/50 mt-1">💡 {selectedImgKey?.startsWith(auction.id) ? "Ahora haz clic en otra imagen para intercambiar posiciones" : "Haz clic en una imagen para moverla · X para eliminar"}</p>
                  )}
                </div>
              )}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label className="text-xs">Duración de la subasta (horas) *</Label>
                  <div className="flex items-center gap-2 max-w-xs">
                    <select
                      value={reviewEndTime[auction.id] || String((auction as any).requested_duration_hours || "24")}
                      onChange={(e) => setReviewEndTime(p => ({ ...p, [auction.id]: e.target.value }))}
                      className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="1">1 hora</option>
                      <option value="2">2 horas</option>
                      <option value="3">3 horas</option>
                      <option value="4">4 horas</option>
                      <option value="5">5 horas</option>
                      <option value="6">6 horas</option>
                      <option value="12">12 horas</option>
                      <option value="24">1 día (24h)</option>
                      <option value="48">2 días (48h)</option>
                      <option value="72">3 días (72h)</option>
                      <option value="96">4 días (96h)</option>
                      <option value="120">5 días (120h)</option>
                      <option value="144">6 días (144h)</option>
                    </select>
                  </div>
                  {(auction as any).requested_duration_hours && reviewEndTime[auction.id] && reviewEndTime[auction.id] !== String((auction as any).requested_duration_hours) && (
                    <p className="text-[10px] text-warning flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Diferente a lo solicitado por el dealer ({(auction as any).requested_duration_hours}h)
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notas (opcional)</Label>
                  <Textarea value={reviewNotes[auction.id] || ""} onChange={(e) => setReviewNotes(p => ({ ...p, [auction.id]: e.target.value }))} rows={2} className="rounded-sm" maxLength={500} />
                </div>
                <div className="flex gap-2">
                  {auction.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => handleAuctionReview(auction.id, "in_review")} disabled={processingAuction === auction.id} className="text-xs h-7 rounded-sm">
                      <Eye className="h-3 w-3 mr-1" /> En Revisión
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleAuctionReview(auction.id, "approved")} disabled={processingAuction === auction.id} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-xs h-7">
                    <CheckCircle className="h-3 w-3 mr-1" /> Aprobar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAuctionReview(auction.id, "rejected")} disabled={processingAuction === auction.id} className="text-destructive border-destructive/30 rounded-sm text-xs h-7">
                    <XCircle className="h-3 w-3 mr-1" /> Rechazar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Image Lightbox Modal ── */}
      {lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxImages([])}
          onKeyDown={(e) => {
            if (e.key === "Escape") setLightboxImages([]);
            if (e.key === "ArrowRight" && lightboxIndex < lightboxImages.length - 1) setLightboxIndex(i => i + 1);
            if (e.key === "ArrowLeft" && lightboxIndex > 0) setLightboxIndex(i => i - 1);
          }}
          tabIndex={0}
          role="dialog"
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-2"
            onClick={(e) => { e.stopPropagation(); setLightboxImages([]); }}
          >
            <X className="h-7 w-7" />
          </button>
          {lightboxImages.length > 1 && lightboxIndex > 0 && (
            <button
              className="absolute left-4 text-white/80 hover:text-white z-10 p-2"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => i - 1); }}
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
          )}
          {lightboxImages.length > 1 && lightboxIndex < lightboxImages.length - 1 && (
            <button
              className="absolute right-4 text-white/80 hover:text-white z-10 p-2"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => i + 1); }}
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          )}
          <img
            src={lightboxImages[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {lightboxImages.map((_, i) => (
                <button
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${i === lightboxIndex ? "bg-white scale-125" : "bg-white/40 hover:bg-white/70"}`}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AdminReviewTab;
