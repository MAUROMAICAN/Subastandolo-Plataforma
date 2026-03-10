import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { Tables } from "@/integrations/supabase/types";
import {
  Loader2, Upload, CheckCircle, Copy, Clock, Building2, CreditCard,
  FileText, DollarSign, ShieldCheck, AlertTriangle, Lock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type PaymentProof = Tables<"payment_proofs">;

interface BatchAuction {
  id: string;
  title: string;
  amount: number;
  image_url?: string | null;
}

interface PaymentFlowProps {
  auctionId: string;
  amountUsd: number;
  userId: string;
  showCommission?: boolean;
  // Batch mode: pay for multiple auctions at once
  batchAuctions?: BatchAuction[];
  onBatchComplete?: () => void;
}

const BANK_INFO = {
  bank: "BANESCO Banco Universal",
  account: "01340178171781043753",
  accountRaw: "01340178171781043753",
  rif: "J413098075",
  name: "UNIFORMES KRONUS C.A",
};

const PaymentFlow = ({ auctionId, amountUsd, userId, showCommission = false, batchAuctions, onBatchComplete }: PaymentFlowProps) => {
  const isBatchMode = batchAuctions && batchAuctions.length > 1;
  const totalBatchUsd = isBatchMode ? batchAuctions.reduce((s, a) => s + a.amount, 0) : amountUsd;
  const displayAmountUsd = isBatchMode ? totalBatchUsd : amountUsd;
  const { toast } = useToast();
  const { profile } = useAuth();
  const { getSetting } = useSiteSettings();
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [commission, setCommission] = useState<number>(0);
  const [rateLoading, setRateLoading] = useState(true);
  // Restore reference from sessionStorage in case Android caused a re-mount
  const sessionKey = `payment_ref_${auctionId}`;
  const [reference, setReference] = useState<string>(
    () => sessionStorage.getItem(sessionKey) || ""
  );
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingProof, setExistingProof] = useState<PaymentProof | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Load BCV rate: admin manual → multiple APIs → cached fallback
  const BCV_CACHE_KEY = "subastandolo_bcv_rate";
  const BCV_CACHE_TS_KEY = "subastandolo_bcv_ts";

  const cacheRate = (rate: number) => {
    try {
      localStorage.setItem(BCV_CACHE_KEY, String(rate));
      localStorage.setItem(BCV_CACHE_TS_KEY, String(Date.now()));
    } catch { /* storage full or disabled */ }
  };

  const getCachedRate = (): number | null => {
    try {
      const cached = localStorage.getItem(BCV_CACHE_KEY);
      const ts = localStorage.getItem(BCV_CACHE_TS_KEY);
      if (cached && ts) {
        const age = Date.now() - Number(ts);
        // Cache valid for 24 hours
        if (age < 24 * 60 * 60 * 1000) return Number(cached);
      }
    } catch { /* */ }
    return null;
  };

  const loadRate = async () => {
    setRateLoading(true);
    try {
      // Commission always loads
      const commissionPct = parseFloat(getSetting("commission_percentage", "0") || "0");
      if (!isNaN(commissionPct)) setCommission(commissionPct);

      // 1. Admin manual rate (highest priority)
      const manualRate = getSetting("bcv_rate", "");
      if (manualRate) {
        const parsed = parseFloat(manualRate);
        if (!isNaN(parsed) && parsed > 0) {
          setBcvRate(parsed);
          cacheRate(parsed);
          setRateLoading(false);
          return;
        }
      }

      // 2. ve.dolarapi.com — Dólar Oficial (BCV)
      try {
        const res = await fetch("https://ve.dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          const value = data?.promedio ?? data?.venta ?? data?.precio;
          if (value && !isNaN(Number(value)) && Number(value) > 0) {
            const rate = Number(value);
            setBcvRate(rate);
            cacheRate(rate);
            setRateLoading(false);
            return;
          }
        }
      } catch { /* try next */ }

      // 3. ve.dolarapi.com — All dólares (find oficial from array)
      try {
        const res = await fetch("https://ve.dolarapi.com/v1/dolares", { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          const oficial = Array.isArray(data) ? data.find((d: any) => d?.fuente === "oficial" || d?.nombre?.toLowerCase()?.includes("oficial")) : null;
          const value = oficial?.promedio ?? oficial?.venta ?? oficial?.precio;
          if (value && !isNaN(Number(value)) && Number(value) > 0) {
            const rate = Number(value);
            setBcvRate(rate);
            cacheRate(rate);
            setRateLoading(false);
            return;
          }
        }
      } catch { /* try next */ }

      // 4. pydolarve.org — Venezuelan dollar API
      try {
        const res = await fetch("https://pydolarve.org/api/v2/dollar?page=bcv", { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          // pydolarve returns {monitors: {usd: {price: X}}} or similar
          const price = data?.monitors?.usd?.price ?? data?.price ?? data?.usd;
          if (price && !isNaN(Number(price)) && Number(price) > 0) {
            const rate = Number(price);
            setBcvRate(rate);
            cacheRate(rate);
            setRateLoading(false);
            return;
          }
        }
      } catch { /* try next */ }

      // 5. open.er-api.com (international exchange rate)
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const data = await res.json();
          const value = data?.rates?.VES ?? data?.rates?.VEF;
          if (value && !isNaN(Number(value)) && Number(value) > 0) {
            const rate = Number(value);
            setBcvRate(rate);
            cacheRate(rate);
            setRateLoading(false);
            return;
          }
        }
      } catch { /* no more APIs */ }

      // 6. Last resort: use cached rate from localStorage
      const cachedRate = getCachedRate();
      if (cachedRate && cachedRate > 0) {
        setBcvRate(cachedRate);
        setRateLoading(false);
        return;
      }

    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    loadRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  const fetchExistingProof = async () => {
    // In batch mode, check if ANY of the auctions already has a proof
    if (isBatchMode) {
      const { data } = await supabase
        .from("payment_proofs")
        .select("*")
        .in("auction_id", batchAuctions.map(a => a.id))
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExistingProof(data as PaymentProof);
    } else {
      const { data } = await supabase
        .from("payment_proofs")
        .select("*")
        .eq("auction_id", auctionId)
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setExistingProof(data as PaymentProof);
    }
  };

  useEffect(() => { fetchExistingProof(); }, [auctionId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: `${label} copiado` });
  };

  const handleSubmit = async () => {
    const fileToUpload = proofFile ?? fileInputRef.current?.files?.[0] ?? null;
    if (!fileToUpload) {
      toast({ title: "Falta el comprobante", description: "Por favor selecciona el archivo nuevamente.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const currentRate = bcvRate || 0;

      const ext = fileToUpload.name.split(".").pop();
      const filePath = `${userId}/${auctionId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(filePath, fileToUpload);
      if (uploadError) throw uploadError;

      if (isBatchMode) {
        // === BATCH MODE: insert one row per auction with shared batch_id ===
        const batchId = crypto.randomUUID();
        const rows = batchAuctions.map(a => ({
          auction_id: a.id,
          buyer_id: userId,
          amount_usd: a.amount,
          amount_bs: currentRate ? a.amount * currentRate : 0,
          bcv_rate: currentRate,
          reference_number: reference.trim() || "",
          proof_url: filePath,
          batch_id: batchId,
        }));

        for (const row of rows) {
          const { error: insertError } = await supabase.from("payment_proofs").insert(row);
          if (insertError) {
            if (insertError.code === "42501" || insertError.message?.includes("row-level security")) {
              throw new Error(`No se pudo registrar el comprobante para una de las subastas. Contacta a soporte.`);
            }
            throw insertError;
          }
        }

        // Update payment_status for all auctions
        for (const a of batchAuctions) {
          await supabase.from("auctions").update({ payment_status: "under_review" } as any).eq("id", a.id);
        }

        toast({ title: "¡Comprobante enviado!", description: `Pago unificado para ${batchAuctions.length} subastas registrado.` });
        onBatchComplete?.();

        // Notify dealers (fire-and-forget) — all should be same dealer, notify once
        const firstAuction = batchAuctions[0];
        supabase.from("auctions").select("created_by, title, image_url").eq("id", firstAuction.id).single().then(({ data: auc }) => {
          if (auc?.created_by) {
            supabase.functions.invoke("notify-payment-received", {
              body: {
                dealerUserId: auc.created_by,
                buyerName: profile?.full_name || "El comprador",
                auctionTitle: `Pago unificado (${batchAuctions.length} subastas)`,
                auctionId: firstAuction.id,
                amountUsd: totalBatchUsd,
                imageUrl: auc.image_url || null,
              },
            }).catch(() => { });
          }
        });

      } else {
        // === SINGLE MODE (original) ===
        const amountBsCalc = currentRate ? amountUsd * currentRate : 0;
        const { error: insertError } = await supabase.from("payment_proofs").insert({
          auction_id: auctionId,
          buyer_id: userId,
          amount_usd: amountUsd,
          amount_bs: amountBsCalc,
          bcv_rate: currentRate,
          reference_number: reference.trim() || "",
          proof_url: filePath,
        });
        if (insertError) {
          await supabase.storage.from("payment-proofs").remove([filePath]).catch(() => { });
          if (insertError.code === "42501" || insertError.message?.includes("row-level security")) {
            throw new Error(
              "No se pudo registrar el comprobante. Asegúrate de que eres el ganador de esta subasta y que la subasta haya finalizado. Si el problema persiste, contacta a soporte."
            );
          }
          throw insertError;
        }

        toast({ title: "¡Comprobante enviado!", description: "Tu pago será verificado pronto." });

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
      }

      setReference("");
      sessionStorage.removeItem(sessionKey);
      setProofFile(null);
      setProofFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchExistingProof();

    } catch (err: any) {
      toast({ title: "Error al enviar comprobante", description: err.message, variant: "destructive" });
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
            <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">
              ⚠️ Lee atentamente antes de pagar
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-200/80 leading-relaxed">
              Para <strong>garantizar y resguardar tu compra</strong>, realiza el pago <strong>únicamente</strong> a la cuenta
              oficial de Subastandolo que aparece abajo. <br />
              <strong className="text-amber-800 dark:text-amber-200">
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
        <div className="bg-primary/5 dark:bg-white/5 px-5 py-3 border-b border-primary/10 dark:border-white/10 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-primary dark:text-[#A6E300] shrink-0" />
          <span className="text-[10px] font-black text-primary dark:text-[#A6E300] uppercase tracking-widest">
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
            <p className="text-xs text-muted-foreground dark:text-slate-400">Banco Universal · Transferencia en Bs.</p>
          </div>
        </div>

        {/* Account fields */}
        <div className="px-5 py-3 space-y-2">
          {[
            { label: "N° de Cuenta", value: BANK_INFO.accountRaw, copyValue: BANK_INFO.accountRaw, mono: true },
            { label: "RIF", value: BANK_INFO.rif, copyValue: BANK_INFO.rif, mono: true },
            { label: "A nombre de", value: BANK_INFO.name, copyValue: BANK_INFO.name, mono: false },
          ].map(({ label, value, copyValue, mono }) => (
            <div key={label} className="flex items-center justify-between bg-secondary/40 dark:bg-white/5 rounded-xl px-4 py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground dark:text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className={`text-sm font-bold text-foreground dark:text-white ${mono ? "font-mono tracking-wider" : ""}`}>{value}</p>
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
        <div className="bg-secondary/50 dark:bg-white/5 px-5 py-3 border-b border-border flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-bold text-muted-foreground dark:text-slate-300 uppercase tracking-widest">Monto a Transferir</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-3xl font-black text-primary dark:text-[#A6E300]">
            ${displayAmountUsd.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
            <span className="text-base font-semibold text-muted-foreground dark:text-slate-400 ml-1">USD</span>
          </p>

          {/* Batch breakdown */}
          {isBatchMode && (
            <div className="bg-secondary/40 dark:bg-white/5 rounded-xl p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground dark:text-slate-400 uppercase font-semibold tracking-wide">Desglose por subasta</p>
              {batchAuctions.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  {a.image_url && <img src={a.image_url} className="h-8 w-8 rounded object-cover border border-border shrink-0" alt="" />}
                  <span className="flex-1 min-w-0 truncate text-foreground">{a.title}</span>
                  <span className="font-bold text-foreground shrink-0">${a.amount.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="border-t border-border pt-2 flex justify-between text-sm font-black">
                <span>Total</span>
                <span className="text-primary dark:text-[#A6E300]">${totalBatchUsd.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {rateLoading ? (
            <p className="text-xs text-muted-foreground dark:text-slate-400 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Obteniendo tasa BCV...
            </p>
          ) : bcvRate && amountBs ? (
            <div className="bg-secondary/40 dark:bg-white/5 rounded-xl px-4 py-3 space-y-1">
              <p className="text-[10px] text-muted-foreground dark:text-slate-400 uppercase font-semibold tracking-wide">Equivalente en Bolívares (BCV)</p>
              <p className="text-2xl font-black text-foreground">
                Bs. {amountBs.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-muted-foreground dark:text-slate-400">
                Tasa del día: <strong className="text-foreground">{bcvRate.toFixed(2)} Bs/$</strong>
                {" · "}La tasa se fija a la tasa oficial BCV vigente al cierre de la subasta.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 flex-1">⚠️ No se pudo obtener la tasa BCV. Puedes enviar tu comprobante de todas formas.</p>
              <button onClick={loadRate} className="shrink-0 text-xs font-bold text-primary dark:text-accent underline">Reintentar</button>
            </div>
          )}

          {showCommission && commission > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground dark:text-slate-400 uppercase tracking-widest">Desglose</p>
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
            <label className="text-xs font-semibold text-foreground dark:text-white">Número de Referencia (Opcional)</label>
            <Input
              placeholder="Ej: 00123456789"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                sessionStorage.setItem(sessionKey, e.target.value);
              }}
              className="rounded-xl font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground dark:text-white">Imagen / Captura del Comprobante *</label>
            <div className="border border-border rounded-xl p-3 bg-secondary/10 dark:bg-white/5">
              {/* Native input hidden – triggered by custom button below (Android-safe) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setProofFile(file);
                    setProofFileName(file.name);
                  }
                }}
              />
              <div className="flex items-center gap-3 min-w-0">
                {/* Custom trigger button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 py-2.5 px-4 rounded-lg text-xs font-black bg-accent text-accent-foreground hover:bg-accent/80 active:scale-95 transition-all"
                >
                  Seleccionar archivo
                </button>
                {/* Status text */}
                <span className="text-xs min-w-0 truncate">
                  {(proofFileName || proofFile?.name) ? (
                    <span className="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="shrink-0">✓</span>
                      <span className="truncate">{proofFileName || proofFile?.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">Ningún archivo seleccionado</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || (!proofFile && !fileInputRef.current?.files?.length)}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-black rounded-xl h-11 text-sm shadow-md"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
              : <Upload className="h-4 w-4 mr-2" />}
            Enviar Comprobante de Pago
          </Button>
        </div>
      </div>

      {/* FOOTER DISCLAIMERS */}
      <div className="rounded-xl bg-secondary/20 dark:bg-white/5 border border-border px-4 py-3 space-y-1.5">
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
