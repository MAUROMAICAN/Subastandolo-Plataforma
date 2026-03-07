import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Clock, CheckCircle, Banknote, Save } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function DealerPaymentTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [bankAccount, setBankAccount] = useState<{
    id?: string; bank_name: string; account_type: string; account_number: string;
    identity_document: string; email: string; is_verified: boolean;
  } | null>(null);
  const [bankForm, setBankForm] = useState({
    bank_name: "", account_type: "", account_number: "", identity_document: "", email: "",
  });
  const [savingBank, setSavingBank] = useState(false);
  const [loadingBank, setLoadingBank] = useState(true);

  useEffect(() => {
    if (user) fetchBankAccount();
  }, [user]);

  const fetchBankAccount = async () => {
    if (!user) return;
    setLoadingBank(true);
    const { data } = await supabase
      .from("dealer_bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setBankAccount(data as any);
      setBankForm({
        bank_name: data.bank_name, account_type: data.account_type,
        account_number: data.account_number, identity_document: data.identity_document, email: data.email,
      });
    }
    setLoadingBank(false);
  };

  const handleSaveBankAccount = async () => {
    if (!user) return;
    const { bank_name, account_type, account_number, identity_document, email } = bankForm;
    if (!bank_name || !account_type || !account_number || !identity_document || !email) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    if (account_number.length < 10 || account_number.length > 20) {
      toast({ title: "Número de cuenta inválido", description: "Debe tener entre 10 y 20 dígitos.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Correo electrónico inválido", variant: "destructive" });
      return;
    }

    setSavingBank(true);
    if (bankAccount?.id) {
      const { error } = await supabase.from("dealer_bank_accounts").update({
        bank_name, account_type, account_number, identity_document, email, is_verified: false,
      } as any).eq("id", bankAccount.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "💰 Datos bancarios actualizados", description: "Pendiente de verificación por el admin." });
    } else {
      const { error } = await supabase.from("dealer_bank_accounts").insert({
        user_id: user.id, bank_name, account_type, account_number, identity_document, email,
      } as any);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "💰 Datos bancarios registrados", description: "Pendiente de verificación por el admin." });
    }
    setSavingBank(false);
    fetchBankAccount();
  };

  const banks = [
    "Banco de Venezuela", "Banesco", "Banco Mercantil", "BBVA Provincial",
    "Banco Nacional de Crédito (BNC)", "Banco del Tesoro", "Banco Bicentenario",
    "Banco Exterior", "Banco Caroní", "Banco Fondo Común (BFC)", "Banco Sofitasa",
    "Banco Plaza", "Banco Venezolano de Crédito", "Banplus",
    "Banco del Caribe (Bancaribe)", "Bancrecer", "Mi Banco", "100% Banco",
    "Bancamiga", "Banco Activo",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary dark:text-[#A6E300]" />
          Configuración de Cobro
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Configura tu cuenta bancaria para recibir pagos de tus ventas</p>
      </div>

      <div className="bg-amber-500/10 border border-amber-200 rounded-sm p-4 text-sm space-y-1">
        <p className="font-semibold text-foreground">🔒 Regla de Seguridad</p>
        <p className="text-xs text-muted-foreground">Solo se realizarán pagos a cuentas bancarias cuya titularidad coincida exactamente con la identidad verificada del Dealer.</p>
      </div>

      {bankAccount?.is_verified && (
        <div className="flex items-center gap-2 bg-primary/10 dark:bg-[#A6E300]/10 border border-primary/20 rounded-sm p-3">
          <CheckCircle className="h-4 w-4 text-primary dark:text-[#A6E300]" />
          <span className="text-xs text-primary dark:text-[#A6E300] font-semibold">Cuenta verificada por el administrador</span>
        </div>
      )}
      {bankAccount && !bankAccount.is_verified && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-sm p-3">
          <Clock className="h-4 w-4 text-warning" />
          <span className="text-xs text-warning font-semibold">Pendiente de verificación por el administrador</span>
        </div>
      )}

      {loadingBank ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" /></div>
      ) : (
        <Card className="border border-border rounded-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-heading">{bankAccount ? "Editar Datos Bancarios" : "Registrar Datos Bancarios"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre del Banco *</Label>
              <Select value={bankForm.bank_name} onValueChange={v => setBankForm(p => ({ ...p, bank_name: v }))}>
                <SelectTrigger className="rounded-sm"><SelectValue placeholder="Selecciona tu banco" /></SelectTrigger>
                <SelectContent>
                  {banks.map(bank => (<SelectItem key={bank} value={bank}>{bank}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Cuenta *</Label>
              <Select value={bankForm.account_type} onValueChange={v => setBankForm(p => ({ ...p, account_type: v }))}>
                <SelectTrigger className="rounded-sm"><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corriente">Corriente</SelectItem>
                  <SelectItem value="ahorros">Ahorros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Número de Cuenta *</Label>
              <Input
                value={bankForm.account_number}
                onChange={e => { const val = e.target.value.replace(/\D/g, "").slice(0, 20); setBankForm(p => ({ ...p, account_number: val })); }}
                placeholder="Ej: 01340123456789012345" className="rounded-sm" maxLength={20}
              />
              <p className="text-[10px] text-muted-foreground">Entre 10 y 20 dígitos</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Documento de Identidad (Cédula/RIF) *</Label>
              <Input
                value={bankForm.identity_document}
                onChange={e => setBankForm(p => ({ ...p, identity_document: e.target.value.slice(0, 20) }))}
                placeholder="Ej: V-12345678" className="rounded-sm" maxLength={20}
              />
              <p className="text-[10px] text-muted-foreground">Debe coincidir con tu documento de verificación</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Correo Electrónico Asociado *</Label>
              <Input
                type="email" value={bankForm.email}
                onChange={e => setBankForm(p => ({ ...p, email: e.target.value.slice(0, 100) }))}
                placeholder="correo@ejemplo.com" className="rounded-sm" maxLength={100}
              />
              <p className="text-[10px] text-muted-foreground">Para notificaciones de transferencia</p>
            </div>

            <Button onClick={handleSaveBankAccount} disabled={savingBank} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm font-bold">
              {savingBank ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {bankAccount ? "Actualizar Datos Bancarios" : "Guardar Datos Bancarios"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
