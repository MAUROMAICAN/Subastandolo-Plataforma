import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, User, Phone, ShieldAlert, CheckCircle2, RefreshCw, Fingerprint, ShieldCheck, Sparkles, Send, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError, isEmailNotConfirmedError } from "@/lib/authErrors";
import { sanitizeEmail, sanitizeText, sanitizePhone } from "@/lib/sanitize";
import PasswordInput from "@/components/PasswordInput";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import logo from "@/assets/logo-dark.png";

const MAX_LOGIN_ATTEMPTS = 4;
const LOCKOUT_KEY = "login_lockout";
const ATTEMPTS_KEY = "login_attempts";
const LOCKOUT_DURATION = 15 * 60 * 1000;
const RESEND_COOLDOWN = 30;

type AuthView = "login" | "register" | "forgot" | "resend" | "signup-success";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showBiometricSuccess, setShowBiometricSuccess] = useState(false);
  const loginInProgressRef = useRef(false);
  const autoPromptFiredRef = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    checking: biometricChecking,
    saveCredentials,
    loginWithBiometric,
    getBiometryLabel,
  } = useBiometricAuth();

  // Check lockout on mount
  useEffect(() => {
    const lockUntil = localStorage.getItem(LOCKOUT_KEY);
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0");
    setLoginAttempts(attempts);
    if (lockUntil) {
      const remaining = parseInt(lockUntil) - Date.now();
      if (remaining > 0) {
        setIsLocked(true);
        setLockoutRemaining(remaining);
      } else {
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      }
    }
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (!isLocked) return;
    const interval = setInterval(() => {
      const lockUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || "0");
      const remaining = lockUntil - Date.now();
      if (remaining <= 0) {
        setIsLocked(false);
        setLockoutRemaining(0);
        setLoginAttempts(0);
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!user) return;
    if (showBiometricPrompt) return;
    if (loginInProgressRef.current) return;
    navigate("/home", { replace: true });
  }, [user, navigate, showBiometricPrompt]);

  // Auto-prompt biometric on mount if credentials are saved
  useEffect(() => {
    if (biometricChecking) return;
    if (!biometricEnabled) return;
    if (autoPromptFiredRef.current) return;
    if (user) return;
    autoPromptFiredRef.current = true;
    void handleBiometricLogin();
  }, [biometricEnabled, biometricChecking, user]);

  // Pre-fill email from remembered user
  useEffect(() => {
    const saved = localStorage.getItem("last_login_email") || "";
    if (saved && !email) setEmail(saved);
  }, []);

  const validateBeforeRegister = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("validate-registration", {
        body: { email: sanitizeEmail(email), phone: sanitizePhone(phone) },
      });

      if (error || !data) {
        toast({ title: "Error de validación", description: "No se pudo verificar tu información. Intenta de nuevo.", variant: "destructive" });
        return false;
      }

      if (!data.valid) {
        const errors: string[] = data.errors || [];
        if (errors.includes("blacklisted_email") || errors.includes("blacklisted_phone") || errors.includes("blacklisted_cedula")) {
          setValidationError("Esta información está asociada a una cuenta suspendida. Si crees que es un error, contacta a soporte.");
          return false;
        }
        if (errors.includes("duplicate_phone")) {
          setValidationError("Este teléfono ya está registrado en otra cuenta. Si olvidaste tu contraseña, recupérala aquí.");
          return false;
        }
        setValidationError("No se pudo completar la validación. Verifica tus datos.");
        return false;
      }
      return true;
    } catch {
      toast({ title: "Error", description: "Error de conexión. Intenta de nuevo.", variant: "destructive" });
      return false;
    }
  };

  const handleResendEmail = useCallback(async (type: "signup" | "recovery") => {
    if (resendCooldown > 0 || !email.trim()) return;
    setLoading(true);
    try {
      if (type === "signup") {
        const { error } = await supabase.auth.resend({ type: "signup", email: sanitizeEmail(email) });
        if (error) {
          toast({ title: "Error", description: translateAuthError(error.message), variant: "destructive" });
        } else {
          toast({ title: "✅ Correo enviado", description: "Revisa tu bandeja de entrada y carpeta de spam." });
          setResendCooldown(RESEND_COOLDOWN);
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(sanitizeEmail(email), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) {
          toast({ title: "Error", description: translateAuthError(error.message), variant: "destructive" });
        } else {
          toast({ title: "✅ Correo enviado", description: "Revisa tu bandeja de entrada para restablecer tu contraseña." });
          setResendCooldown(RESEND_COOLDOWN);
        }
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión. Intenta de nuevo.", variant: "destructive" });
    }
    setLoading(false);
  }, [email, resendCooldown, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError(null);

    if (view === "login") {
      if (isLocked) {
        toast({ title: "Cuenta bloqueada", description: "Demasiados intentos fallidos. Restablece tu contraseña.", variant: "destructive" });
        setLoading(false);
        return;
      }

      loginInProgressRef.current = true;
      const { error } = await signIn(sanitizeEmail(email), password);
      if (error) {
        loginInProgressRef.current = false;
        if (isEmailNotConfirmedError(error.message || "")) {
          setView("resend");
          toast({
            title: "Correo no verificado",
            description: "Debes confirmar tu correo antes de iniciar sesión.",
            variant: "destructive",
          });
          supabase.auth.resend({ type: "signup", email: email.trim() }).then(() => {
            setResendCooldown(RESEND_COOLDOWN);
          });
          setLoading(false);
          return;
        }

        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        localStorage.setItem(ATTEMPTS_KEY, String(newAttempts));

        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          const lockUntil = Date.now() + LOCKOUT_DURATION;
          localStorage.setItem(LOCKOUT_KEY, String(lockUntil));
          setIsLocked(true);
          setLockoutRemaining(LOCKOUT_DURATION);
          toast({
            title: "🔒 Cuenta bloqueada",
            description: `Has superado ${MAX_LOGIN_ATTEMPTS} intentos fallidos. Debes restablecer tu contraseña para continuar.`,
            variant: "destructive",
          });
          setView("forgot");
        } else {
          toast({
            title: "Error al iniciar sesión",
            description: `${translateAuthError(error.message)} (Intento ${newAttempts}/${MAX_LOGIN_ATTEMPTS})`,
            variant: "destructive",
          });
        }
      } else {
        localStorage.removeItem(ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_KEY);
        setLoginAttempts(0);
        setIsLocked(false);

        const loginEmail = email || rememberedEmail;
        localStorage.setItem("last_login_email", loginEmail);
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", authUser.id).maybeSingle();
            if (profile?.full_name) localStorage.setItem("last_login_name", profile.full_name);
            if (profile?.avatar_url) localStorage.setItem("last_login_avatar", profile.avatar_url);
          }
        } catch (_) { /* non-critical */ }

        loginInProgressRef.current = false;
        if ((biometricAvailable || biometricChecking) && !biometricEnabled) {
          setShowBiometricPrompt(true);
        } else {
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
              const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id);
              const userRoles = roles?.map(r => r.role) || [];
              if (userRoles.includes('admin')) {
                navigate("/admin", { replace: true });
                return;
              } else if (userRoles.includes('dealer')) {
                navigate("/dealer", { replace: true });
                return;
              }
            }
          } catch (e) { }
          navigate("/mi-panel", { replace: true });
        }
        // Reset auto-prompt flag so next time they return it fires again
        autoPromptFiredRef.current = false;
      }
    } else if (view === "register") {
      if (!fullName.trim()) {
        toast({ title: "Error", description: "El nombre completo es obligatorio.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!termsAccepted) {
        toast({ title: "Términos requeridos", description: "Debes aceptar los términos y condiciones para registrarte.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const isValid = await validateBeforeRegister();
      if (!isValid) {
        setLoading(false);
        return;
      }

      const { error } = await signUp(sanitizeEmail(email), password, sanitizeText(fullName, 100), sanitizePhone(phone));
      if (error) {
        toast({ title: "Error al registrarse", description: translateAuthError(error.message), variant: "destructive" });
      } else {
        setView("signup-success");
      }
    }
    setLoading(false);
  };

  // ── Post-registration success view ──
  if (view === "signup-success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-brand-lime/5 border border-brand-lime/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-lime/10 flex items-center justify-center">
                  <CheckCircle2 className="h-9 w-9 text-brand-lime" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-lime flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-brand-dark" />
              </div>
            </div>
          </div>
          <div className="text-center mb-6 space-y-2">
            <p className="text-brand-lime/60 text-xs font-medium tracking-widest uppercase">Cuenta creada</p>
            <h3 className="text-2xl font-heading font-bold text-white">¡Registro exitoso!</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Enviamos un enlace de confirmación a<br />
              <span className="text-brand-lime font-medium">{email}</span>
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-lime/10 flex items-center justify-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-brand-lime" />
              </div>
              <p className="text-xs text-white/60">Revisa tu bandeja de entrada y <span className="text-white/80 font-medium">carpeta de spam</span>.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-lime/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-lime" />
              </div>
              <p className="text-xs text-white/60">Haz clic en el enlace para activar tu cuenta.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-lime/10 flex items-center justify-center shrink-0">
                <RefreshCw className="h-3.5 w-3.5 text-brand-lime" />
              </div>
              <p className="text-xs text-white/60">El enlace expira en <span className="text-white/80 font-medium">24 horas</span>.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleResendEmail("signup")}
              className="w-full h-14 bg-brand-lime text-brand-dark hover:bg-brand-lime/90 font-bold rounded-2xl text-sm shadow-lg active:scale-[0.98] transition-all"
              disabled={loading || resendCooldown > 0}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar correo"}
            </Button>
            <Button
              onClick={() => { setView("login"); setPassword(""); }}
              variant="ghost"
              className="w-full text-white/40 hover:text-white/70 hover:bg-transparent text-sm"
            >
              Ya confirmé → Iniciar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Resend verification view ──
  if (view === "resend") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-yellow-400/5 border border-yellow-400/20 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center">
                <Mail className="h-9 w-9 text-yellow-400" />
              </div>
            </div>
          </div>
          <div className="text-center mb-6 space-y-2">
            <p className="text-yellow-400/60 text-xs font-medium tracking-widest uppercase">Verificación pendiente</p>
            <h3 className="text-xl font-heading font-bold text-white">Confirma tu correo</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Tu cuenta aún no está verificada.<br />
              Revisa <span className="text-white/80">bandeja de entrada</span> y <span className="text-white/80">spam</span>.
            </p>
          </div>
          <div className="space-y-3 mb-6">
            <div className="space-y-1.5">
              <label className="text-xs text-white/40 font-medium pl-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-12 focus-visible:ring-yellow-400/30 focus-visible:border-yellow-400/40"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleResendEmail("signup")}
              className="w-full h-14 bg-yellow-400 text-brand-dark hover:bg-yellow-400/90 font-bold rounded-2xl text-sm shadow-lg active:scale-[0.98] transition-all"
              disabled={loading || resendCooldown > 0 || !email.trim()}
            >
              <Send className={`h-4 w-4 mr-2 ${loading ? "animate-pulse" : ""}`} />
              {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar enlace"}
            </Button>
            <Button
              onClick={() => { setView("login"); setPassword(""); }}
              variant="ghost"
              className="w-full text-white/40 hover:text-white/70 hover:bg-transparent text-sm"
            >
              ← Volver al login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password view ──
  if (view === "forgot") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-blue-400/5 border border-blue-400/20 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-blue-400/10 flex items-center justify-center">
                <KeyRound className="h-9 w-9 text-blue-400" />
              </div>
            </div>
          </div>
          <div className="text-center mb-6 space-y-2">
            <p className="text-blue-400/60 text-xs font-medium tracking-widest uppercase">Acceso seguro</p>
            <h3 className="text-xl font-heading font-bold text-white">Recuperar contraseña</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Ingresa tu correo y te enviaremos un enlace para restablecerla.
            </p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleResendEmail("recovery"); }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-white/40 font-medium pl-1">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-12 focus-visible:ring-blue-400/30 focus-visible:border-blue-400/40"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-14 bg-blue-400 text-white hover:bg-blue-400/90 font-bold rounded-2xl text-sm shadow-lg active:scale-[0.98] transition-all"
              disabled={loading || resendCooldown > 0}
            >
              <Send className={`h-4 w-4 mr-2 ${loading ? "animate-pulse" : ""}`} />
              {resendCooldown > 0 ? `Espera ${resendCooldown}s` : loading ? "Enviando..." : "Enviar enlace"}
            </Button>
          </form>
          <Button
            variant="ghost"
            className="w-full mt-3 text-white/40 hover:text-white/70 hover:bg-transparent text-sm"
            onClick={() => setView("login")}
          >
            ← Volver al login
          </Button>
        </div>
      </div>
    );
  }

  // ── Login / Register view ──
  const isLogin = view === "login";

  const rememberedEmail = localStorage.getItem("last_login_email") || "";
  const rememberedName = localStorage.getItem("last_login_name") || "";
  const rememberedAvatar = localStorage.getItem("last_login_avatar") || "";
  const isReturningUser = isLogin && !!rememberedEmail;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "¡Buenos días!";
    if (hour < 18) return "¡Buenas tardes!";
    return "¡Buenas noches!";
  };

  const handleBiometricEnable = async (enable: boolean) => {
    if (enable && biometricAvailable) {
      const loginEmail = email || rememberedEmail;
      // Always save the password (not refresh token) so biometric login always works
      const ok = await saveCredentials(loginEmail, password);
      if (ok) {
        toast({ title: "✅ Biometría activada", description: `Iniciarás sesión más rápido con tu ${getBiometryLabel()}.` });
      }
    }
    setShowBiometricPrompt(false);
    navigate("/home", { replace: true });
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await loginWithBiometric();
      if (result.success === false) {
        if (result.error !== "Cancelado por el usuario") {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      // Secret is always the password
      const { error } = await signIn(result.email, result.secret);
      if (error) {
        toast({ title: "Error", description: translateAuthError(error.message), variant: "destructive" });
      } else {
        setShowBiometricSuccess(true);
        setTimeout(() => navigate("/home", { replace: true }), 1400);
      }
    } catch {
      toast({ title: "Error", description: "No se pudo completar la verificación.", variant: "destructive" });
    }
    setLoading(false);
  };

  const maskEmail = (e: string) => {
    if (!e) return "";
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const masked = local.length <= 2 ? local[0] + "***" : local[0] + "***" + local.slice(-1);
    const [domName, ext] = domain.split(".");
    const maskedDom = domName.length <= 2 ? domName[0] + "***" : domName[0] + "***" + domName.slice(-1);
    return `${masked}@${maskedDom}.${ext}`;
  };

  // ── Biometric success screen ──
  if (showBiometricSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-6">
        <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-75 duration-500">
          <div className="w-20 h-20 rounded-full bg-brand-lime/10 border-2 border-brand-lime/30 flex items-center justify-center shadow-xl">
            <ShieldCheck className="h-10 w-10 text-brand-lime" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-brand-lime/60 text-xs font-medium tracking-widest uppercase">Identidad verificada</p>
            <h2 className="text-2xl font-heading font-bold text-white">¡Bienvenido!</h2>
            <p className="text-brand-lime/70 text-sm">Acceso con {getBiometryLabel()} exitoso</p>
          </div>
          <div className="flex gap-1.5 mt-2">
            <span className="w-2 h-2 rounded-full bg-brand-lime animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-brand-lime animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-brand-lime animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Biometric activation prompt (modal overlay after login) ──
  if (showBiometricPrompt && biometricAvailable) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
          {/* Glow ring */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-brand-lime/5 border border-brand-lime/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-lime/10 flex items-center justify-center">
                  <Fingerprint className="h-9 w-9 text-brand-lime" />
                </div>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-lime flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-brand-dark" />
              </div>
            </div>
          </div>

          <div className="text-center mb-6 space-y-2">
            <p className="text-brand-lime/60 text-xs font-medium tracking-widest uppercase">Acceso seguro</p>
            <h3 className="text-xl font-heading font-bold text-white">Activar {getBiometryLabel()}</h3>
            <p className="text-sm text-white/50 leading-relaxed px-2">
              La próxima vez entrarás al instante sin escribir contraseña.
            </p>
          </div>

          {/* Security badges */}
          <div className="flex justify-center gap-3 mb-8">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <ShieldCheck className="h-3 w-3 text-brand-lime" />
              <span className="text-[11px] text-white/60">Encriptado</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <Fingerprint className="h-3 w-3 text-brand-lime" />
              <span className="text-[11px] text-white/60">Solo en tu dispositivo</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="w-full h-14 bg-brand-lime text-brand-dark hover:bg-brand-lime/90 font-bold rounded-2xl text-sm tracking-wide shadow-lg active:scale-[0.98] transition-all"
              onClick={() => handleBiometricEnable(true)}
            >
              <Fingerprint className="h-4 w-4 mr-2" />
              Sí, activar ahora
            </Button>
            <Button
              variant="ghost"
              className="w-full text-white/40 hover:text-white/70 hover:bg-transparent text-sm"
              onClick={() => handleBiometricEnable(false)}
            >
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header decorative strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-brand-dark via-primary to-brand-dark" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">

          {isLogin && isReturningUser ? (
            <>
              {/* Returning user: avatar + greeting */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary/20 bg-muted mb-3 shadow-md">
                  {rememberedAvatar ? (
                    <img src={rememberedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                      <User className="h-8 w-8 text-primary/60" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-0.5">{getGreeting()}</p>
                <h2 className="text-lg font-heading font-bold text-foreground">{rememberedName || "Usuario"}</h2>
                <p className="text-xs text-muted-foreground/70">{maskEmail(rememberedEmail)}</p>
              </div>

              {/* Biometric button — prominent */}
              {biometricEnabled && !biometricChecking && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full mb-4 flex items-center gap-4 p-4 rounded-2xl bg-brand-dark text-brand-lime shadow-lg hover:bg-brand-dark/90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-lime/10 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-6 w-6 text-brand-lime" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold leading-tight">Entrar con {getBiometryLabel()}</p>
                    <p className="text-[11px] text-brand-lime/70 leading-tight mt-0.5">Rápido y seguro</p>
                  </div>
                </button>
              )}

              <form onSubmit={(e) => { setEmail(rememberedEmail); handleSubmit(e); }} className="w-full space-y-4">
                <input type="hidden" value={rememberedEmail} onChange={() => { }} />

                {/* Divider when biometric is shown */}
                {biometricEnabled && !biometricChecking && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-muted-foreground">o con contraseña</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <PasswordInput
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 pr-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>

                {loginAttempts > 0 && !isLocked && (
                  <p className="text-[11px] text-destructive/80 pl-1">
                    Intento {loginAttempts}/{MAX_LOGIN_ATTEMPTS}
                  </p>
                )}
                {isLocked && (
                  <div className="flex items-center gap-2 bg-destructive/10 rounded-xl px-3 py-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                    <p className="text-[11px] text-destructive font-medium">
                      Bloqueado — restablece tu contraseña ({Math.ceil(lockoutRemaining / 60000)} min)
                    </p>
                  </div>
                )}

                <div className="text-right">
                  <button type="button" onClick={() => setView("forgot")} className="text-xs text-primary hover:underline font-medium">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{validationError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-14 bg-brand-dark text-brand-lime hover:bg-brand-dark/90 font-bold rounded-2xl text-sm tracking-wide shadow-md active:scale-[0.98] transition-all"
                  disabled={loading || isLocked}
                >
                  {loading ? "Verificando..." : "Ingresar"}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("last_login_email");
                    localStorage.removeItem("last_login_name");
                    localStorage.removeItem("last_login_avatar");
                    setEmail("");
                    setPassword("");
                    window.location.reload();
                  }}
                  className="block w-full text-center text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Usar otra cuenta
                </button>
              </form>
            </>
          ) : isLogin ? (
            <>
              {/* Standard login */}
              <div className="flex flex-col items-center mb-8">
                <img src={logo} alt="Subastandolo" className="w-48 object-contain mb-6" />
                <h2 className="text-2xl font-heading font-bold text-foreground">Iniciar Sesión</h2>
                <p className="text-sm text-muted-foreground mt-1">Accede a tu cuenta de subastas</p>
              </div>

              {/* Biometric prominent button */}
              {biometricEnabled && !biometricChecking && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={loading}
                  className="w-full mb-5 flex items-center gap-4 p-4 rounded-2xl bg-brand-dark text-brand-lime shadow-lg hover:bg-brand-dark/90 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <div className="w-11 h-11 rounded-xl bg-brand-lime/10 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-6 w-6 text-brand-lime" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold leading-tight">Entrar con {getBiometryLabel()}</p>
                    <p className="text-[11px] text-brand-lime/70 leading-tight mt-0.5">Rápido y seguro</p>
                  </div>
                </button>
              )}

              <form onSubmit={handleSubmit} className="w-full space-y-4">
                {biometricEnabled && !biometricChecking && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-muted-foreground">o con correo</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    required
                    autoComplete="username"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <PasswordInput
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 pr-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>

                {loginAttempts > 0 && !isLocked && (
                  <p className="text-[11px] text-destructive/80 pl-1">
                    Intento {loginAttempts}/{MAX_LOGIN_ATTEMPTS}
                  </p>
                )}

                <div className="flex justify-between items-center px-1">
                  <button type="button" onClick={() => setView("resend")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    ¿No recibiste verificación?
                  </button>
                  <button type="button" onClick={() => setView("forgot")} className="text-xs text-primary hover:underline font-medium">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{validationError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-14 bg-brand-dark text-brand-lime hover:bg-brand-dark/90 font-bold rounded-2xl text-sm tracking-wide shadow-md active:scale-[0.98] transition-all"
                  disabled={loading || isLocked}
                >
                  {loading ? "Verificando..." : "Ingresar"}
                </Button>
              </form>
            </>
          ) : (
            <>
              {/* Register */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-brand-dark flex items-center justify-center mb-4 shadow-md">
                  <User className="h-7 w-7 text-brand-lime" />
                </div>
                <h2 className="text-2xl font-heading font-bold text-foreground">Crear Cuenta</h2>
                <p className="text-sm text-muted-foreground mt-1">Regístrate para participar en subastas</p>
              </div>

              <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nombre completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    required
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Teléfono (Ej: 0412-1234567)"
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9+\-\s]/g, "");
                      const digits = val.replace(/\D/g, "");
                      if (digits.startsWith("5858")) val = "+58" + digits.slice(4);
                      else if (digits.startsWith("580")) val = "+58" + digits.slice(3);
                      setPhone(val);
                    }}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    required
                    autoComplete="username"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <PasswordInput
                    placeholder="Contraseña (mín. 6 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border border-input bg-background pl-12 pr-12 text-base focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex items-start gap-3 bg-muted/40 rounded-2xl p-3">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5 shrink-0"
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                    He leído y acepto los{" "}
                    <Link to="/terminos" className="text-primary hover:underline font-semibold" target="_blank">
                      Términos y Condiciones
                    </Link>
                  </label>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{validationError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-14 bg-brand-dark text-brand-lime hover:bg-brand-dark/90 font-bold rounded-2xl text-sm tracking-wide shadow-md active:scale-[0.98] transition-all"
                  disabled={loading}
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Bottom: Switch between login/register */}
      <div className="pb-8 pt-2 text-center px-6">
        <button
          type="button"
          onClick={() => {
            setView(isLogin ? "register" : "login");
            setValidationError(null);
            setPassword("");
          }}
          className="text-sm text-muted-foreground"
        >
          {isLogin ? (
            <span>¿No tienes cuenta? <span className="text-primary font-semibold">Regístrate</span></span>
          ) : (
            <span>¿Ya tienes cuenta? <span className="text-primary font-semibold">Inicia sesión</span></span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Auth;
