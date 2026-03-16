// @ts-nocheck — live_* tables not yet in generated Supabase types
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Loader2, Radio, Trophy, ExternalLink, ChevronDown, ChevronUp,
    Package, DollarSign, Users, Phone, Mail, Copy, CheckCircle,
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

interface ProfileInfo {
    full_name: string;
    phone: string | null;
    email: string | null;
}

interface Props {
    globalSearch?: string;
}

export default function AdminLiveSalesTab({ globalSearch = "" }: Props) {
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [products, setProducts] = useState<LiveProduct[]>([]);
    const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
    const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
    const [bidCounts, setBidCounts] = useState<Record<string, number>>({});
    const [copied, setCopied] = useState<string | null>(null);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);

        const { data: eventsData } = await supabase
            .from("live_events")
            .select("*")
            .order("scheduled_at", { ascending: false });

        const eventsList = eventsData || [];
        setEvents(eventsList);

        const eventIds = eventsList.map((e: any) => e.id);
        let productsList: LiveProduct[] = [];
        if (eventIds.length > 0) {
            const { data: productsData } = await supabase
                .from("live_event_products")
                .select("*")
                .in("event_id", eventIds)
                .order("sort_order");
            productsList = productsData || [];
            setProducts(productsList);

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

        // Collect ALL user IDs (dealers + winners)
        const allUserIds = new Set<string>();
        eventsList.forEach((e: any) => allUserIds.add(e.dealer_id));
        productsList.forEach((p: any) => { if (p.winner_id) allUserIds.add(p.winner_id); });

        if (allUserIds.size > 0) {
            const { data: profilesData } = await supabase
                .from("profiles")
                .select("id, full_name, phone")
                .in("id", [...allUserIds]);

            // Fetch emails via admin function
            let emailMap: Record<string, string> = {};
            try {
                const { data: emailData } = await supabase.functions.invoke("admin-manage-user", {
                    body: { action: "list_users", userId: "all" },
                });
                if (emailData?.emails) emailMap = emailData.emails;
            } catch (e) { console.error("Email fetch error:", e); }

            const map: Record<string, ProfileInfo> = {};
            (profilesData || []).forEach((p: any) => {
                map[p.id] = {
                    full_name: p.full_name || p.id.slice(0, 8),
                    phone: p.phone || null,
                    email: emailMap[p.id] || null,
                };
            });
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
    const soldProducts = products.filter((p) => p.status === "sold");
    const totalRevenue = soldProducts.reduce((sum, p) => sum + (p.current_price || p.starting_price), 0);
    const totalBids = Object.values(bidCounts).reduce((a, b) => a + b, 0);
    const liveEvents = events.filter((e) => e.status === "live").length;

    const filteredEvents = globalSearch
        ? events.filter((e) =>
            e.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
            (profiles[e.dealer_id]?.full_name || "").toLowerCase().includes(globalSearch.toLowerCase())
        )
        : events;

    /** Renders a contact detail row with copy button */
    const ContactRow = ({ icon: Icon, value, label }: { icon: any; value: string; label: string }) => (
        <div className="flex items-center gap-2 text-xs">
            <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-foreground">{value}</span>
            <button
                onClick={(e) => { e.stopPropagation(); copyToClipboard(value, label); }}
                className="text-muted-foreground hover:text-accent transition-colors shrink-0"
                title="Copiar"
            >
                {copied === label ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
                    <Radio className="h-5 w-5 text-red-500" /> Ventas En Vivo
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Todas las subastas en vivo, productos vendidos y datos de ganadores
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Eventos", value: events.length, sub: `${liveEvents} en vivo`, icon: Radio, gradient: "from-red-500/20 to-red-500/5", iconColor: "text-red-400" },
                    { label: "Vendidos", value: soldProducts.length, sub: `de ${products.length} productos`, icon: Package, gradient: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-400" },
                    { label: "Ingresos Live", value: `$${totalRevenue.toFixed(2)}`, sub: `${totalBids} pujas totales`, icon: DollarSign, gradient: "from-green-500/20 to-green-500/5", iconColor: "text-green-400" },
                    { label: "Compradores", value: new Set(soldProducts.map((p) => p.winner_id).filter(Boolean)).size, sub: "ganadores únicos", icon: Users, gradient: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-400" },
                ].map((stat) => (
                    <div key={stat.label} className={`bg-gradient-to-br ${stat.gradient} border border-border rounded-xl p-4`}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 h-9 rounded-lg bg-card/60 flex items-center justify-center shadow-sm">
                                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground tabular-nums">{stat.value}</p>
                        <p className="text-[11px] font-bold text-foreground/80">{stat.label}</p>
                        <p className="text-[9px] text-muted-foreground">{stat.sub}</p>
                    </div>
                ))}
            </div>

            {/* Events */}
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
                                <button
                                    onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                                    className="w-full p-4 flex items-center gap-3 hover:bg-secondary/20 transition-colors text-left"
                                >
                                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                                        event.status === "live" ? "bg-red-500 animate-pulse" :
                                        event.status === "ended" ? "bg-emerald-500" : "bg-amber-500"
                                    }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-foreground truncate">{event.title}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {profiles[event.dealer_id]?.full_name || "Dealer"} · {new Date(event.scheduled_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                        <p className="text-sm font-black text-accent tabular-nums">${eventRevenue.toFixed(2)}</p>
                                        <p className="text-[9px] text-muted-foreground">{eventSold.length}/{eventProducts.length} vendidos</p>
                                    </div>
                                    <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${
                                        event.status === "live" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30" :
                                        event.status === "ended" ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30" :
                                        "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                                    }`}>
                                        {event.status === "live" ? "EN VIVO" : event.status === "ended" ? "Finalizado" : "Programado"}
                                    </span>
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-border">
                                        <div className="p-4 bg-secondary/5">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    Productos ({eventProducts.length})
                                                </p>
                                                <a href={`/live/${event.id}`} target="_blank" rel="noreferrer"
                                                    className="text-[10px] text-accent font-bold flex items-center gap-1 hover:underline">
                                                    <ExternalLink className="h-3 w-3" /> Ver sala
                                                </a>
                                            </div>
                                            {eventProducts.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-4 text-center">Sin productos</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {eventProducts.map((p) => {
                                                        const winner = p.winner_id ? profiles[p.winner_id] : null;
                                                        return (
                                                            <div key={p.id}
                                                                className={`rounded-xl text-xs overflow-hidden ${
                                                                    p.status === "sold"
                                                                        ? "bg-emerald-500/5 border border-emerald-500/20"
                                                                        : p.status === "active"
                                                                        ? "bg-accent/5 border border-accent/20"
                                                                        : "bg-card border border-border"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3 p-3">
                                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                                        p.status === "sold" ? "bg-emerald-400" :
                                                                        p.status === "active" ? "bg-accent animate-pulse" :
                                                                        p.status === "unsold" ? "bg-red-400" :
                                                                        "bg-muted-foreground/30"
                                                                    }`} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-bold text-foreground truncate">{p.product_title}</p>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <p className="font-black tabular-nums text-foreground">
                                                                            ${(p.current_price || p.starting_price).toFixed(2)}
                                                                        </p>
                                                                        {p.status === "sold" && (
                                                                            <p className="text-[9px] text-muted-foreground">{bidCounts[p.id] || 0} pujas</p>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${
                                                                        p.status === "sold" ? "bg-emerald-500/15 text-emerald-400" :
                                                                        p.status === "active" ? "bg-accent/15 text-accent" :
                                                                        p.status === "unsold" ? "bg-red-500/15 text-red-400" :
                                                                        "bg-secondary text-muted-foreground"
                                                                    }`}>
                                                                        {p.status === "sold" ? "Vendido" :
                                                                         p.status === "active" ? "Activo" :
                                                                         p.status === "unsold" ? "No vendido" :
                                                                         p.status === "skipped" ? "Omitido" : "Pendiente"}
                                                                    </span>
                                                                </div>
                                                                {/* Winner contact details */}
                                                                {p.status === "sold" && winner && (
                                                                    <div className="px-3 pb-3 pt-0 border-t border-emerald-500/10 mt-0">
                                                                        <div className="bg-emerald-500/5 rounded-lg p-2.5 space-y-1.5">
                                                                            <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                                                                <Trophy className="h-3 w-3" /> Ganador
                                                                            </p>
                                                                            <p className="text-sm font-bold text-foreground">{winner.full_name}</p>
                                                                            {winner.phone && (
                                                                                <ContactRow icon={Phone} value={winner.phone} label={`phone-${p.id}`} />
                                                                            )}
                                                                            {winner.email && (
                                                                                <ContactRow icon={Mail} value={winner.email} label={`email-${p.id}`} />
                                                                            )}
                                                                            {!winner.phone && !winner.email && (
                                                                                <p className="text-[10px] text-muted-foreground italic">Sin datos de contacto</p>
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
