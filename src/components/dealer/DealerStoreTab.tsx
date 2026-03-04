import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Store, Package, Loader2, Edit, Pause, Play, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

// Extends product with images
interface ProductWithImages extends Tables<"marketplace_products"> {
    images: Tables<"marketplace_product_images">[];
}

interface Props {
    dealerId: string;
    setActiveTab: (tab: string) => void;
}

export default function DealerStoreTab({ dealerId, setActiveTab }: Props) {
    const [products, setProducts] = useState<ProductWithImages[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        fetchProducts();
    }, [dealerId]);

    const fetchProducts = async () => {
        setLoading(true);
        const { data: prods, error } = await supabase
            .from("marketplace_products")
            .select(`
        *,
        images:marketplace_product_images(*)
      `)
            .eq("dealer_id", dealerId)
            .order("created_at", { ascending: false });

        if (error) {
            toast({ title: "Error", description: "No se pudieron cargar los productos", variant: "destructive" });
        } else {
            // Sort images by display_order inside each product
            const enriched = (prods || []).map((p: any) => ({
                ...p,
                images: p.images?.sort((a: any, b: any) => a.display_order - b.display_order) || []
            }));
            setProducts(enriched);
        }
        setLoading(false);
    };

    const toggleStatus = async (productId: string, currentStatus: string) => {
        const newStatus = currentStatus === "active" ? "paused" : "active";
        const { error } = await supabase
            .from("marketplace_products")
            .update({ status: newStatus as any })
            .eq("id", productId);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Estado actualizado", description: `Producto marcado como ${newStatus === "active" ? "Activo" : "Pausado"}.` });
            setProducts(products.map(p => p.id === productId ? { ...p, status: newStatus as any } : p));
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-sm p-4 sm:p-5">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-sm bg-accent/10 flex items-center justify-center shrink-0">
                        <Store className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                        <h2 className="text-lg font-heading font-bold">Mi Tienda (Precio Fijo)</h2>
                        <p className="text-xs text-muted-foreground">Gestiona tu catálogo de productos de venta directa.</p>
                    </div>
                </div>
                <Button onClick={() => setActiveTab("store-create")} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-sm font-bold shadow-sm whitespace-nowrap w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" /> Publicar Producto
                </Button>
            </div>

            {/* Empty State */}
            {products.length === 0 ? (
                <Card className="border border-border rounded-sm p-12 text-center bg-secondary/10">
                    <Tag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="font-heading font-bold text-lg text-foreground mb-1">Aún no tienes productos</p>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        Publica tu primer artículo de venta directa para que los usuarios puedan comprarlo inmediatamente sin esperar subastas.
                    </p>
                    <Button onClick={() => setActiveTab("store-create")} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-sm font-bold">
                        <Plus className="h-4 w-4 mr-2" /> Crear Primera Publicación
                    </Button>
                </Card>
            ) : (
                /* Products Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {products.map(product => {
                        const mainImg = product.images[0]?.image_url;
                        return (
                            <Card key={product.id} className="border border-border rounded-sm overflow-hidden flex flex-col group">
                                {/* Image */}
                                <div className="relative aspect-square bg-secondary/30">
                                    {mainImg ? (
                                        <img src={mainImg} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                                            <Package className="h-10 w-10 mb-2" />
                                            <span className="text-xs">Sin imagen</span>
                                        </div>
                                    )}
                                    {/* Status Badge */}
                                    <div className="absolute top-2 right-2">
                                        {product.status === 'active' ? (
                                            <Badge className="bg-success text-success-foreground border-none font-bold shadow-sm">Activo</Badge>
                                        ) : product.status === 'out_of_stock' ? (
                                            <Badge variant="destructive" className="font-bold shadow-sm">Agotado</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="font-bold shadow-sm border-border bg-background/90 backdrop-blur-sm text-muted-foreground">Pausado</Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Info */}
                                <CardContent className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-heading font-bold text-sm line-clamp-2 leading-tight mb-2 flex-1 group-hover:text-accent transition-colors">
                                        {product.title}
                                    </h3>
                                    <div className="flex items-end justify-between mt-auto pt-3 border-t border-border">
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">Precio Fijo</p>
                                            <p className="text-lg font-black text-foreground">${product.price_usd.toLocaleString("es-MX")}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground mb-0.5">Stock</p>
                                            <p className="text-sm font-bold">{product.stock} unids.</p>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="grid grid-cols-2 gap-2 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-sm h-8 text-xs border-border hover:bg-secondary"
                                            onClick={() => setActiveTab(`store-edit-${product.id}`)}
                                        >
                                            <Edit className="h-3 w-3 mr-1.5" /> Editar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className={`rounded-sm h-8 text-xs border-border ${product.status === 'active' ? 'hover:bg-warning/10 hover:text-warning hover:border-warning/30' : 'hover:bg-success/10 hover:text-success hover:border-success/30'}`}
                                            onClick={() => toggleStatus(product.id, product.status)}
                                        >
                                            {product.status === 'active' ? (
                                                <><Pause className="h-3 w-3 mr-1.5" /> Pausar</>
                                            ) : (
                                                <><Play className="h-3 w-3 mr-1.5" /> Activar</>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
