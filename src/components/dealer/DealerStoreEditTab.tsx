import { useState, useEffect } from "react";
import { compressImage } from "@/utils/compressImage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ImagePlus, X, PlusCircle, Trash2 } from "lucide-react";
import { moderateText } from "@/utils/textModeration";

interface Props {
    dealerId: string;
    productId: string;
    setActiveTab: (tab: string) => void;
    onUpdated: () => void;
}

export default function DealerStoreEditTab({ dealerId, productId, setActiveTab, onUpdated }: Props) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [stock, setStock] = useState("");
    const [condition, setCondition] = useState("new");
    const [returnPolicy, setReturnPolicy] = useState("none");

    // Existing Images mapping { id, url }
    const [existingImages, setExistingImages] = useState<{ id: string, url: string }[]>([]);
    // New images to upload
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const { toast } = useToast();

    const [attributes, setAttributes] = useState<{ id?: string, name: string, value: string, extraPrice: string }[]>([]);

    useEffect(() => {
        fetchProduct();
    }, [productId]);

    const fetchProduct = async () => {
        try {
            const { data: prod, error } = await supabase
                .from("marketplace_products")
                .select(`
          *,
          images:marketplace_product_images(*),
          attrs:marketplace_product_attributes(*)
        `)
                .eq("id", productId)
                .eq("dealer_id", dealerId)
                .single();

            if (error) throw error;
            if (!prod) return;

            setTitle(prod.title || "");
            setDescription(prod.description || "");
            setPrice((prod.price_usd || 0).toString());
            setStock((prod.stock || 0).toString());
            setCondition(prod.condition || "new");
            setReturnPolicy((prod as any).return_policy || "none");

            const sortedImgs = (prod.images || []).sort((a: any, b: any) => a.display_order - b.display_order);
            setExistingImages(sortedImgs.map((img: any) => ({ id: img.id, url: img.image_url })));

            const mapAttrs = (prod.attrs || []).map((a: any) => ({
                id: a.id,
                name: a.attr_name || "",
                value: a.attr_value || "",
                extraPrice: (a.additional_price_usd || 0).toString()
            }));
            setAttributes(mapAttrs);

        } catch (err: any) {
            toast({ title: "Error", description: "No se encontró el producto", variant: "destructive" });
            setActiveTab("store");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const totalAllowed = 5 - (existingImages.length + images.length);
            const newFiles = Array.from(e.target.files).slice(0, totalAllowed);
            setImages([...images, ...newFiles]);
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setImagePreviews([...imagePreviews, ...newPreviews]);
        }
    };

    const removeNewImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);

        const newPreviews = [...imagePreviews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setImagePreviews(newPreviews);
    };

    const deleteExistingImage = async (imageId: string) => {
        if (existingImages.length + images.length <= 1) {
            toast({ title: "Atención", description: "Debe quedar al menos 1 imagen del producto.", variant: "default" });
            return;
        }
        setExistingImages(existingImages.filter(i => i.id !== imageId));
        // Physically deleting from DB so it's instantly removed. 
        await supabase.from("marketplace_product_images").delete().eq("id", imageId);
    };

    const addAttribute = () => setAttributes([...attributes, { name: "", value: "", extraPrice: "0" }]);
    const updateAttribute = (index: number, field: string, val: string) => {
        const newAttrs = [...attributes];
        (newAttrs[index] as any)[field] = val;
        setAttributes(newAttrs);
    };
    const removeAttribute = async (index: number) => {
        const attr = attributes[index];
        if (attr.id) {
            await supabase.from("marketplace_product_attributes").delete().eq("id", attr.id);
        }
        const newAttrs = [...attributes];
        newAttrs.splice(index, 1);
        setAttributes(newAttrs);
    };

    const handleDeleteProduct = async () => {
        if (!confirm("¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.")) return;

        setSaving(true);
        try {
            const { error } = await supabase.from("marketplace_products").delete().eq("id", productId);
            if (error) throw error;
            toast({ title: "Producto Eliminado" });
            setActiveTab("store");
            onUpdated();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !price || !stock || (existingImages.length === 0 && images.length === 0)) {
            toast({ title: "Faltan datos", description: "El título, precio, stock y al menos 1 imagen son obligatorios.", variant: "destructive" });
            return;
        }

        // Anti-fraud: check for contact info and prohibited content
        const modResult = moderateText(title, description);
        if (!modResult.isClean) {
            toast({ title: "Contenido no permitido", description: modResult.violations[0], variant: "destructive" });
            return;
        }

        setSaving(true);

        try {
            // 1. Update Product
            const { error: prodErr } = await supabase.from("marketplace_products").update({
                title,
                description,
                price_usd: parseFloat(price),
                stock: parseInt(stock),
                condition,
                return_policy: returnPolicy,
            } as any).eq("id", productId);

            if (prodErr) throw prodErr;

            // 2. Upload New Images
            if (images.length > 0) {
                let currentMaxOrder = existingImages.length;
                const uploadPromises = images.map(async (file, index) => {
                    const compressed = await compressImage(file);
                    const fileExt = compressed.name.split('.').pop();
                    const fileName = `${dealerId}/${productId}/new-${index}-${Date.now()}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('auction-images')
                        .upload(fileName, compressed);

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('auction-images')
                        .getPublicUrl(fileName);

                    return supabase.from("marketplace_product_images").insert({
                        product_id: productId,
                        image_url: publicUrl,
                        display_order: currentMaxOrder + index
                    });
                });

                await Promise.all(uploadPromises);
            }

            // 3. Upsert Attributes
            if (attributes.length > 0) {
                const attrUpserts = attributes.filter(a => a.name && a.value).map(a => {
                    const p: any = {
                        product_id: productId,
                        attr_name: a.name,
                        attr_value: a.value,
                        additional_price_usd: parseFloat(a.extraPrice) || 0
                    };
                    if (a.id) p.id = a.id;
                    return p;
                });

                if (attrUpserts.length > 0) {
                    const { error: attrErr } = await supabase.from("marketplace_product_attributes").upsert(attrUpserts);
                    if (attrErr) console.warn("Attrs error", attrErr);
                }
            }

            toast({ title: "Éxito", description: "Producto actualizado correctamente." });
            onUpdated();
            setActiveTab("store");

        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Ocurrió un error al guardar.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-[#A6E300]" /></div>;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in">
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" onClick={() => setActiveTab("store")}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Volver
                </Button>
                <Button variant="destructive" onClick={handleDeleteProduct} disabled={saving} className="rounded-sm h-8 text-xs font-bold">
                    <Trash2 className="h-3 w-3 mr-2" /> Eliminar Producto
                </Button>
            </div>

            <Card className="border border-border rounded-sm">
                <CardContent className="p-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                            Editar Producto <Badge className="bg-primary/20 text-primary dark:text-[#A6E300] hover:bg-primary/20">{title}</Badge>
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Fotos */}
                        <div className="space-y-3">
                            <Label className="font-bold">Fotos del producto <span className="text-destructive">*</span></Label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {/* Existing */}
                                {existingImages.map((img, i) => (
                                    <div key={img.id} className="relative aspect-square rounded-sm overflow-hidden border border-border group">
                                        <img src={img.url} alt={`Existing ${i}`} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => deleteExistingImage(img.id)} className="absolute top-1 right-1 bg-black/50 hover:bg-destructive text-white p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="h-3 w-3" />
                                        </button>
                                        {i === 0 && <div className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[10px] text-center py-0.5 font-bold">Principal</div>}
                                    </div>
                                ))}
                                {/* New Previews */}
                                {imagePreviews.map((url, i) => (
                                    <div key={`new-${i}`} className="relative aspect-square rounded-sm overflow-hidden border border-primary group border-dashed">
                                        <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover opacity-80" />
                                        <button type="button" onClick={() => removeNewImage(i)} className="absolute top-1 right-1 bg-black/50 hover:bg-destructive text-white p-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="h-3 w-3" />
                                        </button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-secondary/80 text-xs text-center py-0.5 font-bold">Nueva</div>
                                    </div>
                                ))}
                                {/* Add Button */}
                                {(existingImages.length + images.length) < 5 && (
                                    <label className="aspect-square border-2 border-dashed border-border hover:border-primary dark:hover:border-[#A6E300] rounded-sm flex flex-col items-center justify-center cursor-pointer transition-colors text-muted-foreground hover:text-primary dark:hover:text-[#A6E300]">
                                        <ImagePlus className="h-6 w-6 mb-1" />
                                        <span className="text-[10px] font-medium text-center px-2">Añadir foto<br />(Max 5)</span>
                                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" multiple onChange={handleImageUpload} />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="title" className="font-bold">Título de la publicación <span className="text-destructive">*</span></Label>
                                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} className="rounded-sm" required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="price" className="font-bold">Precio Fijo (USD) <span className="text-destructive">*</span></Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-muted-foreground font-bold">$</span>
                                    <Input id="price" type="number" min="0.1" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="pl-7 rounded-sm" required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="stock" className="font-bold">Cantidad disponible (Stock) <span className="text-destructive">*</span></Label>
                                <Input id="stock" type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="rounded-sm" required />
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

                            <div className="space-y-2">
                                <Label className="font-bold">Política de Devolución</Label>
                                <Select value={returnPolicy} onValueChange={setReturnPolicy}>
                                    <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">🚫 Sin devolución</SelectItem>
                                        <SelectItem value="7_days">📦 7 días (comprador paga envío)</SelectItem>
                                        <SelectItem value="15_days">📦 15 días (comprador paga envío)</SelectItem>
                                        <SelectItem value="30_days_free">✨ 30 días (envío gratis)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="desc" className="font-bold">Descripción detallada</Label>
                            <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} className="min-h-[120px] rounded-sm" />
                        </div>

                        {/* Variantes / Atributos */}
                        <div className="space-y-3 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <Label className="font-bold">Variantes Guardadas</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addAttribute} className="h-8 rounded-sm text-xs border-primary text-primary dark:border-[#A6E300] dark:text-[#A6E300] hover:bg-primary/10">
                                    <PlusCircle className="h-3 w-3 mr-1" /> Añadir Nueva Variante
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
                                </div>
                            )}
                        </div>

                        <Button type="submit" disabled={saving} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm font-bold text-lg h-12 shadow-md">
                            {saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando Cambios...</> : "Guardar Cambios"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
