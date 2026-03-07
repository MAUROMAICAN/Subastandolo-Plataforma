import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Trophy, MessageCircle, Mail, Phone, User, Package, Pause, Play, CreditCard, Clock, DollarSign, ChevronLeft, ChevronRight, Loader2, Timer, Zap, CalendarClock, Upload, Eye, Search, Lock, Unlock, Truck, CheckCircle, ReceiptText, ShieldCheck, ChevronDown, ChevronUp, ChevronsUpDown, Bell } from "lucide-react";
import type { AuctionExtended, WinnerInfo } from "./types";

interface Props {
  auctions: AuctionExtended[];
  winnerProfiles: Record<string, WinnerInfo>;
  commissionPct: number;
  fetchAllData: () => Promise<void>;
  globalSearch?: string;
}

const AdminAuctionsTab = ({ auctions, winnerProfiles, commissionPct, fetchAllData, globalSearch = "" }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [auctionFilter, setAuctionFilter] = useState<"visible" | "scheduled" | "archived" | "all">("visible");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);
  const [sendingShipReminder, setSendingShipReminder] = useState<string | null>(null);
  const [sendingShipNotification, setSendingShipNotification] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [newDurationHours, setNewDurationHours] = useState("");
  const [savingTime, setSavingTime] = useState(false);

  // Search, collapse & pagination
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { if (globalSearch) setSearchQuery(globalSearch); }, [globalSearch]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Create "Próximamente" auction state
  const [showCreateScheduled, setShowCreateScheduled] = useState(false);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDescription, setSchedDescription] = useState("");
  const [schedStartingPrice, setSchedStartingPrice] = useState("");
  const [schedImageFiles, setSchedImageFiles] = useState<File[]>([]);
  const [creatingScheduled, setCreatingScheduled] = useState(false);
  const [activateDuration, setActivateDuration] = useState<Record<string, string>>({});
  const [activateDate, setActivateDate] = useState<Record<string, string>>({});
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const handleChangeTime = async (auctionId: string) => {
    const hours = parseFloat(newDurationHours);
    if (isNaN(hours) || hours <= 0) {
      toast({ title: "Ingresa un número de horas válido", variant: "destructive" });
      return;
    }
    setSavingTime(true);
    const newEndTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("auctions").update({ end_time: newEndTime } as any).eq("id", auctionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `⏱️ Tiempo actualizado a ${hours}h desde ahora` });
      setEditingTime(null);
      setNewDurationHours("");
      fetchAllData();
    }
    setSavingTime(false);
  };

  const handleToggleExtended = async (auctionId: string, current: boolean) => {
    const { error } = await supabase.from("auctions").update({ is_extended: !current } as any).eq("id", auctionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "⚡ Etiqueta 'Tiempo Extendido' activada" : "Etiqueta removida" });
      fetchAllData();
    }
  };

  const filteredAuctions = auctions.filter(a => {
    const isArchived = !!a.archived_at;
    let passFilter = false;
    if (auctionFilter === "archived") passFilter = isArchived;
    else if (auctionFilter === "scheduled") passFilter = a.status === "scheduled";
    else if (auctionFilter === "all") passFilter = true;
    else passFilter = !isArchived && (["active", "paused", "finalized"].includes(a.status));
    if (!passFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.dealer_name || "").toLowerCase().includes(q) ||
      (a.operation_number || "").toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAuctions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedAuctions = filteredAuctions.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllCards = () => {
    if (expandedCards.size >= paginatedAuctions.length) {
      setExpandedCards(new Set());
    } else {
      setExpandedCards(new Set(paginatedAuctions.map(a => a.id)));
    }
  };

  const handleCreateScheduled = async () => {
    if (!user || !schedTitle.trim() || schedImageFiles.length < 1) {
      toast({ title: "Completa título y al menos 1 foto", variant: "destructive" });
      return;
    }
    setCreatingScheduled(true);
    const { applyWatermark } = await import("@/lib/watermark");
    const uploadedUrls: string[] = [];
    for (const file of schedImageFiles) {
      const watermarked = await applyWatermark(file);
      const filePath = `${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from("auction-images").upload(filePath, watermarked);
      if (uploadError) {
        toast({ title: "Error subiendo imagen", description: uploadError.message, variant: "destructive" });
        setCreatingScheduled(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("auction-images").getPublicUrl(filePath);
      uploadedUrls.push(urlData.publicUrl);
    }
    const { data, error } = await supabase.from("auctions").insert({
      title: schedTitle,
      description: schedDescription || null,
      starting_price: parseFloat(schedStartingPrice) || 0,
      current_price: 0,
      end_time: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id,
      image_url: uploadedUrls[0] || null,
      status: "scheduled" as any,
    } as any).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setCreatingScheduled(false);
      return;
    }
    if (data && uploadedUrls.length > 0) {
      const imageInserts = uploadedUrls.map((url, index) => ({ auction_id: data.id, image_url: url, display_order: index }));
      await supabase.from("auction_images").insert(imageInserts);
    }
    toast({ title: "📅 Subasta 'Próximamente' creada", description: "Es visible al público pero nadie puede pujar." });
    setSchedTitle(""); setSchedDescription(""); setSchedStartingPrice(""); setSchedImageFiles([]);
    setShowCreateScheduled(false);
    fetchAllData();
    setCreatingScheduled(false);
  };

  const handleActivateScheduled = async (auctionId: string, hours: number, scheduleDate?: string) => {
    const updateData: any = { status: "active" };
    if (scheduleDate) {
      const startTime = new Date(scheduleDate).toISOString();
      updateData.start_time = startTime;
      updateData.end_time = new Date(new Date(scheduleDate).getTime() + hours * 60 * 60 * 1000).toISOString();
    } else {
      updateData.start_time = new Date().toISOString();
      updateData.end_time = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }
    updateData.requested_duration_hours = hours;
    const { error } = await supabase.from("auctions").update(updateData).eq("id", auctionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Subasta activada" });
      // Notify users who favorited this auction (in-app + push)
      const { data: favUsers } = await supabase.from("favorites").select("user_id").eq("auction_id", auctionId);
      if (favUsers && favUsers.length > 0) {
        const auction = auctions.find(a => a.id === auctionId);
        const auctionTitle = auction?.title || "subasta";
        const notifications = favUsers.map(f => ({
          user_id: f.user_id,
          title: "🚀 ¡Subasta activada!",
          message: `La subasta "${auctionTitle}" que marcaste como favorita ya está activa. ¡Puja ahora!`,
          type: "auction_activated",
          link: `/auction/${auctionId}`,
        }));
        await supabase.from("notifications").insert(notifications);

        // Send push notifications to favorited users
        const favUserIds = favUsers.map(f => f.user_id);
        const { data: pushSubs } = await supabase
          .from("push_subscriptions")
          .select("*")
          .in("user_id", favUserIds);

        if (pushSubs && pushSubs.length > 0) {
          try {
            await supabase.functions.invoke("send-push-to-users", {
              body: {
                userIds: favUserIds,
                title: "🚀 ¡Subasta activada!",
                body: `"${auctionTitle}" ya está activa. ¡Puja ahora!`,
                url: `/auction/${auctionId}`,
                tag: "auction_activated",
              },
            });
          } catch (e) {
            console.error("Push notification error:", e);
          }
        }
      }
      fetchAllData();
    }
  };

  const handlePauseAuction = async (auctionId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await supabase.from("auctions").update({ status: newStatus } as any).eq("id", auctionId);
    toast({ title: newStatus === "paused" ? "⏸ Subasta pausada" : "▶️ Subasta reactivada" });
    fetchAllData();
  };

  const handleArchiveAuction = async (auctionId: string, isArchived: boolean) => {
    const updateData: any = isArchived ? { archived_at: null } : { archived_at: new Date().toISOString() };
    await supabase.from("auctions").update(updateData).eq("id", auctionId);
    toast({ title: isArchived ? "📂 Subasta restaurada" : "📦 Subasta archivada" });
    fetchAllData();
  };

  const handleDelete = async (auctionId: string) => {
    await supabase.from("platform_earnings").delete().eq("auction_id", auctionId);
    await supabase.from("payment_proofs").delete().eq("auction_id", auctionId);
    await supabase.from("shipping_info").delete().eq("auction_id", auctionId);
    await supabase.from("shipping_audit_log").delete().eq("auction_id", auctionId);
    await supabase.from("bids").delete().eq("auction_id", auctionId);
    await supabase.from("auction_images").delete().eq("auction_id", auctionId);
    await supabase.from("reviews").delete().eq("auction_id", auctionId);
    await supabase.from("dispute_messages").delete().in("dispute_id",
      (await supabase.from("disputes").select("id").eq("auction_id", auctionId)).data?.map(d => d.id) || []
    );
    await supabase.from("disputes").delete().eq("auction_id", auctionId);
    await supabase.from("auction_reports").delete().eq("auction_id", auctionId);
    const { error } = await supabase.from("auctions").delete().eq("id", auctionId);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "🗑️ Subasta eliminada permanentemente" });
    fetchAllData();
  };

  const handleSendEmail = async (auctionId: string) => {
    setSendingEmail(auctionId);
    try {
      const auction = auctions.find(a => a.id === auctionId);
      if (!auction || !auction.winner_id) {
        toast({ title: "No hay ganador para esta subasta", variant: "destructive" });
        setSendingEmail(null);
        return;
      }
      const winner = winnerProfiles[auction.winner_id];
      if (!winner) {
        toast({ title: "No se encontró el perfil del ganador", variant: "destructive" });
        setSendingEmail(null);
        return;
      }
      if (!winner.email) {
        toast({ title: "El ganador no tiene email registrado", variant: "destructive" });
        setSendingEmail(null);
        return;
      }
      const mainImage = auction.images[0]?.image_url || auction.image_url;
      const { data, error } = await supabase.functions.invoke("notify-auction-won", {
        body: {
          email: winner.email,
          name: winner.full_name,
          auctionTitle: auction.title,
          auctionId: auction.id,
          winningBid: auction.current_price,
          imageUrl: mainImage || null,
          userId: auction.winner_id,
        },
      });
      if (error || data?.error) {
        toast({ title: "Error al enviar correo", description: error?.message || data?.error, variant: "destructive" });
      } else {
        toast({ title: "📧 Correo enviado al ganador" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Error desconocido", variant: "destructive" });
    }
    setSendingEmail(null);
  };

  const openWhatsApp = (phone: string, title: string, price: number) => {
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
    // Si empieza con 0 (formato local venezolano), reemplazar por +58
    if (cleaned.startsWith("0")) {
      cleaned = "58" + cleaned.substring(1);
    }
    // Si no empieza con + ni con código de país, agregar 58
    if (!cleaned.startsWith("+") && !cleaned.startsWith("58")) {
      cleaned = "58" + cleaned;
    }
    // Quitar el + si quedó
    cleaned = cleaned.replace(/\D/g, "");
    const msg = encodeURIComponent(`🎉 ¡Felicidades! Ganaste la subasta "${title}" por $${price.toLocaleString("es-MX")}.`);
    window.open(`https://wa.me/${cleaned}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary dark:text-accent" /> Gestión de Subastas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {auctions.filter(a => a.status === "active").length} activas · {auctions.filter(a => a.status === "finalized").length} finalizadas · {auctions.filter(a => a.status === "scheduled").length} programadas
          </p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["visible", "scheduled", "archived", "all"] as const).map(f => (
            <Button key={f} variant={auctionFilter === f ? "default" : "outline"} size="sm" className="text-xs h-7 rounded-sm" onClick={() => { setAuctionFilter(f); setCurrentPage(1); }}>
              {f === "visible" ? "Visibles" : f === "scheduled" ? "📅 Próximamente" : f === "archived" ? "Archivadas" : "Todas"}
            </Button>
          ))}
          <Button size="sm" className="text-xs h-7 rounded-sm bg-accent text-accent-foreground" onClick={() => setShowCreateScheduled(!showCreateScheduled)}>
            <CalendarClock className="h-3 w-3 mr-1" /> Crear Próximamente
          </Button>
        </div>
      </div>

      {/* Search bar + controls */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, dealer, operación o ID..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9 h-9 rounded-sm text-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-9 text-xs rounded-sm gap-1.5" onClick={toggleAllCards}>
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {expandedCards.size >= paginatedAuctions.length ? "Colapsar Todo" : "Expandir Todo"}
          </Button>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="flex h-9 rounded-sm border border-input bg-background px-3 py-1 text-xs"
          >
            <option value={25}>25/pág</option>
            <option value={50}>50/pág</option>
            <option value={100}>100/pág</option>
          </select>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredAuctions.length} resultado{filteredAuctions.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Create scheduled auction form */}
      {showCreateScheduled && (
        <Card className="border-2 border-accent/30 rounded-sm">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-accent" /> Crear Subasta "Próximamente"
            </h3>
            <p className="text-[10px] text-muted-foreground">Esta subasta será visible al público pero nadie podrá pujar. Luego podrás activarla asignándole duración.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} placeholder="Ej: iPhone 15 Pro Max" className="rounded-sm" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea value={schedDescription} onChange={(e) => setSchedDescription(e.target.value)} placeholder="Descripción del producto..." rows={3} className="rounded-sm" maxLength={2000} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Precio inicial ($)</Label>
              <Input type="number" min="0" step="0.01" value={schedStartingPrice} onChange={(e) => setSchedStartingPrice(e.target.value)} placeholder="100" className="rounded-sm max-w-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fotos * (mín. 1, máx. 10)</Label>
              <label className="flex items-center gap-2 px-4 py-3 rounded-sm border border-dashed border-accent/40 text-sm text-accent cursor-pointer hover:bg-accent/5 transition-colors w-full justify-center">
                <Upload className="h-4 w-4" />
                Seleccionar fotos ({schedImageFiles.length}/10)
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (schedImageFiles.length + files.length > 10) { toast({ title: "Máximo 10 fotos", variant: "destructive" }); return; }
                  setSchedImageFiles(prev => [...prev, ...files]);
                }} />
              </label>
              {schedImageFiles.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {schedImageFiles.map((file, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-sm overflow-hidden border border-border shrink-0">
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setSchedImageFiles(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-[9px]">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateScheduled} disabled={creatingScheduled || !schedTitle.trim() || schedImageFiles.length < 1} size="sm" className="rounded-sm text-xs">
                {creatingScheduled ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CalendarClock className="h-3 w-3 mr-1" />}
                Crear Próximamente
              </Button>
              <Button variant="outline" size="sm" className="rounded-sm text-xs" onClick={() => setShowCreateScheduled(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}
      {paginatedAuctions.map(auction => {
        const isEnded = new Date(auction.end_time).getTime() <= Date.now();
        const winner = auction.winner_id ? winnerProfiles[auction.winner_id] : null;
        const mainImage = auction.images[0]?.image_url || auction.image_url;
        const isArchived = !!auction.archived_at;
        const isExpanded = expandedCards.has(auction.id);
        const statusStyles: Record<string, string> = {
          active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          paused: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          finalized: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20",
          scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        };
        const statusLabels: Record<string, string> = {
          active: "Activa", paused: "Pausada", finalized: "Finalizada",
          scheduled: "Próximamente", pending: "Pendiente",
        };
        return (
          <Card key={auction.id} className={`border rounded-sm transition-all overflow-hidden ${isArchived ? "border-muted opacity-60" : "border-border hover:border-primary/30 hover:shadow-sm"}`}>
            <CardContent className="p-0">
              {/* ═══ Card Header (always visible, click to toggle) ═══ */}
              <div className="flex items-stretch gap-0 cursor-pointer" onClick={() => toggleCard(auction.id)}>
                {mainImage && (
                  <img
                    src={mainImage}
                    className="w-24 h-auto min-h-[96px] object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity border-r border-border"
                    onClick={() => navigate(`/auction/${auction.id}`)}
                    alt=""
                  />
                )}
                <div className="flex-1 min-w-0 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 min-w-0 cursor-pointer group"
                      onClick={() => navigate(`/auction/${auction.id}`)}
                    >
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-heading font-bold text-sm truncate group-hover:text-primary dark:group-hover:text-accent transition-colors">{auction.title}</h4>
                        <Badge variant="outline" className={`text-[10px] font-semibold ${statusStyles[auction.status] || ""}`}>
                          {statusLabels[auction.status] || auction.status}
                        </Badge>
                        {isArchived && <Badge variant="secondary" className="text-[10px]">📦 Archivada</Badge>}
                        {(auction as any).is_extended && (
                          <Badge className="text-[10px] bg-accent text-accent-foreground border-0 animate-pulse">
                            <Zap className="h-2.5 w-2.5 mr-0.5" />EXTENDIDA
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{auction.dealer_name}</span>
                        <span className="font-bold text-foreground">${auction.current_price.toLocaleString("es-MX")}</span>
                        <span>{auction.bids_count} pujas</span>
                        {auction.operation_number && <span className="font-mono text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded">{auction.operation_number}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />Fin: {new Date(auction.end_time).toLocaleString("es-MX")}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" title="Ver subasta" onClick={() => navigate(`/auction/${auction.id}`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {["active", "paused"].includes(auction.status) && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" title="Editar tiempo" onClick={() => { setEditingTime(editingTime === auction.id ? null : auction.id); setNewDurationHours(""); }}>
                            <Timer className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-500/10" title={auction.status === "paused" ? "Reanudar" : "Pausar"} onClick={() => handlePauseAuction(auction.id, auction.status)}>
                            {auction.status === "paused" ? <Play className="h-3.5 w-3.5 text-emerald-500" /> : <Pause className="h-3.5 w-3.5 text-amber-500" />}
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" title={isArchived ? "Restaurar" : "Archivar"} onClick={() => handleArchiveAuction(auction.id, isArchived)}>
                        <Package className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" title="Eliminar"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar subasta?</AlertDialogTitle>
                            <AlertDialogDescription>Esta acción es irreversible. Se eliminará "{auction.title}" permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(auction.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary" title={isExpanded ? "Colapsar" : "Expandir"} onClick={() => toggleCard(auction.id)}>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ Collapsible Body ═══ */}
              {isExpanded && <div className="border-t border-border">

                {/* Time editing & Extended toggle */}
                {editingTime === auction.id && (
                  <div className="p-3 rounded-sm bg-secondary/50 border border-border space-y-3">
                    <p className="text-xs font-heading font-bold flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5 text-primary dark:text-accent" /> Cambiar Tiempo de Subasta
                    </p>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1 max-w-xs">
                        <Label className="text-[10px]">Nuevas horas desde ahora</Label>
                        <select
                          value={newDurationHours}
                          onChange={(e) => setNewDurationHours(e.target.value)}
                          className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="">Seleccionar...</option>
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
                      <Button size="sm" onClick={() => handleChangeTime(auction.id)} disabled={savingTime || !newDurationHours} className="rounded-sm text-xs h-9">
                        {savingTime ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aplicar"}
                      </Button>
                    </div>
                    {newDurationHours && (
                      <p className="text-[10px] text-muted-foreground">
                        Nuevo fin: <strong className="text-foreground">{new Date(Date.now() + parseFloat(newDurationHours) * 60 * 60 * 1000).toLocaleString("es-MX")}</strong>
                      </p>
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <div>
                        <p className="text-xs font-medium flex items-center gap-1"><Zap className="h-3 w-3 text-accent" /> Etiqueta "Tiempo Extendido"</p>
                        <p className="text-[10px] text-muted-foreground">Visible para compradores en la tarjeta de subasta</p>
                      </div>
                      <Switch checked={(auction as any).is_extended || false} onCheckedChange={() => handleToggleExtended(auction.id, (auction as any).is_extended || false)} />
                    </div>
                  </div>
                )}

                {/* Activate scheduled auction */}
                {auction.status === "scheduled" && (
                  <div className="p-3 rounded-sm bg-accent/5 border border-accent/20 space-y-3">
                    <p className="text-xs font-heading font-bold flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 text-accent" /> Activar Subasta
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Duración *</Label>
                        <select value={activateDuration[auction.id] || ""} onChange={(e) => setActivateDuration(p => ({ ...p, [auction.id]: e.target.value }))} className="flex h-9 w-full rounded-sm border border-input bg-background px-3 py-1 text-sm">
                          <option value="">Seleccionar...</option>
                          <option value="1">1 hora</option>
                          <option value="2">2 horas</option>
                          <option value="3">3 horas</option>
                          <option value="6">6 horas</option>
                          <option value="12">12 horas</option>
                          <option value="24">1 día</option>
                          <option value="48">2 días</option>
                          <option value="72">3 días</option>
                          <option value="96">4 días</option>
                          <option value="120">5 días</option>
                          <option value="144">6 días</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Programar inicio (opcional)</Label>
                        <Input type="datetime-local" value={activateDate[auction.id] || ""} onChange={(e) => setActivateDate(p => ({ ...p, [auction.id]: e.target.value }))} min={new Date().toISOString().slice(0, 16)} className="rounded-sm h-9 text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-sm text-xs" disabled={!activateDuration[auction.id] || activatingId === auction.id} onClick={async () => {
                        setActivatingId(auction.id);
                        await handleActivateScheduled(auction.id, parseInt(activateDuration[auction.id]), activateDate[auction.id] || undefined);
                        setActivatingId(null);
                      }}>
                        {activatingId === auction.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                        {activateDate[auction.id] ? "Programar Inicio" : "Activar Ahora"}
                      </Button>
                    </div>
                  </div>
                )}

                {isEnded && winner && (
                  <div className="mx-4 mb-3 rounded-lg border border-primary/20 overflow-hidden">
                    {/* Winner Header */}
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent dark:from-accent/10 dark:via-accent/5 px-4 py-2.5 flex items-center gap-2 border-b border-primary/10">
                      <div className="h-8 w-8 rounded-full bg-primary/15 dark:bg-accent/15 flex items-center justify-center">
                        <Trophy className="h-4 w-4 text-primary dark:text-accent" />
                      </div>
                      <div>
                        <p className="text-xs font-heading font-bold text-primary dark:text-accent">Ganador de la Subasta</p>
                        <p className="text-[10px] text-muted-foreground">Precio final: <strong className="text-foreground">${auction.current_price.toLocaleString("es-MX")}</strong></p>
                      </div>
                    </div>
                    {/* Winner Details */}
                    <div className="px-4 py-3 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-2.5 bg-secondary/30 rounded-sm px-3 py-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground">Nombre</p>
                            <p className="text-xs font-semibold">{winner.full_name}</p>
                          </div>
                        </div>
                        {winner.phone && (
                          <div className="flex items-center gap-2.5 bg-secondary/30 rounded-sm px-3 py-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Teléfono</p>
                              <p className="text-xs font-semibold font-mono">{winner.phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {winner.phone && (
                          <Button size="sm" className="text-xs h-8 rounded-sm bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none" onClick={() => openWhatsApp(winner.phone!, auction.title, auction.current_price)}>
                            <MessageCircle className="h-3.5 w-3.5 mr-1.5" />WhatsApp
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-xs h-8 rounded-sm flex-1 sm:flex-none" onClick={() => handleSendEmail(auction.id)} disabled={sendingEmail === auction.id}>
                          {sendingEmail === auction.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />}
                          Enviar Correo
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {isEnded && auction.winner_id && (() => {
                  const payStatus = (auction as any).payment_status || "pending";
                  const delStatus = (auction as any).delivery_status || "pending";
                  const frozen = (auction as any).funds_frozen;
                  const PayIcon: Record<string, any> = { pending: Clock, under_review: Search, verified: CheckCircle, escrow: Lock, released: Unlock, refunded: ReceiptText };
                  const paymentSteps = [
                    { key: "pending", label: "Pendiente", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
                    { key: "under_review", label: "En Revisión", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
                    { key: "verified", label: "Verificado", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" },
                    { key: "escrow", label: "Custodia", color: "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20" },
                    { key: "released", label: "Liberado", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                    { key: "refunded", label: "Reembolsado", color: "text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20" },
                  ];
                  const DelIcon: Record<string, any> = { pending: Package, ready_to_ship: ShieldCheck, shipped: Truck, delivered: CheckCircle };
                  const deliverySteps = [
                    { key: "pending", label: "Pendiente", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
                    { key: "ready_to_ship", label: "Listo", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" },
                    { key: "shipped", label: "Enviado", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
                    { key: "delivered", label: "Entregado", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                  ];
                  const currentPayIdx = paymentSteps.findIndex(s => s.key === payStatus);
                  const currentDelIdx = deliverySteps.findIndex(s => s.key === delStatus);
                  const changePayment = async (targetIdx: number) => {
                    if (targetIdx < 0 || targetIdx >= paymentSteps.length || targetIdx === currentPayIdx) return;
                    const newStatus = paymentSteps[targetIdx].key;
                    const updateData: any = { payment_status: newStatus };
                    if (newStatus === "escrow") updateData.paid_at = new Date().toISOString();
                    if (newStatus === "released") updateData.funds_released_at = new Date().toISOString();
                    await supabase.from("auctions").update(updateData).eq("id", auction.id);
                    toast({ title: `Pago → ${paymentSteps[targetIdx].label}` }); fetchAllData();
                  };
                  const changeDelivery = async (targetIdx: number) => {
                    if (targetIdx < 0 || targetIdx >= deliverySteps.length || targetIdx === currentDelIdx) return;
                    const newStatus = deliverySteps[targetIdx].key;
                    const updateData: any = { delivery_status: newStatus };
                    if (newStatus === "ready_to_ship") updateData.dealer_ship_deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
                    if (newStatus === "delivered") updateData.delivered_at = new Date().toISOString();
                    await supabase.from("auctions").update(updateData).eq("id", auction.id);
                    toast({ title: `Envío → ${deliverySteps[targetIdx].label}` }); fetchAllData();
                  };
                  const currentPayStep = paymentSteps[currentPayIdx];
                  const currentDelStep = deliverySteps[currentDelIdx];
                  const CurrentPayIcon = PayIcon[payStatus] || Clock;
                  const CurrentDelIcon = DelIcon[delStatus] || Package;
                  return (
                    <div className="mx-4 mb-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-heading font-bold flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-primary dark:text-accent" /> Estado de Fondos</p>
                        {frozen && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 font-bold animate-pulse">🔒 CONGELADO</Badge>}
                      </div>

                      {/* ═══ PAGO ═══ */}
                      <div className="rounded-lg border border-border bg-card overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">💳 Pago</span>
                            <Badge variant="outline" className={`text-[10px] font-bold ${currentPayStep?.color || ""}`}>
                              <CurrentPayIcon className="h-3 w-3 mr-1" />{currentPayStep?.label || payStatus}
                            </Badge>
                          </div>
                          <span className="text-[9px] text-muted-foreground">Click para cambiar</span>
                        </div>
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {paymentSteps.map((step, i) => {
                              const isActive = i === currentPayIdx; const isPast = i < currentPayIdx;
                              const StepIcon = PayIcon[step.key] || Clock;
                              return (
                                <div key={step.key} className="flex items-center flex-1">
                                  <button
                                    onClick={() => changePayment(i)}
                                    className={`flex flex-col items-center flex-1 transition-all group cursor-pointer ${isActive || isPast ? "" : "opacity-40 hover:opacity-70"}`}
                                    title={`${step.label} — click para seleccionar`}
                                  >
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all group-hover:scale-110 group-hover:shadow-md ${isActive ? step.color + " ring-2 ring-offset-2 ring-offset-background ring-current/20 shadow-sm"
                                      : isPast ? "bg-primary/10 text-primary dark:text-accent border-primary/30 group-hover:ring-1 group-hover:ring-primary/20"
                                        : "bg-muted/50 border-border text-muted-foreground group-hover:border-primary/40 group-hover:text-primary dark:group-hover:text-accent"
                                      }`}>
                                      {isPast ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-[9px] mt-1 text-center leading-tight transition-colors ${isActive ? "font-bold text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>{step.label}</span>
                                  </button>
                                  {i < paymentSteps.length - 1 && (
                                    <div className={`h-0.5 w-full min-w-2 mx-0.5 rounded-full transition-colors ${i < currentPayIdx ? "bg-primary dark:bg-accent" : "bg-border"}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Payment Reminder Button */}
                        {(payStatus === "pending" || payStatus === "under_review") && (() => {
                          const winner = winnerProfiles[auction.winner_id!];
                          return winner?.email ? (
                            <div className="px-4 pb-3 -mt-1 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[11px] h-8 rounded-md gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-500"
                                disabled={sendingReminder === auction.id}
                                onClick={async () => {
                                  setSendingReminder(auction.id);
                                  try {
                                    const mainImage = auction.images[0]?.image_url || auction.image_url;
                                    const { data, error } = await supabase.functions.invoke("notify-payment-reminder", {
                                      body: {
                                        email: winner.email,
                                        name: winner.full_name,
                                        auctionTitle: auction.title,
                                        auctionId: auction.id,
                                        winningBid: auction.current_price,
                                        imageUrl: mainImage || null,
                                        userId: auction.winner_id,
                                        operationNumber: (auction as any).operation_number || null,
                                        auctionDate: auction.end_time ? new Date(auction.end_time).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : null,
                                      },
                                    });
                                    if (error || data?.error) {
                                      toast({ title: "Error al enviar recordatorio", description: error?.message || data?.error, variant: "destructive" });
                                    } else {
                                      toast({ title: "📧 Correo de recordatorio enviado", description: `Enviado a ${winner.email}` });
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Error", description: err?.message, variant: "destructive" });
                                  }
                                  setSendingReminder(null);
                                }}
                              >
                                {sendingReminder === auction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                                Correo
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[11px] h-8 rounded-md gap-1.5 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 hover:text-blue-500"
                                disabled={sendingNotification === auction.id}
                                onClick={async () => {
                                  setSendingNotification(auction.id);
                                  try {
                                    const amount = `$${auction.current_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
                                    const { data, error } = await supabase.functions.invoke("notify-push", {
                                      body: {
                                        user_id: auction.winner_id,
                                        title: `⚠️ Pago pendiente: "${auction.title}"`,
                                        message: `Hola ${winner.full_name}, recuerda completar tu pago de ${amount} para recibir tu producto. Ingresa a la plataforma y sube tu comprobante.`,
                                        type: "payment_reminder",
                                        link: `/subasta/${auction.id}`,
                                      },
                                    });
                                    if (error || data?.error) {
                                      toast({ title: "Error al enviar notificación", description: error?.message || data?.error, variant: "destructive" });
                                    } else {
                                      toast({ title: "🔔 Notificación enviada", description: `Enviada a ${winner.full_name} (app + web)` });
                                    }
                                  } catch (err: any) {
                                    toast({ title: "Error", description: err?.message, variant: "destructive" });
                                  }
                                  setSendingNotification(null);
                                }}
                              >
                                {sendingNotification === auction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                                Notificación
                              </Button>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* ═══ ENVÍO ═══ */}
                      <div className="rounded-lg border border-border bg-card overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/30 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">📦 Envío</span>
                            <Badge variant="outline" className={`text-[10px] font-bold ${currentDelStep?.color || ""}`}>
                              <CurrentDelIcon className="h-3 w-3 mr-1" />{currentDelStep?.label || delStatus}
                            </Badge>
                          </div>
                          <span className="text-[9px] text-muted-foreground">Click para cambiar</span>
                        </div>
                        <div className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {deliverySteps.map((step, i) => {
                              const isActive = i === currentDelIdx; const isPast = i < currentDelIdx;
                              const StepIcon = DelIcon[step.key] || Package;
                              return (
                                <div key={step.key} className="flex items-center flex-1">
                                  <button
                                    onClick={() => changeDelivery(i)}
                                    className={`flex flex-col items-center flex-1 transition-all group cursor-pointer ${isActive || isPast ? "" : "opacity-40 hover:opacity-70"}`}
                                    title={`${step.label} — click para seleccionar`}
                                  >
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all group-hover:scale-110 group-hover:shadow-md ${isActive ? step.color + " ring-2 ring-offset-2 ring-offset-background ring-current/20 shadow-sm"
                                      : isPast ? "bg-primary/10 text-primary dark:text-accent border-primary/30 group-hover:ring-1 group-hover:ring-primary/20"
                                        : "bg-muted/50 border-border text-muted-foreground group-hover:border-primary/40 group-hover:text-primary dark:group-hover:text-accent"
                                      }`}>
                                      {isPast ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                                    </div>
                                    <span className={`text-[9px] mt-1 text-center leading-tight transition-colors ${isActive ? "font-bold text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>{step.label}</span>
                                  </button>
                                  {i < deliverySteps.length - 1 && (
                                    <div className={`h-0.5 w-full min-w-2 mx-0.5 rounded-full transition-colors ${i < currentDelIdx ? "bg-primary dark:bg-accent" : "bg-border"}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {/* Shipping Reminder Buttons */}
                      {(delStatus === "pending" || delStatus === "preparing" || delStatus === "ready") && (() => {
                        const winner = winnerProfiles[auction.winner_id!];
                        return (
                          <div className="px-4 pb-3 -mt-1 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-[11px] h-8 rounded-md gap-1.5 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 hover:text-blue-500"
                              disabled={sendingShipReminder === auction.id}
                              onClick={async () => {
                                setSendingShipReminder(auction.id);
                                try {
                                  // Fetch dealer profile
                                  const { data: dealerProfile } = await supabase.from("profiles").select("full_name, id").eq("id", (auction as any).user_id).single();
                                  const { data: authData } = await supabase.rpc("get_user_email_admin" as any, { target_user_id: (auction as any).user_id });
                                  const dealerEmail = authData || null;
                                  const dealerName = dealerProfile?.full_name || auction.dealer_name || "Dealer";

                                  if (!dealerEmail) {
                                    toast({ title: "No se encontró el email del dealer", variant: "destructive" });
                                    setSendingShipReminder(null);
                                    return;
                                  }
                                  const mainImage = auction.images[0]?.image_url || auction.image_url;
                                  const { data, error } = await supabase.functions.invoke("notify-shipping-reminder", {
                                    body: {
                                      email: dealerEmail,
                                      name: dealerName,
                                      auctionTitle: auction.title,
                                      auctionId: auction.id,
                                      winningBid: auction.current_price,
                                      imageUrl: mainImage || null,
                                      userId: (auction as any).user_id,
                                      operationNumber: (auction as any).operation_number || null,
                                      buyerName: winner?.full_name || "el comprador",
                                    },
                                  });
                                  if (error || data?.error) {
                                    toast({ title: "Error al enviar recordatorio", description: error?.message || data?.error, variant: "destructive" });
                                  } else {
                                    toast({ title: "📧 Correo de envío enviado al dealer", description: `Enviado a ${dealerEmail}` });
                                  }
                                } catch (err: any) {
                                  toast({ title: "Error", description: err?.message, variant: "destructive" });
                                }
                                setSendingShipReminder(null);
                              }}
                            >
                              {sendingShipReminder === auction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                              Correo Dealer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-[11px] h-8 rounded-md gap-1.5 border-purple-500/30 text-purple-600 hover:bg-purple-500/10 hover:text-purple-500"
                              disabled={sendingShipNotification === auction.id}
                              onClick={async () => {
                                setSendingShipNotification(auction.id);
                                try {
                                  const dealerName = auction.dealer_name || "Dealer";
                                  const winner = winnerProfiles[auction.winner_id!];
                                  const amount = `$${auction.current_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
                                  const { data, error } = await supabase.functions.invoke("notify-push", {
                                    body: {
                                      user_id: (auction as any).user_id,
                                      title: `📦 Envío pendiente: "${auction.title}"`,
                                      message: `Hola ${dealerName}, el comprador ${winner?.full_name || ""} ya pagó ${amount}. Por favor, procede con el envío del artículo.`,
                                      type: "shipping_reminder",
                                      link: `/subasta/${auction.id}`,
                                    },
                                  });
                                  if (error || data?.error) {
                                    toast({ title: "Error al enviar notificación", description: error?.message || data?.error, variant: "destructive" });
                                  } else {
                                    toast({ title: "🔔 Notificación enviada al dealer", description: `Enviada a ${dealerName} (app + web)` });
                                  }
                                } catch (err: any) {
                                  toast({ title: "Error", description: err?.message, variant: "destructive" });
                                }
                                setSendingShipNotification(null);
                              }}
                            >
                              {sendingShipNotification === auction.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                              Notificación Dealer
                            </Button>
                          </div>
                        );
                      })()}

                      {/* Auto-release notice */}
                      {
                        (auction as any).delivered_at && !frozen && payStatus === "escrow" && (
                          <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-lg px-4 py-2.5">
                            <Clock className="h-4 w-4 text-primary dark:text-accent shrink-0" />
                            <p className="text-xs text-primary dark:text-accent">Auto-liberación: <strong>{new Date(new Date((auction as any).delivered_at).getTime() + 72 * 60 * 60 * 1000).toLocaleString("es-MX")}</strong></p>
                          </div>
                        )
                      }

                      {/* ═══ COMISIÓN ═══ */}
                      {
                        auction.winner_id && (
                          <div className="rounded-lg border border-border bg-card overflow-hidden">
                            <div className="px-4 py-2.5 bg-secondary/30 border-b border-border">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" /> Desglose de Comisión
                              </span>
                            </div>
                            <div className="grid grid-cols-3 divide-x divide-border">
                              <div className="p-3 text-center">
                                <ReceiptText className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground mb-0.5">Venta Total</p>
                                <p className="text-base font-heading font-bold text-foreground">${auction.current_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="p-3 text-center bg-primary/5 dark:bg-accent/5">
                                <DollarSign className="h-4 w-4 text-primary dark:text-accent mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground mb-0.5">Comisión ({commissionPct}%)</p>
                                <p className="text-base font-heading font-bold text-primary dark:text-accent">${(auction.current_price * commissionPct / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="p-3 text-center">
                                <User className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                                <p className="text-[10px] text-muted-foreground mb-0.5">Dealer Recibe</p>
                                <p className="text-base font-heading font-bold text-foreground">${(auction.current_price * (1 - commissionPct / 100)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                    </div>
                  );
                })()}
              </div>}
            </CardContent>
          </Card>
        );
      })}

      {/* Pagination */}
      {
        totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredAuctions.length)} de {filteredAuctions.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Anterior
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let page: number;
                if (totalPages <= 7) page = i + 1;
                else if (safePage <= 4) page = i + 1;
                else if (safePage >= totalPages - 3) page = totalPages - 6 + i;
                else page = safePage - 3 + i;
                return (
                  <Button key={page} variant={page === safePage ? "default" : "outline"} size="sm" className="h-8 w-8 text-xs rounded-sm p-0" onClick={() => setCurrentPage(page)}>
                    {page}
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                Siguiente <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default AdminAuctionsTab;
