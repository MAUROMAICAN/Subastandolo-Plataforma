import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Check, X, Clock, DollarSign, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Offer {
    id: string;
    product_id: string;
    buyer_id: string;
    amount: number;
    message: string | null;
    status: string;
    counter_amount: number | null;
    counter_message: string | null;
    created_at: string;
    expires_at: string;
    product_title?: string;
    product_image?: string;
    buyer_name?: string;
}

interface Props {
    dealerId: string;
}

export default function DealerOffersTab({ dealerId }: Props) {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        fetchOffers();
    }, [dealerId]);

    const fetchOffers = async () => {
        setLoading(true);
        try {
            // Get all products by this dealer
            const { data: products } = await (supabase
                .from("marketplace_products")
                .select("id, title, image_url")
                .eq("seller_id", dealerId) as any);

            if (!products || products.length === 0) { setOffers([]); setLoading(false); return; }

            const productIds = (products as any[]).map((p: any) => p.id);
            const productMap: Record<string, { title: string; image_url: string }> = {};
            (products as any[]).forEach((p: any) => { productMap[p.id] = { title: p.title, image_url: p.image_url }; });

            // Get offers for those products
            const { data: offersData, error } = await (supabase
                .from("product_offers" as any)
                .select("*")
                .in("product_id", productIds)
                .order("created_at", { ascending: false }) as any);

            if (error) throw error;

            // Enrich with product info and buyer names
            const buyerIds = [...new Set((offersData || []).map((o: any) => o.buyer_id))] as string[];
            const buyerMap: Record<string, string> = {};
            if (buyerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from("profiles")
                    .select("id, full_name")
                    .in("id", buyerIds);
                (profiles || []).forEach((p: any) => { buyerMap[p.id] = p.full_name; });
            }

            const enriched: Offer[] = (offersData || []).map((o: any) => ({
                ...o,
                product_title: productMap[o.product_id]?.title || "Producto",
                product_image: productMap[o.product_id]?.image_url || null,
                buyer_name: buyerMap[o.buyer_id] || "Comprador",
            }));

            setOffers(enriched);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (offerId: string, action: 'accepted' | 'rejected') => {
        setActionLoading(offerId);
        try {
            const { error } = await (supabase
                .from("product_offers" as any)
                .update({ status: action, responded_at: new Date().toISOString() } as any)
                .eq("id", offerId) as any);
            if (error) throw error;
            setOffers(prev => prev.map(o => o.id === offerId ? { ...o, status: action } : o));
            toast({ title: action === 'accepted' ? "✅ Oferta aceptada" : "❌ Oferta rechazada" });
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold text-[10px]"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>;
            case 'accepted': return <Badge className="bg-success/10 text-success border-success/30 font-bold text-[10px]"><Check className="h-3 w-3 mr-1" /> Aceptada</Badge>;
            case 'rejected': return <Badge className="bg-destructive/10 text-destructive border-destructive/30 font-bold text-[10px]"><X className="h-3 w-3 mr-1" /> Rechazada</Badge>;
            case 'expired': return <Badge variant="secondary" className="font-bold text-[10px]"><Clock className="h-3 w-3 mr-1" /> Expirada</Badge>;
            default: return <Badge variant="secondary" className="font-bold text-[10px]">{status}</Badge>;
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" /></div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-3 bg-card border border-border rounded-sm p-4 sm:p-5">
                <div className="h-12 w-12 rounded-sm bg-blue-500/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                    <h2 className="text-lg font-heading font-bold">Ofertas Recibidas</h2>
                    <p className="text-xs text-muted-foreground">
                        {offers.filter(o => o.status === 'pending').length} pendientes · {offers.length} total
                    </p>
                </div>
            </div>

            {offers.length === 0 ? (
                <Card className="border border-border rounded-sm p-12 text-center bg-secondary/10">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="font-heading font-bold text-lg text-foreground mb-1">Sin ofertas aún</p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Cuando un comprador haga una oferta sobre tus productos marcados como "Acepto Ofertas", aparecerán aquí.
                    </p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {offers.map(offer => {
                        const isExpired = offer.status === 'pending' && new Date(offer.expires_at) < new Date();
                        return (
                            <Card key={offer.id} className="border border-border rounded-sm overflow-hidden">
                                <CardContent className="p-4">
                                    <div className="flex gap-4">
                                        {/* Product thumbnail */}
                                        <div className="h-16 w-16 rounded-sm bg-secondary/30 overflow-hidden shrink-0">
                                            {offer.product_image ? (
                                                <img src={offer.product_image} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/30" /></div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <p className="text-sm font-bold text-foreground line-clamp-1">{offer.product_title}</p>
                                                {isExpired ? statusBadge('expired') : statusBadge(offer.status)}
                                            </div>

                                            <p className="text-xs text-muted-foreground mb-1">
                                                De: <strong className="text-foreground">{offer.buyer_name}</strong> · {new Date(offer.created_at).toLocaleDateString("es-VE")}
                                            </p>

                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign className="h-4 w-4 text-blue-500" />
                                                <span className="text-lg font-black text-blue-600 dark:text-blue-400">${Number(offer.amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            {offer.message && (
                                                <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2 mb-2 italic">"{offer.message}"</p>
                                            )}

                                            {/* Actions */}
                                            {offer.status === 'pending' && !isExpired && (
                                                <div className="flex gap-2 mt-2">
                                                    <Button
                                                        size="sm"
                                                        className="rounded-sm h-8 text-xs bg-success hover:bg-success/90 text-white font-bold"
                                                        onClick={() => handleAction(offer.id, 'accepted')}
                                                        disabled={actionLoading === offer.id}
                                                    >
                                                        {actionLoading === offer.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" /> Aceptar</>}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="rounded-sm h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
                                                        onClick={() => handleAction(offer.id, 'rejected')}
                                                        disabled={actionLoading === offer.id}
                                                    >
                                                        <X className="h-3 w-3 mr-1" /> Rechazar
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
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
