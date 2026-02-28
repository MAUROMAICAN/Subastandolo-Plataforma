import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { useDisputes, type Dispute } from "@/hooks/useDisputes";
import DisputeChat from "@/components/DisputeChat";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowLeft, AlertTriangle, Clock, CheckCircle, Shield, Scale, ChevronRight, ImageIcon,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Abierta", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertTriangle },
  mediation: { label: "En Mediación", color: "bg-primary/10 text-primary border-primary/20", icon: Scale },
  resolved: { label: "Resuelta", color: "bg-primary/10 text-primary border-primary/20", icon: CheckCircle },
  refunded: { label: "Reembolsada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: Shield },
};

const DisputeCenter = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { disputes, loading, requestAdminIntervention } = useDisputes();
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const loadEvidence = async (urls: string[]) => {
    setLoadingEvidence(true);
    const signed: string[] = [];
    for (const path of urls) {
      const { data } = await supabase.storage.from("dispute-evidence").createSignedUrl(path, 3600);
      if (data?.signedUrl) signed.push(data.signedUrl);
    }
    setEvidenceUrls(signed);
    setLoadingEvidence(false);
  };

  const handleSelect = (d: Dispute) => {
    setSelectedDispute(d);
    if (d.evidence_urls.length > 0) loadEvidence(d.evidence_urls);
    else setEvidenceUrls([]);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (selectedDispute) {
    const sc = STATUS_CONFIG[selectedDispute.status] || STATUS_CONFIG.open;
    const Icon = sc.icon;
    const deadlinePassed = selectedDispute.dealer_deadline && new Date(selectedDispute.dealer_deadline).getTime() < Date.now();

    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-4 max-w-3xl">
          <button onClick={() => setSelectedDispute(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-3 w-3" /> Volver a disputas
          </button>

          <div className="bg-card border border-border rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm">{selectedDispute.auction_title}</h2>
                <p className="text-xs text-muted-foreground">{selectedDispute.category}</p>
              </div>
              <Badge variant="outline" className={sc.color}>
                <Icon className="h-3 w-3 mr-1" />
                {sc.label}
              </Badge>
            </div>

            <div className="p-4 border-b border-border space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Comprador: <strong className="text-foreground">{selectedDispute.buyer_name}</strong></span>
                <span>Dealer: <strong className="text-foreground">{selectedDispute.dealer_name}</strong></span>
              </div>
              <p className="text-sm">{selectedDispute.description}</p>

              {selectedDispute.dealer_deadline && (
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  <span className={deadlinePassed ? "text-destructive font-semibold" : "text-muted-foreground"}>
                    Plazo del dealer: {new Date(selectedDispute.dealer_deadline).toLocaleString("es-MX")}
                    {deadlinePassed && " — VENCIDO"}
                  </span>
                </div>
              )}

              {selectedDispute.resolution && (
                <div className="bg-primary/10 border border-primary/20 rounded-sm p-3 text-sm">
                  <strong>Resolución:</strong> {selectedDispute.resolution}
                </div>
              )}
            </div>

            {/* Evidence */}
            {selectedDispute.evidence_urls.length > 0 && (
              <div className="p-4 border-b border-border">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Evidencia ({selectedDispute.evidence_urls.length})
                </h4>
                {loadingEvidence ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="flex gap-2 overflow-x-auto">
                    {evidenceUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Evidencia ${i + 1}`} className="h-20 w-20 object-cover rounded-sm border border-border" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chat */}
            <DisputeChat disputeId={selectedDispute.id} disputeStatus={selectedDispute.status} />

            {/* Request admin intervention */}
            {selectedDispute.status === "open" && selectedDispute.buyer_id === user.id && !selectedDispute.admin_requested && (
              <div className="p-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
                  onClick={() => requestAdminIntervention(selectedDispute.id)}
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Solicitar Intervención del Administrador
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-4 max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <button onClick={() => navigate("/")} className="hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Inicio
          </button>
          <span>/</span>
          <span className="text-foreground">Centro de Disputas</span>
        </div>

        <h1 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Centro de Disputas
        </h1>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : disputes.length === 0 ? (
          <div className="bg-card border border-border rounded-sm p-8 text-center">
            <CheckCircle className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="font-heading font-bold">Sin disputas</p>
            <p className="text-sm text-muted-foreground mt-1">No tienes disputas abiertas.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {disputes.map(d => {
              const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.open;
              const Icon = sc.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => handleSelect(d)}
                  className="w-full bg-card border border-border rounded-sm p-4 text-left hover:border-primary/30 transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-heading font-bold text-sm truncate">{d.auction_title}</p>
                    <p className="text-xs text-muted-foreground">{d.category}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(d.created_at).toLocaleDateString("es-MX")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge variant="outline" className={sc.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {sc.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Legal notice */}
        <div className="mt-6 bg-muted/50 border border-border rounded-sm p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">📜 Garantía de Subasta Segura</p>
          <p><strong>Para el Comprador:</strong> Si el producto no coincide con la descripción, tienes 72 horas tras recibirlo para abrir una disputa. Los fondos del Dealer permanecerán retenidos hasta que se resuelva el caso.</p>
          <p><strong>Para el Dealer:</strong> Si el comprador abre una disputa injustificada, puedes presentar tus pruebas de envío y fotos del estado del producto antes de ser enviado para proteger tu pago y tu reputación.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DisputeCenter;
