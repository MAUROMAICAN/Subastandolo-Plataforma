import { useState } from "react";
import { useMarketplaceDisputes, MARKETPLACE_DISPUTE_REASONS, DISPUTE_STATUS_CONFIG, type MarketplaceDispute } from "@/hooks/useMarketplaceDisputes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ArrowLeft, ShieldCheck, AlertTriangle, Clock, CheckCircle2, Scale,
  MessageSquare, ChevronRight, Send, ImageIcon
} from "lucide-react";

interface Props {
  dealerId: string;
}

export default function DealerStoreDisputesTab({ dealerId: _dealerId }: Props) {
  const { disputes, loading, respondAseSeller } = useMarketplaceDisputes("seller");
  const [selected, setSelected] = useState<MarketplaceDispute | null>(null);
  const [response, setResponse] = useState("");
  const [responseFiles, setResponseFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleRespond = async () => {
    if (!selected || !response.trim()) return;
    setSubmitting(true);
    await respondAseSeller(selected.id, response, responseFiles);
    setSubmitting(false);
    setResponse("");
    setResponseFiles([]);
    setSelected(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Detail view
  if (selected) {
    const sc = DISPUTE_STATUS_CONFIG[selected.status] || DISPUTE_STATUS_CONFIG.open;
    const reasonLabel = MARKETPLACE_DISPUTE_REASONS.find(r => r.value === selected.reason)?.label || selected.reason;
    const deadlinePassed = selected.seller_deadline && new Date(selected.seller_deadline).getTime() < Date.now();
    const canRespond = selected.status === "open" && !deadlinePassed;

    return (
      <div className="max-w-3xl mx-auto animate-fade-in space-y-4">
        <Button variant="ghost" onClick={() => setSelected(null)} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a disputas
        </Button>

        <Card className="border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-heading font-bold text-sm">{selected.product_title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{reasonLabel}</p>
            </div>
            <Badge variant="outline" className={sc.color}>{sc.label}</Badge>
          </div>

          {/* Details */}
          <div className="p-5 space-y-3 border-b border-border">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Comprador: <strong className="text-foreground">{selected.buyer_name}</strong></span>
              <span>{new Date(selected.created_at).toLocaleDateString("es-MX")}</span>
            </div>
            {selected.description && (
              <p className="text-sm bg-muted/50 rounded-lg p-3">{selected.description}</p>
            )}
            {selected.seller_deadline && (
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3" />
                <span className={deadlinePassed ? "text-destructive font-semibold" : "text-muted-foreground"}>
                  Plazo para responder: {new Date(selected.seller_deadline).toLocaleString("es-MX")}
                  {deadlinePassed && " — VENCIDO"}
                </span>
              </div>
            )}
          </div>

          {/* Your response (if already responded) */}
          {selected.seller_response && (
            <div className="p-5 border-b border-border">
              <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Tu respuesta
              </h4>
              <p className="text-sm bg-green-500/5 border border-green-500/20 rounded-lg p-3">{selected.seller_response}</p>
            </div>
          )}

          {/* Resolution */}
          {selected.resolution && (
            <div className="p-5 border-b border-border">
              <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-primary" /> Resolución
              </h4>
              <p className="text-sm bg-primary/5 border border-primary/20 rounded-lg p-3">{selected.resolution}</p>
              {selected.refund_amount && (
                <p className="text-xs text-muted-foreground mt-1">Monto de reembolso: <strong className="text-foreground">${selected.refund_amount}</strong></p>
              )}
            </div>
          )}

          {/* Respond form (only if open and not expired) */}
          {canRespond && !selected.seller_response && (
            <div className="p-5 space-y-3">
              <h4 className="text-xs font-bold flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Responder al comprador
              </h4>
              <Textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Explica tu posición: evidencia de envío, fotos del producto antes de enviar, etc."
                rows={4}
                className="rounded-xl"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                  <ImageIcon className="h-4 w-4" />
                  <span>{responseFiles.length > 0 ? `${responseFiles.length} archivo(s)` : "Adjuntar evidencia"}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files && setResponseFiles(Array.from(e.target.files))}
                  />
                </label>
                <Button
                  onClick={handleRespond}
                  disabled={!response.trim() || submitting}
                  className="rounded-xl"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar Respuesta
                </Button>
              </div>
            </div>
          )}

          {/* Deadline passed warning */}
          {deadlinePassed && !selected.seller_response && selected.status === "open" && (
            <div className="p-5 bg-destructive/5 border-t border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  El plazo para responder ha vencido. La disputa puede resolverse automáticamente a favor del comprador.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-heading font-bold">Disputas de Marketplace</h2>
          <p className="text-sm text-muted-foreground">Gestiona los reclamos de compradores sobre tus productos.</p>
        </div>
      </div>

      {disputes.length === 0 ? (
        <Card className="border rounded-2xl">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="font-heading font-bold">Sin disputas</p>
            <p className="text-sm text-muted-foreground mt-1">No tienes disputas pendientes. ¡Excelente reputación!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {disputes.map(d => {
            const sc = DISPUTE_STATUS_CONFIG[d.status] || DISPUTE_STATUS_CONFIG.open;
            const reasonLabel = MARKETPLACE_DISPUTE_REASONS.find(r => r.value === d.reason)?.label || d.reason;
            return (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors flex items-center justify-between group"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold text-sm truncate">{d.product_title}</p>
                  <p className="text-xs text-muted-foreground">{reasonLabel}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">Comprador: {d.buyer_name}</span>
                    <span className="text-[10px] text-muted-foreground">• {new Date(d.created_at).toLocaleDateString("es-MX")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <Badge variant="outline" className={sc.color}>{sc.label}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
