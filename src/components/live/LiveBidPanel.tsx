// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gavel, Timer, Trophy, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

interface LiveBid {
    id: string;
    bidder_id: string;
    amount: number;
    created_at: string;
}

interface LiveBidPanelProps {
    eventId: string;
    activeProduct: LiveProduct | null;
}

export default function LiveBidPanel({ eventId, activeProduct }: LiveBidPanelProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [bids, setBids] = useState<LiveBid[]>([]);
    const [bidding, setBidding] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const currentPrice = activeProduct?.current_price || activeProduct?.starting_price || 0;
    const bidIncrement = currentPrice < 10 ? 1 : currentPrice < 100 ? 5 : currentPrice < 500 ? 10 : 25;
    const nextBidAmount = currentPrice + bidIncrement;

    // Load bids for active product + realtime
    useEffect(() => {
        if (!activeProduct) { setBids([]); return; }

        const loadBids = async () => {
            const { data } = await supabase
                .from("live_bids")
                .select("id, bidder_id, amount, created_at")
                .eq("product_id", activeProduct.id)
                .order("created_at", { ascending: false })
                .limit(20);
            if (data) setBids(data as LiveBid[]);
        };
        loadBids();

        const channel = supabase
            .channel(`live-bids-${activeProduct.id}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "live_bids", filter: `product_id=eq.${activeProduct.id}` },
                (payload) => {
                    const newBid = payload.new as LiveBid;
                    setBids((prev) => [newBid, ...prev]);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeProduct?.id]);

    // Countdown timer
    useEffect(() => {
        if (!activeProduct || activeProduct.status !== "active" || !activeProduct.started_at) {
            setCountdown(0);
            return;
        }

        const tick = () => {
            const started = new Date(activeProduct.started_at!).getTime();
            const duration = activeProduct.countdown_seconds * 1000;
            const remaining = Math.max(0, Math.ceil((started + duration - Date.now()) / 1000));
            setCountdown(remaining);
        };
        tick();
        const interval = setInterval(tick, 250);
        return () => clearInterval(interval);
    }, [activeProduct?.started_at, activeProduct?.status, activeProduct?.countdown_seconds]);

    const placeBid = useCallback(async () => {
        if (!user || !activeProduct || bidding) return;
        setBidding(true);

        try {
            const { error } = await supabase.from("live_bids").insert({
                product_id: activeProduct.id,
                event_id: eventId,
                bidder_id: user.id,
                amount: nextBidAmount,
            });

            if (error) throw error;

            // Update current price on the product
            await supabase
                .from("live_event_products")
                .update({ current_price: nextBidAmount })
                .eq("id", activeProduct.id);

        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "No se pudo realizar la puja", variant: "destructive" });
        } finally {
            setBidding(false);
        }
    }, [user, activeProduct, bidding, nextBidAmount, eventId, toast]);

    // No active product state
    if (!activeProduct) {
        return (
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 h-full">
                <Timer className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                    Esperando que el dealer presente el siguiente producto...
                </p>
            </div>
        );
    }

    const isSold = activeProduct.status === "sold";
    const isEnded = countdown === 0 && activeProduct.status === "active";
    const isWinner = activeProduct.winner_id === user?.id;
    const countdownColor = countdown <= 5 ? "text-red-500" : countdown <= 15 ? "text-amber-500" : "text-accent";
    const countdownBarPercent = activeProduct.countdown_seconds > 0 ? (countdown / activeProduct.countdown_seconds) * 100 : 0;

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-full">
            {/* Product header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-start gap-3">
                    {/* Product image thumbnail */}
                    {activeProduct.product_images?.[0] ? (
                        <img
                            src={activeProduct.product_images[0]}
                            alt={activeProduct.product_title}
                            className="w-16 h-16 rounded-xl object-cover border border-border shrink-0"
                        />
                    ) : (
                        <div className="w-16 h-16 rounded-xl bg-secondary/30 flex items-center justify-center shrink-0">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-bold text-sm text-foreground truncate">{activeProduct.product_title}</h3>
                        {activeProduct.product_description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{activeProduct.product_description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Countdown bar */}
            {activeProduct.status === "active" && (
                <div className="px-4 py-3 border-b border-border bg-secondary/20">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Timer className={`h-4 w-4 ${countdownColor}`} />
                            <span className={`text-lg font-heading font-black tabular-nums ${countdownColor}`}>
                                {countdown}s
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">Tiempo restante</span>
                    </div>
                    <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-250 ${
                                countdown <= 5 ? "bg-red-500" : countdown <= 15 ? "bg-amber-500" : "bg-accent"
                            }`}
                            style={{ width: `${countdownBarPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Current price */}
            <div className="p-4 text-center border-b border-border">
                <p className="text-xs text-muted-foreground mb-1">
                    {isSold ? "Precio final" : "Precio actual"}
                </p>
                <p className="text-3xl font-heading font-black text-accent tabular-nums">
                    ${currentPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
                {!isSold && !isEnded && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Incremento: +${bidIncrement.toFixed(2)}
                    </p>
                )}
            </div>

            {/* Bid button or sold state */}
            <div className="p-4">
                {isSold || isEnded ? (
                    <div className={`text-center py-4 rounded-xl ${isWinner ? "bg-accent/10" : "bg-secondary/20"}`}>
                        <Trophy className={`h-8 w-8 mx-auto mb-2 ${isWinner ? "text-accent" : "text-muted-foreground"}`} />
                        <p className={`font-bold text-sm ${isWinner ? "text-accent" : "text-foreground"}`}>
                            {isWinner ? "¡Ganaste este producto!" : "Producto vendido"}
                        </p>
                    </div>
                ) : user ? (
                    <button
                        onClick={placeBid}
                        disabled={bidding || countdown === 0}
                        className="w-full bg-accent text-accent-foreground font-heading font-black text-lg py-4 rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                        <Gavel className="h-5 w-5" />
                        Pujar ${nextBidAmount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </button>
                ) : (
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                            <a href="/auth" className="text-accent font-bold">Inicia sesión</a> para pujar
                        </p>
                    </div>
                )}
            </div>

            {/* Recent bids */}
            <div className="flex-1 overflow-y-auto border-t border-border p-3 space-y-1.5 min-h-0">
                <p className="text-xs text-muted-foreground font-bold mb-2">Últimas pujas</p>
                {bids.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Aún no hay pujas</p>
                )}
                {bids.map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{bid.bidder_id.slice(0, 8)}...</span>
                        <span className="font-bold text-accent">${bid.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
