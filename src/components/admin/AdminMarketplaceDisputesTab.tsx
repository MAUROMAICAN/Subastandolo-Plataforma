import { useState } from "react";
import { useMarketplaceDisputes, MARKETPLACE_DISPUTE_REASONS, DISPUTE_STATUS_CONFIG, type MarketplaceDispute } from "@/hooks/useMarketplaceDisputes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ArrowLeft, ShieldCheck, AlertTriangle, Clock, CheckCircle2,
  Scale, ChevronRight, Send, User, Store
} from "lucide-react";

export default function AdminMarketplaceDisputesTab() {
  const { disputes, loading, resolveDispute } = useMarketplaceDisputes("admin");
  const [selected, setSelected] = useState<MarketplaceDispute | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolutionType, setResolutionType] = useState("full_refund");
  const [inFavorOf, setInFavorOf] = useState<"buyer" | "seller">("buyer");
  const [refundAmount, setRefundAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const filteredDisputes = filter === "all" ? disputes : disputes.filter(d => d.status === filter);

  const handleResolve = async () => {
    if (!selected || !resolution.trim()) return;
    setSubmitting(true);
    await resolveDispute(selected.id, inFavorOf, resolutionType, resolution, refundAmount ? parseFloat(refundAmount) : undefined);
    setSubmitting(false);
    setResolution("");
    setSelected(null);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Detail / mediation view
  if (selected) {
    const sc = DISPUTE_STATUS_CONFIG[selected.status] || DISPUTE_STATUS_CONFIG.open;
    const reasonLabel = MARKETPLACE_DISPUTE_REASONS.find(r => r.value === selected.reason)?.label || selected.reason;
    const deadlinePassed = selected.seller_deadline && new Date(selected.seller_deadline).getTime() < Date.now();
    const isResolved = selected.status.startsWith("resolved");

    return (
      <div className="max-w-3xl mx-auto animate-fade-in space-y-4">
        <Button variant="ghost" onClick={() => setSelected(null)} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Volver a disputas
        </Button>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
            <div>
              <h2 className="font-heading font-bold text-sm">{selected.product_title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{reasonLabel}</p>
            </div>
            <Badge variant="outline" className={sc.color}>{sc.label}</Badge>
          </div>

          {/* Parties */}
          <div className="p-5 border-b border-border grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Comprador</p>
                <p className="text-sm font-bold">{selected.buyer_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Vendedor</p>
                <p className="text-sm font-bold">{selected.seller_name}</p>
              </div>
            </div>
          </div>

          {/* Buyer's complaint */}
          <div className="p-5 border-b border-border space-y-3">
            <h4 className="text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Reclamo del comprador
            </h4>
            {selected.description && (
              <p className="text-sm bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">{selected.description}</p>
            )}
            {selected.seller_deadline && (
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3 w-3" />
                <span className={deadlinePassed ? "text-destructive font-bold" : "text-muted-foreground"}>
                  Plazo vendedor: {new Date(selected.seller_deadline).toLocaleString("es-MX")}
                  {deadlinePassed && " — VENCIDO"}
                </span>
              </div>
            )}
          </div>

          {/* Seller's response */}
          <div className="p-5 border-b border-border space-y-2">
            <h4 className="text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Respuesta del vendedor
            </h4>
            {selected.seller_response ? (
              <p className="text-sm bg-green-500/5 border border-green-500/20 rounded-lg p-3">{selected.seller_response}</p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {deadlinePassed ? "El vendedor no respondió dentro del plazo." : "Esperando respuesta del vendedor..."}
              </p>
            )}
          </div>

          {/* Existing resolution */}
          {selected.resolution && (
            <div className="p-5 border-b border-border">
              <h4 className="text-xs font-bold flex items-center gap-1.5 mb-2">
                <Scale className="h-3.5 w-3.5 text-primary" /> Resolución aplicada
              </h4>
              <p className="text-sm bg-primary/5 border border-primary/20 rounded-lg p-3">{selected.resolution}</p>
              {selected.refund_amount && (
                <p className="text-xs text-muted-foreground mt-1">Reembolso: <strong className="text-foreground">${selected.refund_amount}</strong></p>
              )}
            </div>
          )}

          {/* Mediation form (only if not resolved) */}
          {!isResolved && (
            <div className="p-5 space-y-4 bg-secondary/5">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" /> Mediar y Resolver
              </h4>

              {/* In favor of */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setInFavorOf("buyer")}
                  className={`p-3 rounded-xl border text-sm font-bold text-center transition-all ${
                    inFavorOf === "buyer" ? "border-blue-500 bg-blue-500/5 text-blue-600" : "border-border hover:border-blue-300"
                  }`}
                >
                  👤 A favor del comprador
                </button>
                <button
                  onClick={() => setInFavorOf("seller")}
                  className={`p-3 rounded-xl border text-sm font-bold text-center transition-all ${
                    inFavorOf === "seller" ? "border-emerald-500 bg-emerald-500/5 text-emerald-600" : "border-border hover:border-emerald-300"
                  }`}
                >
                  🏪 A favor del vendedor
                </button>
              </div>

              {/* Resolution type */}
              {inFavorOf === "buyer" && (
                <div className="space-y-2">
                  <label className="text-xs font-bold">Tipo de resolución</label>
                  <select
                    value={resolutionType}
                    onChange={e => setResolutionType(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="full_refund">Reembolso completo</option>
                    <option value="partial_refund">Reembolso parcial</option>
                    <option value="replacement">Reemplazo del producto</option>
                    <option value="return_and_refund">Devolución + reembolso</option>
                  </select>
                  {(resolutionType === "partial_refund") && (
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      placeholder="Monto (USD)"
                      className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  )}
                </div>
              )}

              <Textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                placeholder="Escribe la resolución detallada... (visible para ambas partes)"
                rows={3}
                className="rounded-xl"
              />

              <Button
                onClick={handleResolve}
                disabled={!resolution.trim() || submitting}
                className="w-full rounded-xl font-bold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scale className="h-4 w-4 mr-2" />}
                Resolver Disputa
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-heading font-bold">Disputas del Marketplace</h2>
            <p className="text-sm text-muted-foreground">{disputes.length} disputa{disputes.length !== 1 ? "s" : ""} en total</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "Todas" },
          { value: "open", label: "Abiertas" },
          { value: "seller_responded", label: "Respondidas" },
          { value: "in_mediation", label: "En mediación" },
          { value: "resolved_buyer", label: "✅ Comprador" },
          { value: "resolved_seller", label: "✅ Vendedor" },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all font-bold ${
              filter === f.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredDisputes.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
          <p className="font-heading font-bold">Sin disputas {filter !== "all" ? "con este filtro" : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDisputes.map(d => {
            const sc = DISPUTE_STATUS_CONFIG[d.status] || DISPUTE_STATUS_CONFIG.open;
            const reasonLabel = MARKETPLACE_DISPUTE_REASONS.find(r => r.value === d.reason)?.label || d.reason;
            const deadlinePassed = d.seller_deadline && new Date(d.seller_deadline).getTime() < Date.now();
            return (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary/30 transition-colors flex items-center justify-between group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-heading font-bold text-sm truncate">{d.product_title}</p>
                    {deadlinePassed && d.status === "open" && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">VENCIDO</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{reasonLabel}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>👤 {d.buyer_name}</span>
                    <span>🏪 {d.seller_name}</span>
                    <span>• {new Date(d.created_at).toLocaleDateString("es-MX")}</span>
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
