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

interface ProductAttribute {
    id: string;
    attr_name: string;
    attr_value: string;
    additional_price_usd: number;
}

interface ProductImage {
    id: string;
    image_url: string;
    display_order: number;
}

interface ProductDetails {
    id: string;
    title: string;
    description: string;
    price_usd: number;
    stock: number;
    condition: string;
    status: string;
    created_at: string;
    images: ProductImage[];
    attributes: ProductAttribute[];
    dealer: { id: string, name: string };
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

    // Selected variation
    const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null);

    useEffect(() => {
        if (id) fetchProduct(id);
    }, [id]);

    const fetchProduct = async (productId: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("marketplace_products")
                .select(`
          *,
          images:marketplace_product_images(*),
          attributes:marketplace_product_attributes(*),
          dealer:profiles!dealer_id(id, name),
          category:marketplace_categories(id, name)
        `)
                .eq("id", productId)
                .single();

            if (error) throw error;
            if (!data) {
                navigate("/tienda");
                return;
            }

            const p: ProductDetails = {
                ...data,
                images: (data.images || []).sort((a: any, b: any) => a.display_order - b.display_order),
                dealer: { id: (data.dealer as any)?.id || "", name: (data.dealer as any)?.name || "" },
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
        navigate(`/checkout-tienda/${product?.id}${selectedAttrId ? `?attr=${selectedAttrId}` : ''}`);
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

    const selectedAttr = product.attributes.find(a => a.id === selectedAttrId);
    const finalPrice = product.price_usd + (selectedAttr?.additional_price_usd || 0);
    const isAvailable = product.status === 'active' && product.stock > 0;

    // Group attributes by name for UI
    const groupedAttrs = product.attributes.reduce((acc, attr) => {
        if (!acc[attr.attr_name]) acc[attr.attr_name] = [];
        acc[attr.attr_name].push(attr);
        return acc;
    }, {} as Record<string, ProductAttribute[]>);

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
                    </div>

                    {/* Right: Details & Action */}
                    <div className="w-full lg:w-2/5 flex flex-col space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Link to={`/dealer/${product.dealer.id}`} className="text-xs font-bold text-accent hover:underline flex items-center">
                                    <Store className="h-3.5 w-3.5 mr-1" /> Vendedor: {product.dealer.name}
                                </Link>
                            </div>

                            <h1 className="text-2xl md:text-3xl font-heading font-black leading-tight text-foreground mb-4">
                                {product.title}
                            </h1>

                            <div className="flex flex-col gap-1 mb-6">
                                <p className="text-xs text-muted-foreground line-through decoration-muted-foreground/50">${(finalPrice * 1.2).toFixed(2)}</p>
                                <div className="flex items-end gap-3">
                                    <p className="text-4xl font-black text-foreground">${finalPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
                                    <Badge variant="outline" className="mb-1.5 bg-success/10 text-success border-success/30 font-bold">Precio Fijo</Badge>
                                </div>
                            </div>
                        </div>

                        <Card className="border border-border rounded-xl shadow-sm">
                            <CardContent className="p-5 flex flex-col gap-4">

                                {/* Product Status / Condition */}
                                <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                    <span className="text-muted-foreground">Condición:</span>
                                    <span className="font-bold capitalize">{product.condition === 'new' ? 'Nuevo' : product.condition === 'used' ? 'Usado' : 'Reacondicionado'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                                    <span className="text-muted-foreground">Disponibilidad:</span>
                                    <span className={`font-bold ${product.stock > 0 ? 'text-success' : 'text-destructive'}`}>
                                        {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
                                    </span>
                                </div>

                                {/* Variations */}
                                {Object.keys(groupedAttrs).length > 0 && (
                                    <div className="space-y-4 py-2">
                                        <p className="font-bold text-sm">Selecciona tus opciones:</p>
                                        {Object.entries(groupedAttrs).map(([attrName, attrs]) => (
                                            <div key={attrName} className="space-y-2">
                                                <p className="text-xs text-muted-foreground">{attrName}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {attrs.map(attr => (
                                                        <button
                                                            key={attr.id}
                                                            onClick={() => setSelectedAttrId(attr.id === selectedAttrId ? null : attr.id)}
                                                            className={`px-3 py-1.5 rounded-sm text-sm font-medium border transition-colors
                                ${selectedAttrId === attr.id
                                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                                    : 'bg-background hover:bg-secondary border-border text-foreground hover:border-primary/50'
                                                                }`}
                                                        >
                                                            {attr.attr_value}
                                                            {attr.additional_price_usd > 0 && <span className="text-[10px] ml-1 opacity-80">(+${attr.additional_price_usd})</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
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
                                </div>

                                {/* Trust Badges */}
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <ShieldCheck className="h-5 w-5 text-success shrink-0" />
                                        <p className="leading-tight"><strong className="text-foreground">Compra Protegida</strong><br />Recibes el producto que esperabas o te devolvemos tu dinero.</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <Truck className="h-5 w-5 text-primary shrink-0" />
                                        <p className="leading-tight"><strong className="text-foreground">Envío a todo el país</strong><br />Acuerda con el vendedor el método de envío más conveniente.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Store Vendor Card */}
                        <VendorStoreCard dealerId={product.dealer.id} dealerName={product.dealer.name} />

                        {/* Description Mobile */}
                        <div className="lg:hidden mt-4 bg-card border border-border p-5 rounded-xl">
                            <h3 className="font-heading font-bold text-lg mb-3">Descripción del Producto</h3>
                            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                                {product.description || "Sin descripción proporcionada."}
                            </div>
                        </div>

                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
