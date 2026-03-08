import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Upload, AlertTriangle, Headphones, Copy } from "lucide-react";

interface Props {
  isGoldPlus: boolean;
  dealerAccountStatus: string;
  onCreated: () => void;
  setActiveTab: (tab: string) => void;
  initialData?: { title: string; description: string; startingPrice: string; durationHours: string };
  onInitialDataConsumed?: () => void;
}

export default function DealerCreateTab({ isGoldPlus, dealerAccountStatus, onCreated, setActiveTab, initialData, onInitialDataConsumed }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [productCondition, setProductCondition] = useState("nuevo");
  const [auctionDuration, setAuctionDuration] = useState("24");
  const [startDate, setStartDate] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const el = descTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // 4 extra lines of breathing room (approx 24px per line)
    el.style.height = (el.scrollHeight + 96) + "px";
  }, []);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setStartingPrice(initialData.startingPrice);
      setAuctionDuration(initialData.durationHours);
      setIsDuplicate(true);
      onInitialDataConsumed?.();
      // Trigger resize after state settles
      setTimeout(autoResizeTextarea, 50);
    }
    // Only run on mount with initial data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const total = imageFiles.length + files.length;
    if (total > 10) {
      toast({ title: "Máximo 10 fotos", variant: "destructive" });
      return;
    }
    setImageFiles(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setImageFiles(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (imageFiles.length < 1) {
      toast({ title: "Mínimo 1 foto requerida", description: "Sube al menos 1 foto del producto.", variant: "destructive" });
      return;
    }

    const { validateNoContactInfo } = await import("@/lib/contactDetector");
    const contactError = validateNoContactInfo(title, description);
    if (contactError) {
      toast({ title: "⚠️ Contenido no permitido", description: contactError, variant: "destructive" });
      return;
    }

    setCreating(true);
    setUploading(true);

    const { applyWatermark } = await import("@/lib/watermark");
    const uploadedUrls: string[] = [];
    for (const file of imageFiles) {
      const watermarked = await applyWatermark(file);
      const filePath = `${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from("auction-images").upload(filePath, watermarked);
      if (uploadError) {
        toast({ title: "Error subiendo imagen", description: uploadError.message, variant: "destructive" });
        setCreating(false);
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("auction-images").getPublicUrl(filePath);
      uploadedUrls.push(urlData.publicUrl);
    }
    setUploading(false);

    const autoApprove = isGoldPlus && dealerAccountStatus === "active";
    const durationHours = parseInt(auctionDuration) || 24;
    const scheduledStart = startDate ? new Date(startDate + "T09:00:00").toISOString() : null;
    const scheduledStartMs = scheduledStart ? new Date(scheduledStart).getTime() : 0;
    // If scheduled start is in the future, use it; otherwise use now
    const baseTime = scheduledStartMs > Date.now() ? scheduledStartMs : Date.now();
    const endTime = autoApprove
      ? new Date(baseTime + durationHours * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase.from("auctions").insert({
      title,
      description: description || null,
      starting_price: parseFloat(startingPrice) || 0,
      current_price: 0,
      end_time: endTime,
      start_time: scheduledStart,
      created_by: user.id,
      image_url: uploadedUrls[0] || null,
      status: (autoApprove ? "active" : "pending") as any,
      requested_duration_hours: durationHours,
      condition: productCondition,
    } as any).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    if (data && uploadedUrls.length > 0) {
      const imageInserts = uploadedUrls.map((url, index) => ({
        auction_id: data.id,
        image_url: url,
        display_order: index,
      }));
      await supabase.from("auction_images").insert(imageInserts);
    }

    if (autoApprove) {
      toast({ title: "🚀 ¡Subasta publicada!", description: "Tu subasta está activa gracias a tu nivel de confianza." });
    } else {
      toast({ title: "¡Producto enviado a revisión!", description: "Un administrador revisará tu publicación." });
    }
    setTitle(""); setDescription(""); setStartingPrice(""); setProductCondition("nuevo"); setAuctionDuration("24"); setStartDate(""); setImageFiles([]);

    if (data) {
      // Push notification (existing)
      supabase.functions.invoke("send-push-notification", {
        body: { type: "new_auction", targetUserId: user?.id, auctionId: data.id, auctionTitle: data.title },
      }).catch(() => { });

      // Email to followers — userIds resolved server-side by Edge Function
      if (autoApprove) {
        supabase.from("dealer_follows" as any).select("follower_id").eq("dealer_id", user.id).then(async ({ data: follows }) => {
          if (!follows || (follows as any[]).length === 0) return;
          const followerIds = (follows as any[]).map(f => f.follower_id);
          supabase.functions.invoke("notify-new-auction", {
            body: {
              followerIds,
              dealerUserId: user.id,
              auctionTitle: data.title,
              auctionId: data.id,
              startingPrice: data.starting_price,
              imageUrl: uploadedUrls[0] || null,
              endsAt: data.end_time,
            },
          }).catch(() => { });
        });
      }

    }


    setActiveTab("auctions");
    onCreated();
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(132,204,22,0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(250,204,21,0.08),transparent_50%)]" />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary dark:text-[#A6E300]" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-black text-white">Publicar Producto</h2>
              {isGoldPlus && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 mt-0.5">
                  ⚡ Publicación Directa
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-white/40 leading-relaxed max-w-2xl">
            {isGoldPlus
              ? "Como dealer de nivel Oro o superior, tus subastas se publican directamente sin necesidad de revisión."
              : "Tu producto será revisado por un administrador antes de ser publicado."
            }
            {" "}
            <a href="/politicas-publicacion" target="_blank" className="text-primary dark:text-[#A6E300] underline underline-offset-2 font-medium hover:opacity-80">
              Ver Políticas
            </a>
          </p>
        </div>
      </div>

      {/* Duplicate warning */}
      {isDuplicate && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
          <Copy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-500">📋 Borrador basado en una publicación anterior</p>
            <p className="text-muted-foreground mt-0.5">El título, descripción y precio han sido copiados. <strong className="text-foreground">Realiza cambios</strong> antes de enviar.</p>
          </div>
        </div>
      )}

      {/* ── FORM ── */}
      <form onSubmit={handleCreate} className="space-y-5">

        {/* STEP 1: Info básica */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
            <span className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center text-xs font-black shrink-0">1</span>
            <span className="text-sm font-heading font-bold">Información del Producto</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Título del Producto <span className="text-destructive">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej: Refrigerador Samsung 2024" className="rounded-xl h-11" maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Descripción del Producto <span className="text-destructive">*</span></Label>
              <textarea
                ref={descTextareaRef}
                value={description}
                required
                maxLength={2000}
                lang="es"
                spellCheck={true}
                placeholder="Describe detalladamente el producto: condición, características, modelo, etc."
                rows={6}
                className="flex w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
                style={{ minHeight: "10rem" }}
                onChange={(e) => {
                  setDescription(e.target.value);
                  autoResizeTextarea();
                }}
              />
              <p className="text-[10px] text-muted-foreground text-right">{description.length}/2000</p>
            </div>
          </div>
        </div>

        {/* STEP 2: Precio y Estado */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
            <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs font-black shrink-0">2</span>
            <span className="text-sm font-heading font-bold">Precio y Estado</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Precio Inicial ($) <span className="text-destructive">*</span></Label>
              <div className="relative max-w-xs">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                <Input type="number" min="1" step="0.01" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} required placeholder="100" className="rounded-xl h-11 pl-8" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Estado del Producto <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-3 gap-2.5 max-w-md">
                {([
                  { value: "nuevo", label: "Nuevo", emoji: "✨", desc: "Sin uso" },
                  { value: "usado_buen_estado", label: "Usado", emoji: "👍", desc: "Buen estado" },
                  { value: "para_reparar", label: "Para reparar", emoji: "🔧", desc: "Necesita reparación" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProductCondition(opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all hover:-translate-y-0.5 ${productCondition === opt.value
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

        {/* STEP 3: Duración y Programación */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
            <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0">3</span>
            <span className="text-sm font-heading font-bold">Duración y Programación</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Duración de la Subasta <span className="text-destructive">*</span></Label>
              <select
                value={auctionDuration}
                onChange={(e) => setAuctionDuration(e.target.value)}
                className="flex h-11 w-full max-w-xs rounded-xl border border-input bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="1">1 hora</option>
                <option value="2">2 horas</option>
                <option value="3">3 horas</option>
                <option value="4">4 horas</option>
                <option value="5">5 horas</option>
                <option value="6">6 horas</option>
                <option value="12">12 horas</option>
                <option value="24">1 día (24 horas)</option>
                <option value="48">2 días (48 horas)</option>
                <option value="72">3 días (72 horas)</option>
                <option value="96">4 días (96 horas)</option>
                <option value="120">5 días (120 horas)</option>
                <option value="144">6 días (144 horas)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                {isGoldPlus
                  ? "Tu subasta se activa directamente con esta duración."
                  : "El administrador podrá ajustar la duración si lo considera necesario."
                }
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Fecha de inicio programada <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="max-w-xs rounded-xl h-11"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Si dejas la fecha vacía, el departamento de revisión podrá activarla sin necesidad de confirmación.
              </p>
            </div>
          </div>
        </div>

        {/* STEP 4: Fotos */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-secondary/20">
            <span className="w-7 h-7 rounded-lg bg-violet-500 text-white flex items-center justify-center text-xs font-black shrink-0">4</span>
            <span className="text-sm font-heading font-bold">Fotos del Producto</span>
            <span className="ml-auto text-[10px] text-muted-foreground font-medium">{imageFiles.length}/10</span>
          </div>
          <div className="p-5 space-y-3">
            <label className="flex flex-col items-center gap-2 px-6 py-8 rounded-xl border-2 border-dashed border-primary/30 text-sm cursor-pointer hover:bg-primary/5 hover:border-primary/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                <Upload className="h-6 w-6 text-primary dark:text-[#A6E300]" />
              </div>
              <span className="font-heading font-bold text-sm text-foreground">Arrastra o haz clic para subir fotos</span>
              <span className="text-[10px] text-muted-foreground">Mínimo 1, máximo 10 imágenes. Se aplica marca de agua automáticamente.</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </label>

            {imageFiles.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground">Arrastra las imágenes para reordenar. La primera será la principal.</p>
                <div className="grid grid-cols-5 gap-2.5">
                  {imageFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={`relative group aspect-square rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${dragOverIndex === index ? "border-primary scale-105 shadow-lg" : dragIndex === index ? "border-primary/50 opacity-50" : "border-border hover:border-primary/30"
                        }`}
                    >
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover pointer-events-none" />
                      <span className="absolute top-1.5 left-1.5 w-5 h-5 bg-background/80 backdrop-blur-sm text-foreground rounded-lg flex items-center justify-center text-[10px] font-black">{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-lg flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        ×
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[9px] text-center py-1 font-bold">PRINCIPAL</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── WARNINGS & INFO ── */}
        <div className="space-y-3">
          {/* Seller commitment */}
          <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-4 text-xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-destructive mb-0.5">Compromiso del Vendedor</p>
              <p className="text-muted-foreground leading-relaxed">
                Al publicar, te comprometes a <strong className="text-foreground">enviar el producto al ganador</strong> una vez cobrada. El incumplimiento puede resultar en suspensión de tu cuenta.
              </p>
            </div>
          </div>

          {/* Publication process */}
          <div className="bg-secondary/30 border border-border rounded-xl p-4 text-xs">
            <p className="font-bold text-foreground mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">ℹ️</span>
              Proceso de publicación
            </p>
            {isGoldPlus ? (
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Envías tu producto → <strong className="text-foreground">Activa</strong> (publicación directa)</li>
                <li>Finaliza la subasta → Recibes datos del ganador</li>
                <li>El departamento de cobranza gestiona el pago</li>
                <li>Envías el producto → Se libera el pago</li>
              </ol>
            ) : (
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Envías tu producto → <strong className="text-foreground">Pendiente</strong></li>
                <li>El admin revisa → <strong className="text-foreground">En Revisión</strong></li>
                <li>El admin aprueba → <strong className="text-foreground">Activa</strong></li>
                <li>Finaliza → Recibes datos del ganador</li>
                <li>Se gestiona el pago → Envías → Pago liberado</li>
              </ol>
            )}
            {isGoldPlus && (
              <p className="text-[10px] text-amber-500 mt-2">⚠️ El admin puede pausar tu subasta si detecta irregularidades.</p>
            )}
          </div>

          {/* Support */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">¿Necesitas ayuda con tu publicación?</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs rounded-xl shrink-0 font-bold hover:border-primary/30"
              onClick={() => navigate("/contacto")}
            >
              <Headphones className="h-3.5 w-3.5 mr-1.5" />
              Soporte
            </Button>
          </div>
        </div>

        {/* ── SUBMIT ── */}
        <Button type="submit" disabled={creating || imageFiles.length < 1} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-xl h-12 text-sm shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all">
          {creating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploading ? "Subiendo fotos..." : "Enviando..."}</>
          ) : (
            isGoldPlus ? "🚀 Publicar Subasta" : "📤 Enviar a Revisión"
          )}
        </Button>
      </form>
    </div>
  );
}
