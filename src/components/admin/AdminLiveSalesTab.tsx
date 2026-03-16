// @ts-nocheck — live_* tables not yet in generated Supabase types
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Loader2, Radio, Trophy, ExternalLink, ChevronDown, ChevronUp,
    Package, DollarSign, Users,
} from "lucide-react";

interface LiveEvent {
    id: string;
    title: string;
    status: string;
    dealer_id: string;
    scheduled_at: string;
    started_at: string | null;
    ended_at: string | null;
    viewer_count: number;
}

interface LiveProduct {
    id: string;
    event_id: string;
    product_title: string;
    starting_price: number;
    current_price: number | null;
    status: string;
    winner_id: string | null;
}

interface Props {
    globalSearch?: string;
}

export default function AdminLiveSalesTab({ globalSearch = "" }: Props) {
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [products, setProducts] = useState<LiveProduct[]>([]);
    const [profiles, setProfiles] = useState<Record<string, string>>({});
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
    const [bidCounts, setBidCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // Fetch all live events
        const { data: eventsData } = await supabase
            .from("live_events")
            .select("*")
            .order("scheduled_at", { ascending: false });

        const eventsList = eventsData || [];
        setEvents(eventsList);

        // Fetch all products for all events
        const eventIds = eventsList.map((e: any) => e.id);
        if (eventIds.length > 0) {
            const { data: productsData } = await supabase
                .from("live_event_products")
                .select("*")
                .in("event_id", eventIds)
                .order("sort_order");
            setProducts(productsData || []);

            // Fetch bid counts
            const { data: bidsData } = await supabase
                .from("live_bids")
                .select("product_id")
                .in("event_id", eventIds);
            const counts: Record<string, number> = {};
            (bidsData || []).forEach((b: any) => {
                counts[b.product_id] = (counts[b.product_id] || 0) + 1;
            });
            setBidCounts(counts);
        }

        // Fetch all relevant profiles (dealers + winners)
        const allUserIds = new Set<string>();
        eventsList.forEach((e: any) => allUserIds.add(e.dealer_id));
        (products || []).forEach((p: any) => { if (p.winner_id) allUserIds.add(p.winner_id); });

        // Also get winner IDs from just-fetched products
        const prods = (eventIds.length > 0) ? (await supabase.from("live_event_products").select("winner_id").in("event_id", eventIds).not("winner_id", "is", null)).data || [] : [];
        prods.forEach((p: any) => { if (p.winner_id) allUserIds.add(p.winner_id); });

        if (allUserIds.size > 0) {
            const { data: profilesData } = await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", [...allUserIds]);
            const map: Record<string, string> = {};
            (profilesData || []).forEach((p: any) => { map[p.id] = p.full_name || p.id.slice(0, 8); });
            setProfiles(map);
        }

        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    // Stats
    const totalEvents = events.length;
    const liveEvents = events.filter((e) => e.status === "live").length;
    const endedEvents = events.filter((e) => e.status === "ended").length;
    const soldProducts = products.filter((p) => p.status === "sold");
    const totalRevenue = soldProducts.reduce((sum, p) => sum + (p.current_price || p.starting_price), 0);
    const totalBids = Object.values(bidCounts).reduce((a, b) => a + b, 0);

    // Filter by search
    const filteredEvents = globalSearch
        ? events.filter((e) =>
            e.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
            (profiles[e.dealer_id] || "").toLowerCase().includes(globalSearch.toLowerCase())
        )
        : events;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
                    <Radio className="h-5 w-5 text-red-500" /> Ventas En Vivo
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Todas las subastas en vivo, productos vendidos y ganadores
                </p>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Eventos", value: totalEvents, sub: `${liveEvents} en vivo`, icon: Radio, color: "text-red-500", bg: "bg-red-500/10" },
                    { label: "Productos Vendidos", value: soldProducts.length, sub: `de ${products.length}`, icon: Package, color: "text-green-500", bg: "bg-green-500/10" },
                    { label: "Ingresos Live", value: `$${totalRevenue.toFixed(2)}`, sub: `${totalBids} pujas`, icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                    { label: "Compradores", value: new Set(soldProducts.map((p) => p.winner_id).filter(Boolean)).size, sub: "ganadores únicos", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                ].map((stat) => (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </div>
                        <p className="text-lg font-black text-foreground tabular-nums">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        <p className="text-[9px] text-muted-foreground/60">{stat.sub}</p>
                    </div>
                ))}
            </div>

            {/* Events list */}
            {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No hay eventos en vivo registrados</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredEvents.map((event) => {
                        const eventProducts = products.filter((p) => p.event_id === event.id);
                        const eventSold = eventProducts.filter((p) => p.status === "sold");
                        const eventRevenue = eventSold.reduce((sum, p) => sum + (p.current_price || p.starting_price), 0);
                        const isExpanded = expandedEvent === event.id;

                        return (
                            <div key={event.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                                {/* Event header */}
                                <button
                                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                    className="w-full p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors text-left"
                                >
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                        event.status === "live" ? "bg-red-500 animate-pulse" :
                                        event.status === "ended" ? "bg-green-500" :
                                        "bg-amber-500"
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-foreground truncate">{event.title}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {profiles[event.dealer_id] || "Dealer"} · {new Date(event.scheduled_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-xs font-bold text-foreground tabular-nums">${eventRevenue.toFixed(2)}</p>
                                        <p className="text-[9px] text-muted-foreground">{eventSold.length}/{eventProducts.length} vendidos</p>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                        event.status === "live" ? "bg-red-500/10 text-red-400" :
                                        event.status === "ended" ? "bg-green-500/10 text-green-400" :
                                        "bg-amber-500/10 text-amber-400"
                                    }`}>
                                        {event.status === "live" ? "EN VIVO" : event.status === "ended" ? "Finalizado" : "Programado"}
                                    </span>
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>

                                {/* Expanded: product details */}
                                {isExpanded && (
                                    <div className="border-t border-border">
                                        <div className="p-3 bg-secondary/10">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    Productos ({eventProducts.length})
                                                </p>
                                                <a
                                                    href={`/live/${event.id}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[10px] text-accent font-bold flex items-center gap-1 hover:underline"
                                                >
                                                    <ExternalLink className="h-3 w-3" /> Ver sala
                                                </a>
                                            </div>
                                            {eventProducts.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-4 text-center">Sin productos</p>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {eventProducts.map((p) => (
                                                        <div
                                                            key={p.id}
                                                            className={`flex items-center gap-3 p-2.5 rounded-xl text-xs ${
                                                                p.status === "sold"
                                                                    ? "bg-green-500/5 border border-green-500/20"
                                                                    : p.status === "active"
                                                                    ? "bg-accent/5 border border-accent/20"
                                                                    : "bg-card border border-border"
                                                            }`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                p.status === "sold" ? "bg-green-400" :
                                                                p.status === "active" ? "bg-accent animate-pulse" :
                                                                p.status === "unsold" ? "bg-red-400" :
                                                                "bg-muted-foreground/30"
                                                            }`} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-foreground truncate">{p.product_title}</p>
                                                                {p.status === "sold" && p.winner_id && (
                                                                    <p className="text-[10px] text-green-400/80 flex items-center gap-1 mt-0.5">
                                                                        <Trophy className="h-2.5 w-2.5" />
                                                                        {profiles[p.winner_id] || p.winner_id.slice(0, 12)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="font-black tabular-nums text-foreground">
                                                                    ${(p.current_price || p.starting_price).toFixed(2)}
                                                                </p>
                                                                {p.status === "sold" && (
                                                                    <p className="text-[9px] text-muted-foreground">
                                                                        {bidCounts[p.id] || 0} pujas
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                                                p.status === "sold" ? "bg-green-500/10 text-green-400" :
                                                                p.status === "active" ? "bg-accent/10 text-accent" :
                                                                p.status === "unsold" ? "bg-red-500/10 text-red-400" :
                                                                "bg-secondary text-muted-foreground"
                                                            }`}>
                                                                {p.status === "sold" ? "Vendido" :
                                                                 p.status === "active" ? "Activo" :
                                                                 p.status === "unsold" ? "No vendido" :
                                                                 p.status === "skipped" ? "Omitido" : "Pendiente"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
