import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ImagePlus, X } from "lucide-react";
import CategorySelector from "@/components/CategorySelector";
import DynamicAttributeForm from "@/components/DynamicAttributeForm";
import { useCategoryAttributes, type Category } from "@/hooks/useCategories";

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
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

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

        // Validate required attributes
        const missingRequired = categoryAttributes
            .filter(a => a.required && !attributeValues[a.name])
            .map(a => a.label);
        if (missingRequired.length > 0) {
            toast({ title: "Faltan características", description: `Completa: ${missingRequired.join(", ")}`, variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            // 1. Create Product
            const { data: product, error: prodErr } = await supabase.from("marketplace_products").insert({
                seller_id: dealerId,
                category_id: selectedCategory.id,
                title,
                description: description || null,
                price: parseFloat(price),
                stock: parseInt(stock) || 1,
                condition,
                attributes: attributeValues,
                status: "active",
            } as any).select("id").single();

            if (prodErr) throw prodErr;

            // 2. Upload Images
            const uploadPromises = images.map(async (file, index) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `marketplace/${dealerId}/${product.id}/${index}-${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('auction-images')
                    .upload(fileName, file);

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
                        <p className="text-sm text-muted-foreground">Artículos de venta directa con precio fijo.</p>
                    </div>
                </Card>

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
                                <Label className="text-xs font-bold">Precio Fijo ($) <span className="text-destructive">*</span></Label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                                    <Input type="number" min="0.1" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="pl-8 rounded-xl h-11" placeholder="0.00" required />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold">Cantidad disponible <span className="text-destructive">*</span></Label>
                                <Input type="number" min="1" value={stock} onChange={e => setStock(e.target.value)} className="rounded-xl h-11" placeholder="1" required />
                            </div>
                        </div>

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
