import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, CheckCircle, Copy, Clock, Building2, CreditCard, FileText, DollarSign, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface PaymentFlowProps {
  auctionId: string;
  amountUsd: number;
  userId: string;
  showCommission?: boolean;
}

interface PaymentProof {
  id: string;
  status: string;
  reference_number: string;
  amount_bs: number;
  bcv_rate: number;
  created_at: string;
  proof_url: string;
}

const BANK_INFO = {
  bank: "BANESCO",
  account: "01340178171781043753",
  rif: "J413098075",
  name: "UNIFORMES KRONUS CA",
};

const PaymentFlow = ({ auctionId, amountUsd, userId, showCommission = false }: PaymentFlowProps) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [commission, setCommission] = useState<number>(0);
  const [rateLoading, setRateLoading] = useState(true);
  const [reference, setReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingProof, setExistingProof] = useState<PaymentProof | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchBcvRate();
    fetchExistingProof();
  }, [auctionId]);

  const fetchBcvRate = async () => {
    setRateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-bcv-rate");
      if (error) throw error;
      if (data?.rate) setBcvRate(data.rate);
      if (data?.commission != null) setCommission(data.commission);
    } catch {
      toast({ title: "Error obteniendo tasa BCV", variant: "destructive" });
    } finally {
      setRateLoading(false);
    }
  };

  const fetchExistingProof = async () => {
    const { data } = await supabase
      .from("payment_proofs")
      .select("*")
      .eq("auction_id", auctionId)
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setExistingProof(data as PaymentProof);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copiado` });
  };

  const handleSubmit = async () => {
    if (!proofFile || !reference.trim() || !bcvRate) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const ext = proofFile.name.split(".").pop();
      const filePath = `${userId}/${auctionId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, proofFile);
      if (uploadError) throw uploadError;

      const amountBs = amountUsd * bcvRate;

      const { error: insertError } = await supabase.from("payment_proofs").insert({
        auction_id: auctionId,
        buyer_id: userId,
        amount_usd: amountUsd,
        amount_bs: amountBs,
        bcv_rate: bcvRate,
        reference_number: reference.trim(),
        proof_url: filePath,
      });
      if (insertError) throw insertError;

      toast({ title: "¡Comprobante enviado!", description: "Tu pago será verificado pronto." });
      setReference("");
      setProofFile(null);
      fetchExistingProof();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const amountBs = bcvRate ? (amountUsd * bcvRate) : null;
  const commissionUsd = amountUsd * commission / 100;
  const dealerNetUsd = amountUsd - commissionUsd;

  // Already submitted
  if (existingProof) {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      pending: { label: "En revisión", color: "text-amber-600 bg-amber-50 border-amber-200", icon: <Clock className="h-4 w-4" /> },
      approved: { label: "Aprobado", color: "text-primary bg-primary/5 border-primary/20", icon: <CheckCircle className="h-4 w-4" /> },
      rejected: { label: "Rechazado", color: "text-destructive bg-destructive/5 border-destructive/20", icon: <FileText className="h-4 w-4" /> },
    };
    const s = statusMap[existingProof.status] || statusMap.pending;

    return (
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="bg-secondary/50 px-4 py-2.5 border-b border-border">
          <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-primary" />
            Estado de tu Pago
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-sm border ${s.color}`}>
            {s.icon}
            <span className="font-semibold">{s.label}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Referencia: <span className="font-mono font-medium text-foreground">{existingProof.reference_number}</span></p>
            <p>Monto: <span className="font-medium text-foreground">Bs. {existingProof.amount_bs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span></p>
            <p>Tasa BCV: <span className="font-medium text-foreground">{existingProof.bcv_rate.toFixed(2)} Bs/$</span></p>
          </div>
          {existingProof.status === "rejected" && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setExistingProof(null)}
            >
              Enviar nuevo comprobante
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Location missing interceptor
  const canPay = Boolean(profile?.city && profile?.state);
  if (!canPay) {
    return (
      <div className="bg-card border border-destructive/30 rounded-sm overflow-hidden p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <MapPin className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground">Información Incompleta</h3>
        <p className="text-sm text-muted-foreground mx-auto">
          ⚠️ Por favor actualiza tu información de Ciudad y Estado en tu perfil para proceder con el reporte de tu pago.
        </p>
        <Link to="/mi-panel" className="inline-block mt-4">
          <Button className="font-bold">Ir a mi Perfil</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="bg-secondary/50 px-4 py-2.5 border-b border-border">
        <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-primary" />
          Pagar Subasta
        </h3>
      </div>
      <div className="p-4 space-y-4">
        {/* Bank details */}
        <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Datos para Transferencia
          </p>
          {[
            { label: "Banco", value: BANK_INFO.bank },
            { label: "Cuenta", value: BANK_INFO.account },
            { label: "RIF", value: BANK_INFO.rif },
            { label: "A nombre de", value: BANK_INFO.name },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground text-xs">{label}: </span>
                <span className="font-mono font-medium">{value}</span>
              </div>
              <button
                onClick={() => copyToClipboard(value, label)}
                className="text-primary hover:text-primary/70 transition-colors p-1"
                title="Copiar"
              >
                {copied === label ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>

        {/* Amount */}
        <div className="bg-primary/5 border border-primary/10 rounded-sm p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Monto a Pagar
          </p>
          <p className="text-lg font-bold text-primary">${amountUsd.toLocaleString("es-MX")}</p>
          {rateLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Obteniendo tasa BCV...
            </p>
          ) : bcvRate && amountBs ? (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Equivalente: <span className="font-bold text-foreground">Bs. {amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
              </p>
              <p>Tasa BCV del día: {bcvRate.toFixed(2)} Bs/$</p>
            </div>
          ) : (
            <p className="text-xs text-destructive">No se pudo obtener la tasa. Intenta de nuevo.</p>
          )}

          {/* Commission breakdown - only for dealers/admins */}
          {showCommission && commission > 0 && (
            <div className="border-t border-primary/10 pt-2 mt-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Desglose de la venta</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-xs">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-bold text-foreground">${amountUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Comisión ({commission}%)</p>
                  <p className="font-bold text-primary">${commissionUsd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dealer recibe</p>
                  <p className="font-bold text-foreground">${dealerNetUsd.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reference */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Número de Referencia</label>
          <Input
            placeholder="Ej: 123456789"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="rounded-sm font-mono"
          />
        </div>

        {/* File upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Comprobante de Pago</label>
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-sm p-4 cursor-pointer hover:border-primary/50 hover:bg-secondary/20 transition-colors">
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] || null)}
            />
            {proofFile ? (
              <span className="text-sm text-foreground font-medium truncate">{proofFile.name}</span>
            ) : (
              <>
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Subir capture o PDF</span>
              </>
            )}
          </label>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !reference.trim() || !proofFile || !bcvRate}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Enviar Comprobante
        </Button>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          ⚠️ Tu pago será verificado por nuestro equipo. Una vez aprobado, el vendedor procederá con el envío del producto.
        </p>
      </div>
    </div>
  );
};

export default PaymentFlow;
