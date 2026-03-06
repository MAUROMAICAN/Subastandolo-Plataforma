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
    <Card className="border border-border rounded-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <Plus className="h-4 w-4 text-primary" />
          Publicar Producto para Subasta
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {isGoldPlus
            ? "Como dealer de nivel Oro o superior, tus subastas se publican directamente sin necesidad de revisión."
            : "Tu producto será revisado por un administrador antes de ser publicado. Selecciona la duración deseada y el administrador podrá ajustarla si lo considera necesario."
          }
          {" "}
          <a href="/politicas-publicacion" target="_blank" className="text-primary underline underline-offset-2 font-medium hover:text-primary/80">
            Ver Políticas de Publicación
          </a>
        </p>
        {isGoldPlus && (
          <Badge variant="outline" className="mt-1 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/25">
            ⚡ Publicación Directa
          </Badge>
        )}
        {isDuplicate && (
          <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-sm p-3">
            <Copy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-600 dark:text-amber-400">📋 Borrador basado en una publicación anterior</p>
              <p className="text-muted-foreground mt-0.5">El título, descripción y precio han sido copiados. <strong className="text-foreground">Debes realizar cambios</strong> (ej. nuevas fotos, ajustar precio o descripción) antes de enviarla a revisión.</p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Título del Producto *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ej: Refrigerador Samsung 2024" className="rounded-sm" maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descripción del Producto *</Label>
            <textarea
              ref={descTextareaRef}
              value={description}
              required
              maxLength={2000}
              lang="es"
              spellCheck={true}
              placeholder="Describe detalladamente el producto: condición, características, modelo, etc."
              rows={8}
              className="flex w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
              style={{ minHeight: "12rem" }}
              onChange={(e) => {
                setDescription(e.target.value);
                autoResizeTextarea();
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Precio Inicial ($) *</Label>
            <Input type="number" min="1" step="0.01" value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} required placeholder="100" className="rounded-sm max-w-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Estado del Producto *</Label>
            <div className="grid grid-cols-3 gap-2 max-w-sm">
              {([
                { value: "nuevo", label: "Nuevo", emoji: "✨", desc: "Sin uso" },
                { value: "usado_buen_estado", label: "Usado", emoji: "👍", desc: "Buen estado" },
                { value: "para_reparar", label: "Para reparar", emoji: "🔧", desc: "Necesita reparación" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProductCondition(opt.value)}
                  className={`flex flex-col items-center gap-0.5 rounded-sm border p-2.5 text-center transition-all ${productCondition === opt.value
                      ? "border-primary bg-primary/10 text-primary dark:border-[#A6E300] dark:bg-[#A6E300]/10 dark:text-[#A6E300]"
                      : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                >
                  <span className="text-lg leading-none">{opt.emoji}</span>
                  <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Duración deseada de la Subasta *</Label>
            <select
              value={auctionDuration}
              onChange={(e) => setAuctionDuration(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                ? "Como dealer nivel Oro o superior, tu subasta se publica directamente con esta duración."
                : "El administrador revisará tu solicitud y podrá ajustar la duración si lo considera necesario."
              }
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Fecha de inicio programada (opcional)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="max-w-xs rounded-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              La fecha y el tiempo de publicación serán tomados en cuenta para activar la subasta. Si dejas la fecha vacía o algún campo sin completar, el departamento de revisión podrá activarla sin necesidad de confirmación. El tiempo mínimo de duración será de 1 día.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Fotos del Producto * (mínimo 1, máximo 10)</Label>
            <label className="flex items-center gap-2 px-4 py-3 rounded-sm border border-dashed border-primary/40 text-sm text-primary cursor-pointer hover:bg-primary/5 transition-colors w-full justify-center">
              <Upload className="h-4 w-4" />
              Seleccionar fotos ({imageFiles.length}/10)
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            </label>

            {imageFiles.length > 0 && (
              <>
                <p className="text-[10px] text-muted-foreground">Arrastra las imágenes para reordenar. La primera será la principal.</p>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {imageFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${file.size}-${index}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                      className={`relative group aspect-square rounded-sm overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${dragOverIndex === index ? "border-primary scale-105" : dragIndex === index ? "border-primary/50 opacity-50" : "border-border"
                        }`}
                    >
                      <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover pointer-events-none" />
                      <span className="absolute top-1 left-1 w-5 h-5 bg-background/80 text-foreground rounded-full flex items-center justify-center text-[10px] font-bold">{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[9px] text-center py-0.5">Principal</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-destructive/5 border border-destructive/15 rounded-sm p-3 text-xs space-y-1.5">
            <p className="font-semibold text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Compromiso del Vendedor
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Al publicar una subasta, te comprometes a <strong className="text-foreground">enviar el producto al ganador</strong> una vez finalizada y cobrada la subasta.
              El incumplimiento puede resultar en la suspensión de tu cuenta y acciones legales.
            </p>
          </div>

          <div className="bg-secondary/50 rounded-sm p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">ℹ️ Proceso de publicación:</p>
            {isGoldPlus ? (
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>Envías tu producto → Estado: <strong>Activa</strong> (publicación directa por tu nivel de confianza)</li>
                <li>Finaliza la subasta → Recibes datos del ganador</li>
                <li>El departamento de cobranza gestiona el pago</li>
                <li>Envías el producto → Se libera el pago</li>
              </ol>
            ) : (
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>Envías tu producto → Estado: <strong>Pendiente</strong></li>
                <li>El admin revisa fotos y detalles → Estado: <strong>En Revisión</strong></li>
                <li>El admin aprueba y asigna el tiempo de subasta → Estado: <strong>Activa</strong></li>
                <li>Finaliza la subasta → Recibes datos del ganador</li>
                <li>El departamento de cobranza gestiona el pago</li>
                <li>Envías el producto → Se libera el pago</li>
              </ol>
            )}
            {isGoldPlus && (
              <p className="text-[10px] text-primary mt-1">⚠️ Nota: El administrador puede pausar tu subasta si detecta alguna irregularidad.</p>
            )}
          </div>

          <div className="bg-primary/5 border border-primary/15 rounded-sm p-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              <p>¿Tienes un error en tu publicación o necesitas ayuda?</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs rounded-sm shrink-0"
              onClick={() => navigate("/contacto")}
            >
              <Headphones className="h-3.5 w-3.5 mr-1" />
              Contactar Soporte
            </Button>
          </div>

          <Button type="submit" disabled={creating || imageFiles.length < 1} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
            {creating ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploading ? "Subiendo fotos..." : "Enviando..."}</>
            ) : (
              isGoldPlus ? "🚀 Publicar Subasta" : "Enviar a Revisión"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
