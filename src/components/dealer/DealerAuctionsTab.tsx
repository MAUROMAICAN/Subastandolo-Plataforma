import { useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Trash2, Image as ImageIcon, Eye, Clock, CheckCircle,
  XCircle, TrendingUp, DollarSign, Package, Trophy, User, Phone,
  AlertTriangle, ChevronDown, ChevronUp, Pause, Truck, Camera,
  Edit3, Save, RotateCcw, Copy, ZoomIn, ArrowLeftRight, X as XIcon, ChevronLeft, ChevronRight,
  Upload, Search, ShoppingBag, CreditCard, PackageCheck, Ban, Store
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DealerStoreOrdersTab from "./DealerStoreOrdersTab";
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
  dealerId?: string;
}

export default function DealerAuctionsTab({
  auctions, loading, statusFilter, setStatusFilter,
  expandedAuction, setExpandedAuction, winnerProfiles, shippingInfoMap,
  trackingNumber, setTrackingNumber, trackingFile, setTrackingFile,
  trackingCompany, setTrackingCompany, submittingTracking, handleSubmitTracking,
  fetchMyAuctions, onDuplicate, dealerId,
}: Props) {
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [salesPanel, setSalesPanel] = useState<"all" | "active" | "pending_payment" | "in_transit" | "delivered" | "no_bids" | "other" | "store">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Helper: effective status considering time
  const getEffective = useCallback((a: AuctionWithImages) =>
    (a.status === "active" && new Date(a.end_time).getTime() <= Date.now()) ? "finalized" : a.status, []);

  // Lifecycle classification
  const classifyAuction = useCallback((a: AuctionWithImages) => {
    const eff = getEffective(a);
    const ds = (a as any).delivery_status || "pending";
    const ps = (a as any).payment_status || "pending";
    const hasBids = a.bids.length > 0 || a.winner_id;

    if (eff === "active") return "active";
    if ((eff === "finalized") && a.winner_id) {
      if (ds === "delivered") return "delivered";
      if (ds === "shipped" || ds === "ready_to_ship") return "in_transit";
      if (ps === "under_review" || ps === "pending" || ps === "verified") return "pending_payment";
      if (ps === "abandoned") return "no_bids"; // treat abandoned as republishable
    }
    if ((eff === "finalized") && !hasBids) return "no_bids";
    return "other";
  }, [getEffective]);

  // Count per lifecycle
  const lifecycleCounts = useMemo(() => {
    const counts = { all: auctions.length, active: 0, pending_payment: 0, in_transit: 0, delivered: 0, no_bids: 0, other: 0 };
    auctions.forEach(a => { counts[classifyAuction(a)]++; });
    return counts;
  }, [auctions, classifyAuction]);

  const filteredAuctions = useMemo(() => {
    let result = auctions;

    // Lifecycle filter
    if (salesPanel !== "all") {
      result = result.filter(a => classifyAuction(a) === salesPanel);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => {
        if (a.title.toLowerCase().includes(q)) return true;
        if (a.description?.toLowerCase().includes(q)) return true;
        const winner = a.winner_id ? winnerProfiles[a.winner_id] : null;
        if (winner?.full_name?.toLowerCase().includes(q)) return true;
        if (winner?.phone?.includes(q)) return true;
        if ((a as any).operation_number?.toString().includes(q)) return true;
        return false;
      });
    }

    return result;
  }, [auctions, salesPanel, searchQuery, classifyAuction, winnerProfiles]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAuctions.length / pageSize));
  const paginatedAuctions = filteredAuctions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [previewAuction, setPreviewAuction] = useState<AuctionWithImages | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedImgKey, setSelectedImgKey] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState<string | null>(null);

  // Reset page when filter changes
  const handlePanelChange = (panel: typeof salesPanel) => {
    setSalesPanel(panel);
    setCurrentPage(1);
  };

  // Handle adding new photos to an existing auction
  const handleAddPhotos = async (auction: AuctionWithImages, files: FileList) => {
    const fileArray = Array.from(files);
    const total = auction.images.length + fileArray.length;
    if (total > 10) {
      toast({ title: "Máximo 10 fotos", description: `Ya tienes ${auction.images.length} fotos. Solo puedes agregar ${10 - auction.images.length} más.`, variant: "destructive" });
      return;
    }
    setUploadingPhotos(auction.id);
    let successCount = 0;
    try {
      const { applyWatermark } = await import("@/lib/watermark");
      for (const [i, file] of fileArray.entries()) {
        // Step 1: Apply watermark
        let watermarked: File;
        try {
          watermarked = await applyWatermark(file);
        } catch (wmErr: any) {
          console.error("Watermark error:", wmErr);
          toast({ title: "Error procesando imagen", description: `No se pudo procesar ${file.name}`, variant: "destructive" });
          continue;
        }

        // Step 2: Upload to storage
        const filePath = `${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("auction-images")
          .upload(filePath, watermarked, { cacheControl: "3600", upsert: false });
        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          toast({ title: "Error subiendo imagen al servidor", description: uploadError.message, variant: "destructive" });
          continue;
        }

        // Step 3: Get public URL
        const { data: urlData } = supabase.storage.from("auction-images").getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) {
          console.error("No public URL returned");
          toast({ title: "Error obteniendo URL de imagen", variant: "destructive" });
          continue;
        }

        // Step 4: Insert into auction_images table
        const { error: insertError } = await supabase.from("auction_images").insert({
          auction_id: auction.id,
          image_url: publicUrl,
          display_order: auction.images.length + i,
        });
        if (insertError) {
          console.error("DB insert error:", insertError);
          toast({ title: "Error registrando imagen", description: insertError.message, variant: "destructive" });
          continue;
        }

        successCount++;
      }

      // Update main image_url if auction had no images before
      if (auction.images.length === 0 && successCount > 0) {
        const { data: firstImg } = await supabase
          .from("auction_images")
          .select("image_url")
          .eq("auction_id", auction.id)
          .order("display_order", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (firstImg?.image_url) {
          await supabase.from("auctions").update({ image_url: firstImg.image_url } as any).eq("id", auction.id);
        }
      }

      if (successCount > 0) {
        toast({ title: `📸 ${successCount} foto${successCount > 1 ? "s" : ""} agregada${successCount > 1 ? "s" : ""} correctamente` });
      } else {
        toast({ title: "No se pudieron agregar las fotos", description: "Revisa tu conexión e inténtalo de nuevo.", variant: "destructive" });
      }

      // Refresh the auctions data to show new images
      await fetchMyAuctions();
    } catch (err: any) {
      console.error("Photo upload error:", err);
      toast({ title: "Error inesperado", description: err?.message || "Error al subir fotos", variant: "destructive" });
    }
    setUploadingPhotos(null);
  };

  // Handle deleting a single image from an existing auction
  const handleDeleteImage = async (auction: AuctionWithImages, imageId: string, imageUrl: string) => {
    if (auction.images.length <= 1) {
      toast({ title: "Mínimo 1 foto", description: "No puedes eliminar la única foto de la subasta.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("auction_images").delete().eq("id", imageId);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    // If we deleted the main image, update auction.image_url to the next one
    if (auction.image_url === imageUrl) {
      const { data: nextImg } = await supabase.from("auction_images").select("image_url").eq("auction_id", auction.id).order("display_order", { ascending: true }).limit(1).maybeSingle();
      if (nextImg?.image_url) {
        await supabase.from("auctions").update({ image_url: nextImg.image_url } as any).eq("id", auction.id);
      }
    }
    toast({ title: "Foto eliminada" });
    fetchMyAuctions();
  };

  // Move image from one position to another and reassign sequential display_order
  const handleSwapImages = async (auction: AuctionWithImages, fromIdx: number, toIdx: number) => {
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
      toast({ title: "Error al reordenar imágenes", variant: "destructive" });
      return;
    }
    // Update main image_url if position 0 changed
    const newMainUrl = images[0].image_url;
    if (newMainUrl !== auction.image_url) {
      await supabase.from("auctions").update({ image_url: newMainUrl } as any).eq("id", auction.id);
    }
    fetchMyAuctions();
    toast({ title: "📸 Imágenes reordenadas" });
  };

  const handleDelete = async (auctionId: string) => {
    const { error } = await supabase.from("auctions").delete().eq("id", auctionId);
    if (!error) {
      fetchMyAuctions();
      toast({ title: "Subasta eliminada" });
    }
  };

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
    // Delete old bids so the reactivated auction starts fresh
    await supabase.from("bids").delete().eq("auction_id", auction.id);
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

  const handleRepublish = async (auction: AuctionWithImages) => {
    const durationHours = (auction as any).requested_duration_hours || 24;

    // Try server-side RPC first (atomically deletes old bids + resets auction with server timing)
    const { error: rpcError } = await (supabase.rpc as any)("republish_auction", {
      p_auction_id: auction.id,
      p_duration_hours: durationHours,
    });

    if (rpcError) {
      // Fallback: delete bids manually then update auction
      console.warn("RPC republish_auction not available, using fallback:", rpcError.message);
      await supabase.from("bids").delete().eq("auction_id", auction.id);
      const newEndTime = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("auctions").update({
        status: "active",
        current_price: 0,
        winner_id: null,
        winner_name: null,
        end_time: newEndTime,
        start_time: new Date().toISOString(),
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
        toast({ title: "Error al republicar", description: error.message, variant: "destructive" });
        return;
      }
    }

    fetchMyAuctions();
    toast({ title: "🚀 ¡Subasta republicada!", description: "Tu producto está activo como una subasta nueva, sin pujas ni datos anteriores." });
  };

  return (
    <>
      <div className="space-y-5">
        {/* Preview Modal */}
        {previewAuction && (
          <AuctionPreviewModal auction={previewAuction} onClose={() => setPreviewAuction(null)} />
        )}

        {/* ── HEADER WITH KPIS ── */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-heading font-black text-foreground flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Mis Ventas
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gestiona tus subastas, envíos y cobros en un solo lugar
                </p>
              </div>
              <Badge variant="outline" className="text-[11px] font-bold">
                {auctions.length} publicaciones
              </Badge>
            </div>
            {/* Mini KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "active" as const, count: lifecycleCounts.active, label: "Activas",
                  numClass: "text-primary dark:text-[#A6E300]",
                  base: "bg-primary/5 border-primary/15 hover:bg-primary/10 hover:border-primary/25",
                  active: "bg-primary/15 border-primary/40 ring-2 ring-primary/30 ring-offset-1 ring-offset-card shadow-sm" },
                { key: "pending_payment" as const, count: lifecycleCounts.pending_payment, label: "Por Cobrar",
                  numClass: "text-amber-500",
                  base: "bg-amber-500/5 border-amber-500/15 hover:bg-amber-500/10 hover:border-amber-500/25",
                  active: "bg-amber-500/15 border-amber-500/40 ring-2 ring-amber-500/30 ring-offset-1 ring-offset-card shadow-sm" },
                { key: "in_transit" as const, count: lifecycleCounts.in_transit, label: "En Tránsito",
                  numClass: "text-blue-500",
                  base: "bg-blue-500/5 border-blue-500/15 hover:bg-blue-500/10 hover:border-blue-500/25",
                  active: "bg-blue-500/15 border-blue-500/40 ring-2 ring-blue-500/30 ring-offset-1 ring-offset-card shadow-sm" },
                { key: "delivered" as const, count: lifecycleCounts.delivered, label: "Entregadas",
                  numClass: "text-emerald-500",
                  base: "bg-emerald-500/5 border-emerald-500/15 hover:bg-emerald-500/10 hover:border-emerald-500/25",
                  active: "bg-emerald-500/15 border-emerald-500/40 ring-2 ring-emerald-500/30 ring-offset-1 ring-offset-card shadow-sm" },
              ].map(kpi => (
                <button
                  key={kpi.key}
                  onClick={() => handlePanelChange(salesPanel === kpi.key ? "all" : kpi.key)}
                  className={`rounded-xl px-3 py-2.5 text-center transition-all cursor-pointer border ${
                    salesPanel === kpi.key ? kpi.active : kpi.base
                  }`}
                >
                  <p className={`text-lg font-black ${kpi.numClass}`}>{kpi.count}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">{kpi.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, comprador, teléfono u operación..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10 h-10 rounded-xl text-xs"
          />
        </div>

        {/* ── LIFECYCLE SUB-TABS ── */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all" as const, label: "Todas", count: lifecycleCounts.all, icon: Package, color: "" },
            { key: "active" as const, label: "Activas", count: lifecycleCounts.active, icon: TrendingUp, color: "text-primary dark:text-[#A6E300]" },
            { key: "pending_payment" as const, label: "Pago Pendiente", count: lifecycleCounts.pending_payment, icon: CreditCard, color: "text-amber-500" },
            { key: "in_transit" as const, label: "En Tránsito", count: lifecycleCounts.in_transit, icon: Truck, color: "text-blue-500" },
            { key: "delivered" as const, label: "Entregadas", count: lifecycleCounts.delivered, icon: PackageCheck, color: "text-emerald-500" },
            { key: "no_bids" as const, label: "Sin Pujas", count: lifecycleCounts.no_bids, icon: Ban, color: "text-orange-500" },
            { key: "store" as const, label: "Ventas Directas", count: 0, icon: Store, color: "text-violet-500" },
            { key: "other" as const, label: "Otras", count: lifecycleCounts.other, icon: Clock, color: "text-muted-foreground" },
          ].filter(f => f.count > 0 || f.key === "all" || f.key === "store").map(f => (
            <button
              key={f.key}
              onClick={() => handlePanelChange(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                salesPanel === f.key
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
              }`}
            >
              <f.icon className={`h-3 w-3 ${salesPanel === f.key ? "" : f.color}`} />
              <span className="hidden sm:inline">{f.label}</span>
              <span className="sm:hidden">{f.label.split(" ")[0]}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                salesPanel === f.key ? "bg-white/10" : "bg-muted/80 dark:bg-white/10"
              }`}>{f.count}</span>
            </button>
          ))}
        </div>

        {/* ── STORE ORDERS (when Ventas Directas tab selected) ── */}
        {salesPanel === "store" && dealerId ? (
          <DealerStoreOrdersTab dealerId={dealerId} />
        ) : salesPanel === "store" ? (
          <div className="text-center py-12">
            <Store className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Cargando ventas directas...</p>
          </div>
        ) : (
        <>
        {/* ── AUCTION LIST ── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" />
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? `Sin resultados para "${searchQuery}"` : "No hay subastas en esta categoría."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedAuctions.map((auction) => {
              const isEnded = new Date(auction.end_time).getTime() <= Date.now();
              const effectiveStatus = (auction.status === "active" && isEnded) ? "finalized" : auction.status;
              const sc = statusConfig[effectiveStatus] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const isExpanded = expandedAuction === auction.id;
              const winner = auction.winner_id ? winnerProfiles[auction.winner_id] : null;
              const mainImage = auction.images[0]?.image_url || auction.image_url;

              return (
                <div key={auction.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
                  {/* Row header */}
                  <div
                    className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-secondary/10 transition-colors"
                    onClick={() => setExpandedAuction(isExpanded ? null : auction.id)}
                  >
                    {mainImage ? (
                      <img src={mainImage} alt={auction.title} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-border/50" />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-secondary/50 flex items-center justify-center shrink-0">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{auction.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Inicio: ${auction.starting_price.toLocaleString("es-MX")}
                        {auction.current_price > 0 && ` · Actual: $${auction.current_price.toLocaleString("es-MX")}`}
                        {` · ${auction.bids.length} pujas`}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Creada: {new Date(auction.created_at).toLocaleDateString("es-MX")}
                        {winner && <span className="text-primary dark:text-[#A6E300] font-bold ml-2">🏆 Ganador: {winner.full_name}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <Badge variant="outline" className={`text-[10px] rounded-lg ${sc.color}`}>
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
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">
                              <CheckCircle className="h-3 w-3 mr-1" /> Entregado
                            </Badge>
                          );
                        }
                        if (deliveryStatus === "shipped") {
                          return (
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20 animate-pulse">
                              <Truck className="h-3 w-3 mr-1" /> En Camino
                            </Badge>
                          );
                        }
                        if (deliveryStatus === "ready_to_ship") {
                          return (
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-accent/10 text-accent-foreground border-accent/30 font-bold">
                              <Package className="h-3 w-3 mr-1" /> ¡Envía el producto!
                            </Badge>
                          );
                        }
                        if (paymentStatus === "under_review") {
                          return (
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-warning/10 text-warning border-warning/20">
                              <Clock className="h-3 w-3 mr-1" /> Pago en revisión
                            </Badge>
                          );
                        }
                        if (paymentStatus === "verified") {
                          return (
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">
                              <CheckCircle className="h-3 w-3 mr-1" /> Pago verificado
                            </Badge>
                          );
                        }
                        if (paymentStatus === "pending") {
                          return (
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-muted text-muted-foreground border-border">
                              <DollarSign className="h-3 w-3 mr-1" /> Pendiente de pago
                            </Badge>
                          );
                        }
                        if (paymentStatus === "abandoned") {
                          return (
                            <Badge variant="outline" className="text-[10px] rounded-lg bg-red-500/10 text-red-500 border-red-500/20">
                              <XCircle className="h-3 w-3 mr-1" /> Abandonada
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
                    <div className="border-t border-border p-4 sm:p-5 space-y-3 bg-card">
                      {/* Photos gallery */}
                      {auction.images.length > 0 && (
                        <div className="bg-secondary/50 border border-border rounded-xl p-3">
                          <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-2">📷 Fotos ({auction.images.length})</p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {auction.images.map((img, i) => {
                              const canReorder = (auction.status === "pending" || auction.status === "in_review") && auction.images.length > 1;
                              const selKey = `${auction.id}:${i}`;
                              const isSelected = selectedImgKey === selKey;
                              const isSwapTarget = selectedImgKey !== null && selectedImgKey.startsWith(auction.id + ":") && !isSelected && canReorder;
                              return (
                                <div
                                  key={img.id}
                                  className={`relative shrink-0 group rounded-lg transition-all cursor-pointer ${isSelected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background scale-95" : ""
                                    } ${isSwapTarget ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background hover:ring-primary" : ""}`}
                                  onClick={() => {
                                    if (canReorder) {
                                      if (isSelected) {
                                        setSelectedImgKey(null);
                                        return;
                                      }
                                      if (selectedImgKey && selectedImgKey.startsWith(auction.id + ":")) {
                                        const fromIdx = parseInt(selectedImgKey.split(":")[1], 10);
                                        setSelectedImgKey(null);
                                        handleSwapImages(auction, fromIdx, i);
                                        return;
                                      }
                                      setSelectedImgKey(selKey);
                                    } else {
                                      setLightboxImages(auction.images.map(im => im.image_url));
                                      setLightboxIndex(i);
                                    }
                                  }}
                                >
                                  <img
                                    src={img.image_url}
                                    alt={`Foto ${i + 1}`}
                                    className="w-24 h-24 rounded-lg object-cover border border-border/50 group-hover:border-primary/50 hover:shadow-lg transition-all"
                                    draggable={false}
                                  />
                                  {/* Overlay */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center pointer-events-none">
                                    {isSelected
                                      ? <ArrowLeftRight className="h-5 w-5 text-blue-400 opacity-100 animate-pulse" />
                                      : isSwapTarget
                                        ? <ArrowLeftRight className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        : <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />}
                                  </div>
                                  {/* Delete button for pending/in_review */}
                                  {(auction.status === "pending" || auction.status === "in_review") && (
                                    <button
                                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteImage(auction, img.id, img.image_url); }}
                                      title="Eliminar foto"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                  {isSelected && <span className="absolute top-0.5 left-0.5 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold z-10">1º</span>}
                                  {i === 0 && <span className="absolute bottom-1 left-1 text-[8px] bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded font-bold z-10">PRINCIPAL</span>}
                                </div>
                              );
                            })}
                          </div>
                          {(auction.status === "pending" || auction.status === "in_review") && auction.images.length > 1 && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1.5">💡 {selectedImgKey?.startsWith(auction.id) ? "Ahora haz clic en otra imagen para intercambiar" : "Haz clic en una imagen para moverla de posición"}</p>
                          )}
                        </div>
                      )}

                      {/* Add more photos — for pending and in_review */}
                      {(auction.status === "pending" || auction.status === "in_review") && auction.images.length < 10 && (
                        <div className="bg-secondary/50 border border-border rounded-xl p-3">
                          <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-2">➕ Agregar Fotos ({auction.images.length}/10)</p>
                          <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-primary/30 cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all group">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                              {uploadingPhotos === auction.id
                                ? <Loader2 className="h-4 w-4 animate-spin text-primary dark:text-[#A6E300]" />
                                : <Upload className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                              }
                            </div>
                            <div>
                              <span className="text-xs font-bold text-foreground">Subir más fotos</span>
                              <span className="text-[10px] text-muted-foreground block">Puedes agregar hasta {10 - auction.images.length} foto{10 - auction.images.length !== 1 ? "s" : ""} más</span>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={uploadingPhotos === auction.id}
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleAddPhotos(auction, e.target.files);
                                  e.target.value = "";
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}

                      {/* Description */}
                      {auction.description && (
                        <div className="bg-secondary/50 border border-border rounded-xl p-3">
                          <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider mb-1.5">📝 Descripción</p>
                          <p className="text-xs text-foreground/70 leading-relaxed max-h-32 overflow-y-auto pr-2">{auction.description}</p>
                        </div>
                      )}

                      {/* Admin notes */}
                      {auction.admin_notes && (
                        <div className="bg-warning/5 border border-warning/20 rounded-xl p-3">
                          <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1">📋 Notas del Administrador</p>
                          <p className="text-xs text-muted-foreground">{auction.admin_notes}</p>
                        </div>
                      )}

                      {/* Active timer */}
                      {auction.status === "active" && (
                        <div className="bg-secondary/50 border border-border rounded-xl p-3 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">⏰ Finalización</span>
                          <span className="text-xs font-bold text-foreground">
                            {new Date(auction.end_time).toLocaleString("es-MX")}
                            {isEnded && <span className="text-destructive ml-2">— FINALIZADA</span>}
                          </span>
                        </div>
                      )}

                      {/* Bids table */}
                      {auction.bids.length > 0 && (
                        <div className="bg-secondary/50 border border-border rounded-xl overflow-hidden">
                          <div className="px-3 py-2 border-b border-border">
                            <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">🏷️ Pujas ({auction.bids.length})</p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0">
                                <tr className="bg-card border-b border-border">
                                  <th className="px-3 py-2 text-left text-muted-foreground font-bold">#</th>
                                  <th className="px-3 py-2 text-left text-muted-foreground font-bold">Postor</th>
                                  <th className="px-3 py-2 text-right text-muted-foreground font-bold">Monto</th>
                                  <th className="px-3 py-2 text-right text-muted-foreground font-bold">Fecha</th>
                                </tr>
                              </thead>
                              <tbody>
                                {auction.bids.map((bid, index) => (
                                  <tr key={bid.id} className={`border-b border-border/50 last:border-0 ${index === 0 ? "bg-primary/5" : "hover:bg-secondary/20"}`}>
                                    <td className="px-3 py-2 font-bold">{index === 0 ? "👑" : index + 1}</td>
                                    <td className="px-3 py-2">{maskName(bid.bidder_name)}</td>
                                    <td className="px-3 py-2 text-right font-bold text-primary dark:text-[#A6E300]">${bid.amount.toLocaleString("es-MX")}</td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">{new Date(bid.created_at).toLocaleDateString("es-MX")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Winner info */}
                      {(auction.status === "finalized" || (auction.status === "active" && isEnded)) && auction.winner_id && winner && (
                        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-black text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                            <Trophy className="h-3.5 w-3.5" /> Ganador de la Subasta
                          </p>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" /> {winner.full_name}</div>
                            {winner.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" /> {winner.phone}</div>}
                            <div className="flex items-center gap-1.5"><DollarSign className="h-3 w-3 text-muted-foreground" /> Precio final: ${auction.current_price.toLocaleString("es-MX")}</div>
                          </div>
                          <div className="bg-warning/10 border border-warning/25 rounded-xl p-3 flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground font-semibold leading-relaxed">No cobrar directamente. El departamento de cobranza y seguridad gestionará el pago. Envía el producto una vez confirmado el pago.</p>
                          </div>

                          {/* Tracking upload */}
                          {(auction as any).delivery_status === "ready_to_ship" && !(auction as any).tracking_number && (
                            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3 mt-2">
                              <p className="text-sm font-black text-foreground flex items-center gap-1.5">
                                <Truck className="h-4 w-4 text-primary dark:text-[#A6E300]" /> Confirmar Envío
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Completa los datos del envío para notificar al comprador automáticamente.
                              </p>
                              {(auction as any).dealer_ship_deadline && (
                                <p className={`text-[10px] ${new Date((auction as any).dealer_ship_deadline).getTime() < Date.now() ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                                  ⏰ Plazo: {new Date((auction as any).dealer_ship_deadline).toLocaleString("es-MX")}
                                  {new Date((auction as any).dealer_ship_deadline).getTime() < Date.now() && " — VENCIDO"}
                                </p>
                              )}

                              {shippingInfoMap[auction.id] && (
                                <div className="bg-secondary/50 border border-border rounded-xl p-3 text-xs space-y-1">
                                  <p className="font-bold text-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Datos del destinatario:</p>
                                  <p className="text-muted-foreground">{shippingInfoMap[auction.id].full_name} · CI: {shippingInfoMap[auction.id].cedula}</p>
                                  <p className="text-muted-foreground">{shippingInfoMap[auction.id].shipping_company} — {shippingInfoMap[auction.id].office_name}</p>
                                  <p className="text-muted-foreground">{shippingInfoMap[auction.id].city}, {shippingInfoMap[auction.id].state}</p>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Empresa de Envío *</Label>
                                <Select value={trackingCompany[auction.id] || ""} onValueChange={(v) => setTrackingCompany(prev => ({ ...prev, [auction.id]: v }))}>
                                  <SelectTrigger className="rounded-xl text-xs h-9"><SelectValue placeholder="Selecciona la empresa" /></SelectTrigger>
                                  <SelectContent>
                                    {["MRW", "Zoom", "Tealca", "Domesa", "Liberty Express", "Servientrega", "DHL", "FedEx", "Otra"].map(c => (
                                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Número de Guía *</Label>
                                <Input placeholder="Ej: 123456789" value={trackingNumber[auction.id] || ""} onChange={(e) => setTrackingNumber(prev => ({ ...prev, [auction.id]: e.target.value }))} className="rounded-xl text-xs h-9 font-mono" />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Foto del Comprobante *</Label>
                                <label className="flex items-center gap-2 border-2 border-dashed border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 hover:bg-secondary/20 transition-all text-xs">
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
                                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-xl shadow-lg shadow-accent/20"
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
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mt-2">
                              <p className="text-xs font-black text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" /> Envío registrado
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">Guía: <span className="font-mono font-bold text-foreground">{(auction as any).tracking_number}</span></p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="space-y-3 pt-1">
                        {/* Inline Edit Form */}
                        {editingId === auction.id && (
                          <div className="bg-card border border-primary/25 rounded-xl p-4 space-y-3 animate-fade-in">
                            <p className="text-xs font-black text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                              <Edit3 className="h-3.5 w-3.5" /> Editar publicación
                            </p>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">Título *</Label>
                              <Input
                                value={editFields.title}
                                onChange={(e) => setEditFields(f => ({ ...f, title: e.target.value }))}
                                maxLength={55}
                                className="rounded-xl text-xs h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-bold">Descripción</Label>
                              <textarea
                                value={editFields.description}
                                onChange={(e) => setEditFields(f => ({ ...f, description: e.target.value }))}
                                maxLength={2000}
                                rows={5}
                                lang="es"
                                spellCheck={true}
                                className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Precio Inicial ($)</Label>
                                <Input
                                  type="number" min="1" step="0.01"
                                  value={editFields.startingPrice}
                                  onChange={(e) => setEditFields(f => ({ ...f, startingPrice: e.target.value }))}
                                  className="rounded-xl text-xs h-9"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Duración deseada</Label>
                                <select
                                  value={editFields.durationHours}
                                  onChange={(e) => setEditFields(f => ({ ...f, durationHours: e.target.value }))}
                                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs h-8 font-bold"
                              >
                                {savingEdit ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Guardando...</> : <><Save className="h-3 w-3 mr-1" />Guardar cambios</>}
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => setEditingId(null)}
                                className="rounded-xl text-xs h-8"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {(auction.status === "pending" || auction.status === "in_review") && (
                            <>
                              <Button
                                variant="outline" size="sm"
                                onClick={() => editingId === auction.id ? setEditingId(null) : startEdit(auction)}
                                className="text-primary border-primary/30 dark:text-[#A6E300] hover:bg-primary/10 rounded-xl text-xs h-8 font-bold"
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                {editingId === auction.id ? "Cerrar editor" : "Editar"}
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDelete(auction.id)} className="text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl text-xs h-8 font-bold">
                                <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                              </Button>
                            </>
                          )}
                          {(auction.status === "finalized" || auction.status === "rejected") && !auction.winner_id && auction.bids.length === 0 && (
                            <Button variant="outline" size="sm" onClick={() => handleReactivate(auction)} className="text-primary border-primary/30 dark:text-[#A6E300] hover:bg-primary/10 rounded-xl text-xs h-8 font-bold">
                              <RotateCcw className="h-3 w-3 mr-1" /> Reactivar Producto
                            </Button>
                          )}
                          {/* Republish abandoned auctions (skip review) */}
                          {(auction as any).payment_status === "abandoned" && (
                            <div className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" /> El comprador no completó el pago
                              </p>
                              <p className="text-[10px] text-muted-foreground leading-relaxed">
                                Puedes republicar esta subasta directamente sin necesidad de revisión. Tu producto volverá a la plataforma con los mismos datos.
                              </p>
                              <Button
                                size="sm"
                                onClick={() => handleRepublish(auction)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-8 font-bold w-full gap-1.5"
                              >
                                <RotateCcw className="h-3 w-3" /> Republicar Subasta
                              </Button>
                            </div>
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
                            className="text-foreground border-border hover:bg-secondary/50 rounded-xl text-xs h-8 font-bold"
                          >
                            <Copy className="h-3 w-3 mr-1" /> Publicación similar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewAuction(auction)}
                            className="text-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 rounded-xl text-xs h-8 font-bold"
                          >
                            <Eye className="h-3 w-3 mr-1" /> Vista previa
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAGINATION ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredAuctions.length)} de {filteredAuctions.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 p-0 rounded-lg">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-bold px-2">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 p-0 rounded-lg">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        </>
        )}
      </div>

      {/* ── Image Lightbox Modal ── */}
      {
        lightboxImages.length > 0 && (
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
              <XIcon className="h-7 w-7" />
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
        )
      }
    </>
  );
}
