import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Store, ShoppingBag, ShieldCheck, Truck, MapPin, CreditCard, Minus, Plus, Heart } from "lucide-react";
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

            // Fetch seller profile separately (seller_id FK goes to auth.users, not profiles)
            let sellerInfo: { id: string; name: string; city?: string; state?: string } = { id: data.seller_id || "", name: "Vendedor" };
            if (data.seller_id) {
                const { data: sellerProfile } = await supabase
                    .from("profiles")
                    .select("id, full_name, city, state")
                    .eq("id", data.seller_id)
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

    const handleBuyNow = () => {
        if (!user) {
            toast({ title: "Inicia Sesión", description: "Debes iniciar sesión para comprar." });
            navigate("/auth");
            return;
        }

        // In Fase 3, this will navigate to a special CheckoutFlow for Marketplace
        // Passing the product ID and selected attribute ID.
        navigate(`/checkout-tienda/${product?.id}`);
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
                                    <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/50">${(finalPrice * 1.2).toFixed(2)}</p>
                                    <div className="flex items-end gap-3">
                                        <p className="text-3xl font-black text-foreground">${Number(finalPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                        <Badge variant="outline" className="mb-1 bg-success/10 text-success dark:text-[#A6E300] border-success/30 font-bold text-[10px]">Precio Fijo</Badge>
                                    </div>
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
                                <div className="flex items-start gap-3 mb-5">
                                    <CreditCard className="h-4.5 w-4.5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Medios de pago</p>
                                        <p className="text-xs text-muted-foreground">Pago Móvil · Transferencia Bancaria</p>
                                    </div>
                                </div>

                                {/* Separator */}
                                <div className="border-t border-border/50 mb-4" />

                                {/* Quantity */}
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

                                {/* CTA Button */}
                                <Button
                                    className="w-full h-14 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5"
                                    disabled={!isAvailable}
                                    onClick={handleBuyNow}
                                >
                                    <ShoppingBag className="h-5 w-5 mr-2" />
                                    {isAvailable ? 'Comprar Ahora' : 'Producto Agotado'}
                                </Button>
                                <p className="text-[10px] text-center text-muted-foreground mt-2">Compra protegida · Pago seguro</p>

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

            <Footer />
        </div>
    );
}
