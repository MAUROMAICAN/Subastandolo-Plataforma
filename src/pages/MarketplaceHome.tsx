import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Store, ArrowRight, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface StoreProduct {
    id: string;
    title: string;
    price_usd: number;
    stock: number;
    condition: string;
    images: { image_url: string }[];
    dealer: { id: string, name: string };
    category: { id: string, name: string };
}

export default function MarketplaceHome() {
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            // Query fixed-price products that are active and have stock
            const { data, error } = await supabase
                .from("marketplace_products")
                .select(`
          *,
          images:marketplace_product_images(image_url),
          dealer:profiles!dealer_id(id, name),
          category:marketplace_categories(id, name)
        `)
                .eq("status", "active")
                .gt("stock", 0)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Ensure proper sorting of images on DB side, or just take the first one
            const enriched = (data || []).map((p: any) => ({
                ...p,
                images: p.images?.sort((a: any, b: any) => a.display_order - b.display_order) || []
            }));
            setProducts(enriched);

        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dealer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            {/* Hero Section */}
            <section className="bg-gradient-to-r from-accent/20 to-primary/10 py-12 px-4 border-b border-border">
                <div className="container mx-auto max-w-6xl text-center">
                    <Badge variant="outline" className="mb-4 bg-background px-3 py-1 border-accent/30 text-accent font-bold"><Store className="h-3 w-3 mr-1" /> Venta Directa</Badge>
                    <h1 className="text-3xl md:text-5xl font-heading font-black tracking-tight mb-4 text-foreground">
                        Encuentra lo que buscas,<br className="hidden md:block" /> sin esperar una subasta.
                    </h1>
                    <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto mb-8 font-medium">
                        Compra directamente a nuestros Dealers Verificados. Precio fijo, envío rápido y protección al comprador.
                    </p>

                    <div className="max-w-xl mx-auto relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
                        <Input
                            placeholder="Buscar zapatos, teléfonos, ropa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-14 rounded-full border-2 border-primary/20 bg-background shadow-lg shadow-primary/5 focus-visible:ring-primary text-base font-medium"
                        />
                        <Button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-6 bg-primary hover:bg-primary/90 font-bold h-10 transition-all active:scale-95">Buscar</Button>
                    </div>
                </div>
            </section>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground font-medium">Cargando catálogo...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="h-20 w-20 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                            <Search className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h2 className="text-xl font-heading font-bold mb-2">No se encontraron productos</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">No hay artículos de venta directa que coincidan con tu búsqueda en este momento.</p>
                        {searchTerm && <Button variant="link" onClick={() => setSearchTerm("")} className="mt-4 text-accent font-bold">Ver todo el catálogo</Button>}
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-heading font-bold flex items-center gap-2"><Tag className="h-5 w-5 text-accent" /> Descubre Artículos</h2>
                            <span className="text-xs font-medium text-muted-foreground bg-secondary px-3 py-1 flex items-center rounded-full border border-border/50 shadow-sm">{filteredProducts.length} resultados</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                            {filteredProducts.map((product) => {
                                const mainImg = product.images[0]?.image_url;
                                return (
                                    <Link to={`/producto/${product.id}`} key={product.id} className="group flex h-full">
                                        <Card className="w-full flex flex-col border border-border group-hover:border-primary/50 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all duration-300 rounded-sm overflow-hidden bg-card relative">
                                            {/* Image */}
                                            <div className="relative aspect-square w-full bg-secondary/20 overflow-hidden border-b border-border/50">
                                                {mainImg ? (
                                                    <img
                                                        src={mainImg}
                                                        alt={product.title}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Store className="h-10 w-10 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {/* Quick View Overlay */}
                                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                                    <span className="text-white text-[10px] font-bold bg-primary/90 px-2 py-0.5 rounded-sm">COMPRAR AHORA</span>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <CardContent className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
                                                        <span className="truncate mr-2">{product.category?.name || "General"}</span>
                                                        {product.condition !== 'new' && <span className="bg-secondary px-1.5 py-0.5 rounded-sm text-[9px] font-bold border border-bordershrink-0">{product.condition === 'used' ? 'USADO' : 'REACOND.'}</span>}
                                                    </p>
                                                    <h3 className="font-heading font-bold text-sm md:text-base leading-tight mb-2 line-clamp-2 text-foreground group-hover:text-accent transition-colors">
                                                        {product.title}
                                                    </h3>
                                                </div>

                                                <div className="mt-auto">
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                                                        <Store className="h-3 w-3 shrink-0" /> <span className="truncate">{product.dealer?.name}</span>
                                                    </div>
                                                    <div className="flex items-end justify-between">
                                                        <p className="text-lg md:text-xl font-black text-foreground">${product.price_usd.toLocaleString("es-MX")}</p>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-secondary/50 group-hover:bg-primary group-hover:text-primary-foreground group-active:scale-95 transition-all">
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
