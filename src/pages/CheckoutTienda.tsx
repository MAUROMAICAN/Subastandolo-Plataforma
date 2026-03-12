import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Receipt, Store, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CheckoutTienda() {
    const { productId } = useParams();
    const [searchParams] = useSearchParams();
    const attrId = searchParams.get('attr');
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [product, setProduct] = useState<any>(null);
    const [selectedAttr, setSelectedAttr] = useState<any>(null);

    // User details for shipping
    const [address, setAddress] = useState("");
    const [city, setCity] = useState("");
    const [state, setState] = useState("");
    const [phone, setPhone] = useState("");

    // Payment proof logic
    const [paymentRef, setPaymentRef] = useState("");
    const [paymentImage, setPaymentImage] = useState<File | null>(null);

    useEffect(() => {
        if (!user) {
            toast({ title: "Inicia Sesión", description: "Debes iniciar sesión para finalizar la compra." });
            navigate("/auth");
            return;
        }
        fetchCheckoutData();
    }, [productId, user]);

    const fetchCheckoutData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Product
            const { data: prodData, error: prodErr } = await supabase
                .from("marketplace_products")
                .select(`
          *,
          images:marketplace_product_images(*),
          dealer:profiles(id, name)
        `)
                .eq("id", productId)
                .single();

            if (prodErr || !prodData) throw new Error("Producto no encontrado o no disponible.");

            if (prodData.status !== 'active' || prodData.stock <= 0) {
                throw new Error("Este producto ya no está disponible.");
            }
            setProduct(prodData);

            // 2. Fetch Selected Attribute (if any)
            if (attrId) {
                const { data: attrData, error: attrErr } = await supabase
                    .from("marketplace_product_attributes")
                    .select("*")
                    .eq("id", attrId)
                    .single();
                if (!attrErr && attrData) setSelectedAttr(attrData);
            }

            // 3. Pre-fill Auth Profile Data
            if (profile) {
                setAddress((profile as any).address || "");
                setCity(profile.city || "");
                setState(profile.state || "");
                setPhone((profile as any).phone || (profile as any).phone_number || "");
            }
        } catch (err: any) {
            toast({ title: "Atención", description: err.message, variant: "destructive" });
            navigate("/tienda");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        const missing = [];
        if (!state) missing.push("Estado/Provincia");
        if (!city) missing.push("Ciudad");
        if (!address) missing.push("Dirección Completa");
        if (!phone) missing.push("Teléfono");

        if (missing.length > 0) {
            toast({ title: "Información Incompleta", description: `Por favor, completa los siguientes campos de envío: ${missing.join(", ")}`, variant: "destructive" });
            return;
        }

        if (!paymentRef && !paymentImage) {
            toast({ title: "Pago Requerido", description: "Debes adjuntar el comprobante o referencia de pago.", variant: "destructive" });
            return;
        }

        setSubmitting(true);
        try {
            // Security: Validate price server-side in a real world app via edge functions.
            // Here we calculate what we expect the total to be.
            const basePrice = Number(product.price_usd);
            const extraPrice = Number(selectedAttr?.additional_price_usd || 0);
            const totalToPay = basePrice + extraPrice;

            // Ensure stock again right before inserting
            const { data: checkStock } = await supabase.from("marketplace_products").select("stock").eq("id", product.id).single();
            if ((checkStock?.stock || 0) <= 0) {
                throw new Error("Lo sentimos, el producto se acaba de agotar.");
            }

            let receiptUrl = null;
            if (paymentImage) {
                const fileExt = paymentImage.name.split('.').pop();
                const fileName = `${user?.id}/marketplace-order-${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(fileName, paymentImage);
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from("payment-proofs").getPublicUrl(fileName);
                receiptUrl = publicUrl;
            }

            // Insert Order via Secure RPC
            const { data: orderId, error: orderErr } = await supabase.rpc('create_secure_marketplace_order', {
                p_buyer_id: user.id,
                p_product_id: product.id,
                p_attr_id: selectedAttr?.id || null,
                p_quantity: 1, // Phase 1 quantity
                p_shipping_address: address,
                p_shipping_city: city,
                p_shipping_state: state,
                p_phone_number: phone,
                p_payment_reference: paymentRef || null,
                p_payment_receipt_url: receiptUrl || null
            });

            if (orderErr) throw orderErr;

            // Update user profile location if missing
            if (!profile?.city || !profile?.state) {
                await supabase.from("profiles").update({ city, state, address, phone_number: phone }).eq("id", user?.id);
            }

            toast({ title: "¡Compra Exitosa!", description: "Tu pedido ha sido registrado. El vendedor verificará el pago pronto." });
            navigate("/mi-panel"); // Redirect to buyer's panel where they will see "Mis Compras"

        } catch (error: any) {
            toast({ title: "Error en la compra", description: error.message, variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!product) return null;

    const basePrice = Number(product.price_usd);
    const extraPrice = Number(selectedAttr?.additional_price_usd || 0);
    const total = basePrice + extraPrice;
    const mainImg = product.images?.sort((a: any, b: any) => a.display_order - b.display_order)[0]?.image_url;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />
            <BackButton />

            <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
                <h1 className="text-2xl md:text-3xl font-heading font-black mb-8 text-foreground">Completa tu compra</h1>

                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Formulario de Checkout */}
                    <div className="w-full lg:w-3/5 space-y-6">
                        <form id="checkout-form" onSubmit={handleCreateOrder} className="space-y-6">

                            {/* Sección 1: Envío */}
                            <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                                <div className="bg-secondary/40 px-6 py-4 border-b border-border">
                                    <h2 className="font-heading font-bold text-lg flex items-center gap-2"><div className="bg-primary/20 text-primary dark:text-[#A6E300] h-6 w-6 rounded-full flex items-center justify-center text-xs">1</div> Datos de Envío</h2>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="font-bold">Estado / Provincia <span className="text-destructive dark:text-red-400">*</span></Label>
                                            <Input value={state} onChange={e => setState(e.target.value)} placeholder="Ej. Miranda" required className="bg-secondary/20" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold">Ciudad <span className="text-destructive dark:text-red-400">*</span></Label>
                                            <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Ej. Caracas" required className="bg-secondary/20" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">Dirección Completa <span className="text-destructive dark:text-red-400">*</span></Label>
                                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Calle, Avenida, Edificio, Piso, Número" required className="bg-secondary/20" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">Teléfono de Contacto <span className="text-destructive dark:text-red-400">*</span></Label>
                                        <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="0414..." required className="bg-secondary/20" />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Sección 2: Pago */}
                            <Card className="border border-border shadow-sm rounded-xl overflow-hidden">
                                <div className="bg-secondary/40 px-6 py-4 border-b border-border">
                                    <h2 className="font-heading font-bold text-lg flex items-center gap-2"><div className="bg-primary/20 text-primary dark:text-[#A6E300] h-6 w-6 rounded-full flex items-center justify-center text-xs">2</div> Información de Pago</h2>
                                </div>
                                <CardContent className="p-6 space-y-4">
                                    <div className="bg-accent/10 border border-accent/20 p-4 rounded-lg flex gap-3 text-sm text-accent-foreground mb-4">
                                        <AlertCircle className="h-5 w-5 text-accent shrink-0" />
                                        <p>Realiza la transferencia por <strong>${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong> a las cuentas de Subastandolo Inc. y adjunta el comprobante.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label className="font-bold">Número de Referencia</Label>
                                            <Input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Ej. 09483321" className="bg-secondary/20" />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="font-bold flex items-center gap-2">Comprobante (Captura) <Receipt className="h-4 w-4 text-muted-foreground" /></Label>
                                            <Input type="file" accept="image/*" onChange={e => setPaymentImage(e.target.files?.[0] || null)} className="bg-secondary/20 cursor-pointer" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                        </form>
                    </div>

                    {/* Resumen del Pedido (Sidebar) */}
                    <div className="w-full lg:w-2/5">
                        <div className="sticky top-24">
                            <Card className="border border-border shadow-lg rounded-xl overflow-hidden">
                                <div className="bg-primary/5 px-6 py-4 border-b border-border">
                                    <h2 className="font-heading font-bold text-lg">Resumen de Compra</h2>
                                </div>
                                <CardContent className="p-0">
                                    <div className="p-6 border-b border-border flex gap-4">
                                        <div className="h-20 w-20 bg-secondary/30 rounded-lg overflow-hidden shrink-0 border border-border">
                                            {mainImg ? <img src={mainImg} className="w-full h-full object-cover" /> : <Store className="h-8 w-8 text-muted-foreground/30 m-auto mt-6" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base leading-tight line-clamp-2 mb-1">{product.title}</h3>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2"><Store className="h-3 w-3" /> {product.dealer?.name}</p>
                                            {selectedAttr && (
                                                <span className="bg-secondary text-xs px-2 py-0.5 rounded-sm font-medium border border-border">
                                                    {selectedAttr.attr_name}: {selectedAttr.attr_value}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Producto (x1)</span>
                                            <span className="font-semibold">${basePrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        {selectedAttr && selectedAttr.additional_price_usd > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground text-xs pl-2">Variante extra ({selectedAttr.attr_value})</span>
                                                <span className="font-semibold text-xs">+${extraPrice.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between border-t border-border/50 pt-3 mt-3">
                                            <span className="font-bold text-base">Total a Pagar</span>
                                            <span className="font-black text-xl text-accent">${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>

                                    <div className="p-6 pt-0">
                                        <Button
                                            form="checkout-form"
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full h-14 rounded-xl text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 transition-all"
                                        >
                                            {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
                                            {submitting ? 'Procesando...' : 'Confirmar y Pagar'}
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground mt-3 leading-tight">
                                            Al confirmar, aceptas nuestras Políticas de Privacidad y Términos de Compra Directa. Tu dinero está protegido.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
