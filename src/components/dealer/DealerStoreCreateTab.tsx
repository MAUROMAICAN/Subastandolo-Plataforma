import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ImagePlus, X, PlusCircle } from "lucide-react";

interface Props {
    dealerId: string;
    setActiveTab: (tab: string) => void;
    onCreated: () => void;
}

export default function DealerStoreCreateTab({ dealerId, setActiveTab, onCreated }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("");
    const [condition, setCondition] = useState("new");
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Basic attributes logic for this V1. Can be expanded dynamically later.
    const [attributes, setAttributes] = useState<{ name: string, value: string, extraPrice: string }[]>([]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).slice(0, 5 - images.length);
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

    const addAttribute = () => {
        setAttributes([...attributes, { name: "", value: "", extraPrice: "0" }]);
    };

    const updateAttribute = (index: number, field: string, val: string) => {
        const newAttrs = [...attributes];
        (newAttrs[index] as any)[field] = val;
        setAttributes(newAttrs);
    };

    const removeAttribute = (index: number) => {
        const newAttrs = [...attributes];
        newAttrs.splice(index, 1);
        setAttributes(newAttrs);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !price || !stock || images.length === 0) {
            toast({ title: "Faltan datos", description: "El título, precio, stock y al menos 1 imagen son obligatorios.", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            // 1. Get a default category for now (We would need a Category selector fetching from DB)
            // Let's check if there is any category, if not insert a dummy one
            let { data: cat } = await supabase.from("marketplace_categories").select("id").limit(1).single();

            let categoryId = cat?.id;
            if (!categoryId) {
                const { data: newCat, error: catErr } = await supabase.from("marketplace_categories").insert({
                    name: "General", slug: "general", description: "Categoría general"
                }).select("id").single();
                if (catErr) throw catErr;
                categoryId = newCat.id;
            }

            // 2. Create Product
            const { data: product, error: prodErr } = await supabase.from("marketplace_products").insert({
                dealer_id: dealerId,
                category_id: categoryId,
                title,
                description,
                price_usd: parseFloat(price),
                stock: parseInt(stock),
                condition
            }).select("id").single();

            if (prodErr) throw prodErr;

            // 3. Upload Images
            const uploadPromises = images.map(async (file, index) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${dealerId}/${product.id}/${index}-${Date.now()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('auction-images') // Reusing the same public bucket for now to avoid creating new ones
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

            // 4. Save Attributes
            if (attributes.length > 0) {
                const attrInserts = attributes.filter(a => a.name && a.value).map(a => ({
                    product_id: product.id,
                    attr_name: a.name,
                    attr_value: a.value,
                    additional_price_usd: parseFloat(a.extraPrice) || 0
                }));

                if (attrInserts.length > 0) {
                    await supabase.from("marketplace_product_attributes").insert(attrInserts);
                }
            }

            toast({ title: "Éxito", description: "Producto publicado correctamente en tu tienda." });
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

            <Card className="border border-border rounded-sm">
                <CardContent className="p-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-heading font-bold">Publicar Nuevo Producto</h2>
                        <p className="text-sm text-muted-foreground">Artículos de venta directa con precio fijo y stock.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Fotos */}
                        <div className="space-y-3">
                            <Label className="font-bold">Fotos del producto <span className="text-destructive">*</span></Label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {imagePreviews.map((url, i) => (
                                    <div key={i} className="relative aspect-square rounded-sm overflow-hidden border border-border group">
                                        <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/50 hover:bg-destructive text-white p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="h-3 w-3" />
                                        </button>
                                        {i === 0 && <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] text-center py-0.5 font-bold">Principal</div>}
                                    </div>
                                ))}
                                {images.length < 5 && (
                                    <label className="aspect-square border-2 border-dashed border-border hover:border-primary rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground hover:text-primary">
                                        <ImagePlus className="h-6 w-6 mb-1" />
                                        <span className="text-xs font-medium">Añadir foto</span>
                                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" multiple onChange={handleImageUpload} />
                                    </label>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground">Sube hasta 5 fotos. La primera será la portada.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="title" className="font-bold">Título de la publicación <span className="text-destructive">*</span></Label>
                                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Zapatos Nike Air Max 270 Originales" className="rounded-sm" required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="price" className="font-bold">Precio Fijo (USD) <span className="text-destructive">*</span></Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">$</span>
                                    <Input id="price" type="number" min="0.1" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="pl-7 rounded-sm" placeholder="0.00" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="stock" className="font-bold">Cantidad disponible (Stock) <span className="text-destructive">*</span></Label>
                                <Input id="stock" type="number" min="1" value={stock} onChange={e => setStock(e.target.value)} className="rounded-sm" placeholder="Ej. 10" required />
                            </div>

                            <div className="space-y-2">
                                <Label className="font-bold">Condición</Label>
                                <Select value={condition} onValueChange={setCondition}>
                                    <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="new">Nuevo</SelectItem>
                                        <SelectItem value="used">Usado (Como Nuevo)</SelectItem>
                                        <SelectItem value="refurbished">Reacondicionado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="desc" className="font-bold">Descripción detallada</Label>
                            <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[120px] rounded-sm" placeholder="Describe las características, dimensiones, material..." />
                        </div>

                        {/* Variantes / Atributos */}
                        <div className="space-y-3 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <Label className="font-bold">Variantes (Opcional)</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addAttribute} className="h-8 rounded-sm text-xs">
                                    <PlusCircle className="h-3 w-3 mr-1" /> Añadir Variante (Talla, Color)
                                </Button>
                            </div>

                            {attributes.length > 0 && (
                                <div className="bg-secondary/20 p-3 rounded-sm border border-border space-y-3">
                                    {attributes.map((attr, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <div className="flex-1 space-y-1">
                                                <Input placeholder="Nombre (Ej. Talla)" value={attr.name} onChange={e => updateAttribute(i, 'name', e.target.value)} className="h-8 text-xs rounded-sm" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <Input placeholder="Valor (Ej. L)" value={attr.value} onChange={e => updateAttribute(i, 'value', e.target.value)} className="h-8 text-xs rounded-sm" />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <Input type="number" placeholder="Precio Extra USD (0)" value={attr.extraPrice} onChange={e => updateAttribute(i, 'extraPrice', e.target.value)} className="h-8 text-xs rounded-sm" />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeAttribute(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <p className="text-[10px] text-muted-foreground">Si un tamaño o color específico cuesta más, indica la diferencia de precio.</p>
                                </div>
                            )}
                        </div>

                        <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 rounded-sm font-bold text-lg h-12">
                            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Publicando...</> : "Publicar Producto"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
