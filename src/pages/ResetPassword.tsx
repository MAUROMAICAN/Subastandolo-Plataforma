import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Mail, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError } from "@/lib/authErrors";
import PasswordInput from "@/components/PasswordInput";
import logo from "@/assets/logo-dark.png";

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

  // ── Invalid / expired link view ──
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border border-border rounded-sm shadow-sm">
          <CardHeader className="text-center space-y-2">
            <img src={logo} alt="Subastandolo" className="h-14 mx-auto object-contain mb-1" />
            <div className="mx-auto bg-destructive/10 rounded-full p-3 w-fit">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl font-heading">Enlace inválido o expirado</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Este enlace ya fue usado o ha expirado. Ingresa tu correo para recibir uno nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="pl-10 rounded-sm h-9"
                />
              </div>
            </div>
            <Button
              onClick={handleResendRecovery}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm"
              disabled={resendLoading || resendCooldown > 0 || !resendEmail.trim()}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${resendLoading ? "animate-spin" : ""}`} />
              {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Enviar nuevo enlace"}
            </Button>
            <Button onClick={() => navigate("/auth")} variant="ghost" className="w-full text-xs">
              ← Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Reset password form ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border border-border rounded-sm shadow-sm">
        <CardHeader className="text-center space-y-1 pb-2">
          <img src={logo} alt="Subastandolo" className="h-14 mx-auto object-contain mb-2" />
          <CardTitle className="text-xl font-heading">Nueva Contraseña</CardTitle>
          <CardDescription className="text-xs">Ingresa tu nueva contraseña. Debe ser diferente a la anterior.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nueva contraseña</Label>
              <PasswordInput
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 rounded-sm h-9"
                required
                minLength={6}
                startAdornment={<Lock className="h-4 w-4" />}
                showLabel="Ver contraseña"
                hideLabel="Ocultar contraseña"
              />
              {password.length > 0 && password.length < 6 && (
                <p className="text-[10px] text-destructive/80">Mínimo 6 caracteres</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirmar contraseña</Label>
              <PasswordInput
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 rounded-sm h-9"
                required
                minLength={6}
                startAdornment={<Lock className="h-4 w-4" />}
                showLabel="Ver confirmación"
                hideLabel="Ocultar confirmación"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[10px] text-destructive/80">Las contraseñas no coinciden</p>
              )}
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm" disabled={loading || password.length < 6 || password !== confirmPassword}>
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
