// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import LiveKitViewer from "@/components/live/LiveKitViewer";
import LiveBidPanel from "@/components/live/LiveBidPanel";
import {
    Loader2, ShieldCheck, Star, Store, Radio, Users,
    Send, ChevronLeft, Gavel, Timer, MessageCircle,
    ChevronDown, ChevronUp,
} from "lucide-react";

/* ───────────────────────── Types ───────────────────────── */
interface LiveEvent {
    id: string;
    dealer_id: string;
    title: string;
    description: string | null;
    status: string;
    mux_playback_id: string | null;
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

interface ChatMessage {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    is_hidden?: boolean;
}

const ANTI_SNIPE_THRESHOLD = 15;
const ANTI_SNIPE_EXTENSION = 10;

/* ───────────────────────── Component ───────────────────────── */
export default function LiveRoom() {
    const { eventId } = useParams<{ eventId: string }>();
    const { user } = useAuth();
    const [event, setEvent] = useState<LiveEvent | null>(null);
    const [products, setProducts] = useState<LiveProduct[]>([]);
    const [dealer, setDealer] = useState<DealerProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // LiveKit
    const [livekitToken, setLivekitToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [livekitError, setLivekitError] = useState<string | null>(null);

    // Chat
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatSending, setChatSending] = useState(false);
    const [lastChatSent, setLastChatSent] = useState(0);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Bid
    const [bidding, setBidding] = useState(false);

    // Mobile tabs
    const [mobileTab, setMobileTab] = useState<"chat" | "products">("chat");
    const [showSidebar, setShowSidebar] = useState(false);

    const activeProduct = products.find((p) => p.status === "active") || null;
    const currentPrice = activeProduct?.current_price || activeProduct?.starting_price || 0;
    const bidIncrement = currentPrice < 10 ? 1 : currentPrice < 100 ? 5 : currentPrice < 500 ? 10 : 25;
    const nextBidAmount = currentPrice + bidIncrement;
    const soldCount = products.filter((p) => p.status === "sold").length;

    /* ─── Countdown ─── */
    const [countdown, setCountdown] = useState(0);
    useEffect(() => {
        if (!activeProduct || activeProduct.status !== "active") { setCountdown(0); return; }
        const getEndsAt = () => {
            if (activeProduct.ends_at) return new Date(activeProduct.ends_at).getTime();
            if (activeProduct.started_at) return new Date(activeProduct.started_at).getTime() + activeProduct.countdown_seconds * 1000;
            return Date.now();
        };
        const endsAt = getEndsAt();
        const tick = () => setCountdown(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [activeProduct?.ends_at, activeProduct?.started_at, activeProduct?.status]);

    /* ─── Load data ─── */
    useEffect(() => {
        if (!eventId) return;

        const load = async () => {
            const { data: ev } = await (supabase
                .from("live_events" as any)
                .select("id, dealer_id, title, description, status, mux_playback_id, viewer_count, started_at")
                .eq("id", eventId)
                .single() as any);

            if (ev) {
                setEvent(ev as LiveEvent);
                const { data: profile } = await (supabase
                    .from("profiles")
                    .select("full_name, avatar_url")
                    .eq("id", ev.dealer_id)
                    .single() as any);
                if (profile) setDealer({ display_name: profile.full_name || 'Dealer', avatar_url: profile.avatar_url, dealer_level: null } as DealerProfile);
            }

            const { data: prods } = await (supabase
                .from("live_event_products" as any)
                .select("*")
                .eq("event_id", eventId)
                .order("sort_order", { ascending: true }) as any);
            if (prods) setProducts(prods as unknown as LiveProduct[]);

            // Load chat
            const { data: msgs } = await supabase
                .from("live_chat")
                .select("id, user_id, message, created_at, is_hidden")
                .eq("event_id", eventId)
                .order("created_at", { ascending: true })
                .limit(200);
            if (msgs) setChatMessages(msgs as ChatMessage[]);

            setLoading(false);
        };
        load();

        // Realtime: event
        const evChannel = supabase
            .channel(`live-event-${eventId}`)
            .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "live_events", filter: `id=eq.${eventId}` },
                (payload: any) => setEvent((prev: any) => prev ? { ...prev, ...payload.new } : null))
            .subscribe();

        // Realtime: products (full refetch)
        const prodChannel = supabase
            .channel(`live-products-${eventId}`)
            .on("postgres_changes" as any, { event: "*", schema: "public", table: "live_event_products", filter: `event_id=eq.${eventId}` },
                async () => {
                    const { data } = await supabase.from("live_event_products").select("*").eq("event_id", eventId).order("sort_order", { ascending: true });
                    if (data) setProducts(data as LiveProduct[]);
                })
            .subscribe();

        // Realtime: chat
        const chatChannel = supabase
            .channel(`live-chat-${eventId}`)
            .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "live_chat", filter: `event_id=eq.${eventId}` },
                (payload: any) => {
                    const msg = payload.new as ChatMessage;
                    if (!msg.is_hidden) setChatMessages((prev) => [...prev, msg]);
                })
            .subscribe();

        return () => {
            supabase.removeChannel(evChannel);
            supabase.removeChannel(prodChannel);
            supabase.removeChannel(chatChannel);
        };
    }, [eventId]);

    // Auto-scroll chat
    useEffect(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    }, [chatMessages]);

    /* ─── LiveKit token ─── */
    useEffect(() => {
        if (!event || event.status !== "live" || !eventId) return;
        if (user && event.dealer_id === user.id) return;
        if (!user) { setLivekitError("Inicia sesión para ver el stream"); return; }

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
                setLivekitError(err.message);
            }
        };
        getToken();
    }, [event?.status, eventId, user?.id]);

    /* ─── Send chat ─── */
    const sendChat = async () => {
        if (!chatInput.trim() || !user || chatSending) return;
        if (Date.now() - lastChatSent < 3000) return;
        setChatSending(true);
        setChatInput("");
        setLastChatSent(Date.now());
        await supabase.from("live_chat").insert({ event_id: eventId, user_id: user.id, message: chatInput.trim() });
        setChatSending(false);
    };

    /* ─── Place bid ─── */
    const placeBid = async () => {
        if (!user || !activeProduct || bidding || countdown === 0) return;
        setBidding(true);
        try {
            await supabase.from("live_bids").insert({
                product_id: activeProduct.id, event_id: eventId, bidder_id: user.id, amount: nextBidAmount,
            });
            const updates: any = { current_price: nextBidAmount };
            if (countdown <= ANTI_SNIPE_THRESHOLD && activeProduct.ends_at) {
                updates.ends_at = new Date(new Date(activeProduct.ends_at).getTime() + ANTI_SNIPE_EXTENSION * 1000).toISOString();
            }
            await supabase.from("live_event_products").update(updates).eq("id", activeProduct.id);
        } catch (err: any) {
            console.error("[Bid]", err);
        } finally {
            setBidding(false);
        }
    };

    /* ─── Loading / Not found ─── */
    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
    if (!event) return (
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

    const isLive = event.status === "live";
    const isEnded = event.status === "ended";
    const isDealer = user && event.dealer_id === user.id;
    const showLiveKit = isLive && livekitToken && livekitUrl && !isDealer;
    const countdownColor = countdown <= 5 ? "text-red-500" : countdown <= ANTI_SNIPE_THRESHOLD ? "text-amber-400" : "text-white";
    const visibleChat = chatMessages.filter((m) => !m.is_hidden);

    /* ═══════════════════════════ RENDER ═══════════════════════════ */
    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* ─── Top bar ─── */}
            <div className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link to="/live" className="text-white/60 hover:text-white transition-colors shrink-0">
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                        {isLive && (
                            <span className="flex items-center gap-1.5 bg-red-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full animate-pulse shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                EN VIVO
                            </span>
                        )}
                        {isEnded && (
                            <span className="bg-white/10 text-white/50 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                                FINALIZADO
                            </span>
                        )}
                        <h1 className="text-white font-bold text-sm truncate">{event.title}</h1>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center gap-1 text-white/50 text-xs">
                            <Users className="h-3.5 w-3.5" />
                            {event.viewer_count}
                        </span>
                    </div>
                </div>
            </div>

            {/* ─── Main content ─── */}
            <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">

                {/* ═══ LEFT: Video + overlaid chat (eBay style) ═══ */}
                <div className="flex-1 flex flex-col relative">
                    {/* Video container — fills available height */}
                    <div className="relative flex-1 bg-black flex items-center justify-center min-h-[300px]" style={{ maxHeight: "calc(100vh - 140px)" }}>
                        {showLiveKit ? (
                            <LiveKitViewer token={livekitToken} serverUrl={livekitUrl} isLive={isLive} viewerCount={event.viewer_count} />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                {isLive && (
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse z-10">
                                        <span className="w-2 h-2 rounded-full bg-white" />
                                        EN VIVO
                                    </div>
                                )}
                                <Radio className="h-12 w-12 text-red-500 animate-pulse" />
                                <p className="text-white font-bold text-sm">
                                    {isDealer ? "Transmitiendo desde el wizard" : isLive ? "Conectando..." : isEnded ? "Transmisión finalizada" : "Esperando..."}
                                </p>
                                {livekitError && <p className="text-red-400 text-xs">{livekitError}</p>}
                            </div>
                        )}

                        {/* Chat overlay on video (eBay style) */}
                        <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none hidden lg:block">
                            <div className="p-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                                {/* Messages */}
                                <div ref={chatScrollRef} className="max-h-[180px] overflow-y-auto space-y-1 mb-2 pointer-events-auto scrollbar-thin">
                                    {visibleChat.slice(-30).map((msg) => {
                                        const isDealer = msg.user_id === event.dealer_id;
                                        return (
                                            <div key={msg.id} className="text-xs leading-relaxed">
                                                <span className={`font-bold ${isDealer ? "text-red-400" : "text-accent"}`}>
                                                    {isDealer ? "🎙️ Dealer" : msg.user_id.slice(0, 8)}
                                                </span>
                                                <span className="text-white/90 ml-1.5">{msg.message}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Chat input */}
                                {user ? (
                                    <div className="flex items-center gap-2 pointer-events-auto">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                                            placeholder="Escribe un mensaje..."
                                            maxLength={200}
                                            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                        <button
                                            onClick={sendChat}
                                            disabled={!chatInput.trim()}
                                            className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-white/40 text-xs pointer-events-auto">
                                        <a href="/auth" className="text-accent font-bold">Inicia sesión</a> para chatear
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ RIGHT SIDEBAR: Dealer + Product + Bid + Chat (mobile) ═══ */}
                <div className="w-full lg:w-[380px] flex flex-col bg-card border-l border-white/5 max-h-[calc(100vh-52px)] overflow-y-auto">
                    {/* Dealer info */}
                    <div className="p-4 border-b border-white/10 flex items-center gap-3">
                        {dealer?.avatar_url ? (
                            <img src={dealer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-accent shrink-0" />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                                <Store className="h-4 w-4 text-accent" />
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{dealer?.display_name || "Dealer"}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <ShieldCheck className="h-3 w-3 text-accent" />
                                Vendedor verificado
                            </div>
                        </div>
                    </div>

                    {/* Active product + bid */}
                    {activeProduct ? (
                        <div className="p-4 border-b border-white/10 space-y-3">
                            {/* Product title + countdown */}
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Subastando ahora</p>
                                    <h3 className="font-bold text-foreground text-sm truncate">{activeProduct.product_title}</h3>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <span className={`text-2xl font-black tabular-nums ${countdownColor}`}>
                                        {countdown}s
                                    </span>
                                    {countdown <= ANTI_SNIPE_THRESHOLD && countdown > 0 && (
                                        <p className="text-[9px] text-amber-400">⚡ +10s/puja</p>
                                    )}
                                </div>
                            </div>

                            {/* Countdown bar */}
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-250 ${
                                        countdown <= 5 ? "bg-red-500" : countdown <= ANTI_SNIPE_THRESHOLD ? "bg-amber-500" : "bg-accent"
                                    }`}
                                    style={{ width: `${Math.min(100, (countdown / (activeProduct.countdown_seconds || 60)) * 100)}%` }}
                                />
                            </div>

                            {/* Price */}
                            <div className="text-center py-2">
                                <p className="text-xs text-muted-foreground">Precio actual</p>
                                <p className="text-3xl font-black text-accent tabular-nums">
                                    ${currentPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Incremento: +${bidIncrement.toFixed(2)}
                                </p>
                            </div>

                            {/* Bid button */}
                            {countdown > 0 ? (
                                user ? (
                                    <button
                                        onClick={placeBid}
                                        disabled={bidding}
                                        className="w-full bg-accent text-accent-foreground font-black text-lg py-3.5 rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                    >
                                        <Gavel className="h-5 w-5" />
                                        Pujar ${nextBidAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                    </button>
                                ) : (
                                    <div className="text-center py-2">
                                        <a href="/auth" className="text-accent font-bold text-sm">Inicia sesión para pujar</a>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-3 bg-white/5 rounded-xl">
                                    <p className="text-sm font-bold text-foreground">
                                        {activeProduct.winner_id === user?.id ? "🎉 ¡Ganaste!" : "Subasta cerrada"}
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-6 border-b border-white/10 text-center">
                            <Timer className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                                Esperando el siguiente producto...
                            </p>
                        </div>
                    )}

                    {/* Product queue */}
                    {products.length > 0 && (
                        <div className="p-4 border-b border-white/10">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                                Productos ({soldCount}/{products.length})
                            </p>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                                {products.map((p, i) => (
                                    <div key={p.id} className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs ${
                                        p.status === "active" ? "bg-accent/10 text-accent font-bold" :
                                        p.status === "sold" ? "text-green-400 opacity-60" :
                                        p.status === "unsold" || p.status === "skipped" ? "text-muted-foreground opacity-40 line-through" :
                                        "text-foreground"
                                    }`}>
                                        <span className="w-4 text-center font-bold text-muted-foreground">{i + 1}</span>
                                        <span className="flex-1 truncate">{p.product_title}</span>
                                        <span className="shrink-0 tabular-nums">
                                            ${(p.current_price || p.starting_price).toFixed(2)}
                                        </span>
                                        {p.status === "active" && <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">EN VIVO</span>}
                                        {p.status === "sold" && <span className="text-[9px]">✅</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chat (mobile + right sidebar for desktop) */}
                    <div className="flex-1 flex flex-col min-h-0 lg:flex">
                        <div className="px-4 py-2 border-b border-white/10 flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-bold text-muted-foreground">Chat · {visibleChat.length}</p>
                        </div>
                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[100px] max-h-[300px] lg:max-h-none">
                            {visibleChat.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-6">
                                    Sé el primero en enviar un mensaje 💬
                                </p>
                            )}
                            {visibleChat.map((msg) => {
                                const isDealerMsg = msg.user_id === event.dealer_id;
                                const isMe = msg.user_id === user?.id;
                                return (
                                    <div key={msg.id} className="text-xs leading-relaxed">
                                        <span className={`font-bold ${isDealerMsg ? "text-red-400" : isMe ? "text-accent" : "text-blue-400"}`}>
                                            {isDealerMsg ? "🎙️ Dealer" : isMe ? "Tú" : msg.user_id.slice(0, 6)}
                                        </span>
                                        <span className="text-foreground ml-1.5">{msg.message}</span>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Chat input */}
                        {user ? (
                            <div className="p-2 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                                        placeholder="Escribe un mensaje..."
                                        maxLength={200}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                    />
                                    <button
                                        onClick={sendChat}
                                        disabled={!chatInput.trim()}
                                        className="w-9 h-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-30 shrink-0"
                                    >
                                        <Send className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 border-t border-white/10 text-center">
                                <a href="/auth" className="text-accent font-bold text-xs">Inicia sesión</a>
                                <span className="text-muted-foreground text-xs"> para chatear</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
