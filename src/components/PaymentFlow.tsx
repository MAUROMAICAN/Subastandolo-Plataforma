import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Upload, CheckCircle, Copy, Clock, Building2, CreditCard,
  FileText, DollarSign, MapPin, ShieldCheck, AlertTriangle, Lock
} from "lucide-react";
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
  bank: "BANESCO Banco Universal",
  account: "01340178171781043753",
  accountRaw: "01340178171781043753",
  rif: "J413098075",
  name: "UNIFORMES KRONUS C.A",
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
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(filePath, proofFile);
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

      // Notify dealer via email (fire-and-forget)
      supabase.from("auctions").select("created_by, title, image_url").eq("id", auctionId).single().then(({ data: auc }) => {
        if (auc?.created_by) {
          supabase.functions.invoke("notify-payment-received", {
            body: {
              dealerUserId: auc.created_by,
              buyerName: profile?.full_name || "El comprador",
              auctionTitle: auc.title,
              auctionId,
              amountUsd,
              imageUrl: auc.image_url || null,
            },
          }).catch(() => { });
        }
      });

    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const amountBs = bcvRate ? amountUsd * bcvRate : null;
  const commissionUsd = amountUsd * commission / 100;
  const dealerNetUsd = amountUsd - commissionUsd;

  // ── Already submitted ──────────────────────────────────────────────────────
  if (existingProof) {
    const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      pending: { label: "En revisión", color: "text-amber-700 bg-amber-50 dark:bg-amber-900/20 border-amber-300", icon: <Clock className="h-4 w-4" /> },
      approved: { label: "Pago Aprobado ✓", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300", icon: <CheckCircle className="h-4 w-4" /> },
      rejected: { label: "Rechazado", color: "text-destructive dark:text-white bg-destructive/10 dark:bg-white/10 border-destructive/30 dark:border-white/20", icon: <FileText className="h-4 w-4" /> },
    };
    const s = statusMap[existingProof.status] || statusMap.pending;
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="bg-secondary/50 px-5 py-3 border-b border-border flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Estado de tu Pago</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className={`flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl border ${s.color}`}>
            {s.icon}
            <span className="font-bold">{s.label}</span>
          </div>
          <div className="text-xs text-muted-foreground dark:text-slate-400 space-y-1.5 bg-secondary/30 dark:bg-white/5 rounded-xl p-3">
            <p>Referencia: <span className="font-mono font-semibold text-foreground">{existingProof.reference_number}</span></p>
            <p>Monto: <span className="font-semibold text-foreground">Bs. {existingProof.amount_bs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span></p>
            <p>Tasa BCV aplicada: <span className="font-semibold text-foreground">{existingProof.bcv_rate.toFixed(2)} Bs/$</span></p>
          </div>
          {existingProof.status === "rejected" && (
            <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={() => setExistingProof(null)}>
              Enviar nuevo comprobante
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Location gate ──────────────────────────────────────────────────────────
  const canPay = Boolean(profile?.city && profile?.state);
  if (!canPay) {
    return (
      <div className="bg-card border border-destructive/30 rounded-2xl p-6 text-center space-y-4">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
          <MapPin className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="font-heading font-bold text-lg">Información Incompleta</h3>
        <p className="text-sm text-muted-foreground">
          ⚠️ Actualiza tu Ciudad y Estado en tu perfil para proceder con el pago.
        </p>
        <Link to="/mi-panel">
          <Button className="font-bold rounded-xl">Ir a mi Perfil</Button>
        </Link>
      </div>
    );
  }

  // ── Main payment form ──────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* SECURITY WARNING */}
      <div className="rounded-2xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 h-8 w-8 rounded-full bg-amber-400/20 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-1">
              ⚠️ Lee atentamente antes de pagar
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
              Para <strong>garantizar y resguardar tu compra</strong>, realiza el pago <strong>únicamente</strong> a la cuenta
              oficial de Subastandolo que aparece abajo. <br />
              <strong className="text-amber-800 dark:text-amber-300">
                ❌ NO transfieras directamente al Vendedor / Dealer bajo ninguna circunstancia.
              </strong>{" "}
              Hacerlo invalida la protección de tu compra y Subastandolo no podrá responder por tu pago.
            </p>
          </div>
        </div>
      </div>

      {/* OFFICIAL BANK ACCOUNT CARD */}
      <div className="rounded-2xl border border-primary/25 bg-card overflow-hidden shadow-md">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary" />

        {/* Header */}
        <div className="bg-primary/5 px-5 py-3 border-b border-primary/10 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-black text-primary uppercase tracking-widest">
            Cuenta Oficial · Única y exclusiva en la plataforma
          </span>
          <ShieldCheck className="h-4 w-4 text-emerald-500 ml-auto shrink-0" />
        </div>

        {/* Bank identity */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3 border-b border-border/40">
          <div className="h-11 w-11 rounded-xl bg-blue-900/10 dark:bg-blue-400/10 flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-blue-800 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-black text-base text-foreground leading-tight">BANESCO</p>
            <p className="text-xs text-muted-foreground">Banco Universal · Transferencia en Bs.</p>
          </div>
        </div>

        {/* Account fields */}
        <div className="px-5 py-3 space-y-2">
          {[
            { label: "N° de Cuenta", value: BANK_INFO.accountRaw, copyValue: BANK_INFO.accountRaw, mono: true },
            { label: "RIF", value: BANK_INFO.rif, copyValue: BANK_INFO.rif, mono: true },
            { label: "A nombre de", value: BANK_INFO.name, copyValue: BANK_INFO.name, mono: false },
          ].map(({ label, value, copyValue, mono }) => (
            <div key={label} className="flex items-center justify-between bg-secondary/40 rounded-xl px-4 py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                <p className={`text-sm font-bold text-foreground ${mono ? "font-mono tracking-wider" : ""}`}>{value}</p>
              </div>
              <button
                onClick={() => copyToClipboard(copyValue, label)}
                className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all hover:scale-105"
                title={`Copiar ${label}`}
              >
                {copied === label
                  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AMOUNT TO PAY */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="bg-secondary/50 px-5 py-3 border-b border-border flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold text-muted-foreground dark:text-slate-300 uppercase tracking-widest">Monto a Transferir</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-3xl font-black text-primary">
            ${amountUsd.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            <span className="text-base font-semibold text-muted-foreground ml-1">USD</span>
          </p>

          {rateLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Obteniendo tasa BCV...
            </p>
          ) : bcvRate && amountBs ? (
            <div className="bg-secondary/40 rounded-xl px-4 py-3 space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Equivalente en Bolívares (BCV)</p>
              <p className="text-2xl font-black text-foreground">
                Bs. {amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Tasa del día: <strong className="text-foreground">{bcvRate.toFixed(2)} Bs/$</strong>
                {" · "}La tasa se fija a la tasa oficial BCV vigente al cierre de la subasta.
              </p>
            </div>
          ) : (
            <p className="text-xs text-destructive dark:text-white/70">No se pudo obtener la tasa. Intenta de nuevo más tarde.</p>
          )}

          {showCommission && commission > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Desglose</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { l: "Total", v: `$${amountUsd.toFixed(2)}`, hi: false },
                  { l: `Comisión (${commission}%)`, v: `$${commissionUsd.toFixed(2)}`, hi: true },
                  { l: "Dealer recibe", v: `$${dealerNetUsd.toFixed(2)}`, hi: false },
                ].map(({ l, v, hi }) => (
                  <div key={l} className="bg-secondary/40 rounded-xl p-2">
                    <p className="text-[9px] text-muted-foreground mb-0.5">{l}</p>
                    <p className={`text-sm font-black ${hi ? "text-primary" : "text-foreground"}`}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD PROOF */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="bg-secondary/50 px-5 py-3 border-b border-border flex items-center gap-2">
          <Upload className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold text-muted-foreground dark:text-slate-300 uppercase tracking-widest">Subir Comprobante</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground dark:text-slate-400 leading-relaxed">
            Realiza la transferencia y carga aquí el comprobante. Nuestro equipo lo verificará y notificará al vendedor.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Número de Referencia *</label>
            <Input
              placeholder="Ej: 00123456789"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Imagen / Captura del Comprobante *</label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group">
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />
              {proofFile ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="truncate max-w-[200px]">{proofFile.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                  <span className="text-sm text-muted-foreground">Toca para seleccionar imagen o PDF</span>
                </>
              )}
            </label>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !reference.trim() || !proofFile || !bcvRate}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-black rounded-xl h-11 text-sm"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Upload className="h-4 w-4 mr-2" />}
            Enviar Comprobante de Pago
          </Button>
        </div>
      </div>

      {/* FOOTER DISCLAIMERS */}
      <div className="rounded-xl bg-secondary/20 border border-border px-4 py-3 space-y-1.5">
        <p className="text-[11px] text-muted-foreground dark:text-slate-400 leading-relaxed">
          🔒 <strong className="text-foreground">Tu compra está protegida.</strong> El pago queda en custodia hasta confirmar la entrega del producto.
        </p>
        <p className="text-[11px] text-muted-foreground dark:text-slate-400 leading-relaxed">
          💱 El monto en Bs. se calcula a la tasa oficial BCV vigente al cierre de la subasta.
        </p>
        <p className="text-[11px] text-muted-foreground dark:text-slate-400 leading-relaxed">
          📞 ¿Problemas? Contacta al equipo de <strong className="text-foreground">Soporte de Subastandolo</strong>, nunca directamente al vendedor.
        </p>
      </div>

    </div>
  );
};

export default PaymentFlow;
