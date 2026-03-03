import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Mail, RefreshCw, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/authErrors";
import PasswordInput from "@/components/PasswordInput";

const RESEND_COOLDOWN = 30;

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendRecovery = async () => {
    if (!resendEmail.trim() || resendCooldown > 0) return;
    setResendLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ title: "Error", description: translateAuthError(error.message), variant: "destructive" });
    } else {
      toast({ title: "✅ Correo enviado", description: "Revisa tu bandeja de entrada para el nuevo enlace." });
      setResendCooldown(RESEND_COOLDOWN);
    }
    setResendLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Error", description: translateAuthError(error.message), variant: "destructive" });
    } else {
      toast({ title: "✅ ¡Contraseña actualizada!", description: "Ya puedes iniciar sesión con tu nueva contraseña." });
      navigate("/auth", { replace: true });
    }
    setLoading(false);
  };

  const LogoContainer = () => (
    <div className="flex justify-center items-center mb-6">
      <img src="/inicio_claro.svg" alt="Subastándolo" className="h-10 w-auto dark:hidden" />
      <img src="/inicio_oscuro.svg" alt="Subastándolo" className="h-10 w-auto hidden dark:block" />
    </div>
  );

  // ── Invalid / expired link view ──
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
          <LogoContainer />
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-destructive/5 border border-destructive/20 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
          </div>
          <div className="text-center mb-6 space-y-2">
            <h3 className="text-xl font-heading font-bold text-foreground">Enlace inválido o expirado</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Este enlace ya fue usado o ha expirado. Ingresa tu correo para recibir uno nuevo.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-medium pl-1">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="h-12 rounded-2xl bg-muted/20 border-border/50 pl-11 focus-visible:ring-1 transition-all"
                />
              </div>
            </div>
            <Button
              onClick={handleResendRecovery}
              className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-all"
              disabled={resendLoading || resendCooldown > 0 || !resendEmail.trim()}
            >
              {resendLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : "Enviar nuevo enlace"}
              {resendCooldown > 0 && ` (${resendCooldown}s)`}
            </Button>
            <Button onClick={() => navigate("/auth")} variant="ghost" className="w-full text-muted-foreground hover:text-foreground text-sm">
              ← Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset password form ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
        <LogoContainer />
        <div className="text-center mb-8 space-y-2">
          <h3 className="text-2xl font-heading font-bold text-foreground">Nueva Contraseña</h3>
          <p className="text-sm text-muted-foreground">Ingresa tu nueva contraseña para recuperar el acceso.</p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium pl-1">Nueva contraseña</Label>
            <PasswordInput
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-2xl bg-muted/20 border-border/50 pr-12 focus-visible:ring-1 transition-all"
              required
              minLength={6}
              startAdornment={<Lock className="h-4 w-4" />}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-medium pl-1">Confirmar contraseña</Label>
            <PasswordInput
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 rounded-2xl bg-muted/20 border-border/50 pr-12 focus-visible:ring-1 transition-all"
              required
              minLength={6}
              startAdornment={<Lock className="h-4 w-4" />}
            />
          </div>
          <Button type="submit" className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-all" disabled={loading || password.length < 6 || password !== confirmPassword}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : "Actualizar contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
