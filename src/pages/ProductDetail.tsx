import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Store, ShoppingBag, ShieldCheck, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import VendorStoreCard from "@/components/dealer/VendorStoreCard";
import ProductQA from "@/components/ProductQA";

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
    seller: { id: string, name: string };
    category: { id: string, name: string };
}

export default function ProductDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [product, setProduct] = useState<ProductDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeImage, setActiveImage] = useState<string>("");


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
            let sellerInfo = { id: data.seller_id || "", name: "Vendedor" };
            if (data.seller_id) {
                const { data: sellerProfile } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .eq("id", data.seller_id)
                    .single();
                if (sellerProfile) sellerInfo = { id: sellerProfile.id, name: (sellerProfile as any).full_name || "Vendedor" };
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
                    <div className="w-full lg:w-2/5 flex flex-col space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Link to={`/dealer/${product.seller.id}`} className="text-xs font-bold text-accent hover:underline flex items-center">
                                    <Store className="h-3.5 w-3.5 mr-1" /> Vendedor: {product.seller.name}
                                </Link>
                            </div>

                            <h1 className="text-2xl md:text-3xl font-heading font-black leading-tight text-foreground mb-4">
                                {product.title}
                            </h1>

                            <div className="flex flex-col gap-1 mb-6">
                                <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/50">${(finalPrice * 1.2).toFixed(2)}</p>
                                <div className="flex items-end gap-3">
                                    <p className="text-4xl font-black text-foreground">${Number(finalPrice).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                    <Badge variant="outline" className="mb-1.5 bg-success/10 text-success dark:text-[#A6E300] border-success/30 font-bold">Precio Fijo</Badge>
                                </div>
                            </div>
                        </div>

                        <Card className="border border-border rounded-xl shadow-sm">
                            <CardContent className="p-5 flex flex-col gap-4">

                                {/* Product Status / Condition */}
                                <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                    <span className="text-muted-foreground">Condición:</span>
                                    <span className="font-bold capitalize">
                                        {product.condition === 'nuevo' || product.condition === 'new' ? 'Nuevo' : product.condition === 'usado_buen_estado' ? 'Usado - Buen Estado' : product.condition === 'usado_regular' ? 'Usado - Regular' : product.condition === 'para_reparar' ? 'Para Reparar' : product.condition}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                    <span className="text-muted-foreground">Disponibilidad:</span>
                                    <span className={`font-bold ${product.stock > 0 ? 'text-success dark:text-[#A6E300]' : 'text-destructive dark:text-red-400'}`}>
                                        {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
                                    </span>
                                </div>

                                {/* Variations */}
                                {attrEntries.length > 0 && (
                                    <div className="space-y-3 py-2 border-t border-border/50">
                                        <p className="font-bold text-sm">Características:</p>
                                        <div className="space-y-2">
                                            {attrEntries.map(([key, value]) => (
                                                <div key={key} className="flex items-center justify-between text-sm py-1">
                                                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                                    <span className="font-medium text-foreground capitalize">{value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* CTA */}
                                <div className="pt-4">
                                    <Button
                                        className="w-full h-14 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5"
                                        disabled={!isAvailable}
                                        onClick={handleBuyNow}
                                    >
                                        <ShoppingBag className="h-5 w-5 mr-2" />
                                        {isAvailable ? 'Comprar Ahora' : 'Producto Agotado'}
                                    </Button>
                                    <p className="text-[10px] text-center text-muted-foreground mt-2">Compra protegida · Pago seguro</p>
                                </div>

                                {/* Trust Badges */}
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <ShieldCheck className="h-5 w-5 text-success dark:text-[#A6E300] shrink-0" />
                                        <p className="leading-tight"><strong className="text-foreground">Compra Protegida</strong><br />Recibes el producto que esperabas o te devolvemos tu dinero.</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <Truck className="h-5 w-5 text-primary dark:text-[#A6E300] shrink-0" />
                                        <p className="leading-tight"><strong className="text-foreground">Envío a todo el país</strong><br />Acuerda con el vendedor el método de envío más conveniente.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

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

            <Footer />
        </div>
    );
}
