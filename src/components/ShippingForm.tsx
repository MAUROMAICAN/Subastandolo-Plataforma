import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Truck, CheckCircle, MapPin } from "lucide-react";

interface ShippingFormProps {
  auctionId: string;
  userId: string;
  onComplete: () => void;
}

const SHIPPING_COMPANIES = ["Tealca", "Zoom", "MRW", "Domesa", "Liberty Express", "Otra"];

const STATES = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo",
  "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara",
  "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre",
  "Táchira", "Trujillo", "Vargas", "Yaracuy", "Zulia",
];

const ShippingForm = ({ auctionId, userId, onComplete }: ShippingFormProps) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [cedula, setCedula] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [disclaimer, setDisclaimer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefilledFromProfile, setPrefilledFromProfile] = useState(false);

  // Pre-fill from profile
  useEffect(() => {
    if (profile) {
      if (profile.full_name) { setFullName(profile.full_name); setPrefilledFromProfile(true); }
      if ((profile as any).phone) setPhone((profile as any).phone);
      if ((profile as any).city) setCity((profile as any).city);
      if ((profile as any).state) setState((profile as any).state);
    }
  }, [profile]);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from("shipping_info")
        .select("id")
        .eq("auction_id", auctionId)
        .eq("buyer_id", userId)
        .maybeSingle();
      if (data) {
        setExisting(true);
        onComplete();
      }
      setLoading(false);
    };
    check();
  }, [auctionId, userId, onComplete]);

  const handleSubmit = async () => {
    if (!fullName.trim() || !cedula.trim() || !phone.trim() || !company || !state || !city.trim() || !officeName.trim()) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    if (!disclaimer) {
      toast({ title: "Debes aceptar la cláusula de deslinde", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("shipping_info").insert({
        auction_id: auctionId,
        buyer_id: userId,
        full_name: fullName.trim(),
        cedula: cedula.trim(),
        phone: phone.trim(),
        shipping_company: company,
        state,
        city: city.trim(),
        office_name: officeName.trim(),
        disclaimer_accepted: true,
      });
      if (error) throw error;

      // Sync back to user profile so it's pre-filled next time
      await supabase.from("profiles").update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state,
      } as any).eq("id", userId);

      toast({ title: "¡Datos de envío guardados!" });
      setExisting(true);
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (existing) return null;

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="bg-secondary/50 px-4 py-2.5 border-b border-border">
        <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-primary" />
          Datos de Envío
        </h3>
        <p className="text-[10px] text-muted-foreground dark:text-slate-400 mt-0.5">
          Completa tus datos antes de proceder al pago
        </p>
      </div>
      <div className="p-4 space-y-3">
        {/* Pre-fill banner */}
        {prefilledFromProfile && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-[11px] text-primary dark:text-[#A6E300]">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            Datos pre-llenados desde tu perfil. Revisa y completa los campos faltantes.
          </div>
        )}
        {/* Name & Cedula & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Nombre completo (quien retira)</label>
            <Input
              placeholder="Nombre y Apellido"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Cédula</label>
            <Input
              placeholder="V-12345678"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="rounded-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Teléfono</label>
            <Input
              placeholder="0412-1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-sm"
            />
          </div>
        </div>

        {/* Shipping company */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground dark:text-slate-300">Agencia de Envíos</label>
          <select
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="flex h-10 w-full rounded-sm border border-input bg-background dark:bg-zinc-900 dark:text-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" className="dark:bg-zinc-900">Seleccionar agencia...</option>
            {SHIPPING_COMPANIES.map((c) => (
              <option key={c} value={c} className="dark:bg-zinc-900">{c}</option>
            ))}
          </select>
        </div>

        {/* Address */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground dark:text-slate-300 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Dirección de la Agencia
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="flex h-10 w-full rounded-sm border border-input bg-background dark:bg-zinc-900 dark:text-white px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" className="dark:bg-zinc-900">Estado...</option>
              {STATES.map((s) => (
                <option key={s} value={s} className="dark:bg-zinc-900">{s}</option>
              ))}
            </select>
            <Input
              placeholder="Ciudad"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-sm"
            />
          </div>
          <Input
            placeholder="Nombre de la oficina/sucursal"
            value={officeName}
            onChange={(e) => setOfficeName(e.target.value)}
            className="rounded-sm mt-2"
          />
        </div>

        {/* Disclaimer */}
        <label className="flex items-start gap-2 cursor-pointer bg-secondary/30 border border-border rounded-sm p-3">
          <input
            type="checkbox"
            checked={disclaimer}
            onChange={(e) => setDisclaimer(e.target.checked)}
            className="mt-0.5 rounded border-input"
          />
          <span className="text-[11px] text-muted-foreground dark:text-slate-400 leading-relaxed">
            Al enviar estos datos, acepto que la plataforma y el Dealer quedan libres de toda responsabilidad
            por daños, pérdidas o retrasos ocasionados por la empresa de encomiendas. El Dealer se compromete
            a entregar el producto en la agencia en perfecto estado y proporcionar el número de guía.
          </span>
        </label>

        <Button
          onClick={handleSubmit}
          disabled={submitting || !disclaimer}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Confirmar Datos de Envío
        </Button>
      </div>
    </div>
  );
};

export default ShippingForm;
