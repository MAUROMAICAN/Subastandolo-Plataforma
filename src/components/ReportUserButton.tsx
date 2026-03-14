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
  { value: "harassment", label: "Acoso o amenazas" },
  { value: "fraud", label: "Fraude o estafa" },
  { value: "fake_identity", label: "Identidad falsa o suplantación" },
  { value: "manipulation", label: "Manipulación de reseñas o pujas" },
  { value: "other", label: "Otro motivo" },
];

interface ReportUserButtonProps {
  userId: string;
  userName?: string;
}

const ReportUserButton = ({ userId, userName }: ReportUserButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Don't show if not logged in, already submitted, or reporting self
  if (!user || submitted || user.id === userId) {
    return submitted ? (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <CheckCircle className="h-3.5 w-3.5 text-primary" />
        Reporte enviado. Gracias por ayudarnos a mantener la comunidad segura.
      </div>
    ) : null;
  }

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Selecciona un motivo", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("user_reports" as any).insert({
      reporter_id: user.id,
      reported_user_id: userId,
      reason,
      details: details.trim() || null,
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Ya reportaste a este usuario", description: "Solo puedes reportar una vez por usuario." });
        setSubmitted(true);
      } else {
        toast({ title: "Error al enviar reporte", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "¡Reporte enviado!", description: "Nuestro equipo revisará este caso. Gracias." });
      setSubmitted(true);
      // Notify admins (fire-and-forget)
      supabase.functions.invoke("send-push-notification", {
        body: {
          type: "report",
          auctionId: userId,
          auctionTitle: `Usuario reportado: ${userName || "Desconocido"}`,
          message: `Motivo: ${REPORT_REASONS.find(r => r.value === reason)?.label || reason}`,
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
        Reportar usuario
      </Button>
    );
  }

  return (
    <div className="border border-destructive/20 rounded-xl p-4 space-y-3 bg-destructive/5">
      <h4 className="text-sm font-heading font-bold flex items-center gap-2">
        <Flag className="h-4 w-4 text-destructive" />
        Reportar a {userName || "este usuario"}
      </h4>
      <p className="text-xs text-muted-foreground">
        Si este usuario ha violado las normas de la comunidad, envía un reporte y nuestro equipo tomará acción.
      </p>
      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger className="rounded-lg text-sm">
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
        className="rounded-lg text-sm resize-none"
        rows={2}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg text-xs"
          onClick={() => { setOpen(false); setReason(""); setDetails(""); }}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          className="rounded-lg text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

export default ReportUserButton;
