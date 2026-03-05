import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import ShippingForm from "@/components/ShippingForm";
import PaymentFlow from "@/components/PaymentFlow";
import AuctionProgressTracker from "@/components/AuctionProgressTracker";
import SEOHead from "@/components/SEOHead";
import {
    Loader2, Trophy, ArrowLeft, Package, Truck, CheckCircle,
    Clock, MapPin, AlertTriangle, Star, Shield, RefreshCw, Copy, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type ShippingInfo = {
    id: string;
    full_name: string;
    phone: string;
    cedula: string;
    state: string;
    city: string;
    office_name: string;
    shipping_company: string;
};

type ReviewData = {
    id: string;
    rating: number;
    comment: string;
};

const PAYMENT_STEPS = [
    { key: "pending", label: "Pago pendiente", icon: Clock, color: "text-amber-500 dark:text-amber-400" },
    { key: "under_review", label: "En revisión", icon: Loader2, color: "text-blue-500 dark:text-blue-300" },
    { key: "verified", label: "Pago verificado", icon: CheckCircle, color: "text-primary dark:text-[#A6E300]" },
    { key: "shipped", label: "Enviado", icon: Truck, color: "text-purple-500 dark:text-purple-300" },
    { key: "delivered", label: "Entregado", icon: Package, color: "text-primary dark:text-[#A6E300]" },
];

const MiCompra = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const [auction, setAuction] = useState<Tables<"auctions"> | null>(null);
    const [images, setImages] = useState<string[]>([]);
    const [shippingInfo, setShippingInfo] = useState<ShippingInfo | null>(null);
    const [review, setReview] = useState<ReviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [confirmingDelivery, setConfirmingDelivery] = useState(false);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);
    const [imgIdx, setImgIdx] = useState(0);

    useEffect(() => {
        if (!authLoading && !user) navigate("/auth");
    }, [user, authLoading, navigate]);

    const fetchData = async () => {
        if (!id || !user) return;
        // Android fix: only show full-page spinner on first load.
        // Subsequent re-fetches (triggered by auth re-validation when returning
        // from the Android gallery picker) happen silently to preserve PaymentFlow state.
        if (!auction) setLoading(true);
        const { data: auc } = await supabase
            .from("auctions").select("*").eq("id", id).single();

        if (!auc || auc.winner_id !== user.id) { navigate("/mi-panel"); return; }

        const [{ data: imgs }, { data: ship }, { data: rev }] = await Promise.all([
            supabase.from("auction_images").select("image_url, display_order")
                .eq("auction_id", id).order("display_order"),
            supabase.from("shipping_info").select("*")
                .eq("auction_id", id).eq("buyer_id", user.id).maybeSingle(),
            (supabase as any).from("buyer_reviews").select("*")
                .eq("auction_id", id).eq("buyer_id", user.id).maybeSingle(),
        ]);

        setAuction(auc);
        setImages(imgs?.map(i => i.image_url) || (auc.image_url ? [auc.image_url] : []));
        setShippingInfo(ship as ShippingInfo | null);
        setReview(rev as ReviewData | null);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [id, user, refreshKey]);

    const handleConfirmDelivery = async () => {
        if (!auction || !user) return;
        setConfirmingDelivery(true);
        await supabase.from("auctions").update({
            delivery_status: "delivered",
            delivered_at: new Date().toISOString(),
        } as any).eq("id", auction.id);
        toast({ title: "✅ ¡Entrega confirmada!" });
        setRefreshKey(k => k + 1);
        setShowReviewForm(true);
        setConfirmingDelivery(false);
    };

    const handleSubmitReview = async () => {
        if (!auction || !user || !comment.trim()) return;
        setSubmittingReview(true);
        const { error } = await (supabase as any).from("buyer_reviews").insert({
            auction_id: auction.id,
            buyer_id: user.id,
            dealer_id: auction.created_by,
            rating,
            comment: comment.trim(),
        } as any);
        if (!error) {
            toast({ title: "⭐ ¡Reseña enviada! Gracias." });
            setShowReviewForm(false);
            setRefreshKey(k => k + 1);
        } else {
            toast({ title: "Error al enviar reseña", description: error.message, variant: "destructive" });
        }
        setSubmittingReview(false);
    };

    const copyTracking = () => {
        if (auction?.tracking_number) {
            navigator.clipboard.writeText(auction.tracking_number);
            toast({ title: "Número de tracking copiado" });
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-background">
                <Navbar />
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground dark:text-slate-400">Cargando tu compra...</p>
                </div>
            </div>
        );
    }
    if (!auction) return null;

    const heroImg = images[imgIdx] || auction.image_url;
    const currentStep = PAYMENT_STEPS.find(s =>
        s.key === (auction.delivery_status === "delivered" ? "delivered" :
            auction.delivery_status === "shipped" ? "shipped" :
                auction.payment_status === "verified" ? "verified" :
                    auction.payment_status === "under_review" ? "under_review" : "pending")
    ) || PAYMENT_STEPS[0];
    const StepIcon = currentStep.icon;
    const isDelivered = auction.delivery_status === "delivered" || !!auction.delivered_at;
    const isShipped = auction.delivery_status === "shipped" || !!auction.tracking_number;
    const isVerified = auction.payment_status === "verified" || isShipped || isDelivered;
    const canConfirmDelivery = isShipped && !isDelivered;

    return (
        <div className="min-h-screen bg-background">
            <SEOHead title={`Mi Compra · ${auction.title}`} description="Completa tu compra ganada en subasta" />
            <Navbar />

            <main className="container mx-auto px-4 py-4 max-w-2xl pb-24">

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400 mb-5">
                    <button onClick={() => navigate("/mi-panel")}
                        className="hover:text-primary dark:hover:text-[#A6E300] transition-colors flex items-center gap-1">
                        <ArrowLeft className="h-3 w-3" /> Mi Panel
                    </button>
                    <span className="dark:text-slate-600">/</span>
                    <button onClick={() => navigate("/mi-panel")}
                        className="hover:text-primary dark:hover:text-[#A6E300] transition-colors">
                        Mis Compras
                    </button>
                    <span className="dark:text-slate-600">/</span>
                    <span className="text-foreground font-medium truncate max-w-[120px]">{auction.title}</span>
                </div>

                {/* === WINNER HEADER === */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm mb-5">
                    {/* Trophy bar */}
                    <div className="bg-gradient-to-r from-primary/15 via-accent/8 to-primary/15 border-b border-border px-5 py-4 flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-primary/20 dark:bg-[#A6E300]/10 flex items-center justify-center shrink-0">
                            <Trophy className="h-5 w-5 text-primary dark:text-[#A6E300]" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary dark:text-[#A6E300]">¡Felicidades, ganaste!</p>
                            <p className="font-heading font-bold text-sm text-foreground leading-tight truncate">{auction.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground dark:text-slate-400">Precio final</p>
                            <p className="font-black text-2xl text-foreground">${auction.current_price.toLocaleString("es-MX")}</p>
                            <p className="text-[10px] text-muted-foreground dark:text-slate-400">USD</p>
                        </div>
                    </div>

                    {/* Product image gallery */}
                    {images.length > 0 && (
                        <div className="bg-secondary/20 dark:bg-white/5 py-5 px-4 flex flex-col items-center gap-3">
                            <img src={heroImg || ""} alt={auction.title} className="h-44 object-contain rounded-xl" />
                            {images.length > 1 && (
                                <div className="flex gap-1.5">
                                    {images.map((img, i) => (
                                        <button key={i} onClick={() => setImgIdx(i)}
                                            className={`h-10 w-10 rounded-lg object-cover border-2 overflow-hidden transition-all ${i === imgIdx ? "border-primary dark:border-[#A6E300] scale-110" : "border-border opacity-60"}`}>
                                            <img src={img} alt="" className="h-full w-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status chip */}
                    <div className="px-5 py-3 border-t border-border bg-secondary/10 dark:bg-white/5 flex items-center gap-2">
                        <StepIcon className={`h-4 w-4 shrink-0 ${currentStep.color} ${currentStep.key === "under_review" ? "animate-spin" : ""}`} />
                        <span className={`text-sm font-bold ${currentStep.color}`}>{currentStep.label}</span>
                        <button onClick={() => setRefreshKey(k => k + 1)}
                            className="ml-auto text-muted-foreground dark:text-slate-400 hover:text-primary dark:hover:text-[#A6E300] transition-colors" title="Actualizar">
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* === PROGRESS TRACKER === */}
                <div className="mb-5">
                    <AuctionProgressTracker
                        paymentStatus={auction.payment_status}
                        deliveryStatus={auction.delivery_status}
                        trackingNumber={auction.tracking_number}
                    />
                </div>

                {/* === TRACKING NUMBER (when shipped) === */}
                {auction.tracking_number && (
                    <div className="mb-5 bg-purple-500/5 dark:bg-purple-400/5 border border-purple-400/20 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4 text-purple-500 dark:text-purple-300" />
                            <span className="text-sm font-bold text-purple-600 dark:text-purple-300">Tu pedido está en camino</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground">
                                {auction.tracking_number}
                            </code>
                            <button onClick={copyTracking}
                                className="p-2 rounded-lg border border-border hover:bg-secondary dark:hover:bg-white/10 transition-colors text-foreground dark:text-slate-300">
                                <Copy className="h-4 w-4" />
                            </button>
                            {(auction as any).tracking_url && (
                                <a href={(auction as any).tracking_url} target="_blank" rel="noopener noreferrer"
                                    className="p-2 rounded-lg border border-border hover:bg-secondary dark:hover:bg-white/10 transition-colors text-foreground dark:text-slate-300">
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                        {(auction as any).estimated_delivery && (
                            <p className="text-xs text-muted-foreground dark:text-slate-400 mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Entrega estimada: {new Date((auction as any).estimated_delivery).toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        )}
                    </div>
                )}

                {/* === CONFIRM DELIVERY === */}
                {canConfirmDelivery && (
                    <div className="mb-5 bg-primary/5 dark:bg-[#A6E300]/5 border border-primary/20 dark:border-[#A6E300]/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="flex-1">
                            <p className="font-bold text-sm text-foreground">¿Ya recibiste tu producto?</p>
                            <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">
                                Confirma la entrega para liberar el pago al dealer y poder dejar una reseña.
                            </p>
                        </div>
                        <Button
                            onClick={handleConfirmDelivery}
                            disabled={confirmingDelivery}
                            className="bg-primary text-primary-foreground rounded-xl font-bold text-sm shrink-0"
                        >
                            {confirmingDelivery ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Confirmar Entrega
                        </Button>
                    </div>
                )}

                {/* === DELIVERED BANNER === */}
                {isDelivered && (
                    <div className="mb-5 bg-primary/5 dark:bg-[#A6E300]/5 border border-primary/20 dark:border-[#A6E300]/20 rounded-2xl px-5 py-4 flex items-center gap-3">
                        <CheckCircle className="h-8 w-8 text-primary dark:text-[#A6E300] shrink-0" />
                        <div>
                            <p className="font-bold text-sm text-primary dark:text-[#A6E300]">¡Compra completada con éxito!</p>
                            <p className="text-xs text-muted-foreground dark:text-slate-400">
                                {auction.delivered_at ? `Entregado el ${new Date(auction.delivered_at).toLocaleDateString("es-VE")}` : "Tu pedido fue entregado."}
                            </p>
                        </div>
                    </div>
                )}

                {/* === REVIEW SECTION === */}
                {(isDelivered || showReviewForm) && !review && (
                    <div className="mb-5 bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="bg-amber-500/10 dark:bg-amber-400/10 border-b border-amber-400/20 px-5 py-3 flex items-center gap-2">
                            <Star className="h-4 w-4 text-amber-500 dark:text-amber-400 fill-amber-400" />
                            <p className="font-bold text-sm text-amber-700 dark:text-amber-300">Cuéntanos tu experiencia</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button key={star}
                                        onMouseEnter={() => setHoveredStar(star)}
                                        onMouseLeave={() => setHoveredStar(null)}
                                        onClick={() => setRating(star)}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star className={`h-8 w-8 ${(hoveredStar ?? rating) >= star ? "fill-amber-400 text-amber-400" : "text-border dark:text-slate-600"}`} />
                                    </button>
                                ))}
                                <span className="text-sm text-muted-foreground dark:text-slate-400 ml-2">
                                    {rating === 5 ? "Excelente" : rating === 4 ? "Muy bueno" : rating === 3 ? "Regular" : rating === 2 ? "Malo" : "Muy malo"}
                                </span>
                            </div>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Describe tu experiencia con el dealer, la calidad del producto y el tiempo de entrega..."
                                className="w-full min-h-[90px] rounded-xl border border-input bg-background dark:bg-zinc-900 px-3 py-2 text-sm resize-none text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <Button
                                onClick={handleSubmitReview}
                                disabled={submittingReview || !comment.trim()}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold"
                            >
                                {submittingReview ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2 fill-white" />}
                                Enviar Reseña
                            </Button>
                        </div>
                    </div>
                )}

                {/* Show submitted review */}
                {review && (
                    <div className="mb-5 bg-amber-500/5 dark:bg-amber-400/5 border border-amber-400/20 rounded-2xl p-4 flex items-start gap-3">
                        <Star className="h-5 w-5 text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-border dark:text-slate-600"}`} />
                                ))}
                            </div>
                            <p className="text-sm text-foreground">{review.comment}</p>
                            <p className="text-[10px] text-muted-foreground dark:text-slate-400 mt-1">Reseña enviada</p>
                        </div>
                    </div>
                )}

                {/* === SHIPPING INFO (saved) === */}
                {shippingInfo && (
                    <div className="mb-5 bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="bg-secondary/30 dark:bg-white/5 px-5 py-3 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary dark:text-[#A6E300]" />
                                <span className="text-sm font-bold text-foreground">Datos de Envío</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary dark:text-[#A6E300] border-primary/20 dark:border-[#A6E300]/30">Guardado</Badge>
                        </div>
                        <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            {[
                                { label: "Nombre", value: shippingInfo.full_name },
                                { label: "Cédula", value: shippingInfo.cedula },
                                { label: "Teléfono", value: shippingInfo.phone },
                                { label: "Empresa", value: shippingInfo.shipping_company },
                                { label: "Estado", value: shippingInfo.state },
                                { label: "Ciudad", value: shippingInfo.city },
                                { label: "Oficina", value: shippingInfo.office_name },
                            ].map(({ label, value }) => value ? (
                                <div key={label}>
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground dark:text-slate-400 block mb-0.5">{label}</span>
                                    <span className="font-semibold text-foreground">{value}</span>
                                </div>
                            ) : null)}
                        </div>
                    </div>
                )}

                {/* === STEP 1: SHIPPING FORM (if not filled) === */}
                {!shippingInfo && (
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">1</span>
                            <h2 className="font-heading font-bold text-base text-foreground">Datos de Envío</h2>
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-400/30 ml-auto">Pendiente</Badge>
                        </div>
                        <ShippingForm
                            auctionId={auction.id}
                            userId={user!.id}
                            onComplete={() => setRefreshKey(k => k + 1)}
                        />
                    </div>
                )}

                {/* === STEP 2: PAYMENT === */}
                <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">2</span>
                        <h2 className="font-heading font-bold text-base text-foreground">Comprobante de Pago</h2>
                        {isVerified && (
                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary dark:text-[#A6E300] border-primary/20 dark:border-[#A6E300]/30 ml-auto">Verificado ✓</Badge>
                        )}
                    </div>
                    <PaymentFlow
                        auctionId={auction.id}
                        amountUsd={auction.current_price}
                        userId={user!.id}
                    />
                </div>

                {/* === OPEN DISPUTE === */}
                {isVerified && !isDelivered && (
                    <div className="mb-5 border border-border rounded-2xl p-4 flex items-start gap-3 bg-secondary/10 dark:bg-white/5">
                        <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-foreground">¿Problema con tu pedido?</p>
                            <p className="text-xs text-muted-foreground dark:text-slate-400 mt-0.5">Si el producto no llegó o no coincide con la descripción, puedes abrir una disputa.</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs border-amber-400/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-400/10 shrink-0"
                            onClick={() => navigate("/mi-panel")}
                        >
                            <Shield className="h-3.5 w-3.5 mr-1" /> Disputa
                        </Button>
                    </div>
                )}

                {/* === FOOTER NAV === */}
                <div className="flex gap-3 pt-2">
                    <Button
                        variant="outline"
                        className="flex-1 rounded-xl text-foreground dark:text-white"
                        onClick={() => navigate("/mi-panel")}
                    >
                        <Package className="h-4 w-4 mr-2" />
                        Ver todas mis compras
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl text-foreground dark:text-white"
                        onClick={() => setRefreshKey(k => k + 1)}
                        title="Actualizar estado"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </main>
        </div>
    );
};

export default MiCompra;
