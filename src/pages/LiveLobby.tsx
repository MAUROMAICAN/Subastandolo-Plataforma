// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import SEOHead from "@/components/SEOHead";
import CountdownTimer from "@/components/live/CountdownTimer";
import { Radio, Users, Clock, Calendar, Store, Loader2, Bell } from "lucide-react";

interface LiveEvent {
    id: string;
    dealer_id: string;
    title: string;
    description: string | null;
    category: string | null;
    status: string;
    scheduled_at: string;
    started_at: string | null;
    viewer_count: number;
    thumbnail_url: string | null;
    dealer_name?: string;
    dealer_avatar?: string;
}

export default function LiveLobby() {
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "live" | "scheduled">("all");

    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from("live_events")
                .select("*")
                .in("status", ["live", "scheduled"])
                .order("status", { ascending: false }) // live first
                .order("scheduled_at", { ascending: true });

            if (data) {
                // Fetch dealer profiles
                const dealerIds = [...new Set(data.map((e: LiveEvent) => e.dealer_id))];
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("id, display_name, avatar_url")
                    .in("id", dealerIds);

                const profileMap = new Map(profiles?.map((p: { id: string; display_name: string; avatar_url: string }) => [p.id, p]) || []);

                const enriched = data.map((e: LiveEvent) => {
                    const profile = profileMap.get(e.dealer_id) as { display_name: string; avatar_url: string } | undefined;
                    return {
                        ...e,
                        dealer_name: profile?.display_name || "Dealer",
                        dealer_avatar: profile?.avatar_url || null,
                    };
                });
                setEvents(enriched);
            }
            setLoading(false);
        };
        load();

        // Subscribe to event status changes
        const channel = supabase
            .channel("live-lobby")
            .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, () => {
                load(); // Reload on any change
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const liveEvents = events.filter((e) => e.status === "live");
    const scheduledEvents = events.filter((e) => e.status === "scheduled");

    const filtered = events.filter((e) => {
        if (filter === "live") return e.status === "live";
        if (filter === "scheduled") return e.status === "scheduled";
        return true;
    });

    const liveCount = liveEvents.length;
    const scheduledCount = scheduledEvents.length;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <SEOHead
                title="Subastas en Vivo | Subastandolo"
                description="Participa en subastas en vivo con video streaming. Puja en tiempo real y gana productos increíbles."
            />
            <Navbar />
            <BackButton />

            {/* Hero */}
            <section className="bg-nav py-16 sm:py-20 relative overflow-hidden">
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: "radial-gradient(circle at 70% 30%, hsl(var(--accent)) 0%, transparent 60%), radial-gradient(circle at 20% 80%, #ef4444 0%, transparent 50%)",
                    }}
                />
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-full px-4 py-1.5 mb-6">
                        <Radio className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                        <span className="text-red-400 text-xs font-semibold tracking-wider uppercase">Subastas Live</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-4 leading-tight">
                        Subastas en <span className="text-accent">Vivo</span>
                    </h1>
                    <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-6">
                        Mira las transmisiones en vivo de los dealers, chatea y puja en tiempo real por productos exclusivos.
                    </p>

                    {liveCount > 0 && (
                        <div className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-5 py-2 rounded-full animate-pulse">
                            <span className="w-2.5 h-2.5 rounded-full bg-white" />
                            {liveCount} {liveCount === 1 ? "subasta" : "subastas"} en vivo ahora
                        </div>
                    )}
                </div>
            </section>

            {/* Upcoming Events Carousel (scheduled events with countdown) */}
            {scheduledCount > 0 && (
                <section className="bg-card border-b border-border py-6">
                    <div className="container mx-auto px-4">
                        <h2 className="text-sm font-heading font-bold text-foreground mb-4 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-accent" />
                            Próximas Subastas
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {scheduledEvents.slice(0, 6).map((event) => (
                                <ScheduledEventBanner key={event.id} event={event} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Filter tabs */}
            <div className="border-b border-border bg-card">
                <div className="container mx-auto px-4">
                    <div className="flex gap-1 py-2">
                        {(["all", "live", "scheduled"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    filter === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-secondary/50"
                                }`}
                            >
                                {f === "all" ? "Todas" : f === "live" ? `🔴 En Vivo (${liveCount})` : `📅 Programadas (${scheduledCount})`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Events grid */}
            <section className="flex-1 py-10">
                <div className="container mx-auto px-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-accent" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20">
                            <Radio className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-lg font-bold text-foreground mb-2">No hay subastas en vivo</p>
                            <p className="text-sm text-muted-foreground">Vuelve pronto para ver nuevas transmisiones</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filtered.map((event) => (
                                <LiveEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <Footer />
        </div>
    );
}

/* ── Scheduled Event Banner (promotional card with countdown) ── */
function ScheduledEventBanner({ event }: { event: LiveEvent }) {
    const scheduledDate = new Date(event.scheduled_at);
    const dayName = scheduledDate.toLocaleDateString("es-VE", { weekday: "long" });
    const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const time = scheduledDate.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

    return (
        <Link
            to={`/live/${event.id}`}
            className="group relative bg-gradient-to-br from-nav via-nav to-nav-solid border border-white/10 rounded-2xl overflow-hidden hover:border-accent/40 transition-all duration-300"
        >
            {/* Subtle glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-4 space-y-3">
                {/* Top: Dealer info + category */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {event.dealer_avatar ? (
                            <img src={event.dealer_avatar} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-accent/30" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                                <Store className="h-4 w-4 text-accent" />
                            </div>
                        )}
                        <span className="text-xs font-bold text-white truncate max-w-[120px]">
                            {event.dealer_name}
                        </span>
                    </div>
                    {event.category && (
                        <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                            {event.category}
                        </span>
                    )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-heading font-bold text-white line-clamp-2 group-hover:text-accent transition-colors">
                    {event.title}
                </h3>

                {/* Schedule banner */}
                <div className="bg-white/5 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-accent" />
                            <span className="text-xs text-white/80 font-semibold">
                                {dayCapitalized} {time}
                            </span>
                        </div>
                        <span className="text-[10px] text-white/40 font-medium">⏳ Faltan</span>
                    </div>
                    <CountdownTimer targetDate={event.scheduled_at} />
                </div>

                {/* "No te lo pierdas" banner */}
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40 italic">
                        ¡No te lo pierdas!
                    </span>
                    <div className="flex items-center gap-1 text-accent text-[10px] font-bold">
                        <Bell className="h-3 w-3" />
                        Recordar
                    </div>
                </div>
            </div>
        </Link>
    );
}

/* ── Live/All Event Card ── */
function LiveEventCard({ event }: { event: LiveEvent }) {
    const isLive = event.status === "live";
    const scheduledDate = new Date(event.scheduled_at);
    const now = new Date();
    const isToday = scheduledDate.toDateString() === now.toDateString();

    return (
        <Link
            to={`/live/${event.id}`}
            className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
        >
            {/* Thumbnail / placeholder */}
            <div className="aspect-video bg-nav relative overflow-hidden">
                {event.thumbnail_url ? (
                    <img src={event.thumbnail_url} alt={event.title} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-nav to-nav-solid">
                        <Radio className={`h-12 w-12 ${isLive ? "text-red-400 animate-pulse" : "text-muted-foreground"}`} />
                    </div>
                )}

                {/* Status badge */}
                <div className="absolute top-3 left-3">
                    {isLive ? (
                        <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            EN VIVO
                        </span>
                    ) : (
                        <span className="bg-secondary/80 backdrop-blur text-foreground text-xs font-semibold px-3 py-1 rounded-full">
                            PRÓXIMAMENTE
                        </span>
                    )}
                </div>

                {/* Viewer count */}
                {isLive && (
                    <div className="absolute top-3 right-3">
                        <span className="flex items-center gap-1 bg-black/60 backdrop-blur text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                            <Users className="h-3 w-3" />
                            {event.viewer_count}
                        </span>
                    </div>
                )}

                {/* Countdown overlay for scheduled */}
                {!isLive && (
                    <div className="absolute bottom-2 left-2">
                        <CountdownTimer targetDate={event.scheduled_at} className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-heading font-bold text-sm text-foreground mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                    {event.title}
                </h3>

                {/* Dealer info */}
                <div className="flex items-center gap-2 mb-3">
                    {event.dealer_avatar ? (
                        <img src={event.dealer_avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                            <Store className="h-3 w-3 text-accent" />
                        </div>
                    )}
                    <span className="text-xs text-muted-foreground">{event.dealer_name}</span>
                </div>

                {/* Schedule info */}
                {!isLive && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isToday ? (
                            <>
                                <Clock className="h-3.5 w-3.5 text-accent" />
                                <span className="text-accent font-bold">
                                    Hoy a las {scheduledDate.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </>
                        ) : (
                            <>
                                <Calendar className="h-3.5 w-3.5" />
                                {scheduledDate.toLocaleDateString("es-VE", { day: "numeric", month: "short" })} — {scheduledDate.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                            </>
                        )}
                    </div>
                )}

                {event.category && (
                    <span className="inline-block mt-2 text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                        {event.category}
                    </span>
                )}
            </div>
        </Link>
    );
}
