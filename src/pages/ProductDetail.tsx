import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Store, ShoppingBag, ShieldCheck, Truck, MapPin, CreditCard, Minus, Plus, Heart, Gavel, MessageSquare, Clock, Send, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBCVRate } from "@/hooks/useBCVRate";
import { Badge } from "@/components/ui/badge";
import VendorStoreCard from "@/components/dealer/VendorStoreCard";
import ProductQA from "@/components/ProductQA";
import RelatedProducts from "@/components/RelatedProducts";

interface ProductImage {
    id: string;
    image_url: string;
    display_order: number;
}

interface ProductDetails {
    id: string;
    title: string;
    description: string;
    price: number;
    stock: number;
    condition: string;
    status: string;
    created_at: string;
    attributes: Record<string, string>;
    images: ProductImage[];
    seller: { id: string, name: string, city?: string, state?: string };
    category: { id: string, name: string };
    listing_type?: 'fixed_price' | 'auction' | 'accepts_offers';
    starting_price?: number;
    current_price?: number;
    end_time?: string;
    winner_id?: string;
    accepts_offers?: boolean;
}

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const bcvRate = useBCVRate();

    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeImage, setActiveImage] = useState<string>("");
    const [quantity, setQuantity] = useState(1);

    // Auction state
    const [timeLeft, setTimeLeft] = useState("");
    const [bidAmount, setBidAmount] = useState("");
    const [bidding, setBidding] = useState(false);
    const [auctionEnded, setAuctionEnded] = useState(false);

    // Offer state
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [offerAmount, setOfferAmount] = useState("");
    const [offerMessage, setOfferMessage] = useState("");
    const [sendingOffer, setSendingOffer] = useState(false);


    useEffect(() => {
        if (id) fetchProduct(id);
    }, [id]);

    const fetchProduct = async (productId: string) => {
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from("marketplace_products")
                .select(`
          *,
          images:marketplace_product_images(*),
          category:marketplace_categories(id, name)
        `)
                .eq("id", productId)
                .single() as any);

            if (error) throw error;
            if (!data) {
                navigate("/tienda");
                return;
            }

            // Fetch seller profile separately
            const ownerId = data.dealer_id || data.seller_id || "";
            let sellerInfo: { id: string; name: string; city?: string; state?: string } = { id: ownerId, name: "Vendedor" };
            if (ownerId) {
                const { data: sellerProfile } = await supabase
                    .from("profiles")
                    .select("id, full_name, city, state")
                    .eq("id", ownerId)
                    .single();
                if (sellerProfile) sellerInfo = {
                    id: sellerProfile.id,
                    name: (sellerProfile as any).full_name || "Vendedor",
                    city: (sellerProfile as any).city || undefined,
                    state: (sellerProfile as any).state || undefined,
                };
            }

            const p: ProductDetails = {
                ...data,
                images: (data.images || []).sort((a: any, b: any) => a.display_order - b.display_order),
                attributes: data.attributes || {},
                seller: sellerInfo,
                category: { id: (data.category as any)?.id || "", name: (data.category as any)?.name || "" }
            };
            setProduct(p);
            if (p.images.length > 0) setActiveImage(p.images[0].image_url);

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
            navigate("/tienda");
        } finally {
            setLoading(false);
        }
    };

    // Auction countdown timer
    useEffect(() => {
        if (!product || product.listing_type !== 'auction' || !product.end_time) return;
        const updateTimer = () => {
            const diff = new Date(product.end_time!).getTime() - Date.now();
            if (diff <= 0) { setTimeLeft("Finalizada"); setAuctionEnded(true); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${h}h ${m}m ${s}s`);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [product]);

    const handleBuyNow = () => {
        if (!user) {
            toast({ title: "Inicia Sesión", description: "Debes iniciar sesión para comprar." });
            navigate("/auth");
            return;
        }
        navigate(`/checkout-tienda/${product?.id}`);
    };

    const handleBid = async () => {
        if (!user) { navigate("/auth"); return; }
        if (!product) return;
        const amount = parseFloat(bidAmount);
        const minBid = (product.current_price && product.current_price > 0) ? product.current_price + 1 : (product.starting_price || product.price);
        if (isNaN(amount) || amount < minBid) {
            toast({ title: "Monto inválido", description: `La puja mínima es $${minBid}`, variant: "destructive" });
            return;
        }
        setBidding(true);
        try {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
            const { error } = await supabase.from("product_bids" as any).insert({
                product_id: product.id,
                user_id: user.id,
                bidder_name: (profile as any)?.full_name || "Anónimo",
                amount,
            });
            if (error) throw error;
            toast({ title: "🎉 ¡Puja realizada!", description: `Has pujado $${amount}` });
            setProduct(prev => prev ? { ...prev, current_price: amount } : prev);
            setBidAmount("");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally { setBidding(false); }
    };

    const handleOffer = async () => {
        if (!user) { navigate("/auth"); return; }
        if (!product) return;
        const amount = parseFloat(offerAmount);
        if (isNaN(amount) || amount <= 0) {
            toast({ title: "Monto inválido", variant: "destructive" });
            return;
        }
        setSendingOffer(true);
        try {
            const { error } = await supabase.from("product_offers" as any).insert({
                product_id: product.id,
                buyer_id: user.id,
                amount,
                message: offerMessage || null,
            });
            if (error) throw error;
            toast({ title: "📩 Oferta enviada", description: "El vendedor recibirá tu oferta y podrá aceptarla o rechazarla." });
            setShowOfferModal(false);
            setOfferAmount("");
            setOfferMessage("");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally { setSendingOffer(false); }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Cargando producto...</p>
            </div>
        );
    }

    if (!product) return null;

    const finalPrice = product.price;
    const isAvailable = product.status === 'active' && product.stock > 0;

    // Attributes from JSONB
    const attrEntries = Object.entries(product.attributes || {}).filter(([, v]) => v);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <BackButton />

            <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl animate-fade-in">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Left: Images */}
                    <div className="w-full lg:w-3/5 space-y-4">
                        <div className="bg-secondary/20 aspect-square md:aspect-[4/3] rounded-xl overflow-hidden border border-border flex items-center justify-center border-b-2">
                            {activeImage ? (
                                <img src={activeImage} alt={product.title} className="w-full h-full object-contain" />
                            ) : (
                                <Store className="h-20 w-20 text-muted-foreground/30" />
                            )}
                        </div>

                        {/* Thumbnails */}
                        {product.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                {product.images.map(img => (
                                    <button
                                        key={img.id}
                                        onClick={() => setActiveImage(img.image_url)}
                                        className={`shrink-0 h-20 w-20 rounded-md overflow-hidden border-2 transition-all ${activeImage === img.image_url ? 'border-primary shadow-sm' : 'border-border/50 opacity-70 hover:opacity-100'}`}
                                    >
                                        <img src={img.image_url} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Description Desktop */}
                        <div className="hidden lg:block mt-8 bg-card border border-border p-6 rounded-xl">
                            <h3 className="font-heading font-bold text-lg mb-4">Descripción del Producto</h3>
                            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                                {product.description || "Sin descripción proporcionada."}
                            </div>
                        </div>

                        {/* Q&A Desktop — right below description */}
                        <div className="hidden lg:block mt-6 bg-card border border-border p-6 rounded-xl">
                            <ProductQA productId={product.id} sellerId={product.seller.id} />
                        </div>
                    </div>

                    {/* Right: Details & Action */}
                    <div className="w-full lg:w-2/5 flex flex-col gap-5">

                        {/* Main Info Card */}
                        <Card className="border border-border rounded-xl shadow-sm overflow-hidden">
                            <CardContent className="p-5 flex flex-col gap-0">

                                {/* Condition + Category */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                    <span className="capitalize">
                                        {product.condition === 'nuevo' || product.condition === 'new' ? 'Nuevo' : product.condition === 'usado_buen_estado' ? 'Usado - Buen Estado' : product.condition === 'usado_regular' ? 'Usado - Regular' : product.condition === 'para_reparar' ? 'Para Reparar' : product.condition}
                                    </span>
                                    <span className="text-border">|</span>
                                    <Link to={`/tienda?cat=${product.category?.id || ''}`} className="hover:text-primary dark:hover:text-[#A6E300] transition-colors">
                                        {product.category?.name || 'Sin categoría'}
                                    </Link>
                                </div>

                                {/* Title */}
                                <h1 className="text-xl md:text-2xl font-heading font-black leading-tight text-foreground mb-4">
                                    {product.title}
                                </h1>

                                {/* Price section */}
                                <div className="mb-5">
                                    {product.listing_type === 'auction' ? (
                                        /* AUCTION PRICE */
                                        <>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold text-xs">
                                                    <Gavel className="h-3 w-3 mr-1" /> Subasta
                                                </Badge>
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    <span className={`font-bold ${auctionEnded ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>{timeLeft || 'Cargando...'}</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">Precio inicial: ${Number(product.starting_price || product.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                            <div className="flex items-end gap-3">
                                                <p className="text-3xl font-black text-foreground">
                                                    ${Number(product.current_price && product.current_price > 0 ? product.current_price : product.starting_price || product.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                                </p>
                                                <span className="text-xs text-muted-foreground mb-1">{product.current_price && product.current_price > 0 ? 'Puja actual' : 'Sin pujas'}</span>
                                            </div>
                                        </>
                                    ) : product.listing_type === 'accepts_offers' ? (
                                        /* ACCEPTS OFFERS PRICE */
                                        <>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 font-bold text-xs">
                                                    <MessageSquare className="h-3 w-3 mr-1" /> Acepta Ofertas
                                                </Badge>
                                            </div>
                                            <div className="flex items-end gap-3">
                                                <p className="text-3xl font-black text-foreground">${Number(finalPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                                <span className="text-xs text-muted-foreground mb-1">Precio publicado</span>
                                            </div>
                                            <p className="text-xs text-blue-500 mt-1">💬 El vendedor acepta ofertas sobre este producto</p>
                                        </>
                                    ) : (
                                        /* FIXED PRICE (default) */
                                        <>
                                            <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/50">${(finalPrice * 1.2).toFixed(2)}</p>
                                            <div className="flex items-end gap-3">
                                                <p className="text-3xl font-black text-foreground">${Number(finalPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                                <Badge variant="outline" className="mb-1 bg-success/10 text-success dark:text-[#A6E300] border-success/30 font-bold text-[10px]">Cómpralo Ahora</Badge>
                                            </div>
                                        </>
                                    )}
                                    {bcvRate && bcvRate > 0 && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Bs. {(finalPrice * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    )}
                                </div>

                                {/* Separator */}
                                <div className="border-t border-border/50 mb-4" />

                                {/* Shipping */}
                                <div className="flex items-start gap-3 mb-3">
                                    <Truck className="h-4.5 w-4.5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Envío a todo el país</p>
                                        <p className="text-xs text-muted-foreground">Acuerda con el vendedor el método y costo de envío.</p>
                                    </div>
                                </div>

                                {/* Location */}
                                <div className="flex items-start gap-3 mb-3">
                                    <MapPin className="h-4.5 w-4.5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-foreground">
                                            {[product.seller.city, product.seller.state].filter(Boolean).join(", ") || "Venezuela"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Ubicación del vendedor</p>
                                    </div>
                                </div>

                                {/* Payment */}
                                <div className="flex items-start gap-3 mb-3">
                                    <CreditCard className="h-4.5 w-4.5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Medios de pago</p>
                                        <p className="text-xs text-muted-foreground">Pago Móvil · Transferencia Bancaria</p>
                                    </div>
                                </div>

                                {/* Return Policy Badge */}
                                {(() => {
                                    const policy = (product as any).return_policy || "none";
                                    if (policy === "none") {
                                        return (
                                            <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-semibold">⚠️ Sin devolución</p>
                                                    <p className="text-[10px] opacity-80">Al comprar este producto, aceptas recibirlo tal cual sin derecho a reclamo ni devolución.</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    const labels: Record<string, { text: string; color: string; desc: string }> = {
                                        "7_days": { text: "📦 Devolución 7 días", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", desc: "El comprador paga el envío de devolución" },
                                        "15_days": { text: "📦 Devolución 15 días", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", desc: "El comprador paga el envío de devolución" },
                                        "30_days_free": { text: "✨ Devolución gratis 30 días", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", desc: "Envío de devolución gratis" },
                                    };
                                    const info = labels[policy];
                                    if (!info) return null;
                                    return (
                                        <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${info.color}`}>
                                            <ShieldCheck className="h-4 w-4 shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold">{info.text}</p>
                                                <p className="text-[10px] opacity-70">{info.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Warranty Badge */}
                                {(() => {
                                    const hasWarranty = (product as any).has_warranty;
                                    const warrantyDuration = (product as any).warranty_duration;
                                    const durationLabels: Record<string, string> = {
                                        '30_days': '30 días',
                                        '90_days': '90 días',
                                        '6_months': '6 meses',
                                        '1_year': '1 año',
                                    };
                                    if (hasWarranty && warrantyDuration) {
                                        return (
                                            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                                <div>
                                                    <p className="text-sm font-semibold">🛡️ Garantía {durationLabels[warrantyDuration] || warrantyDuration}</p>
                                                    <p className="text-[10px] opacity-70">La responsabilidad de la garantía recae sobre el vendedor</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border bg-secondary/30 text-muted-foreground border-border/50">
                                            <ShieldCheck className="h-4 w-4 shrink-0 opacity-50" />
                                            <p className="text-xs">Sin garantía del vendedor</p>
                                        </div>
                                    );
                                })()}

                                {/* Separator */}
                                <div className="border-t border-border/50 mb-4" />

                                {/* Quantity — only for fixed_price and accepts_offers */}
                                {product.listing_type !== 'auction' && (
                                    <div className="flex items-center justify-between mb-5">
                                        <span className="text-sm font-semibold text-foreground">Cantidad:</span>
                                        <div className="flex items-center gap-0">
                                            <button
                                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                                disabled={quantity <= 1}
                                                className="h-8 w-8 rounded-l-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary/50 disabled:opacity-30 transition-colors"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="h-8 w-10 border-t border-b border-border flex items-center justify-center text-sm font-bold text-foreground">{quantity}</span>
                                            <button
                                                onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                                                disabled={quantity >= product.stock}
                                                className="h-8 w-8 rounded-r-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary/50 disabled:opacity-30 transition-colors"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="text-xs text-muted-foreground ml-3">({product.stock} disponible{product.stock !== 1 ? 's' : ''})</span>
                                        </div>
                                    </div>
                                )}

                                {/* Characteristics */}
                                {attrEntries.length > 0 && (
                                    <div className="mb-5 border border-border/50 rounded-lg overflow-hidden">
                                        <p className="font-bold text-xs px-3 py-2 bg-secondary/30 border-b border-border/50 uppercase tracking-wide text-muted-foreground">Características</p>
                                        <div className="divide-y divide-border/30">
                                            {attrEntries.map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between text-sm px-3 py-2">
                                                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                                                    <span className="font-medium text-foreground capitalize">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* CTA Buttons — contextual per listing type */}
                                {product.listing_type === 'auction' ? (
                                    /* AUCTION BIDDING */
                                    <div className="space-y-3">
                                        {!auctionEnded ? (
                                            <>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                                        <input
                                                            type="number"
                                                            placeholder={`Mín. $${((product.current_price && product.current_price > 0) ? product.current_price + 1 : product.starting_price || product.price)}`}
                                                            value={bidAmount}
                                                            onChange={(e) => setBidAmount(e.target.value)}
                                                            className="w-full h-14 pl-8 pr-4 rounded-xl border border-input bg-background text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                        />
                                                    </div>
                                                    <Button
                                                        className="h-14 px-6 rounded-xl text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                                                        onClick={handleBid}
                                                        disabled={bidding}
                                                    >
                                                        {bidding ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Gavel className="h-5 w-5 mr-2" /> Pujar</>}
                                                    </Button>
                                                </div>
                                                <p className="text-[10px] text-center text-muted-foreground">Tu puja es un compromiso de compra</p>
                                            </>
                                        ) : (
                                            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center">
                                                <p className="font-bold text-destructive">Subasta Finalizada</p>
                                            </div>
                                        )}
                                    </div>
                                ) : product.listing_type === 'accepts_offers' ? (
                                    /* ACCEPTS OFFERS */
                                    <div className="space-y-2">
                                        <Button
                                            className="w-full h-14 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5"
                                            disabled={!isAvailable}
                                            onClick={handleBuyNow}
                                        >
                                            <ShoppingBag className="h-5 w-5 mr-2" />
                                            {isAvailable ? `Comprar a $${Number(finalPrice).toLocaleString("es-MX")}` : 'Producto Agotado'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="w-full h-12 rounded-xl text-base font-bold border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-all"
                                            disabled={!isAvailable}
                                            onClick={() => { setOfferAmount(""); setOfferMessage(""); setShowOfferModal(true); }}
                                        >
                                            <MessageSquare className="h-5 w-5 mr-2" /> Hacer una Oferta
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground">Compra protegida · Pago seguro</p>
                                    </div>
                                ) : (
                                    /* FIXED PRICE (default) */
                                    <>
                                        <Button
                                            className="w-full h-14 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5"
                                            disabled={!isAvailable}
                                            onClick={handleBuyNow}
                                        >
                                            <ShoppingBag className="h-5 w-5 mr-2" />
                                            {isAvailable ? 'Comprar Ahora' : 'Producto Agotado'}
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground mt-2">Compra protegida · Pago seguro</p>
                                    </>
                                )}

                            </CardContent>
                        </Card>

                        {/* Seller mini-info */}
                        <div className="flex items-center gap-3 px-1">
                            <div className="h-10 w-10 rounded-full bg-secondary/50 border border-border flex items-center justify-center shrink-0">
                                <Store className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">Vendido por</p>
                                <Link to={`/dealer/${product.seller.id}`} className="text-sm font-bold text-foreground hover:text-primary dark:hover:text-[#A6E300] transition-colors">
                                    {product.seller.name}
                                </Link>
                            </div>
                        </div>

                        {/* Trust Badges */}
                        <div className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 text-success dark:text-[#A6E300] shrink-0" />
                                <p className="text-xs leading-tight"><strong className="text-foreground">Compra Protegida</strong> — Recibes el producto o te devolvemos tu dinero.</p>
                            </div>
                        </div>

                        {/* Store Vendor Card */}
                        <VendorStoreCard dealerId={product.seller.id} dealerName={product.seller.name} />

                        {/* Description Mobile */}
                        <div className="lg:hidden mt-4 bg-card border border-border p-5 rounded-xl">
                            <h3 className="font-heading font-bold text-lg mb-3">Descripción del Producto</h3>
                            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                                {product.description || "Sin descripción proporcionada."}
                            </div>
                        </div>

                        {/* Q&A Mobile — right below description */}
                        <div className="lg:hidden mt-4 bg-card border border-border p-5 rounded-xl">
                            <ProductQA productId={product.id} sellerId={product.seller.id} />
                        </div>

                    </div>
                </div>


            </main>

            {/* Related Products */}
            {product && (
                <section className="container mx-auto px-4 pb-10 max-w-6xl">
                    <RelatedProducts
                        productId={product.id}
                        sellerId={product.seller.id}
                        categoryId={product.category?.id || ""}
                        sellerName={product.seller.name}
                    />
                </section>
            )}

            {/* Offer Modal */}
            {showOfferModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowOfferModal(false)}>
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-heading font-bold mb-1">💬 Hacer una Oferta</h3>
                        <p className="text-xs text-muted-foreground mb-4">Precio publicado: <strong>${Number(product?.price || 0).toLocaleString("es-MX")}</strong></p>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-foreground block mb-1">Tu oferta ($) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                    <input
                                        type="number"
                                        value={offerAmount}
                                        onChange={(e) => setOfferAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-12 pl-8 pr-4 rounded-xl border border-input bg-background text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-foreground block mb-1">Mensaje (opcional)</label>
                                <textarea
                                    value={offerMessage}
                                    onChange={(e) => setOfferMessage(e.target.value)}
                                    placeholder="Ej: Me interesa mucho, ¿aceptarías esta oferta?"
                                    rows={3}
                                    maxLength={500}
                                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>
                            <Button
                                className="w-full h-12 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                                onClick={handleOffer}
                                disabled={sendingOffer || !offerAmount}
                            >
                                {sendingOffer ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</> : <><Send className="h-4 w-4 mr-2" /> Enviar Oferta</>}
                            </Button>
                            <p className="text-[10px] text-muted-foreground text-center">La oferta expira en 48 horas si el vendedor no responde.</p>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
