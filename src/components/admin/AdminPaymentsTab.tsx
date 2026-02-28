import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Eye, CheckCircle, XCircle, Loader2, Download } from "lucide-react";

interface Props {
  paymentProofs: any[];
  fetchAllData: () => Promise<void>;
}

const AdminPaymentsTab = ({ paymentProofs, fetchAllData }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [proofImagePreview, setProofImagePreview] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);

  const getSignedUrl = async (proofUrl: string): Promise<string | null> => {
    let filePath = proofUrl;
    // If it's a full URL, extract the relative path from it
    if (proofUrl.startsWith("http")) {
      const marker = "/object/public/payment-proofs/";
      const idx = proofUrl.indexOf(marker);
      if (idx !== -1) {
        filePath = proofUrl.substring(idx + marker.length);
      } else {
        // Try signed URL marker too
        const signedMarker = "/object/sign/payment-proofs/";
        const sIdx = proofUrl.indexOf(signedMarker);
        if (sIdx !== -1) {
          filePath = proofUrl.substring(sIdx + signedMarker.length).split("?")[0];
        }
      }
    }
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(filePath, 864000); // 10 días
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  const handleViewProof = async (proofUrl: string) => {
    setProofLoading(true);
    const url = await getSignedUrl(proofUrl);
    if (url) {
      setProofImagePreview(url);
    } else {
      toast({ title: "Error al cargar comprobante", variant: "destructive" });
    }
    setProofLoading(false);
  };

  const handleDownloadProof = async (proofUrl: string, reference: string) => {
    const url = await getSignedUrl(proofUrl);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = `comprobante-${reference}`;
      a.click();
    } else {
      toast({ title: "Error al descargar comprobante", variant: "destructive" });
    }
  };

  const handlePaymentAction = async (proofId: string, auctionId: string, action: "approved" | "rejected") => {
    setProcessingPayment(proofId);
    const { error } = await supabase.from("payment_proofs").update({
      status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", proofId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (action === "approved") {
        supabase.functions.invoke("notify-payment-verified", { body: { auction_id: auctionId } }).catch(err => console.error("Error notifying dealer:", err));
        toast({ title: "✅ Pago aprobado — Dealer notificado (48h para enviar)" });
      } else {
        toast({ title: "❌ Pago rechazado" });
      }
      fetchAllData();
    }
    setProcessingPayment(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Gestión de Cobros</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">{paymentProofs.filter((p: any) => p.status === "pending").length} pendientes</Badge>
          <Badge variant="outline" className="text-xs">{paymentProofs.length} total</Badge>
        </div>
      </div>
      {paymentProofs.length === 0 ? (
        <Card className="border border-border rounded-md"><CardContent className="p-12 text-center"><CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /><p className="text-sm text-muted-foreground">No hay comprobantes de pago registrados.</p></CardContent></Card>
      ) : (
        <Card className="border border-border rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/50 border-b border-border">
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3">Subasta</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 hidden sm:table-cell">Comprador</th>
                  <th className="text-right font-semibold text-muted-foreground px-4 py-3">Monto</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 hidden md:table-cell">Referencia</th>
                  <th className="text-center font-semibold text-muted-foreground px-4 py-3">Comprobante</th>
                  <th className="text-center font-semibold text-muted-foreground px-4 py-3">Estado</th>
                  <th className="text-center font-semibold text-muted-foreground px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paymentProofs.map((proof: any) => (
                  <tr key={proof.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3"><p className="font-medium truncate max-w-[200px]">{proof.auction_title}</p></td>
                    <td className="px-4 py-3 hidden sm:table-cell">{proof.buyer_name}</td>
                    <td className="px-4 py-3 text-right"><p className="font-bold">${Number(proof.amount_usd).toLocaleString("es-MX")}</p><p className="text-muted-foreground text-[10px]">Bs. {Number(proof.amount_bs).toLocaleString("es-VE")}</p></td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono">{proof.reference_number}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => handleViewProof(proof.proof_url)} disabled={proofLoading}>
                          {proofLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Eye className="h-3 w-3 mr-1" />}Ver
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => handleDownloadProof(proof.proof_url, proof.reference_number)}>
                          <Download className="h-3 w-3 mr-1" />Descargar
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={`text-[10px] ${proof.status === "pending" ? "bg-warning/10 text-warning border-warning/20" : proof.status === "approved" ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                        {proof.status === "pending" ? "Pendiente" : proof.status === "approved" ? "Aprobado" : "Rechazado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {proof.status === "pending" ? (
                          <>
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-[10px] h-7 px-2.5" onClick={() => handlePaymentAction(proof.id, proof.auction_id, "approved")} disabled={processingPayment === proof.id}>
                              {processingPayment === proof.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}Validar
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 rounded-sm text-[10px] h-7 px-2.5" onClick={() => handlePaymentAction(proof.id, proof.auction_id, "rejected")} disabled={processingPayment === proof.id}>
                              <XCircle className="h-3 w-3 mr-1" /> Rechazar
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setExpandedPayment(expandedPayment === proof.id ? null : proof.id)}>
                            <Eye className="h-3 w-3 mr-1" /> Detalles
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Dialog open={!!proofImagePreview} onOpenChange={(open) => { if (!open) setProofImagePreview(null); }}>
        <DialogContent className="max-w-3xl p-2 bg-card">
          <DialogHeader><DialogTitle className="text-sm font-heading">Comprobante de Pago</DialogTitle></DialogHeader>
          {proofImagePreview && <div className="flex items-center justify-center p-2"><img src={proofImagePreview} alt="Comprobante" className="max-h-[70vh] w-auto rounded-md object-contain" /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentsTab;
