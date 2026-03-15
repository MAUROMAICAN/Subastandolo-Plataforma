// @ts-nocheck — live_* tables not yet in generated Supabase types
// LiveProductControls — dealer manages products while broadcasting
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Plus, Package, Play, CheckCircle, SkipForward,
    ChevronDown, ChevronUp, Loader2, Timer, Trophy,
    DollarSign, Gavel, X,
} from "lucide-react";

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
    started_at: string | null;
    ends_at: string | null;
    winner_id: string | null;
}

interface Props {
    eventId: string;
}

const ANTI_SNIPE_THRESHOLD = 15; // seconds — extend if remaining < this

export default function LiveProductControls({ eventId }: Props) {
    const { toast } = useToast();
    const [products, setProducts] = useState<LiveProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [bidCounts, setBidCounts] = useState<Record<string, number>>({});

    // Add form state
    const [newTitle, setNewTitle] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [newCountdown, setNewCountdown] = useState("60");
    const [adding, setAdding] = useState(false);

    // Active product countdown
    const [countdown, setCountdown] = useState(0);
    const activeProduct = products.find((p) => p.status === "active");
    const pendingProducts = products.filter((p) => p.status === "pending");
    const completedProducts = products.filter((p) => ["sold", "unsold", "skipped"].includes(p.status));

    // Load products
    const loadProducts = useCallback(async () => {
        const { data } = await supabase
            .from("live_event_products")
            .select("*")
            .eq("event_id", eventId)
            .order("sort_order", { ascending: true });
        if (data) setProducts(data as LiveProduct[]);
        setLoading(false);
    }, [eventId]);

    useEffect(() => { loadProducts(); }, [loadProducts]);

    // Realtime: product updates
    useEffect(() => {
        const channel = supabase
            .channel(`live-products-ctrl-${eventId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "live_event_products", filter: `event_id=eq.${eventId}` },
                () => loadProducts()
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [eventId, loadProducts]);

    // Countdown timer for active product
    useEffect(() => {
        if (!activeProduct?.ends_at) { setCountdown(0); return; }

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((new Date(activeProduct.ends_at!).getTime() - Date.now()) / 1000));
            setCountdown(remaining);

            // Auto-close when countdown reaches 0
            if (remaining <= 0) {
                autoCloseProduct(activeProduct);
            }
        };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [activeProduct?.ends_at, activeProduct?.id]);

    // Load bid count for active product
    useEffect(() => {
        if (!activeProduct) return;
        const loadBidCount = async () => {
            const { count } = await supabase
                .from("live_bids")
                .select("id", { count: "exact", head: true })
                .eq("product_id", activeProduct.id);
            setBidCounts((prev) => ({ ...prev, [activeProduct.id]: count || 0 }));
        };
        loadBidCount();

        // Realtime bid count
        const channel = supabase
            .channel(`bid-count-${activeProduct.id}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "live_bids", filter: `product_id=eq.${activeProduct.id}` },
                () => {
                    setBidCounts((prev) => ({ ...prev, [activeProduct.id]: (prev[activeProduct.id] || 0) + 1 }));
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [activeProduct?.id]);

    // Auto-close product when countdown ends
    const autoCloseProduct = async (product: LiveProduct) => {
        // Find highest bidder
        const { data: topBid } = await supabase
            .from("live_bids")
            .select("bidder_id, amount")
            .eq("product_id", product.id)
            .order("amount", { ascending: false })
            .limit(1)
            .single();

        const newStatus = topBid ? "sold" : "unsold";
        await supabase
            .from("live_event_products")
            .update({
                status: newStatus,
                winner_id: topBid?.bidder_id || null,
                current_price: topBid?.amount || product.current_price,
                ended_at: new Date().toISOString(),
            })
            .eq("id", product.id)
            .eq("status", "active"); // Only if still active (prevent double-close)

        loadProducts();
    };

    // Add product
    const addProduct = async () => {
        if (!newTitle.trim() || !newPrice) return;
        setAdding(true);
        const { error } = await supabase.from("live_event_products").insert({
            event_id: eventId,
            product_title: newTitle.trim(),
            starting_price: parseFloat(newPrice),
            countdown_seconds: parseInt(newCountdown) || 60,
            sort_order: products.length,
        });
        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setNewTitle(""); setNewPrice(""); setShowAddForm(false);
            toast({ title: "✅ Producto agregado" });
        }
        setAdding(false);
    };

    // Activate product (start auction)
    const activateProduct = async (product: LiveProduct) => {
        // Deactivate any current active product
        if (activeProduct) {
            await autoCloseProduct(activeProduct);
        }

        const now = new Date();
        const endsAt = new Date(now.getTime() + (product.countdown_seconds || 60) * 1000);

        await supabase
            .from("live_event_products")
            .update({
                status: "active",
                current_price: product.starting_price,
                started_at: now.toISOString(),
                ends_at: endsAt.toISOString(),
            })
            .eq("id", product.id);

        toast({ title: "🔴 Subasta iniciada", description: product.product_title });
        loadProducts();
    };

    // Mark as sold (manual)
    const markSold = async (product: LiveProduct) => {
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

        toast({ title: "✅ ¡Vendido!" });
        loadProducts();
    };

    // Skip product
    const skipProduct = async (product: LiveProduct) => {
        await supabase
            .from("live_event_products")
            .update({
                status: "skipped",
                ended_at: new Date().toISOString(),
            })
            .eq("id", product.id);
        loadProducts();
    };

    const countdownColor = countdown <= 5 ? "text-red-500" : countdown <= ANTI_SNIPE_THRESHOLD ? "text-amber-500" : "text-accent";
    const countdownBarMax = activeProduct?.countdown_seconds || 60;
    const countdownBarPercent = Math.min(100, (countdown / countdownBarMax) * 100);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-between p-3 hover:bg-secondary/20 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-accent" />
                    <span className="text-sm font-bold text-foreground">
                        Productos ({products.length})
                    </span>
                    {activeProduct && (
                        <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">
                            SUBASTANDO
                        </span>
                    )}
                </div>
                {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>

            {!collapsed && (
                <div className="border-t border-border">
                    {/* Active product display */}
                    {activeProduct && (
                        <div className="p-3 bg-accent/5 border-b border-accent/20">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-accent truncate flex-1">
                                    🔴 {activeProduct.product_title}
                                </p>
                                <span className="text-xs text-muted-foreground ml-2">
                                    {bidCounts[activeProduct.id] || 0} pujas
                                </span>
                            </div>

                            {/* Price */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-lg font-black text-accent tabular-nums">
                                    ${(activeProduct.current_price || activeProduct.starting_price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                </span>
                                <span className={`text-2xl font-black tabular-nums ${countdownColor}`}>
                                    {countdown}s
                                </span>
                            </div>

                            {/* Countdown bar */}
                            <div className="w-full h-1.5 bg-secondary/50 rounded-full overflow-hidden mb-3">
                                <div
                                    className={`h-full rounded-full transition-all duration-250 ${
                                        countdown <= 5 ? "bg-red-500" : countdown <= ANTI_SNIPE_THRESHOLD ? "bg-amber-500" : "bg-accent"
                                    }`}
                                    style={{ width: `${countdownBarPercent}%` }}
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => markSold(activeProduct)}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    ¡Vendido!
                                </button>
                                <button
                                    onClick={() => skipProduct(activeProduct)}
                                    className="flex items-center gap-1.5 bg-secondary/50 text-muted-foreground text-xs font-bold px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                                >
                                    <SkipForward className="h-3.5 w-3.5" />
                                    Saltar
                                </button>
                            </div>

                            {countdown <= ANTI_SNIPE_THRESHOLD && countdown > 0 && (
                                <p className="text-[10px] text-amber-400 text-center mt-2">
                                    ⚡ Zona anti-sniping — cada puja agrega +10s
                                </p>
                            )}
                        </div>
                    )}

                    {/* Pending products queue */}
                    {pendingProducts.length > 0 && (
                        <div className="p-3 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">
                                Cola ({pendingProducts.length})
                            </p>
                            {pendingProducts.map((p, i) => (
                                <div
                                    key={p.id}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/10 border border-border"
                                >
                                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-foreground truncate">{p.product_title}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            ${p.starting_price.toFixed(2)} · {p.countdown_seconds}s
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => activateProduct(p)}
                                        className="flex items-center gap-1 bg-accent text-accent-foreground text-[10px] font-bold px-2.5 py-1 rounded-md hover:bg-accent/90"
                                    >
                                        <Play className="h-3 w-3" />
                                        Subastar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Completed products summary */}
                    {completedProducts.length > 0 && (
                        <div className="p-3 border-t border-border">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">
                                Completados ({completedProducts.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {completedProducts.map((p) => (
                                    <span
                                        key={p.id}
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            p.status === "sold"
                                                ? "bg-green-500/10 text-green-400"
                                                : "bg-secondary/50 text-muted-foreground"
                                        }`}
                                    >
                                        {p.status === "sold" ? "✅" : "⏭️"} {p.product_title}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick add form */}
                    {showAddForm ? (
                        <div className="p-3 border-t border-border bg-secondary/10 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-bold text-foreground">Agregar producto</p>
                                <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Nombre del producto *"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-muted-foreground">Precio ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        placeholder="10.00"
                                        value={newPrice}
                                        onChange={(e) => setNewPrice(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground">Duración (seg)</label>
                                    <input
                                        type="number"
                                        min="10"
                                        max="300"
                                        value={newCountdown}
                                        onChange={(e) => setNewCountdown(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={addProduct}
                                disabled={adding || !newTitle.trim() || !newPrice}
                                className="w-full bg-accent text-accent-foreground text-xs font-bold py-2 rounded-lg disabled:opacity-50"
                            >
                                {adding ? "Agregando..." : "Agregar a la cola"}
                            </button>
                        </div>
                    ) : (
                        <div className="p-3 border-t border-border">
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full flex items-center justify-center gap-1.5 text-xs text-accent font-bold py-2 border border-dashed border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Agregar producto
                            </button>
                        </div>
                    )}

                    {/* Empty state */}
                    {products.length === 0 && !showAddForm && (
                        <div className="p-6 text-center">
                            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">
                                Agrega productos para subastar durante tu transmisión
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
