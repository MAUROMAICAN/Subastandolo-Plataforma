import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail, Lock, User, Phone, ShieldAlert, CircleCheck,
  RefreshCw, Fingerprint, ShieldCheck, Sparkles, Send, KeyRound
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { translateAuthError, isEmailNotConfirmedError } from "@/lib/authErrors";
import { sanitizeEmail, sanitizeText, sanitizePhone } from "@/lib/sanitize";
import { BASE_URL } from "@/lib/env";
import PasswordInput from "@/components/PasswordInput";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";

const MAX_LOGIN_ATTEMPTS = 4;
const LOCKOUT_KEY = "login_lockout";
const ATTEMPTS_KEY = "login_attempts";
const LOCKOUT_DURATION = 15 * 60 * 1000;
const RESEND_COOLDOWN = 30;
const MAX_BIOMETRIC_ATTEMPTS = 3;
const BIOMETRIC_ATTEMPTS_KEY = "biometric_attempts";

type AuthView =
  | "login-email"
  | "welcome-back"
  | "password"
  | "register-email"
  | "register-details"
  | "forgot"
  | "resend"
  | "signup-success";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Biometric enrollment checkbox on password screen
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(false);
  const [showBiometricSuccess, setShowBiometricSuccess] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);

  const loginInProgressRef = useRef(false);
  const autoPromptFiredRef = useRef(false);

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

  const biometryLabel = useMemo(() => getBiometryLabel(), [getBiometryLabel]);

  // ── Check lockout on mount ──
  useEffect(() => {
    const lockUntil = localStorage.getItem(LOCKOUT_KEY);
    const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || "0");
    setLoginAttempts(attempts);
    if (lockUntil) {
      const remaining = parseInt(lockUntil) - Date.now();
      if (remaining > 0) {
        setIsLocked(true);
      } else {
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      }
    }
  }, []);

  // ── Lockout countdown ──
  useEffect(() => {
    if (!isLocked) return undefined;
    const interval = setInterval(() => {
      const lockUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || "0");
      const remaining = lockUntil - Date.now();
      if (remaining <= 0) {
        setIsLocked(false);
        setLoginAttempts(0);
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(ATTEMPTS_KEY);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked]);

  // ── Resend cooldown ──
  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ── Auto-redirect if already logged in ──
  useEffect(() => {
    if (!user) return;
    if (loginInProgressRef.current) return;
    navigate("/home", { replace: true });
  }, [user, navigate]);

  // ── Detect remembered user on mount → welcome-back screen ──
  useEffect(() => {
    const saved = localStorage.getItem("last_login_email") || "";
    if (saved) {
      setEmail(saved);
      setView("welcome-back");
    }
  }, []);

  // ── Auto-prompt biometrics on welcome-back if enabled ──
  useEffect(() => {
    if (biometricChecking) return;
    if (!biometricEnabled) return;
    if (autoPromptFiredRef.current) return;
    if (user) return;
    // Only auto-prompt when in welcome-back view
    if (view !== "welcome-back") return;
    // If we already failed biometrics 3 times, go straight to password
    const storedAttempts = parseInt(localStorage.getItem(BIOMETRIC_ATTEMPTS_KEY) || "0");
    if (storedAttempts >= MAX_BIOMETRIC_ATTEMPTS) {
      setBiometricFailed(true);
      setView("password");
      return;
    }
    autoPromptFiredRef.current = true;
    void handleBiometricLogin();
  }, [biometricEnabled, biometricChecking, user, view]);

  // ── Validation before register ──
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
        if (errors.includes("blacklisted_email") || errors.includes("blacklisted_phone")) {
          setValidationError("Esta información está asociada a una cuenta suspendida.");
          return false;
        }
        if (errors.includes("duplicate_phone")) {
          setValidationError("Este teléfono ya está registrado en otra cuenta.");
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

  // ── Resend email ──
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
          redirectTo: `${BASE_URL}/reset-password`,
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

  // ── Biometric login with attempt counting ──
  const handleBiometricLogin = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loginWithBiometric();
      if (result.success === false) {
        if (result.error === "Cancelado por el usuario") {
          setLoading(false);
          return;
        }
        // Count failed attempt
        const storedAttempts = parseInt(localStorage.getItem(BIOMETRIC_ATTEMPTS_KEY) || "0");
        const newAttempts = storedAttempts + 1;
        localStorage.setItem(BIOMETRIC_ATTEMPTS_KEY, String(newAttempts));

        if (newAttempts >= MAX_BIOMETRIC_ATTEMPTS) {
          // 3 fails → force password
          setBiometricFailed(true);
          setView("password");
          toast({ title: "Biometría bloqueada", description: "Has fallado 3 veces. Ingresa tu contraseña para continuar.", variant: "destructive" });
        } else {
          toast({ title: "Error biométrico", description: `${result.error} (${newAttempts}/${MAX_BIOMETRIC_ATTEMPTS} intentos)`, variant: "destructive" });
        }
        setLoading(false);
        return;
      }

      // Success → reset biometric attempt counter
      localStorage.removeItem(BIOMETRIC_ATTEMPTS_KEY);

      loginInProgressRef.current = true;
      const { error } = await signIn(result.email, result.secret);
      if (error) {
        loginInProgressRef.current = false;
        toast({ title: "Error", description: translateAuthError(error.message), variant: "destructive" });
      } else {
        setShowBiometricSuccess(true);
        setTimeout(() => navigate("/home", { replace: true }), 1400);
      }
    } catch {
      toast({ title: "Error", description: "No se pudo completar la verificación.", variant: "destructive" });
    }
    setLoading(false);
  }, [loginWithBiometric, signIn, toast, navigate]);

  // ── Main submit (login / register) ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationError(null);

    if (view === "password") {
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
          toast({ title: "Correo no verificado", description: "Debes confirmar tu correo antes de iniciar sesión.", variant: "destructive" });
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
        // ── Login success ──
        localStorage.removeItem(ATTEMPTS_KEY);
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(BIOMETRIC_ATTEMPTS_KEY);
        setLoginAttempts(0);
        setIsLocked(false);
        setBiometricFailed(false);

        // Save last login info
        const loginEmail = email;
        localStorage.setItem("last_login_email", loginEmail);
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", authUser.id).maybeSingle();
            if (profile?.full_name) localStorage.setItem("last_login_name", profile.full_name);
            if (profile?.avatar_url) localStorage.setItem("last_login_avatar", profile.avatar_url);
          }
        } catch { /* non-critical */ }

        // If user opted in for biometrics, save credentials NOW
        if (enableBiometricOnLogin && biometricAvailable) {
          await saveCredentials(loginEmail, password);
          toast({ title: `✅ ${getBiometryLabel()} activada`, description: "La próxima vez entrarás sin escribir tu contraseña." });
        }

        loginInProgressRef.current = false;
        autoPromptFiredRef.current = false;

        // Redirect by role
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', currentUser.id);
            const userRoles = roles?.map(r => r.role) || [];
            if (userRoles.includes('admin')) { navigate("/admin", { replace: true }); return; }
            if (userRoles.includes('dealer')) { navigate("/dealer", { replace: true }); return; }
          }
        } catch { /* ignore */ }
        navigate("/mi-panel", { replace: true });
      }

    } else if (view === "register-details") {
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
      if (!isValid) { setLoading(false); return; }

      const { error } = await signUp(sanitizeEmail(email), password, sanitizeText(fullName, 100), sanitizePhone(phone));
      if (error) {
        toast({ title: "Error al registrarse", description: translateAuthError(error.message), variant: "destructive" });
      } else {
        setView("signup-success");
      }
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "¡Buenos días";
    if (hour >= 12 && hour < 18) return "¡Buenas tardes";
    return "¡Buenas noches";
  };

  const rememberedEmail = localStorage.getItem("last_login_email") || "";
  const rememberedName = localStorage.getItem("last_login_name") || "";
  const rememberedAvatar = localStorage.getItem("last_login_avatar") || "";

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

  // ── Signup success ──
  if (view === "signup-success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-dark px-6">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-400">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-brand-lime/5 border border-brand-lime/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-brand-lime/10 flex items-center justify-center">
                  <CircleCheck className="h-9 w-9 text-brand-lime" />
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
              onClick={() => { setView("login-email"); setPassword(""); }}
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

  // ── Resend verification ──
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
            <p className="text-sm text-white/50 leading-relaxed">Tu cuenta aún no está verificada.<br />Revisa <span className="text-white/80">bandeja de entrada</span> y <span className="text-white/80">spam</span>.</p>
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
              onClick={() => { setView("login-email"); setPassword(""); }}
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

  // ── Forgot password ──
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
            <p className="text-sm text-white/50 leading-relaxed">Ingresa tu correo y te enviaremos un enlace para restablecerla.</p>
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
            onClick={() => setView("login-email")}
          >
            ← Volver al login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {import.meta.env.DEV && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 p-3 text-center">
          <p className="text-xs text-blue-800 dark:text-blue-400 mb-2 font-medium">Modo de Pruebas Local Detectado</p>
          <Button
            size="sm"
            onClick={() => {
              localStorage.setItem("dev_bypass", "true");
              window.location.reload();
            }}
            className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-xs h-8 rounded-full"
          >
            🔌 Entrar Directo (Modo Maqueta)
          </Button>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">

          {/* ─────────────────────────────────── */}
          {/* WELCOME BACK – fondo blanco neutro  */}
          {/* ─────────────────────────────────── */}
          {view === "welcome-back" && (
            <div className="animate-in fade-in duration-300">
              {/* Avatar / illustration */}
              <div className="flex flex-col items-center mb-10">
                <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary/10 bg-muted mb-5 shadow-lg">
                  {rememberedAvatar ? (
                    <img src={rememberedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <User className="h-12 w-12 text-primary/40" />
                    </div>
                  )}
                </div>
                <p className="text-sm font-semibold text-muted-foreground tracking-widest uppercase mb-1">
                  {getGreeting()},
                </p>
                <h2 className="text-4xl font-black text-foreground tracking-tight text-center">
                  {rememberedName || "Usuario"}!
                </h2>
                <p className="text-sm text-muted-foreground mt-2 font-medium text-center">{maskEmail(rememberedEmail)}</p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => {
                    setEmail(rememberedEmail);
                    // If biometric available & enabled, try biometric first
                    if (biometricEnabled && biometricAvailable && !biometricChecking) {
                      autoPromptFiredRef.current = true;
                      void handleBiometricLogin();
                    } else {
                      setView("password");
                    }
                  }}
                  className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 font-bold rounded-2xl text-base tracking-wide shadow-lg active:scale-[0.98] transition-all"
                >
                  {biometricEnabled && !biometricFailed ? (
                    <><Fingerprint className="h-5 w-5 mr-2" />Ingresar con {biometryLabel}</>
                  ) : "Ingresar"}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    if (biometricEnabled && biometricAvailable && !biometricChecking && !biometricFailed) {
                      setView("password");
                    }
                    // else fall back to password directly
                    setView("password");
                    setEmail(rememberedEmail);
                  }}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Usar contraseña
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("last_login_email");
                    localStorage.removeItem("last_login_name");
                    localStorage.removeItem("last_login_avatar");
                    localStorage.removeItem(BIOMETRIC_ATTEMPTS_KEY);
                    setEmail("");
                    setPassword("");
                    setBiometricFailed(false);
                    localStorage.removeItem(BIOMETRIC_ATTEMPTS_KEY);
                    setView("login-email");
                  }}
                  className="block w-full text-center text-xs font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
                >
                  Este no es mi correo
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────── */}
          {/* STEP 1: ENTER EMAIL                 */}
          {/* ─────────────────────────────────── */}
          {view === "login-email" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Logo */}
              <div className="flex justify-center items-center mb-8">
                <img src="/inicio_claro.svg" alt="Subastándolo" className="h-24 sm:h-32 w-auto dark:hidden" />
                <img src="/inicio_oscuro.svg" alt="Subastándolo" className="h-24 sm:h-32 w-auto hidden dark:block" />
              </div>

              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight">
                  Inicia sesión en<br />Subastándolo
                </h2>
                <p className="text-sm text-muted-foreground mt-2">Ingresa tu correo para continuar.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); setView("password"); }} className="space-y-4">
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="tumail@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 rounded-2xl border border-border/50 bg-muted/20 pl-4 pr-4 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!email.includes('@')}
                  className="w-full h-14 bg-zinc-800 text-white hover:bg-zinc-700 font-bold rounded-2xl text-base tracking-wide shadow active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  Ingresar
                </Button>
              </form>
            </div>
          )}

          {/* ─────────────────────────────────── */}
          {/* STEP 2: PASSWORD                    */}
          {/* ─────────────────────────────────── */}
          {view === "password" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                onClick={() => setView(rememberedEmail ? "welcome-back" : "login-email")}
                className="mb-6 p-2 -ml-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"
                aria-label="Volver"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>

              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight">
                  Ingresa tu contraseña 🔑
                </h2>
                <p className="text-sm font-medium text-muted-foreground mt-2">{maskEmail(email)}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <PasswordInput
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border border-border/50 bg-muted/20 pl-4 pr-12 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                    required
                    minLength={6}
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>

                {loginAttempts > 0 && !isLocked && (
                  <p className="text-[11px] text-destructive/80 pl-1">
                    Intento {loginAttempts}/{MAX_LOGIN_ATTEMPTS}
                  </p>
                )}

                {/* ── Biometric enrollment checkbox ── */}
                {biometricAvailable && !biometricChecking && !biometricEnabled && (
                  <div
                    className="flex items-start gap-3 bg-muted/30 border border-border/40 rounded-2xl p-4"
                  >
                    <Checkbox
                      id="enable-biometric"
                      checked={enableBiometricOnLogin}
                      onCheckedChange={(checked) => setEnableBiometricOnLogin(checked === true)}
                      className="mt-0.5 shrink-0"
                    />
                    <label htmlFor="enable-biometric" className="text-sm text-foreground/80 font-medium leading-snug cursor-pointer select-none">
                      <span className="flex items-center gap-1.5 mb-0.5">
                        <Fingerprint className="h-4 w-4 text-primary" />
                        Iniciar sesión con {biometryLabel}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal">
                        La próxima vez entrarás sin escribir tu contraseña.
                      </span>
                    </label>
                  </div>
                )}

                {/* Already biometric enabled hint */}
                {biometricEnabled && !biometricFailed && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span>{biometryLabel} activa — <button type="button" className="text-primary hover:underline" onClick={() => setView("welcome-back")}>usar biometría</button></span>
                  </div>
                )}

                {biometricFailed && (
                  <div className="flex items-center gap-2 text-xs text-destructive/80 pl-1">
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>Biometría bloqueada por 3 intentos. Ingresa tu contraseña.</span>
                  </div>
                )}

                <div className="flex justify-between items-center px-1 pt-1">
                  <button type="button" onClick={() => setView("resend")} className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                    ¿No verificaste el correo?
                  </button>
                  <button type="button" onClick={() => setView("forgot")} className="text-xs font-semibold text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-destructive">{validationError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-14 bg-zinc-800 text-white hover:bg-zinc-700 font-bold rounded-2xl text-base tracking-wide shadow active:scale-[0.98] transition-all disabled:opacity-40"
                  disabled={loading || isLocked || password.length < 6}
                >
                  {loading ? "Ingresando..." : "Entrar"}
                </Button>
              </form>
            </div>
          )}

          {/* ─────────────────────────────────── */}
          {/* STEP 3: REGISTER EMAIL              */}
          {/* ─────────────────────────────────── */}
          {view === "register-email" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                onClick={() => setView("login-email")}
                className="mb-6 p-2 -ml-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"
                aria-label="Volver"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>

              {/* Logo */}
              <div className="flex justify-center items-center mb-6 mt-4">
                <img src="/inicio_claro.svg" alt="Subastándolo" className="h-24 sm:h-32 w-auto dark:hidden" />
                <img src="/inicio_oscuro.svg" alt="Subastándolo" className="h-24 sm:h-32 w-auto hidden dark:block" />
              </div>
              <div className="mb-3 text-3xl text-center">👋</div>
              <div className="mb-8 text-center">
                <h2 className="text-3xl font-black text-foreground tracking-tight leading-tight">Crea tu cuenta en Subastándolo</h2>
                <p className="text-sm text-muted-foreground mt-2">Usa tu mejor correo para las subastas.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); setView("register-details"); }} className="space-y-4">
                <Input
                  type="email"
                  placeholder="tumail@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 rounded-2xl border border-border/50 bg-muted/20 pl-4 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                  required
                  autoComplete="username"
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={!email.includes('@')}
                  className="w-full h-14 bg-zinc-800 text-white hover:bg-zinc-700 font-bold rounded-2xl text-base tracking-wide shadow active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  Continuar
                </Button>
              </form>
            </div>
          )}

          {/* ─────────────────────────────────── */}
          {/* STEP 4: REGISTER DETAILS            */}
          {/* ─────────────────────────────────── */}
          {view === "register-details" && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                onClick={() => setView("register-email")}
                className="mb-6 p-2 -ml-2 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <div className="mb-6 text-center">
                <h2 className="text-3xl font-black text-foreground tracking-tight">Casi listo</h2>
                <p className="text-sm font-medium text-muted-foreground mt-2">{maskEmail(email)}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <Input
                    placeholder="Tu nombre completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-14 rounded-2xl border border-border/50 bg-muted/20 pl-12 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                    required
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <Input
                    placeholder="Teléfono móvil"
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9+\-\s]/g, "");
                      const digits = val.replace(/\D/g, "");
                      if (digits.startsWith("5858")) val = "+58" + digits.slice(4);
                      else if (digits.startsWith("580")) val = "+58" + digits.slice(3);
                      setPhone(val);
                    }}
                    className="h-14 rounded-2xl border border-border/50 bg-muted/20 pl-12 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                  <PasswordInput
                    placeholder="Crea una contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 rounded-2xl border border-border/50 bg-muted/20 pl-12 pr-12 text-base font-medium focus-visible:ring-1 focus-visible:ring-primary/50 transition-all"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>

                <div
                  className="flex items-start gap-3 bg-muted/30 border border-border/40 rounded-2xl p-4"
                >
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5 shrink-0"
                  />
                  <label htmlFor="terms" className="text-xs text-muted-foreground font-medium leading-relaxed cursor-pointer">
                    Acepto los <Link to="/terminos" className="text-primary hover:underline font-bold" target="_blank">Términos y Condiciones</Link>
                  </label>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-destructive">{validationError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-14 bg-zinc-800 text-white hover:bg-zinc-700 font-bold rounded-2xl text-base tracking-wide shadow active:scale-[0.98] transition-all disabled:opacity-40"
                  disabled={loading || !termsAccepted || password.length < 6 || !fullName.trim()}
                >
                  {loading ? "Creando..." : "Finalizar registro"}
                </Button>
              </form>
            </div>
          )}

        </div>
      </div>

      {/* ── Bottom toggle (login-email / register-email) ── */}
      {(view === "login-email" || view === "register-email") && (
        <div className="pb-8 pt-4 text-center px-6 border-t border-border/50">
          <button
            onClick={() => {
              setView(view === "login-email" ? "register-email" : "login-email");
              setValidationError(null);
              setPassword("");
            }}
            className="flex items-center justify-center gap-2 mx-auto text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {view === "login-email" ? (
              <><span className="text-xl">👋</span> ¿Primera vez aquí? <span className="text-primary font-bold ml-1">Crea tu cuenta ahora</span></>
            ) : (
              <>¿Ya tienes cuenta? <span className="text-primary font-bold ml-1">Inicia sesión</span></>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default Auth;
