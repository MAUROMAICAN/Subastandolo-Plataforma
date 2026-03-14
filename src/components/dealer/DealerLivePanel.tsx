// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getDealerTier } from "@/components/VerifiedBadge";
import type { DealerInfo } from "@/hooks/useVerifiedDealers";
import GoLiveWizard from "@/components/live/GoLiveWizard";
import {
    Radio, Plus, Trash2, Play, Square, GripVertical,
    Loader2, Copy, ExternalLink, ImageIcon, Calendar,
    Lock, Shield, AlertTriangle,
} from "lucide-react";

interface LiveEvent {
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    status: string;
    scheduled_at: string;
    started_at: string | null;
    ended_at: string | null;
    mux_stream_key: string | null;
    mux_playback_id: string | null;
    viewer_count: number;
}

interface LiveProduct {
    id: string;
    event_id: string;
    product_title: string;
    product_description: string | null;
    product_images: string[];
    starting_price: number;
    current_price: number | null;
    status: string;
    sort_order: number;
    countdown_seconds: number;
}

interface Props {
    dealer: DealerInfo | null;
}

const ALLOWED_TIERS = ["bronce", "plata", "oro", "platinum", "ruby_estelar"];

export default function DealerLivePanel({ dealer }: Props) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<"events" | "create">("events");
    const [liveAuthorized, setLiveAuthorized] = useState(false);
    const [showGoLive, setShowGoLive] = useState(false);

    // Check if dealer has admin-granted live authorization
    useEffect(() => {
        if (!user) return;
        supabase
            .from("profiles")
            .select("live_authorized")
            .eq("id", user.id)
            .single()
            .then(({ data }) => {
                if ((data as any)?.live_authorized) setLiveAuthorized(true);
            });
    }, [user]);

    // Determine access
    const dealerTier = dealer?.isVerified ? getDealerTier(dealer.salesCount) : null;
    const hasLevelAccess = dealerTier ? ALLOWED_TIERS.includes(dealerTier.key) : false;
    const hasAccess = hasLevelAccess || liveAuthorized;

    // Create event form
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [creating, setCreating] = useState(false);

    // Products for a selected event
    const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
    const [products, setProducts] = useState<LiveProduct[]>([]);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [productTitle, setProductTitle] = useState("");
    const [productDesc, setProductDesc] = useState("");
    const [productPrice, setProductPrice] = useState("");
    const [productCountdown, setProductCountdown] = useState("60");

    const loadEvents = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from("live_events")
            .select("*")
            .eq("dealer_id", user.id)
            .order("created_at", { ascending: false });
        if (data) setEvents(data as LiveEvent[]);
        setLoading(false);
    }, [user]);

    useEffect(() => { loadEvents(); }, [loadEvents]);

    const loadProducts = useCallback(async (eventId: string) => {
        const { data } = await supabase
            .from("live_event_products")
            .select("*")
            .eq("event_id", eventId)
            .order("sort_order", { ascending: true });
        if (data) setProducts(data as LiveProduct[]);
    }, []);

    // Create event
    const createEvent = async () => {
        if (!user || !title.trim() || !scheduledAt) return;
        setCreating(true);
        const { error } = await supabase.from("live_events").insert({
            dealer_id: user.id,
            title: title.trim(),
            description: description.trim() || null,
            category: category.trim() || null,
            scheduled_at: new Date(scheduledAt).toISOString(),
        });
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Evento creado", description: "Ahora agrega productos a la cola" });
            setTitle(""); setDescription(""); setCategory(""); setScheduledAt("");
            setTab("events");
            loadEvents();
        }
        setCreating(false);
    };

    // Add product to event
    const addProduct = async () => {
        if (!selectedEvent || !productTitle.trim() || !productPrice) return;
        const { error } = await supabase.from("live_event_products").insert({
            event_id: selectedEvent.id,
            product_title: productTitle.trim(),
            product_description: productDesc.trim() || null,
            starting_price: parseFloat(productPrice),
            countdown_seconds: parseInt(productCountdown) || 60,
            sort_order: products.length,
        });
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setProductTitle(""); setProductDesc(""); setProductPrice(""); setShowAddProduct(false);
            loadProducts(selectedEvent.id);
        }
    };

    // Start live stream
    const startLive = async (event: LiveEvent) => {
        try {
            // 1. Update DB directly to "live" status
            const { error: dbErr } = await supabase
                .from("live_events")
                .update({ status: "live", started_at: new Date().toISOString() })
                .eq("id", event.id);
            if (dbErr) {
                toast({ title: "Error", description: dbErr.message, variant: "destructive" });
                return;
            }
            toast({ title: "🔴 ¡Estás en vivo!" });
            loadEvents();
            setSelectedEvent({ ...event, status: "live" });
            // 2. Try creating Mux stream in background (fire-and-forget)
            supabase.functions.invoke("create-live-stream", {
                body: { event_id: event.id },
            }).catch(() => {});
        } catch (err: any) {
            toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
        }
    };

    const endLive = async (event: LiveEvent) => {
        try {
            // Direct DB update (RLS policy allows dealer to update own events)
            const { error } = await supabase
                .from("live_events")
                .update({ status: "ended", ended_at: new Date().toISOString() })
                .eq("id", event.id);
            if (error) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
                return;
            }
            toast({ title: "✅ Live finalizado" });
            loadEvents();
            setSelectedEvent(null);
            // Try Edge Function for Mux cleanup (fire-and-forget)
            supabase.functions.invoke("end-live-stream", {
                body: { event_id: event.id },
            }).catch(() => {});
        } catch (err: any) {
            toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
        }
    };

    // Activate next product
    const activateProduct = async (product: LiveProduct) => {
        // Deactivate any current active product first
        const currentActive = products.find((p) => p.status === "active");
        if (currentActive) {
            await supabase
                .from("live_event_products")
                .update({ status: "unsold", ended_at: new Date().toISOString() })
                .eq("id", currentActive.id);
        }

        await supabase
            .from("live_event_products")
            .update({
                status: "active",
                current_price: product.starting_price,
                started_at: new Date().toISOString()
            })
            .eq("id", product.id);

        if (selectedEvent) loadProducts(selectedEvent.id);
    };

    // Mark product as sold (to highest bidder)
    const markSold = async (product: LiveProduct) => {
        // Find highest bid
        const { data: topBid } = await supabase
            .from("live_bids")
            .select("bidder_id, amount")
            .eq("product_id", product.id)
            .order("amount", { ascending: false })
            .limit(1)
            .single();

        await supabase
            .from("live_event_products")
            .update({
                status: "sold",
                winner_id: topBid?.bidder_id || null,
                current_price: topBid?.amount || product.current_price,
                ended_at: new Date().toISOString(),
            })
            .eq("id", product.id);

        if (selectedEvent) loadProducts(selectedEvent.id);
    };

    // Delete product
    const deleteProduct = async (productId: string) => {
        await supabase.from("live_event_products").delete().eq("id", productId);
        if (selectedEvent) loadProducts(selectedEvent.id);
    };

    // Delete entire event - direct client-side (no Edge Function)
    const [deleting, setDeleting] = useState<string | null>(null);
    const deleteEvent = async (eventId: string, e?: React.MouseEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (deleting) return;
        setDeleting(eventId);
        try {
            // 1. Delete products related to this event
            await supabase.from("live_event_products").delete().eq("event_id", eventId);
            // 2. Delete chat related to this event
            await supabase.from("live_chat").delete().eq("event_id", eventId);
            // 3. Delete the event itself
            const { error } = await supabase.from("live_events").delete().eq("id", eventId);
            if (error) {
                // If RLS blocks, try the Edge Function as fallback
                const { data, error: fnErr } = await supabase.functions.invoke("delete-live-event", {
                    body: { event_id: eventId },
                });
                if (fnErr || data?.error) {
                    toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
                    return;
                }
            }
            toast({ title: "✅ Evento eliminado" });
            setSelectedEvent(null);
            loadEvents();
        } catch (err: any) {
            console.error("[deleteEvent]", err);
            toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    // Access control gate
    if (!hasAccess) {
        const salesNeeded = dealer?.salesCount != null ? Math.max(0, 10 - dealer.salesCount) : 10;
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto space-y-6">
                <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Lock className="h-10 w-10 text-orange-400" />
                </div>
                <div>
                    <h2 className="text-xl font-heading font-bold text-foreground mb-2">
                        Subastas en Vivo Bloqueadas
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Para transmitir en vivo necesitas ser <strong className="text-orange-400">Vendedor Verificado Bronce</strong> o superior
                        (mínimo 10 ventas completadas) o tener autorización especial del administrador.
                    </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 w-full space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tu nivel actual:</span>
                        <span className="font-bold text-foreground">{dealerTier?.label || "Sin verificar"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ventas completadas:</span>
                        <span className="font-bold text-foreground">{dealer?.salesCount || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ventas necesarias:</span>
                        <span className="font-bold text-orange-400">{salesNeeded} más</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-orange-500 to-accent h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((dealer?.salesCount || 0) / 10) * 100)}%` }}
                        />
                    </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 w-full">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-300 text-left">
                            Las subastas en vivo requieren un nivel mínimo para garantizar la calidad y seguridad
                            de las transmisiones. Sigue vendiendo para desbloquear esta función.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" />
                    <span>¿Necesitas acceso especial? Contacta al administrador</span>
                </div>
            </div>
        );
    }

    // If viewing a specific event's products
    if (selectedEvent) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <button onClick={() => setSelectedEvent(null)} className="text-sm text-accent font-bold mb-2">
                            ← Volver a mis eventos
                        </button>
                        <h2 className="text-xl font-heading font-bold text-foreground">{selectedEvent.title}</h2>
                        <StatusBadge status={selectedEvent.status} />
                    </div>
                    <div className="flex gap-2">
                        {selectedEvent.status === "scheduled" && (
                            <button
                                onClick={() => startLive(selectedEvent)}
                                className="flex items-center gap-2 bg-red-600 text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-red-700 transition-colors"
                            >
                                <Play className="h-4 w-4" /> Iniciar Live
                            </button>
                        )}
                        {selectedEvent.status === "live" && (
                            <button
                                onClick={() => endLive(selectedEvent)}
                                className="flex items-center gap-2 bg-secondary text-foreground font-bold text-sm px-4 py-2 rounded-xl hover:bg-secondary/80 transition-colors"
                            >
                                <Square className="h-4 w-4" /> Finalizar
                            </button>
                        )}
                        <button
                            onClick={() => deleteEvent(selectedEvent.id)}
                            className="flex items-center gap-2 bg-red-500/10 text-red-400 font-bold text-sm px-4 py-2 rounded-xl hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="h-4 w-4" /> Eliminar
                        </button>
                    </div>
                </div>

                {/* Link to live room */}
                {(selectedEvent.status === "live" || selectedEvent.mux_playback_id) && (
                    <div className="bg-nav border border-white/10 rounded-2xl p-4">
                        <a
                            href={`/live/${selectedEvent.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-accent font-bold hover:underline"
                        >
                            <ExternalLink className="h-4 w-4" />
                            🔴 Ver sala en vivo
                        </a>
                    </div>
                )}

                {/* Product queue */}
                <div className="bg-card border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-heading font-bold text-sm text-foreground">Cola de Productos ({products.length})</h3>
                        <button
                            onClick={() => setShowAddProduct(!showAddProduct)}
                            className="flex items-center gap-1 text-xs bg-accent text-accent-foreground font-bold px-3 py-1.5 rounded-lg hover:bg-accent/90"
                        >
                            <Plus className="h-3.5 w-3.5" /> Agregar
                        </button>
                    </div>

                    {/* Add product form */}
                    {showAddProduct && (
                        <div className="bg-secondary/20 rounded-xl p-4 mb-4 space-y-3">
                            <input
                                type="text"
                                placeholder="Título del producto *"
                                value={productTitle}
                                onChange={(e) => setProductTitle(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                            />
                            <textarea
                                placeholder="Descripción (opcional)"
                                value={productDesc}
                                onChange={(e) => setProductDesc(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
                                rows={2}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Precio inicial ($) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={productPrice}
                                        onChange={(e) => setProductPrice(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Countdown (seg)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        max="300"
                                        value={productCountdown}
                                        onChange={(e) => setProductCountdown(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowAddProduct(false)} className="text-xs text-muted-foreground font-bold px-3 py-1.5">
                                    Cancelar
                                </button>
                                <button
                                    onClick={addProduct}
                                    disabled={!productTitle.trim() || !productPrice}
                                    className="text-xs bg-accent text-accent-foreground font-bold px-4 py-1.5 rounded-lg disabled:opacity-50"
                                >
                                    Agregar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Products list */}
                    <div className="space-y-2">
                        {products.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-6">
                                Agrega productos para tu subasta en vivo
                            </p>
                        )}
                        {products.map((p, i) => (
                            <div
                                key={p.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border ${
                                    p.status === "active" ? "bg-accent/5 border-accent/30" :
                                    p.status === "sold" ? "bg-green-500/5 border-green-500/20" :
                                    p.status === "unsold" ? "bg-red-500/5 border-red-500/20 opacity-50" :
                                    "bg-secondary/10 border-border"
                                }`}
                            >
                                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-xs font-bold text-muted-foreground w-6">{i + 1}</span>

                                {p.product_images?.[0] ? (
                                    <img src={p.product_images[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-foreground truncate">{p.product_title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        ${p.starting_price.toFixed(2)} · {p.countdown_seconds}s
                                    </p>
                                </div>

                                <StatusBadge status={p.status} />

                                {/* Actions */}
                                {p.status === "pending" && selectedEvent.status === "live" && (
                                    <button
                                        onClick={() => activateProduct(p)}
                                        className="text-xs bg-accent text-accent-foreground font-bold px-3 py-1 rounded-lg"
                                    >
                                        Activar
                                    </button>
                                )}
                                {p.status === "active" && (
                                    <button
                                        onClick={() => markSold(p)}
                                        className="text-xs bg-green-600 text-white font-bold px-3 py-1 rounded-lg"
                                    >
                                        Vendido
                                    </button>
                                )}
                                {p.status === "pending" && (
                                    <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Main view: event list or create
    return (
        <div className="space-y-6">
            {/* Go Live Wizard */}
            {showGoLive && (
                <GoLiveWizard
                    onClose={() => setShowGoLive(false)}
                    onLiveStarted={() => { loadEvents(); }}
                />
            )}

            {/* Hero: Go Live Button */}
            <div className="bg-gradient-to-r from-red-600/20 via-red-500/10 to-transparent border border-red-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                    <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
                        <Radio className="h-5 w-5 text-red-500 animate-pulse" />
                        Subastas en Vivo
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                        Transmite desde tu cámara y subasta tus productos en tiempo real
                    </p>
                </div>
                <button
                    onClick={() => setShowGoLive(true)}
                    className="flex items-center gap-2 bg-red-600 text-white font-heading font-bold text-sm px-6 py-3 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 whitespace-nowrap"
                >
                    <Radio className="h-4 w-4" />
                    🔴 Ir en Vivo
                </button>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-heading font-bold text-foreground">Mis Eventos</h3>
                <button
                    onClick={() => setTab(tab === "create" ? "events" : "create")}
                    className="flex items-center gap-2 bg-accent text-accent-foreground font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-accent/90 transition-colors"
                >
                    <Plus className="h-3.5 w-3.5" />
                    {tab === "create" ? "Ver Eventos" : "Programar Evento"}
                </button>
            </div>

            {tab === "create" ? (
                /* Create form */
                <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="font-heading font-bold text-foreground">Crear Evento Live</h3>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Título del evento *</label>
                        <input
                            type="text"
                            placeholder="ej: Subasta de Monedas Antiguas"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Descripción (opcional)</label>
                        <textarea
                            placeholder="Describe qué vas a subastar..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Categoría</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm"
                            >
                                <option value="">Sin categoría</option>
                                <option value="Electrónica">Electrónica</option>
                                <option value="Coleccionables">Coleccionables</option>
                                <option value="Moda">Moda</option>
                                <option value="Hogar">Hogar</option>
                                <option value="Deportes">Deportes</option>
                                <option value="Joyería">Joyería</option>
                                <option value="Arte">Arte</option>
                                <option value="Otros">Otros</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Fecha y hora *</label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm"
                            />
                        </div>
                    </div>

                    <button
                        onClick={createEvent}
                        disabled={creating || !title.trim() || !scheduledAt}
                        className="w-full bg-accent text-accent-foreground font-heading font-bold py-3 rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                        {creating ? "Creando..." : "Crear Evento"}
                    </button>
                </div>
            ) : (
                /* Events list */
                <div className="space-y-3">
                    {events.length === 0 && (
                        <div className="text-center py-16">
                            <Radio className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                            <p className="text-foreground font-bold">No tienes eventos creados</p>
                            <p className="text-xs text-muted-foreground mt-1">Crea tu primer evento para empezar a transmitir</p>
                        </div>
                    )}
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-all flex items-center gap-4"
                        >
                            <button
                                onClick={() => { setSelectedEvent(event); loadProducts(event.id); }}
                                className="flex items-center gap-4 flex-1 min-w-0 text-left"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                                    event.status === "live" ? "bg-red-600/20" :
                                    event.status === "ended" ? "bg-secondary/30" :
                                    "bg-accent/10"
                                }`}>
                                    <Radio className={`h-5 w-5 ${
                                        event.status === "live" ? "text-red-500 animate-pulse" :
                                        event.status === "ended" ? "text-muted-foreground" :
                                        "text-accent"
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-heading font-bold text-sm text-foreground truncate">{event.title}</p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(event.scheduled_at).toLocaleDateString("es-VE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        {event.category && (
                                            <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full font-semibold">
                                                {event.category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                            <StatusBadge status={event.status} />
                            <button
                                onClick={(e) => deleteEvent(event.id, e)}
                                disabled={deleting === event.id}
                                className={`transition-colors p-2 rounded-lg shrink-0 ${deleting === event.id ? "text-red-400 animate-spin" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"}`}
                                title="Eliminar evento"
                            >
                                {deleting === event.id ? <Loader2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Status Badge ── */
function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        scheduled: { label: "Programado", className: "bg-blue-500/10 text-blue-400" },
        live: { label: "EN VIVO", className: "bg-red-600/10 text-red-400 animate-pulse" },
        ended: { label: "Finalizado", className: "bg-secondary text-muted-foreground" },
        cancelled: { label: "Cancelado", className: "bg-secondary text-muted-foreground" },
        pending: { label: "Pendiente", className: "bg-secondary/50 text-muted-foreground" },
        active: { label: "Activo", className: "bg-accent/10 text-accent" },
        sold: { label: "Vendido", className: "bg-green-500/10 text-green-400" },
        unsold: { label: "No vendido", className: "bg-red-500/10 text-red-400" },
        skipped: { label: "Omitido", className: "bg-secondary text-muted-foreground" },
    };
    const c = config[status] || { label: status, className: "bg-secondary text-muted-foreground" };
    return (
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${c.className}`}>
            {c.label}
        </span>
    );
}
