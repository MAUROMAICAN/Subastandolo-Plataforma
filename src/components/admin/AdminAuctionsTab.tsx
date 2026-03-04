import { useState } from "react";
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
import { Trash2, Trophy, MessageCircle, Mail, Phone, User, Package, Pause, Play, CreditCard, Clock, DollarSign, ChevronLeft, Loader2, Timer, Zap, CalendarClock, Plus, Upload } from "lucide-react";
import type { AuctionExtended, WinnerInfo } from "./types";

interface Props {
  auctions: AuctionExtended[];
  winnerProfiles: Record<string, WinnerInfo>;
  commissionPct: number;
  fetchAllData: () => Promise<void>;
}

const AdminAuctionsTab = ({ auctions, winnerProfiles, commissionPct, fetchAllData }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [auctionFilter, setAuctionFilter] = useState<"visible" | "scheduled" | "archived" | "all">("visible");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<string | null>(null);
  const [newDurationHours, setNewDurationHours] = useState("");
  const [savingTime, setSavingTime] = useState(false);

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
    if (auctionFilter === "archived") return isArchived;
    if (auctionFilter === "scheduled") return a.status === "scheduled";
    if (auctionFilter === "all") return true;
    return !isArchived && (["active", "paused", "finalized"].includes(a.status));
  });

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
    const { data, error } = await supabase.functions.invoke("notify-winner", { body: { auction_id: auctionId } });
    if (error || data?.error) toast({ title: "Error", variant: "destructive" });
    else toast({ title: "📧 Correo enviado" });
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-heading font-bold">Gestión de Subastas ({auctions.length})</h1>
        <div className="flex items-center gap-1 flex-wrap">
          {(["visible", "scheduled", "archived", "all"] as const).map(f => (
            <Button key={f} variant={auctionFilter === f ? "default" : "outline"} size="sm" className="text-xs h-7 rounded-sm" onClick={() => setAuctionFilter(f)}>
              {f === "visible" ? "Visibles" : f === "scheduled" ? "📅 Próximamente" : f === "archived" ? "Archivadas" : "Todas"}
            </Button>
          ))}
          <Button size="sm" className="text-xs h-7 rounded-sm bg-accent text-accent-foreground" onClick={() => setShowCreateScheduled(!showCreateScheduled)}>
            <CalendarClock className="h-3 w-3 mr-1" /> Crear Próximamente
          </Button>
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
      {filteredAuctions.map(auction => {
        const isEnded = new Date(auction.end_time).getTime() <= Date.now();
        const winner = auction.winner_id ? winnerProfiles[auction.winner_id] : null;
        const mainImage = auction.images[0]?.image_url || auction.image_url;
        const isArchived = !!auction.archived_at;
        return (
          <Card key={auction.id} className={`border rounded-sm ${isArchived ? "border-muted opacity-60" : "border-border"}`}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-3 group">
                {mainImage && (
                  <img
                    src={mainImage}
                    className="w-16 h-16 rounded-sm object-cover border border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/auction/${auction.id}`)}
                    alt=""
                  />
                )}
                <div
                  className="flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => navigate(`/auction/${auction.id}`)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{auction.title}</h4>
                    <Badge variant="outline" className="text-[10px]">{auction.status}</Badge>
                    {isArchived && <Badge variant="secondary" className="text-[10px]">Archivada</Badge>}
                    {(auction as any).is_extended && (
                      <Badge className="text-[10px] bg-accent text-accent-foreground border-0 animate-pulse">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />EXTENDIDA
                      </Badge>
                    )}
                    {auction.operation_number && <span className="text-[10px] text-muted-foreground dark:text-gray-300 font-mono">{auction.operation_number}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{auction.dealer_name} · ${auction.current_price.toLocaleString("es-MX")} · {auction.bids_count} pujas</p>
                  <p className="text-[10px] text-muted-foreground">Fin: {new Date(auction.end_time).toLocaleString("es-MX")}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {["active", "paused"].includes(auction.status) && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar tiempo" onClick={() => { setEditingTime(editingTime === auction.id ? null : auction.id); setNewDurationHours(""); }}>
                        <Timer className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePauseAuction(auction.id, auction.status)}>
                        {auction.status === "paused" ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleArchiveAuction(auction.id, isArchived)}>
                    <Package className="h-3 w-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
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
                </div>
              </div>

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
                <div className="p-2.5 rounded-sm bg-primary/5 border border-primary/10 space-y-2">
                  <div className="flex items-center gap-1.5 text-primary dark:text-accent font-semibold text-xs"><Trophy className="h-3.5 w-3.5" /> Ganador</div>
                  <div className="text-xs space-y-0.5">
                    <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-muted-foreground" />{winner.full_name}</div>
                    {winner.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-muted-foreground" />{winner.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    {winner.phone && <Button size="sm" variant="outline" className="text-xs h-7 rounded-sm" onClick={() => openWhatsApp(winner.phone!, auction.title, auction.current_price)}><MessageCircle className="h-3 w-3 mr-1" />WhatsApp</Button>}
                    <Button size="sm" variant="outline" className="text-xs h-7 rounded-sm" onClick={() => handleSendEmail(auction.id)} disabled={sendingEmail === auction.id}><Mail className="h-3 w-3 mr-1" />Correo</Button>
                  </div>
                </div>
              )}
              {isEnded && auction.winner_id && (() => {
                const payStatus = (auction as any).payment_status || "pending";
                const delStatus = (auction as any).delivery_status || "pending";
                const frozen = (auction as any).funds_frozen;
                const paymentSteps = [
                  { key: "pending", label: "Pendiente", icon: "⏳", color: "text-muted-foreground bg-muted" },
                  { key: "under_review", label: "En Revisión", icon: "🔍", color: "text-amber-600 bg-amber-500/10" },
                  { key: "verified", label: "Verificado", icon: "✓", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                  { key: "escrow", label: "Custodia", icon: "🔐", color: "text-orange-600 dark:text-orange-400 bg-orange-500/10" },
                  { key: "released", label: "Liberado", icon: "💸", color: "text-green-600 dark:text-green-400 bg-green-500/10" },
                  { key: "refunded", label: "Reembolsado", icon: "↩️", color: "text-gray-600 dark:text-gray-400 bg-gray-500/10" },
                ];
                const deliverySteps = [
                  { key: "pending", label: "Pendiente", icon: "📦", color: "text-muted-foreground bg-muted" },
                  { key: "ready_to_ship", label: "Listo", icon: "📋", color: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                  { key: "shipped", label: "Enviado", icon: "🚚", color: "text-amber-600 bg-amber-500/10" },
                  { key: "delivered", label: "Entregado", icon: "✅", color: "text-primary dark:text-accent bg-primary/10" },
                ];
                const currentPayIdx = paymentSteps.findIndex(s => s.key === payStatus);
                const currentDelIdx = deliverySteps.findIndex(s => s.key === delStatus);
                const changePayment = async (direction: "prev" | "next") => {
                  const newIdx = direction === "next" ? currentPayIdx + 1 : currentPayIdx - 1;
                  if (newIdx < 0 || newIdx >= paymentSteps.length) return;
                  const newStatus = paymentSteps[newIdx].key;
                  const updateData: any = { payment_status: newStatus };
                  if (newStatus === "escrow") updateData.paid_at = new Date().toISOString();
                  if (newStatus === "released") updateData.funds_released_at = new Date().toISOString();
                  await supabase.from("auctions").update(updateData).eq("id", auction.id);
                  toast({ title: `Pago → ${paymentSteps[newIdx].label}` }); fetchAllData();
                };
                const changeDelivery = async (direction: "prev" | "next") => {
                  const newIdx = direction === "next" ? currentDelIdx + 1 : currentDelIdx - 1;
                  if (newIdx < 0 || newIdx >= deliverySteps.length) return;
                  const newStatus = deliverySteps[newIdx].key;
                  const updateData: any = { delivery_status: newStatus };
                  if (newStatus === "ready_to_ship") updateData.dealer_ship_deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
                  if (newStatus === "delivered") updateData.delivered_at = new Date().toISOString();
                  await supabase.from("auctions").update(updateData).eq("id", auction.id);
                  toast({ title: `Envío → ${deliverySteps[newIdx].label}` }); fetchAllData();
                };
                return (
                  <div className="p-3 rounded-sm bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-heading font-bold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-primary dark:text-accent" /> Estado de Fondos</p>
                      {frozen && <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 font-bold animate-pulse">🔒 CONGELADO</Badge>}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide">Pago</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={currentPayIdx <= 0} onClick={() => changePayment("prev")}><ChevronLeft className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={currentPayIdx >= paymentSteps.length - 1} onClick={() => changePayment("next")}><ChevronLeft className="h-3 w-3 rotate-180" /></Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {paymentSteps.map((step, i) => {
                          const isActive = i === currentPayIdx; const isPast = i < currentPayIdx;
                          return (
                            <div key={step.key} className="flex items-center flex-1">
                              <div className={`flex flex-col items-center flex-1 ${isActive || isPast ? "" : "opacity-30"}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] border transition-all ${isActive ? step.color + " border-current ring-2 ring-offset-1 ring-current/20 font-bold" : isPast ? "bg-primary/10 text-primary dark:text-accent border-primary/30" : "bg-muted border-border"}`}>{isPast ? "✓" : step.icon}</div>
                                <span className={`text-[8px] mt-0.5 text-center leading-tight ${isActive ? "font-bold text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                              </div>
                              {i < paymentSteps.length - 1 && <div className={`h-0.5 w-full min-w-1 mx-0.5 rounded-full transition-colors ${i < currentPayIdx ? "bg-primary" : "bg-border"}`} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wide">Envío</span>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={currentDelIdx <= 0} onClick={() => changeDelivery("prev")}><ChevronLeft className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={currentDelIdx >= deliverySteps.length - 1} onClick={() => changeDelivery("next")}><ChevronLeft className="h-3 w-3 rotate-180" /></Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {deliverySteps.map((step, i) => {
                          const isActive = i === currentDelIdx; const isPast = i < currentDelIdx;
                          return (
                            <div key={step.key} className="flex items-center flex-1">
                              <div className={`flex flex-col items-center flex-1 ${isActive || isPast ? "" : "opacity-30"}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] border transition-all ${isActive ? step.color + " border-current ring-2 ring-offset-1 ring-current/20 font-bold" : isPast ? "bg-primary/10 text-primary dark:text-accent border-primary/30" : "bg-muted border-border"}`}>{isPast ? "✓" : step.icon}</div>
                                <span className={`text-[8px] mt-0.5 text-center leading-tight ${isActive ? "font-bold text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                              </div>
                              {i < deliverySteps.length - 1 && <div className={`h-0.5 w-full min-w-1 mx-0.5 rounded-full transition-colors ${i < currentDelIdx ? "bg-primary" : "bg-border"}`} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {(auction as any).delivered_at && !frozen && payStatus === "escrow" && (
                      <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/10 rounded-sm px-2.5 py-1.5">
                        <Clock className="h-3 w-3 text-primary dark:text-accent shrink-0" />
                        <p className="text-[10px] text-primary dark:text-accent">Auto-liberación: <strong>{new Date(new Date((auction as any).delivered_at).getTime() + 72 * 60 * 60 * 1000).toLocaleString("es-MX")}</strong></p>
                      </div>
                    )}
                    {auction.winner_id && (
                      <div className="border-t border-border pt-2 space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wider flex items-center gap-1"><DollarSign className="h-3 w-3" /> Desglose de Comisión</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-secondary/30 rounded-sm p-2 text-center"><p className="text-[9px] text-muted-foreground">Venta Total</p><p className="text-sm font-bold text-foreground">${auction.current_price.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p></div>
                          <div className="bg-primary/10 rounded-sm p-2 text-center"><p className="text-[9px] text-muted-foreground">Comisión ({commissionPct}%)</p><p className="text-sm font-bold text-primary dark:text-accent">${(auction.current_price * commissionPct / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p></div>
                          <div className="bg-secondary/30 rounded-sm p-2 text-center"><p className="text-[9px] text-muted-foreground">Dealer Recibe</p><p className="text-sm font-bold text-foreground">${(auction.current_price * (1 - commissionPct / 100)).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminAuctionsTab;
