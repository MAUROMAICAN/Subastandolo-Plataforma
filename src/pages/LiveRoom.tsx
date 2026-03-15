// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import MuxLivePlayer from "@/components/live/MuxLivePlayer";
import LiveKitViewer from "@/components/live/LiveKitViewer";
import LiveChat from "@/components/live/LiveChat";
import LiveBidPanel from "@/components/live/LiveBidPanel";
import { Loader2, ShieldCheck, Star, Store, Radio, Users } from "lucide-react";

interface LiveEvent {
    id: string;
    dealer_id: string;
    title: string;
    description: string | null;
    status: string;
    mux_playback_id: string | null;
    livekit_room_name: string | null;
    viewer_count: number;
    started_at: string | null;
}

interface LiveProduct {
    id: string;
    product_title: string;
    product_description: string | null;
    product_images: string[];
    starting_price: number;
    current_price: number | null;
    status: string;
    winner_id: string | null;
    countdown_seconds: number;
    started_at: string | null;
    ends_at: string | null;
    sort_order: number;
}

interface DealerProfile {
    display_name: string;
    avatar_url: string | null;
    dealer_level: string | null;
}

export default function LiveRoom() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user } = useAuth();
    const [event, setEvent] = useState<LiveEvent | null>(null);
    const [products, setProducts] = useState<LiveProduct[]>([]);
    const [dealer, setDealer] = useState<DealerProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // LiveKit viewer state
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [livekitError, setLivekitError] = useState<string | null>(null);

    const activeProduct = products.find((p) => p.status === "active") || null;
    const soldCount = products.filter((p) => p.status === "sold").length;
    const totalProducts = products.length;

    // Load event + products + dealer
    useEffect(() => {
        if (!eventId) return;

        const load = async () => {
            const { data: ev } = await (supabase
                .from("live_events" as any)
                .select("id, dealer_id, title, description, status, mux_playback_id, livekit_room_name, viewer_count, started_at")
                .eq("id", eventId)
                .single() as any);

            if (ev) {
                setEvent(ev as LiveEvent);

                const { data: profile } = await (supabase
                    .from("profiles")
                    .select("full_name, avatar_url, dealer_level")
                    .eq("id", ev.dealer_id)
                    .single() as any);
                if (profile) setDealer({ display_name: profile.full_name || 'Dealer', avatar_url: profile.avatar_url, dealer_level: profile.dealer_level } as DealerProfile);
            }

            const { data: prods } = await (supabase
                .from("live_event_products" as any)
                .select("*")
                .eq("event_id", eventId)
                .order("sort_order", { ascending: true }) as any);
            if (prods) setProducts(prods as unknown as LiveProduct[]);

            setLoading(false);
        };
        load();

        // Realtime: event updates
        const evChannel = supabase
            .channel(`live-event-${eventId}`)
            .on(
                "postgres_changes" as any,
                { event: "UPDATE", schema: "public", table: "live_events", filter: `id=eq.${eventId}` },
                (payload: any) => setEvent((prev: any) => prev ? { ...prev, ...payload.new } : null)
            )
            .subscribe();

        // Realtime: product updates — do a full refetch for reliability
        const prodChannel = supabase
            .channel(`live-products-${eventId}`)
            .on(
                "postgres_changes" as any,
                { event: "*", schema: "public", table: "live_event_products", filter: `event_id=eq.${eventId}` },
                async () => {
                    // Full refetch to ensure all fields (including ends_at) are accurate
                    const { data } = await supabase
                        .from("live_event_products")
                        .select("*")
                        .eq("event_id", eventId)
                        .order("sort_order", { ascending: true });
                    if (data) setProducts(data as LiveProduct[]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(evChannel);
            supabase.removeChannel(prodChannel);
        };
    }, [eventId]);

    // Get LiveKit viewing token when event loads and is live
    useEffect(() => {
        if (!event || event.status !== "live" || !eventId) return;
        // Don't get viewer token if we're the dealer (they use the wizard broadcaster)
        if (user && event.dealer_id === user.id) return;
        // Need auth to get token
        if (!user) {
            setLivekitError("Inicia sesión para ver el stream en vivo");
            return;
        }

        const getToken = async () => {
            try {
                const { data, error } = await supabase.functions.invoke("livekit-token", {
                    body: { event_id: eventId, role: "subscriber" },
                });
                if (error) throw new Error(error.message);
                if (data?.error) throw new Error(data.error);
                setLivekitToken(data.token);
                setLivekitUrl(data.url);
            } catch (err: any) {
                console.error("[LiveRoom] LiveKit token error:", err);
                setLivekitError(err.message);
            }
        };
        getToken();
    }, [event?.status, eventId, user?.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-lg font-bold text-foreground mb-2">Evento no encontrado</p>
                        <Link to="/live" className="text-accent font-bold text-sm">← Volver al lobby</Link>
                    </div>
                </div>
            </div>
        );
    }

    const isLive = event.status === "live";
    const isEnded = event.status === "ended";
    const isDealer = user && event.dealer_id === user.id;

    // Determine which player to show
    const showLiveKit = isLive && livekitToken && livekitUrl && !isDealer;
    const showMux = event.mux_playback_id && !showLiveKit;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <BackButton />

            {/* Header bar */}
            <div className="bg-nav border-b border-white/10">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        {isLive && (
                            <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shrink-0">
                                <span className="w-2 h-2 rounded-full bg-white" />
                                EN VIVO
                            </span>
                        )}
                        {isEnded && (
                            <span className="bg-secondary text-muted-foreground text-xs font-bold px-3 py-1 rounded-full shrink-0">
                                FINALIZADO
                            </span>
                        )}
                        <h1 className="text-white font-heading font-bold text-sm sm:text-base truncate">
                            {event.title}
                        </h1>
                    </div>
                    <div className="text-xs text-white/50 shrink-0">
                        {soldCount}/{totalProducts} productos
                    </div>
                </div>
            </div>

            {/* Main 3-column layout */}
            <div className="flex-1 container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full" style={{ minHeight: "70vh" }}>

                    {/* Left: Dealer info */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="bg-card border border-border rounded-2xl p-5">
                            <div className="flex items-center gap-3 mb-4">
                                {dealer?.avatar_url ? (
                                    <img src={dealer.avatar_url} alt={dealer.display_name} className="w-12 h-12 rounded-full object-cover border-2 border-accent" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                                        <Store className="h-5 w-5 text-accent" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-heading font-bold text-sm text-foreground">{dealer?.display_name || "Dealer"}</p>
                                    {dealer?.dealer_level && (
                                        <div className="flex items-center gap-1 text-xs text-accent">
                                            <Star className="h-3 w-3" />
                                            {dealer.dealer_level}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                                Vendedor verificado
                            </div>
                        </div>

                        <div className="bg-card border border-border rounded-2xl p-4">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Cola de Productos</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {products.map((p, i) => (
                                    <div
                                        key={p.id}
                                        className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                                            p.status === "active" ? "bg-accent/10 border border-accent/30" :
                                            p.status === "sold" ? "bg-green-500/5 opacity-60" :
                                            p.status === "unsold" ? "bg-red-500/5 opacity-40" :
                                            "bg-secondary/20"
                                        }`}
                                    >
                                        <span className="font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                                        <span className={`flex-1 truncate ${p.status === "active" ? "text-accent font-bold" : "text-foreground"}`}>
                                            {p.product_title}
                                        </span>
                                        <span className="text-muted-foreground shrink-0">
                                            ${(p.current_price || p.starting_price).toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Center: Video + bid panel */}
                    <div className="lg:col-span-5 space-y-4">
                        {showLiveKit ? (
                            <LiveKitViewer
                                token={livekitToken}
                                serverUrl={livekitUrl}
                                isLive={isLive}
                                viewerCount={event.viewer_count}
                            />
                        ) : showMux ? (
                            <MuxLivePlayer
                                playbackId={event.mux_playback_id}
                                title={event.title}
                                viewerCount={event.viewer_count}
                                isLive={isLive}
                            />
                        ) : (
                            <div className="bg-nav rounded-2xl flex flex-col items-center justify-center gap-3 relative" style={{ aspectRatio: '9/16', maxHeight: '70vh' }}>
                                {isLive && (
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                                        <span className="w-2 h-2 rounded-full bg-white" />
                                        EN VIVO
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                                    <Users className="h-3.5 w-3.5" />
                                    {event.viewer_count}
                                </div>
                                <Radio className="h-12 w-12 text-red-500 animate-pulse" />
                                <p className="text-foreground font-bold text-sm">
                                    {isDealer ? "Estás transmitiendo desde el wizard" : isLive ? "🔴 Transmisión en vivo" : isEnded ? "Transmisión finalizada" : "Esperando transmisión..."}
                                </p>
                                <p className="text-muted-foreground text-xs text-center px-8">
                                    {isDealer ? "Vuelve al wizard para ver tu cámara" : livekitError ? `Error: ${livekitError}` : "Conectando..."}
                                </p>
                            </div>
                        )}
                        <LiveBidPanel eventId={event.id} activeProduct={activeProduct} />
                    </div>

                    {/* Right: Chat */}
                    <div className="lg:col-span-4" style={{ height: "70vh" }}>
                        <LiveChat eventId={event.id} dealerId={event.dealer_id} />
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
