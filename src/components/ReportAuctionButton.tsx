import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Flag, Loader2, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REPORT_REASONS = [
  { value: "contact_info", label: "Datos de contacto en fotos o descripción" },
  { value: "misleading_images", label: "Imágenes engañosas o editadas" },
  { value: "prohibited_item", label: "Producto de categoría prohibida" },
  { value: "external_deal", label: "Intento de cerrar trato fuera de la plataforma" },
  { value: "fake_description", label: "Descripción falsa o incompleta" },
  { value: "other", label: "Otro motivo" },
];

interface ReportAuctionButtonProps {
  auctionId: string;
}

const ReportAuctionButton = ({ auctionId }: ReportAuctionButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!user || submitted) {
    return submitted ? (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <CheckCircle className="h-3.5 w-3.5 text-primary" />
        Reporte enviado. Gracias por ayudarnos.
      </div>
    ) : null;
  }

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Selecciona un motivo", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("auction_reports" as any).insert({
      auction_id: auctionId,
      reporter_id: user.id,
      reason,
      details: details.trim() || null,
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Ya reportaste este aviso", description: "Solo puedes reportar una vez por subasta." });
        setSubmitted(true);
      } else {
        toast({ title: "Error al enviar reporte", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "¡Reporte enviado!", description: "Nuestro equipo revisará este aviso. Gracias." });
      setSubmitted(true);
      // Notify admins via push (fire-and-forget)
      const reasonLabel = REPORT_REASONS.find(r => r.value === reason)?.label || reason;
      supabase.functions.invoke("send-push-notification", {
        body: {
          type: "report",
          auctionId,
          auctionTitle: `Aviso reportado`,
          message: `Motivo: ${reasonLabel}`,
        },
      });
    }
    setSubmitting(false);
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Flag className="h-3.5 w-3.5" />
        Reportar aviso
      </Button>
    );
  }

  return (
    <div className="border border-destructive/20 rounded-sm p-4 space-y-3 bg-destructive/5">
      <h4 className="text-sm font-heading font-bold flex items-center gap-2">
        <Flag className="h-4 w-4 text-destructive" />
        Reportar este aviso
      </h4>
      <p className="text-xs text-muted-foreground">
        Si este aviso infringe las políticas de publicación, repórtalo y nuestro equipo lo revisará.
      </p>
      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="rounded-sm text-sm">
          <SelectValue placeholder="¿Cuál es el motivo?" />
        </SelectTrigger>
        <SelectContent>
          {REPORT_REASONS.map((r) => (
            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Detalles adicionales (opcional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={500}
        className="rounded-sm text-sm resize-none"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-sm text-xs"
          onClick={() => { setOpen(false); setReason(""); setDetails(""); }}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="rounded-sm text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Flag className="h-3.5 w-3.5 mr-1" />}
          Enviar Reporte
        </Button>
      </div>
    </div>
  );
};

export default ReportAuctionButton;
