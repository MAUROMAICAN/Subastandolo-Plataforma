import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PackageSearch, Filter, Send, Download } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
    dealerId: string;
}

// Extends order with product and buyer info
interface StoreOrder extends Tables<"marketplace_orders"> {
    product: { title: string, images: { image_url: string }[] };
    buyer: { full_name: string };
}

export default function DealerStoreOrdersTab({ dealerId }: Props) {
    const [orders, setOrders] = useState<StoreOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    // Tracking
    const [trackingNumber, setTrackingNumber] = useState<Record<string, string>>({});
    const [trackingCompany, setTrackingCompany] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState<string | null>(null);

    const { toast } = useToast();

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("marketplace_orders")
                .select(`
          *,
          product:marketplace_products(title, images:marketplace_product_images(image_url)),
          buyer:profiles!buyer_id(full_name)
        `)
                .eq("dealer_id", dealerId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Ensure proper sorting of images on DB side, or just take the first one
            const enriched = (data || []).map((o: any) => ({
                ...o,
                product: {
                    ...o.product,
                    images: o.product?.images?.sort((a: any, b: any) => a.display_order - b.display_order) || []
                }
            }));
            setOrders(enriched);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [dealerId]);

    const handleUpdateTracking = async (orderId: string) => {
        const num = trackingNumber[orderId]?.trim();
        const comp = trackingCompany[orderId]?.trim();

        if (!num || !comp) {
            toast({ title: "Datos incompletos", description: "Ingresa la empresa y el número de guía.", variant: "destructive" });
            return;
        }

        setSubmitting(orderId);
        try {
            const { error } = await supabase
                .from("marketplace_orders")
                .update({
                    shipping_status: "shipped",
                    tracking_number: num,
                    shipping_company: comp,
                    updated_at: new Date().toISOString()
                } as any)
                .eq("id", orderId);

            if (error) throw error;
            toast({ title: "Guía añadida", description: "El comprador podrá rastrear su pedido ahora." });

            // Update local state
            setOrders(orders.map(o => o.id === orderId ? { ...o, shipping_status: "shipped", tracking_number: num, shipping_company: comp } : o));
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSubmitting(null);
        }
    };

    const filteredOrders = orders.filter(o => filter === "all" || o.shipping_status === filter);

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 border border-border rounded-sm">
                <div>
                    <h2 className="text-lg font-heading font-bold">Ventas Directas (Tienda)</h2>
                    <p className="text-xs text-muted-foreground">Gestiona los pedidos de tus productos de precio fijo.</p>
                </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")} className="rounded-sm text-xs font-bold whitespace-nowrap">Todas</Button>
                    <Button variant={filter === "pending" ? "default" : "outline"} size="sm" onClick={() => setFilter("pending")} className="rounded-sm text-xs font-bold whitespace-nowrap">Por Enviar</Button>
                    <Button variant={filter === "shipped" ? "default" : "outline"} size="sm" onClick={() => setFilter("shipped")} className="rounded-sm text-xs font-bold whitespace-nowrap">Enviadas</Button>
                </div>
            </div>

            {filteredOrders.length === 0 ? (
                <Card className="border border-border rounded-sm p-12 text-center bg-secondary/10">
                    <PackageSearch className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="font-heading font-bold text-lg text-foreground mb-1">No se encontraron ventas</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        {filter === "all" ? "Aún no tienes ventas directas en tu tienda. ¡Sigue promocionando tus productos!" : `No tienes ventas con el estado "${filter}".`}
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredOrders.map(order => {
                        const mainImg = order.product?.images?.[0]?.image_url;
                        return (
                            <Card key={order.id} className="border border-border rounded-sm overflow-hidden">
                                <CardHeader className="bg-secondary/40 py-3 px-4 border-b border-border flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-sm font-heading flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                            <span>Pedido #{order.id.slice(0, 8).toUpperCase()}</span>
                                            <span className="text-xs font-normal text-muted-foreground">
                                                {new Date(order.created_at).toLocaleDateString()} a las {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </CardTitle>
                                    </div>
                                    <Badge variant={order.payment_status === "verified" ? "default" : order.payment_status === "pending" ? "destructive" : "secondary"} className={order.payment_status === "verified" ? "bg-success hover:bg-success" : ""}>
                                        {order.payment_status === "verified" ? "Pago Verificado" : order.payment_status === "under_review" ? "Revisando Pago" : "Pago Pendiente"}
                                    </Badge>
                                </CardHeader>

                                <CardContent className="p-4 sm:p-5">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        {/* Resumen del Producto */}
                                        <div className="flex gap-4 md:w-1/3 border-r-0 md:border-r border-border md:pr-6">
                                            <div className="h-16 w-16 bg-secondary/30 rounded-sm overflow-hidden shrink-0 border border-border">
                                                {mainImg ? <img src={mainImg} className="w-full h-full object-cover" /> : <div className="h-full w-full bg-muted"></div>}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm line-clamp-2 leading-tight">{order.product?.title || "Producto no encontrado"}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Cantidad: {order.quantity}</p>
                                                <p className="text-sm font-black text-accent mt-1">${order.total_price_usd.toLocaleString("es-MX")}</p>
                                            </div>
                                        </div>

                                        {/* Datos de Envío */}
                                        <div className="md:w-1/3 border-r-0 md:border-r border-border md:pr-6">
                                            <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Send className="h-3 w-3" /> Datos de Envío</p>
                                            <p className="text-sm font-semibold">{order.buyer?.full_name || "Usuario desconocido"}</p>
                                            <p className="text-xs text-foreground mt-0.5">{order.phone_number}</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed mt-1">{order.shipping_address}<br />{order.shipping_city}, {order.shipping_state}</p>
                                        </div>

                                        {/* Acciones del Dealer */}
                                        <div className="md:w-1/3 flex flex-col justify-center">
                                            {order.shipping_status === "shipped" || order.shipping_status === "delivered" ? (
                                                <div className="bg-success/10 border border-success/30 p-3 rounded-sm">
                                                    <p className="text-xs font-bold text-success flex items-center gap-1 mb-1">
                                                        <Send className="h-3 w-3" /> Paquete Enviado
                                                    </p>
                                                    <p className="text-sm text-foreground font-medium">{order.shipping_company}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5 break-all font-mono">Guía: {order.tracking_number}</p>
                                                </div>
                                            ) : order.payment_status === "verified" ? (
                                                <div className="space-y-3">
                                                    <p className="text-xs font-bold text-warning mb-1">Requiere Envío</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <Input
                                                            placeholder="Ej. MRW, Zoom"
                                                            value={trackingCompany[order.id] || ""}
                                                            onChange={e => setTrackingCompany(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                            className="h-8 text-xs rounded-sm bg-secondary/30"
                                                        />
                                                        <Input
                                                            placeholder="Nº Guía"
                                                            value={trackingNumber[order.id] || ""}
                                                            onChange={e => setTrackingNumber(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                            className="h-8 text-xs rounded-sm bg-secondary/30"
                                                        />
                                                    </div>
                                                    <Button
                                                        onClick={() => handleUpdateTracking(order.id)}
                                                        disabled={submitting === order.id}
                                                        className="w-full h-8 bg-accent text-accent-foreground rounded-sm text-xs font-bold hover:bg-accent/90"
                                                    >
                                                        {submitting === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Registrar Envío"}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="text-center p-3 bg-secondary/20 rounded-sm border border-border border-dashed h-full flex flex-col justify-center">
                                                    <p className="text-xs text-muted-foreground">Esperando que el comprador pague o administración verifique el pago para habilitar el envío.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
