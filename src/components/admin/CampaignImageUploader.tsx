import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, Upload, Loader2, X, CircleCheck } from "lucide-react";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const MAX_SIZE_BYTES = 450 * 1024;

interface CampaignImageUploaderProps {
  onUploadComplete: (url: string) => void;
  existingUrl?: string | null;
  onClear?: () => void;
}

/**
 * Loads a File into an HTMLImageElement.
 */
const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error("No se pudo leer la imagen")); };
    img.src = URL.createObjectURL(file);
  });

/**
 * Normaliza la imagen a 1080x1920 sin recortar contenido (contain) y
 * aplica compresión adaptativa para mantener buen peso/rendimiento.
 */
const processImage = async (file: File): Promise<Blob> => {
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No se pudo iniciar el procesador de imagen");
  }

  // Fondo suavizado para evitar bandas vacías cuando la imagen no es 9:16
  const bgScale = Math.max(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
  const bgW = img.width * bgScale;
  const bgH = img.height * bgScale;
  const bgX = (TARGET_WIDTH - bgW) / 2;
  const bgY = (TARGET_HEIGHT - bgH) / 2;

  ctx.save();
  ctx.filter = "blur(22px) brightness(0.65)";
  ctx.drawImage(img, bgX, bgY, bgW, bgH);
  ctx.restore();

  // Capa principal sin recorte (contain)
  const scale = Math.min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const drawX = (TARGET_WIDTH - drawW) / 2;
  const drawY = (TARGET_HEIGHT - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);

  // Compresión adaptativa en WebP para máximo detalle con menor peso
  let quality = 0.92;
  let blob: Blob | null = null;

  while (quality >= 0.5) {
    blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality)
    );

    if (blob && blob.size <= MAX_SIZE_BYTES) break;
    quality -= 0.06;
  }

  if (!blob) throw new Error("Error al comprimir la imagen");
  return blob;
};

const CampaignImageUploader = ({ onUploadComplete, existingUrl, onClear }: CampaignImageUploaderProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);

  const uploadFile = useCallback(async (file: File) => {
    // Format check
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Formato no válido", description: "Solo se permiten archivos .jpg, .jpeg, .png o .webp.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      // Auto-resize & compress
      setProgress(20);
      const processedBlob = await processImage(file);
      setProgress(50);

      const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`;

      const { error } = await supabase.storage
        .from("campanas_ads")
        .upload(fileName, processedBlob, { contentType: "image/webp" });

      if (error) {
        toast({ title: "Error al subir", description: error.message, variant: "destructive" });
        setUploading(false);
        setProgress(0);
        return;
      }

      setProgress(80);

      const { data: urlData } = supabase.storage.from("campanas_ads").getPublicUrl(fileName);

      setProgress(100);
      setPreviewUrl(urlData.publicUrl);
      onUploadComplete(urlData.publicUrl);

      const sizeKB = Math.round(processedBlob.size / 1024);
      toast({ title: "✅ Imagen optimizada y subida", description: `Redimensionada a ${TARGET_WIDTH}×${TARGET_HEIGHT} · ${sizeKB} KB` });

      setTimeout(() => { setUploading(false); setProgress(0); }, 600);
    } catch (err: any) {
      toast({ title: "Error procesando imagen", description: err.message, variant: "destructive" });
      setUploading(false);
      setProgress(0);
    }
  }, [onUploadComplete, toast]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleClear = () => {
    setPreviewUrl(null);
    onClear?.();
    if (inputRef.current) inputRef.current.value = "";
  };

  // Show preview
  if (previewUrl && !uploading) {
    return (
      <div className="relative group">
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
          <img src={previewUrl} alt="Vista previa del flyer" className="w-full max-h-[320px] object-contain mx-auto" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600">
            <CircleCheck className="h-3.5 w-3.5" />
            <span>Imagen optimizada · {TARGET_WIDTH}×{TARGET_HEIGHT}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="text-xs text-muted-foreground hover:text-destructive h-7">
            <X className="h-3 w-3 mr-1" /> Cambiar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer
          ${dragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-muted-foreground/25 bg-muted/20 hover:border-primary/50 hover:bg-primary/5"}
          ${uploading ? "pointer-events-none opacity-70" : ""}
        `}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Optimizando y subiendo…</p>
            <Progress value={progress} className="h-2 w-full max-w-[200px]" />
            <p className="text-[10px] text-muted-foreground">{progress}%</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Arrastra tu imagen aquí</p>
              <p className="text-xs text-muted-foreground mt-1">o haz clic para seleccionar</p>
            </div>
            <Button
              type="button" variant="outline" size="sm"
              className="rounded-full text-xs gap-1.5 mt-1"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            >
              <ImagePlus className="h-3.5 w-3.5" /> Seleccionar Imagen
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1">
              <span>JPG / PNG / WEBP</span>
              <span>•</span>
              <span>9:16 completo + optimización automática</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CampaignImageUploader;
