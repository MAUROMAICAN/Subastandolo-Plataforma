import { useState, useEffect } from "react";
import { compressImage } from "@/utils/compressImage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ImagePlus, X, ShoppingCart, Gavel, MessageSquare } from "lucide-react";
import CategorySelector from "@/components/CategorySelector";
import DynamicAttributeForm from "@/components/DynamicAttributeForm";
import { useCategoryAttributes, type Category } from "@/hooks/useCategories";
import { moderateText } from "@/utils/textModeration";

interface Props {
    dealerId: string;
    setActiveTab: (tab: string) => void;
    onCreated: () => void;
}

export default function DealerStoreCreateTab({ dealerId, setActiveTab, onCreated }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("1");
    const [condition, setCondition] = useState("nuevo");
    const [returnPolicy, setReturnPolicy] = useState("none");
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Listing type
    const [listingType, setListingType] = useState<'fixed_price' | 'auction' | 'accepts_offers'>('fixed_price');
    const [auctionDuration, setAuctionDuration] = useState("24");

    // Listing tier
    const [listingTier, setListingTier] = useState<'free' | 'standard' | 'premium'>('free');
    const [freeCount, setFreeCount] = useState(0);

    // Fetch free listing count on mount
    useEffect(() => {
        supabase.from("marketplace_products")
            .select("id", { count: "exact", head: true })
            .eq("seller_id", dealerId)
            .eq("status", "active")
            .eq("listing_tier" as any, "free")
            .then(({ count }) => setFreeCount(count || 0));
    }, [dealerId]);

    // Category + dynamic attributes
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
    const { data: categoryAttributes = [] } = useCategoryAttributes(selectedCategory?.id || null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 10 - images.length);
            setImages([...images, ...newFiles]);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setImagePreviews([...imagePreviews, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);
        const newPreviews = [...imagePreviews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setImagePreviews(newPreviews);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategory) {
            toast({ title: "Selecciona una categoría", description: "Debes elegir la categoría del producto.", variant: "destructive" });
            return;
        }
        if (!title || !price || images.length === 0) {
            toast({ title: "Faltan datos", description: "El título, precio y al menos 1 imagen son obligatorios.", variant: "destructive" });
            return;
        }
        if (title.length > 80) {
            toast({ title: "Título muy largo", description: "El título no puede exceder 80 caracteres.", variant: "destructive" });
            return;
        }
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice < 1) {
            toast({ title: "Precio inválido", description: "El precio mínimo es $1.00 USD.", variant: "destructive" });
            return;
        }
        if (numPrice > 50000) {
            toast({ title: "Precio excesivo", description: "El precio máximo es $50,000.00 USD.", variant: "destructive" });
            return;
        }
        if (description.length > 3000) {
            toast({ title: "Descripción muy larga", description: "La descripción no puede exceder 3000 caracteres.", variant: "destructive" });
            return;
        }

        // Validate required attributes
        const missingRequired = categoryAttributes
            .filter(a => a.required && !attributeValues[a.name])
            .map(a => a.label);
        if (missingRequired.length > 0) {
            toast({ title: "Faltan características", description: `Completa: ${missingRequired.join(", ")}`, variant: "destructive" });
            return;
        }

        // Anti-fraud: check for contact info and prohibited content
        const modResult = moderateText(title, description);
        if (!modResult.isClean) {
            toast({ title: "Contenido no permitido", description: modResult.violations[0], variant: "destructive" });
            return;
        }

        // Validate free listing limit
        if (listingTier === 'free' && freeCount >= 5) {
            toast({ title: "Límite alcanzado", description: "Solo puedes tener 5 publicaciones gratuitas activas. Elige Estándar o Premium.", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            // 1. Create Product
            const insertData: any = {
                seller_id: dealerId,
                category_id: selectedCategory.id,
                title,
                description: description || null,
                price: parseFloat(price),
                stock: listingType === 'auction' ? 1 : (parseInt(stock) || 1),
                condition,
                attributes: attributeValues,
                status: "active",
                listing_type: listingType,
                return_policy: returnPolicy,
                listing_tier: listingTier,
            };

            if (listingType === 'auction') {
                insertData.starting_price = parseFloat(price);
                insertData.current_price = 0;
                insertData.auction_duration_hours = parseInt(auctionDuration) || 24;
                const durationMs = (parseInt(auctionDuration) || 24) * 60 * 60 * 1000;
                insertData.end_time = new Date(Date.now() + durationMs).toISOString();
                insertData.allow_auto_extend = true;
            }

            if (listingType === 'accepts_offers') {
                insertData.accepts_offers = true;
            }

            const { data: product, error: prodErr } = await supabase.from("marketplace_products").insert(insertData).select("id").single();

            if (prodErr) throw prodErr;

            // 2. Upload Images
            const uploadPromises = images.map(async (file, index) => {
                const compressed = await compressImage(file);
                const fileExt = compressed.name.split('.').pop();
                const fileName = `marketplace/${dealerId}/${product.id}/${index}-${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('auction-images')
                    .upload(fileName, compressed);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('auction-images')
                    .getPublicUrl(fileName);

                return supabase.from("marketplace_product_images").insert({
                    product_id: product.id,
                    image_url: publicUrl,
                    display_order: index
                });
            });

            await Promise.all(uploadPromises);

            // 3. Set first image as product image_url
            if (images.length > 0) {
                // Get first image URL from uploaded images
                const { data: firstImg } = await supabase.from("marketplace_product_images")
                    .select("image_url")
                    .eq("product_id", product.id)
                    .order("display_order")
                    .limit(1)
                    .single();
                if (firstImg) {
                    await supabase.from("marketplace_products").update({ image_url: firstImg.image_url } as any).eq("id", product.id);
                }
            }

            toast({ title: "✅ ¡Producto publicado!", description: "Tu producto está disponible en tu tienda." });
            onCreated();
            setActiveTab("store");

        } catch (error: any) {
            console.error(error);
            toast({ title: "Error", description: error.message || "Ocurrió un error al publicar.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <Button variant="ghost" onClick={() => setActiveTab("store")} className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver a mi Tienda
            </Button>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* HEADER */}
                <Card className="border border-border rounded-2xl overflow-hidden">
                    <div className="p-5 sm:p-6">
                        <h2 className="text-xl font-heading font-bold mb-1">Publicar Nuevo Producto</h2>
                        <p className="text-sm text-muted-foreground">Elige cómo quieres vender tu producto.</p>
                    </div>
                </Card>

                {/* LISTING TYPE SELECTOR */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
                        <span className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shrink-0">⚡</span>
                        <span className="text-sm font-heading font-bold">Modo de Venta</span>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {([
                                { value: 'fixed_price' as const, icon: ShoppingCart, label: 'Cómpralo Ahora', desc: 'Precio fijo. El comprador lo compra inmediatamente.', color: 'emerald' },
                                { value: 'auction' as const, icon: Gavel, label: 'Subasta', desc: 'Los compradores pujan. Gana la oferta más alta.', color: 'amber' },
                                { value: 'accepts_offers' as const, icon: MessageSquare, label: 'Acepto Ofertas', desc: 'Publicas un precio y los compradores negocian.', color: 'blue' },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setListingType(opt.value)}
                                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all hover:-translate-y-0.5 ${
                                        listingType === opt.value
                                            ? `border-${opt.color}-500 bg-${opt.color}-500/10 shadow-md`
                                            : 'border-border hover:border-foreground/20 hover:bg-secondary/30'
                                    }`}
                                >
                                    <opt.icon className={`h-6 w-6 ${listingType === opt.value ? `text-${opt.color}-500` : 'text-muted-foreground'}`} />
                                    <span className={`text-sm font-bold ${listingType === opt.value ? 'text-foreground' : 'text-muted-foreground'}`}>{opt.label}</span>
                                    <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* LISTING TIER SELECTOR */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-xs font-black shrink-0">⭐</span>
                        <span className="text-sm font-heading font-bold">Nivel de Publicación</span>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {([
                                { value: 'free' as const, label: 'Gratuita', commission: '0%', desc: 'Sin comisión. Máx 5 activas.', badge: null, color: 'border-border', limit: `${freeCount}/5 usadas` },
                                { value: 'standard' as const, label: 'Estándar', commission: '7%', desc: 'Mayor exposición. Sin límite.', badge: null, color: 'border-sky-500' },
                                { value: 'premium' as const, label: 'Premium', commission: '10%', desc: 'Máxima exposición + destacado.', badge: '✨', color: 'border-amber-500' },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setListingTier(opt.value)}
                                    disabled={opt.value === 'free' && freeCount >= 5}
                                    className={`relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-center transition-all hover:-translate-y-0.5 ${listingTier === opt.value
                                        ? `${opt.color} bg-primary/5 shadow-md`
                                        : 'border-border/50 hover:border-foreground/20 hover:bg-secondary/30'
                                    } ${opt.value === 'free' && freeCount >= 5 ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                    {opt.badge && <span className="absolute -top-2 -right-2 text-lg">{opt.badge}</span>}
                                    <span className="text-2xl font-black text-foreground">{opt.commission}</span>
                                    <span className="text-sm font-bold text-foreground">{opt.label}</span>
                                    <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
                                    {opt.value === 'free' && (
                                        <span className={`text-[9px] font-bold mt-1 ${freeCount >= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>{opt.limit}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {listingTier === 'premium' && (
                            <p className="text-[10px] text-amber-500 font-medium mt-3 text-center">⭐ Tu producto aparecerá destacado con badge Premium en los listados.</p>
                        )}
                    </div>
                </div>

                {/* STEP 1: Categoría */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
                        <span className="w-7 h-7 rounded-lg bg-violet-500 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
                        <span className="text-sm font-heading font-bold">Categoría</span>
                    </div>
                    <div className="p-5">
                        <CategorySelector
                            selectedCategoryId={selectedCategory?.id || null}
                            onSelect={(cat) => { setSelectedCategory(cat); setAttributeValues({}); }}
                            onClear={() => { setSelectedCategory(null); setAttributeValues({}); }}
                        />
                    </div>
                </div>

                {/* STEP 2: Info del Producto */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
                        <span className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center text-xs font-black shrink-0">2</span>
                        <span className="text-sm font-heading font-bold">Información del Producto</span>
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Title */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Título de la publicación <span className="text-destructive">*</span></Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Zapatos Nike Air Max 270 Originales" className="rounded-xl h-11" required maxLength={80} />
                            <p className={`text-[10px] text-right ${title.length >= 75 ? "text-amber-500 font-bold" : "text-muted-foreground"}`}>{title.length}/80</p>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">Descripción detallada <span className="text-destructive">*</span></Label>
                            <textarea
                                value={description}
                                required
                                maxLength={3000}
                                lang="es"
                                spellCheck={true}
                                placeholder="Describe detalladamente: características, material, dimensiones, incluye, etc."
                                rows={6}
                                className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none overflow-hidden"
                                style={{ minHeight: "10rem" }}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground text-right">{description.length}/3000</p>
                        </div>

                        {/* Dynamic Attributes */}
                        {selectedCategory && (
                            <div className="border-t border-border pt-4 mt-2">
                                <DynamicAttributeForm
                                    categoryId={selectedCategory.id}
                                    values={attributeValues}
                                    onChange={setAttributeValues}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* STEP 3: Precio, Stock, Estado */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
                        <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-black shrink-0">3</span>
                        <span className="text-sm font-heading font-bold">Precio y Stock</span>
                    </div>
                    <div className="p-5 space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">
                                    {listingType === 'auction' ? 'Precio Inicial ($)' : 'Precio ($)'} <span className="text-destructive">*</span>
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                    <Input type="number" min="0.1" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="pl-8 rounded-xl h-11" placeholder="0.00" required />
                                </div>
                                {listingType === 'accepts_offers' && (
                                    <p className="text-[10px] text-blue-500">Los compradores podrán hacer ofertas sobre este precio.</p>
                                )}
                            </div>

                            {listingType !== 'auction' && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold">Cantidad disponible <span className="text-destructive">*</span></Label>
                                    <Input type="number" min="1" value={stock} onChange={e => setStock(e.target.value)} className="rounded-xl h-11" placeholder="1" required />
                                </div>
                            )}
                        </div>

                        {/* Auction-specific: Duration */}
                        {listingType === 'auction' && (
                            <div className="space-y-1.5 border-t border-border pt-4">
                                <Label className="text-xs font-bold">Duración de la Subasta <span className="text-destructive">*</span></Label>
                                <select
                                    value={auctionDuration}
                                    onChange={(e) => setAuctionDuration(e.target.value)}
                                    className="flex h-11 w-full max-w-xs rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="1">1 hora</option>
                                    <option value="2">2 horas</option>
                                    <option value="3">3 horas</option>
                                    <option value="6">6 horas</option>
                                    <option value="12">12 horas</option>
                                    <option value="24">1 día (24 horas)</option>
                                    <option value="48">2 días (48 horas)</option>
                                    <option value="72">3 días (72 horas)</option>
                                </select>
                                <p className="text-[10px] text-muted-foreground">La subasta finalizará automáticamente al pasar este tiempo.</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-xs font-bold">Estado del Producto <span className="text-destructive">*</span></Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {([
                                    { value: "nuevo", label: "Nuevo", emoji: "✨", desc: "Sin uso" },
                                    { value: "usado_buen_estado", label: "Usado", emoji: "👍", desc: "Buen estado" },
                                    { value: "usado_regular", label: "Regular", emoji: "👌", desc: "Uso visible" },
                                    { value: "para_reparar", label: "Para reparar", emoji: "🔧", desc: "Necesita arreglo" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setCondition(opt.value)}
                                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all hover:-translate-y-0.5 ${condition === opt.value
                                            ? "border-primary bg-primary/10 text-primary dark:border-[#A6E300] dark:bg-[#A6E300]/10 dark:text-[#A6E300] shadow-md shadow-primary/10"
                                            : "border-border hover:border-primary/30 hover:bg-secondary/30"
                                            }`}
                                    >
                                        <span className="text-xl leading-none">{opt.emoji}</span>
                                        <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                                        <span className="text-[9px] text-muted-foreground leading-tight">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Return Policy */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold">Política de Devolución</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {([
                                    { value: "none", label: "Sin devolución", emoji: "🚫", desc: "No acepta" },
                                    { value: "7_days", label: "7 días", emoji: "📦", desc: "Comprador paga envío" },
                                    { value: "15_days", label: "15 días", emoji: "📦", desc: "Comprador paga envío" },
                                    { value: "30_days_free", label: "30 días gratis", emoji: "✨", desc: "Envío gratis" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setReturnPolicy(opt.value)}
                                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all hover:-translate-y-0.5 ${returnPolicy === opt.value
                                            ? "border-primary bg-primary/10 text-primary dark:border-[#A6E300] dark:bg-[#A6E300]/10 dark:text-[#A6E300] shadow-md shadow-primary/10"
                                            : "border-border hover:border-primary/30 hover:bg-secondary/30"
                                            }`}
                                    >
                                        <span className="text-xl leading-none">{opt.emoji}</span>
                                        <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                                        <span className="text-[9px] text-muted-foreground leading-tight">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                            {returnPolicy === "30_days_free" && (
                                <p className="text-[10px] text-emerald-500 font-medium">✨ Tu publicación mostrará el badge "Devolución Gratis" — esto aumenta la confianza del comprador.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* STEP 4: Fotos */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
                        <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0">4</span>
                        <span className="text-sm font-heading font-bold">Fotos del Producto</span>
                    </div>
                    <div className="p-5 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {imagePreviews.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
                                    <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                    {i === 0 && <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] text-center py-0.5 font-bold">Principal</div>}
                                </div>
                            ))}
                            {images.length < 10 && (
                                <label className="aspect-square border-2 border-dashed border-border hover:border-primary dark:hover:border-[#A6E300] rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground hover:text-primary dark:hover:text-[#A6E300]">
                                    <ImagePlus className="h-6 w-6 mb-1" />
                                    <span className="text-xs font-medium">Añadir foto</span>
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" multiple onChange={handleImageUpload} />
                                </label>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Sube hasta 10 fotos. La primera será la portada.</p>
                    </div>
                </div>

                {/* SUBMIT */}
                <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl font-bold text-lg h-12 shadow-lg">
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publicando...</> : "🚀 Publicar Producto"}
                </Button>
            </form>
        </div>
    );
}
