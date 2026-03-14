import { useState } from "react";
import { useMarketplaceDisputes, MARKETPLACE_DISPUTE_REASONS } from "@/hooks/useMarketplaceDisputes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, ArrowLeft, CheckCircle2, Loader2, ImageIcon, AlertTriangle,
} from "lucide-react";

interface Props {
  orderId: string;
  productId: string;
  sellerId: string;
  productTitle: string;
  onBack: () => void;
  onCreated: () => void;
}

export default function MarketplaceDisputeForm({ orderId, productId, sellerId, productTitle, onBack, onCreated }: Props) {
  const { createDispute } = useMarketplaceDisputes("buyer");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !description.trim()) return;
    setSubmitting(true);
    const result = await createDispute(orderId, productId, sellerId, reason, description, files);
    setSubmitting(false);
    if (result) {
      setSubmitted(true);
      setTimeout(() => onCreated(), 2000);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h2 className="font-heading font-bold text-lg mb-2">Disputa creada exitosamente</h2>
        <p className="text-sm text-muted-foreground">
          El vendedor tiene <strong>3 días</strong> para responder. Te notificaremos cuando haya novedades.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Volver
      </Button>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-sm">Abrir Disputa</h2>
              <p className="text-xs text-muted-foreground truncate max-w-[250px]">{productTitle}</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Reason selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold">¿Cuál es el motivo? <span className="text-destructive">*</span></label>
            <div className="space-y-2">
              {MARKETPLACE_DISPUTE_REASONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    reason === r.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <span className="text-lg">{r.icon}</span>
                  <span className="text-sm font-medium">{r.label}</span>
                  {reason === r.value && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold">Describe el problema <span className="text-destructive">*</span></label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Explica con detalle: qué esperabas, qué recibiste, cuándo ocurrió el problema..."
              rows={4}
              className="rounded-xl"
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground text-right">{description.length}/2000</p>
          </div>

          {/* Evidence */}
          <div className="space-y-2">
            <label className="text-xs font-bold">Adjuntar evidencia (fotos)</label>
            <label className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border hover:border-primary/30 cursor-pointer transition-colors bg-muted/20">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{files.length > 0 ? `${files.length} archivo(s) seleccionado(s)` : "Seleccionar fotos"}</p>
                <p className="text-[10px] text-muted-foreground">Fotos del producto, capturas de pantalla, etc.</p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files && setFiles(Array.from(e.target.files))}
              />
            </label>
            {files.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {files.map((f, i) => (
                  <div key={i} className="h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0">
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Las disputas falsas o reiteradas sin fundamento pueden afectar tu cuenta. La Garantía Subastandolo protege compradores legítimos.
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!reason || !description.trim() || submitting}
            className="w-full rounded-xl font-bold py-6 text-sm"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            Enviar Disputa
          </Button>
        </div>
      </div>
    </div>
  );
}
