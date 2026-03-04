import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import ShippingForm from "@/components/ShippingForm";
import PaymentFlow from "@/components/PaymentFlow";
import AuctionProgressTracker from "@/components/AuctionProgressTracker";
import SEOHead from "@/components/SEOHead";
import { Loader2, Trophy, ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

const MiCompra = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    const [auction, setAuction] = useState<Tables<"auctions"> | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [shippingDone, setShippingDone] = useState(false);

    // Guard: must be logged in
    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (!id || !user) return;
        const fetch = async () => {
            setLoading(true);
            const { data: auc } = await supabase
                .from("auctions")
                .select("*")
                .eq("id", id)
                .single();

            if (!auc) { navigate("/mi-panel"); return; }

            // Security: only winner can access this page
            if (auc.winner_id !== user.id) { navigate("/mi-panel"); return; }

            const { data: imgs } = await supabase
                .from("auction_images")
                .select("image_url, display_order")
                .eq("auction_id", id)
                .order("display_order");

            setAuction(auc);
            setImages(
                imgs?.map(i => i.image_url) ||
                (auc.image_url ? [auc.image_url] : [])
            );
            setLoading(false);
        };
        fetch();
    }, [id, user, navigate]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (!auction) return null;

    const heroImg = images[0] || auction.image_url;

    return (
        <div className="min-h-screen bg-background">
            <SEOHead title="Mi Compra · Pago y Envío" description="Completa tu compra ganada en subasta" />
            <Navbar />
            <BackButton />

            <main className="container mx-auto px-4 py-4 max-w-2xl">
                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
                    <button
                        onClick={() => navigate("/mi-panel")}
                        className="hover:text-primary transition-colors flex items-center gap-1"
                    >
                        <ArrowLeft className="h-3 w-3" /> Mi Panel
                    </button>
                    <span className="text-border">/</span>
                    <span className="text-foreground font-medium truncate">Mi Compra</span>
                </div>

                {/* Auction won header */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-6">
                    <div className="bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border-b border-border px-5 py-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <Trophy className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">¡Felicidades, ganaste!</p>
                            <p className="font-heading font-bold text-sm text-foreground leading-tight">{auction.title}</p>
                        </div>
                        <div className="ml-auto text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">Precio final</p>
                            <p className="font-black text-xl text-foreground">${auction.current_price.toLocaleString("es-MX")}</p>
                            <p className="text-[10px] text-muted-foreground">USD</p>
                        </div>
                    </div>

                    {/* Product image strip */}
                    {heroImg && (
                        <div className="bg-secondary/30 flex justify-center py-4">
                            <img
                                src={heroImg}
                                alt={auction.title}
                                className="h-40 w-40 object-contain rounded-lg"
                            />
                        </div>
                    )}
                </div>

                {/* Progress tracker */}
                <div className="mb-6">
                    <AuctionProgressTracker
                        paymentStatus={auction.payment_status}
                        deliveryStatus={auction.delivery_status}
                        trackingNumber={auction.tracking_number}
                    />
                </div>

                {/* Step 1: Shipping */}
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
                        <h2 className="font-heading font-bold text-sm">Datos de Envío</h2>
                    </div>
                    <ShippingForm
                        auctionId={auction.id}
                        userId={user!.id}
                        onComplete={() => setShippingDone(true)}
                    />
                </div>

                {/* Step 2: Payment (shows after shipping filled or if already done) */}
                {(shippingDone || auction.payment_status !== "pending") && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">2</span>
                            <h2 className="font-heading font-bold text-sm">Comprobante de Pago</h2>
                        </div>
                        <PaymentFlow
                            auctionId={auction.id}
                            amountUsd={auction.current_price}
                            userId={user!.id}
                        />
                    </div>
                )}

                {/* Go back to panel */}
                <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => navigate("/mi-panel")}
                >
                    <Package className="h-4 w-4 mr-2" />
                    Ver todas mis compras
                </Button>
            </main>
        </div>
    );
};

export default MiCompra;
