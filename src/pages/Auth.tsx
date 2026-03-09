import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail, Lock, User, Phone, ShieldAlert, CircleCheck,
  RefreshCw, Fingerprint, ShieldCheck, Send, KeyRound
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
  | "verify-otp"
  | "signup-success";

const Auth = () => {
  const [view, setView] = useState<AuthView>("login-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cedula, setCedula] = useState("");
  const [cedulaPrefix, setCedulaPrefix] = useState("V");
  const [phone, setPhone] = useState("");
  const [estado, setEstado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // OTP state
  const [otpCode, setOtpCode] = useState<string[]>(Array(6).fill(""));
  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));
  // Biometric enrollment checkbox on password screen
  const [enableBiometricOnLogin, setEnableBiometricOnLogin] = useState(false);
  const [showBiometricSuccess, setShowBiometricSuccess] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);

  const loginInProgressRef = useRef(false);
  const autoPromptFiredRef = useRef(false);

  const { user, signIn, signUp, loading: authLoading } = useAuth();
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
    if (authLoading || !user) return;
    if (loginInProgressRef.current) return;

    // Check if profile is complete before redirecting to home
    const checkProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        // If profile is complete, we can redirect to home or panel
        navigate("/home", { replace: true });
      } else {
        // If profile is incomplete, stay here and show registration details
        console.log("Profile incomplete, staying on register-details");
        setView("register-details");
        // Also ensure email is set if available from session
        if (user.email) setEmail(user.email);
      }
    };

    checkProfile();
  }, [user, navigate, authLoading]);

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
      console.log("[validate-registration] data:", data, "error:", error);
      if (error) {
        // If validation service is temporarily unavailable, allow registration to proceed
        // rather than blocking the user — Supabase's own signup will handle duplicates
        console.warn("[validate-registration] Edge Function error, allowing registration:", error);
        return true;
      }
      if (!data) {
        // No data but no error — allow registration
        console.warn("[validate-registration] No data returned, allowing registration");
        return true;
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
    } catch (err) {
      // Network error or other failure — don't block registration
      console.warn("[validate-registration] Exception, allowing registration:", err);
      return true;
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
          const saved = await saveCredentials(loginEmail, password);
          if (saved) {
            toast({ title: `✅ ${getBiometryLabel()} activada`, description: "La próxima vez entrarás sin escribir tu contraseña." });
          } else {
            toast({ title: "No se pudo activar", description: "Intenta activar la biometría desde tu próximo inicio de sesión.", variant: "destructive" });
          }
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
        navigate("/", { replace: true });
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
        setOtpCode(Array(6).fill(""));
        setView("verify-otp");
        setResendCooldown(RESEND_COOLDOWN);
      }
    }
    setLoading(false);
  };

  const checkEmailExists = async (emailToCheck: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("check-email-exists", {
        body: { email: emailToCheck },
      });
      if (error || !data) return false;
      return data.exists === true;
    } catch {
      return false;
    }
  };

  const maskEmail = (e: string) => {
    if (!e) return "";
    const [local, domain] = e.split("@");
    if (!domain) return e;
    const masked = local.length <= 2 ? local[0] + "***" : local[0] + "***" + local.slice(-1);
    const dotIndex = domain.lastIndexOf(".");
    if (dotIndex <= 0) {
      // No extension (e.g. localhost) - just mask the domain
      const maskedDom = domain.length <= 2 ? domain[0] + "***" : domain[0] + "***" + domain.slice(-1);
      return `${masked}@${maskedDom}`;
    }
    const domName = domain.slice(0, dotIndex);
    const ext = domain.slice(dotIndex + 1);
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

  // ── Native hardware back button handler ──
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = CapApp.addListener('backButton', () => {
      if (view === 'password') setView(rememberedEmail ? 'welcome-back' : 'login-email');
      else if (view === 'register-details') setView('login-email');
      else if (view === 'verify-otp') setView('login-email');
      else if (view === 'signup-success') setView('login-email');
      else if (view === 'forgot') setView('password');
      else if (view === 'resend') setView('login-email');
      else if (view === 'welcome-back') CapApp.minimizeApp();
      else if (view === 'login-email') CapApp.minimizeApp();
    });
    return () => { listener.then(h => h.remove()); };
  }, [view, rememberedEmail]);
  const rememberedName = localStorage.getItem("last_login_name") || "";
  const rememberedAvatar = localStorage.getItem("last_login_avatar") || "";

  // ── OTP verification ──
  const handleVerifyOtp = async (code: string) => {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const { data: verifyData, error } = await supabase.auth.verifyOtp({
        email: sanitizeEmail(email),
        token: code,
        type: "email",
      });
      if (error) {
        toast({ title: "Código incorrecto", description: "El código no es válido o ya expiró. Solicita uno nuevo.", variant: "destructive" });
        setOtpCode(Array(6).fill(""));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      } else {
        // OTP verificado — actualizar perfil con todos los datos del formulario
        const userId = verifyData?.user?.id;
        if (userId) {
          const fullCedula = cedula ? `${cedulaPrefix}-${cedula}` : null;
          // Esperar brevemente a que el trigger cree el perfil base
          await new Promise(res => setTimeout(res, 800));
          await supabase.from("profiles").upsert({
            id: userId,
            full_name: sanitizeText(`${firstName} ${lastName}`.trim(), 100) || sanitizeText(fullName, 100),
            first_name: sanitizeText(firstName, 50) || undefined,
            last_name: sanitizeText(lastName, 50) || undefined,
            phone: sanitizePhone(phone) || undefined,
            state: estado || undefined,
            city: ciudad || undefined,
            cedula_number: fullCedula || undefined,
          }, { onConflict: "id" });
        }
        toast({ title: "✅ ¡Cuenta verificada!", description: "Tu cuenta ha sido activada correctamente." });
        navigate("/", { replace: true });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión. Intenta de nuevo.", variant: "destructive" });
    }
    setLoading(false);
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

  // ── OTP verify screen ──
  if (view === "verify-otp") {
    const fullCode = otpCode.join("");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#161625] px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-brand-lime/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-500 relative z-10">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-[28px] bg-brand-lime/10 border border-brand-lime/20 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(200,241,53,0.3)] rotate-3">
                <ShieldCheck className="h-10 w-10 text-brand-lime -rotate-3" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-brand-lime border-4 border-[#161625] flex items-center justify-center shadow-lg">
                <Mail className="h-3.5 w-3.5 text-brand-dark" />
              </div>
            </div>
          </div>

          <div className="text-center mb-8 space-y-2">
            <h3 className="text-[28px] font-black text-white tracking-tight leading-tight">Ingresa tu código</h3>
            <p className="text-sm text-white/50 leading-relaxed font-medium">
              Enviamos un código de 6 dígitos a<br />
              <span className="text-brand-lime font-bold">{email}</span>
            </p>
          </div>

          {/* 6-digit PIN inputs */}
          <div className="flex gap-2.5 justify-center mb-8">
            {Array(6).fill(null).map((_, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpCode[i]}
                autoFocus={i === 0}
                className={`w-12 h-14 text-center text-xl font-black rounded-xl border bg-white/5 text-white caret-brand-lime outline-none transition-all shadow-sm ${otpCode[i] ? "border-brand-lime/50 bg-brand-lime/5 scale-105" : "border-white/10 focus:border-brand-lime/50"
                  }`}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "").slice(-1);
                  const newCode = [...otpCode];
                  newCode[i] = val;
                  setOtpCode(newCode);
                  if (val && i < 5) otpRefs.current[i + 1]?.focus();
                  if (newCode.every(d => d !== "") && newCode.join("").length === 6) {
                    handleVerifyOtp(newCode.join(""));
                  }
                }}
                onKeyDown={e => {
                  if (e.key === "Backspace" && !otpCode[i] && i > 0) otpRefs.current[i - 1]?.focus();
                }}
                onPaste={e => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                  if (!pasted) return;
                  const newCode = Array(6).fill("");
                  pasted.split("").forEach((c, idx) => { newCode[idx] = c; });
                  setOtpCode(newCode);
                  const nextEmpty = newCode.findIndex(d => d === "");
                  const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
                  otpRefs.current[focusIndex]?.focus();
                  if (pasted.length === 6) handleVerifyOtp(pasted);
                }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={loading || fullCode.length < 6}
              onClick={() => handleVerifyOtp(fullCode)}
              className="w-full h-14 flex items-center justify-center gap-2 bg-brand-lime text-brand-dark font-black tracking-wide rounded-2xl text-base shadow-[0_10px_30px_-10px_rgba(200,241,53,0.4)] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <><RefreshCw className="h-5 w-5 animate-spin" /> Verificando...</> : <><CircleCheck className="h-5 w-5" /> Verificar código</>}
            </button>

            <button
              type="button"
              disabled={resendCooldown > 0 || loading}
              onClick={() => handleResendEmail("signup")}
              className="w-full text-white/40 hover:text-white/70 text-xs font-bold py-4 transition-colors disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {resendCooldown > 0 ? `Reenviar código en ${resendCooldown}s` : "Reenviar código"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Signup success (fallback) ──
  if (view === "signup-success") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#161625] px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[30%] left-[-20%] w-[70vw] h-[70vw] rounded-full bg-brand-lime/5 blur-[120px]" />
        </div>

        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-500 relative z-10">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-[28px] bg-brand-lime/10 border border-brand-lime/20 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(200,241,53,0.3)] rotate-3">
                <Mail className="h-10 w-10 text-brand-lime -rotate-3" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-brand-lime border-4 border-[#161625] flex items-center justify-center shadow-lg">
                <CircleCheck className="h-3.5 w-3.5 text-brand-dark" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8 space-y-2">
            <h3 className="text-[28px] font-black text-white tracking-tight leading-tight">¡Revisa tu correo!</h3>
            <p className="text-sm text-white/50 leading-relaxed font-medium">
              Enviamos un enlace de activación a<br />
              <span className="text-brand-lime font-bold">{email}</span>
            </p>
          </div>

          {/* Instruction card */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8 shadow-xl">
            <ol className="space-y-4 list-none">
              <li className="flex items-start gap-4 text-sm text-white/70 font-medium">
                <span className="w-6 h-6 rounded-full bg-brand-lime/20 text-brand-lime font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-brand-lime/30">1</span>
                <span>Abre tu correo electrónico en tu móvil o PC.</span>
              </li>
              <li className="flex items-start gap-4 text-sm text-white/70 font-medium">
                <span className="w-6 h-6 rounded-full bg-brand-lime/20 text-brand-lime font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-brand-lime/30">2</span>
                <span>Busca el mensaje de <strong>Subastándolo</strong> (revisa el spam).</span>
              </li>
              <li className="flex items-start gap-4 text-sm text-white/70 font-medium">
                <span className="w-6 h-6 rounded-full bg-brand-lime/20 text-brand-lime font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-brand-lime/30">3</span>
                <span>Haz clic en el enlace de acceso e inicia sesión.</span>
              </li>
            </ol>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { setView("login-email"); setPassword(""); }}
              className="w-full h-14 bg-brand-lime text-[#161625] tracking-wide font-black flex items-center justify-center rounded-2xl text-base shadow-[0_10px_30px_-10px_rgba(200,241,53,0.4)] active:scale-[0.98] transition-all"
            >
              Ya confirmé → Iniciar sesión
            </button>
            <button
              onClick={() => handleResendEmail("signup")}
              className="w-full text-white/40 hover:text-white/70 font-bold text-xs py-4 transition-colors tracking-wider uppercase disabled:opacity-50"
              disabled={loading || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Reenviar correo en ${resendCooldown}s` : "No recibí el correo"}
            </button>
          </div>
        </div>
      </div>
    );
  }


  // ── Resend verification ──
  if (view === "resend") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#161625] px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[30%] right-[0%] w-[60vw] h-[60vw] rounded-full bg-yellow-500/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-500 relative z-10">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-[28px] bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(250,204,21,0.2)] rotate-3">
              <Mail className="h-10 w-10 text-yellow-500 -rotate-3" />
            </div>
          </div>

          <div className="text-center mb-10 space-y-2">
            <p className="text-yellow-500/80 text-[11px] font-bold tracking-[0.2em] uppercase">Verificación pendiente</p>
            <h3 className="text-[28px] font-black text-white tracking-tight leading-tight">Confirma tu correo</h3>
            <p className="text-sm text-white/50 leading-relaxed font-medium">Revisa tu bandeja de entrada o spam. Tu cuenta aún no ha sido verificada.</p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-yellow-500 transition-colors z-10" />
              <input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-yellow-500/50 focus:bg-white/10 transition-all font-medium"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleResendEmail("signup")}
              className="w-full h-14 bg-yellow-500 text-yellow-950 font-black tracking-wide rounded-2xl text-base shadow-[0_10px_30px_-10px_rgba(250,204,21,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={loading || resendCooldown > 0 || !email.trim()}
            >
              <Send className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
              {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar enlace"}
            </button>
            <button
              onClick={() => { setView("login-email"); setPassword(""); }}
              className="w-full text-white/40 hover:text-white/70 font-bold text-xs py-4 transition-colors tracking-wider uppercase"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot password ──
  if (view === "forgot") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#161625] px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[30%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-blue-500/5 blur-[100px]" />
        </div>

        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-500 relative z-10">
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 rounded-[28px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(59,130,246,0.2)] -rotate-3">
              <KeyRound className="h-10 w-10 text-blue-500 rotate-3" />
            </div>
          </div>

          <div className="text-center mb-10 space-y-2">
            <p className="text-blue-500/80 text-[11px] font-bold tracking-[0.2em] uppercase">Acceso Seguro</p>
            <h3 className="text-[28px] font-black text-white tracking-tight leading-tight">Recuperar clave</h3>
            <p className="text-sm text-white/50 leading-relaxed font-medium">Ingresa tu correo y te enviaremos un enlace para establecer una nueva.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleResendEmail("recovery"); }} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-blue-500 transition-colors z-10" />
              <input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all font-medium"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full h-14 bg-blue-500 text-white font-black tracking-wide rounded-2xl text-base shadow-[0_10px_30px_-10px_rgba(59,130,246,0.4)] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              disabled={loading || resendCooldown > 0}
            >
              <Send className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
              {resendCooldown > 0 ? `Espera ${resendCooldown}s` : loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>

          <button
            className="w-full text-white/40 hover:text-white/70 font-bold text-xs py-5 transition-colors tracking-wider uppercase mt-2"
            onClick={() => setView("login-email")}
          >
            Regresar al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-dark">
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
          {/* WELCOME BACK */}
          {/* ─────────────────────────────────── */}
          {view === "welcome-back" && (
            <div className="w-full flex flex-col items-center animate-in zoom-in-95 duration-500">
              <div className="mb-8 relative">
                <div className="w-28 h-28 rounded-full bg-white/5 border-2 border-brand-lime/30 flex items-center justify-center p-1 shadow-[0_0_40px_-10px_rgba(200,241,53,0.3)]">
                  <div className="w-full h-full rounded-full overflow-hidden bg-brand-dark flex items-center justify-center">
                    {rememberedAvatar ? (
                      <img src={rememberedAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-12 w-12 text-brand-lime/50" />
                    )}
                  </div>
                </div>
              </div>

              <div className="text-center mb-10 w-full">
                <p className="text-white/40 text-[11px] font-bold tracking-[0.25em] uppercase mb-2">{getGreeting()}</p>
                <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-3">{rememberedName || "Usuario"}</h1>
                <div className="inline-flex items-center gap-2 bg-brand-lime/10 border border-brand-lime/20 px-4 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-brand-lime animate-pulse" />
                  <p className="text-sm text-brand-lime font-medium">{maskEmail(rememberedEmail)}</p>
                </div>
              </div>

              <div className="w-full space-y-4">
                <button
                  onClick={() => {
                    setEmail(rememberedEmail);
                    if (biometricEnabled && biometricAvailable && !biometricChecking) {
                      autoPromptFiredRef.current = true;
                      handleBiometricLogin();
                    } else setView("password");
                  }}
                  className="w-full h-14 rounded-2xl bg-brand-lime text-[#161625] font-black tracking-wide flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-[0_10px_30px_-10px_rgba(200,241,53,0.4)]"
                >
                  {biometricEnabled && !biometricFailed ? (
                    <><Fingerprint className="h-5 w-5" /> Ingresar rápidamente</>
                  ) : "Continuar"}
                </button>

                <button
                  type="button"
                  onClick={() => { setView("password"); setEmail(rememberedEmail); }}
                  className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm active:scale-[0.98] transition-all hover:bg-white/10"
                >
                  Usar mi contraseña
                </button>

                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("last_login_email");
                    localStorage.removeItem("last_login_name");
                    localStorage.removeItem("last_login_avatar");
                    setEmail(""); setPassword(""); setBiometricFailed(false); setView("login-email");
                  }}
                  className="w-full pt-4 text-center text-xs text-white/30 hover:text-white/70 font-medium transition-colors"
                >
                  Este no es mi correo actual
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────── */}
          {/* LOGIN / INICIO                        */}
          {/* ─────────────────────────────────── */}
          {view === "login-email" && (
            <div className="w-full flex flex-col animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex flex-col items-center mb-12 mt-4">
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-brand-lime/10 rounded-[28px] flex items-center justify-center shadow-[0_0_40px_-15px_rgba(200,241,53,0.4)] border border-brand-lime/20">
                    <img src="/logo_solo.svg" alt="Logo" className="w-[52px] h-auto" />
                  </div>
                </div>
                <img src="/logo_letras.svg" alt="Subastándolo" className="h-[28px] w-auto opacity-90 mb-6" />
                <h1 className="text-[24px] font-black text-white text-center tracking-tight leading-[1.15]">
                  La manera más fácil y segura<br />de subastar, comprar y vender
                </h1>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault(); setLoading(true);
                  try {
                    const exists = await checkEmailExists(sanitizeEmail(email));
                    setView(exists ? "password" : "register-details");
                  } catch {
                    setView("password");
                  }
                  setLoading(false);
                }}
                className="w-full space-y-4"
              >
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-brand-lime transition-colors" />
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-lime/50 focus:bg-white/10 transition-all font-semibold"
                    required autoFocus autoComplete="username"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!email.includes('@') || loading}
                  className="w-full h-14 bg-brand-lime text-[#161625] font-black rounded-2xl flex items-center justify-center gap-2 tracking-wide disabled:opacity-50 active:scale-[0.98] transition-all shadow-[0_10px_30px_-10px_rgba(200,241,53,0.4)]"
                >
                  {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Continuar"}
                </button>

                <div className="flex items-center gap-4 py-3 opacity-60">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">O</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <button
                  type="button"
                  onClick={() => { setView("register-details"); setValidationError(null); setPassword(""); }}
                  className="w-full h-14 bg-[#1e1e2d]/50 border text-white/90 border-white/10 hover:border-white/30 hover:bg-white/5 font-bold rounded-2xl active:scale-[0.98] transition-all"
                >
                  Crear una cuenta nueva
                </button>
              </form>
            </div>
          )}

          {/* ─────────────────────────────────── */}
          {/* STEP 2: PASSWORD                    */}
          {/* ─────────────────────────────────── */}
          {view === "password" && (
            <div className="w-full flex flex-col animate-in slide-in-from-right-8 duration-500">
              <div className="mb-8 mt-2">
                <h2 className="text-[28px] font-black text-white tracking-tight leading-tight">
                  Bienvenido de nuevo
                </h2>
                <div className="inline-flex items-center gap-2 bg-brand-lime/10 border border-brand-lime/20 px-3 py-1 rounded-full mt-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-pulse" />
                  <p className="text-xs font-bold text-brand-lime tracking-wide">{maskEmail(email)}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30 group-focus-within:text-brand-lime transition-colors z-10" />
                  <PasswordInput
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-12 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-lime/50 focus:bg-white/10 transition-all font-medium"
                    required
                    minLength={6}
                    autoComplete="current-password"
                    autoFocus
                  />
                </div>

                {loginAttempts > 0 && !isLocked && (
                  <p className="text-[11px] font-bold tracking-widest uppercase text-red-400/80 px-2">
                    Intento {loginAttempts} de {MAX_LOGIN_ATTEMPTS}
                  </p>
                )}

                {/* ── Biometric enrollment checkbox ── */}
                {biometricAvailable && !biometricChecking && !biometricEnabled && (
                  <div className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 transition-colors hover:bg-white/10 cursor-pointer" onClick={() => setEnableBiometricOnLogin(prev => !prev)}>
                    {/* span barrier: stops BubbleInput's synthetic click on the hidden
                        <input> from bubbling up to the parent div onClick */}
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        id="enable-biometric"
                        checked={enableBiometricOnLogin}
                        onCheckedChange={(checked) => setEnableBiometricOnLogin(checked === true)}
                        className="mt-0.5 shrink-0 border-white/30 data-[state=checked]:bg-brand-lime data-[state=checked]:text-brand-dark"
                      />
                    </span>
                    <div className="flex flex-col select-none break-words">
                      <span className="text-sm font-bold text-white flex items-center gap-2 mb-0.5">
                        <Fingerprint className="h-4 w-4 text-brand-lime" />
                        Activar {biometryLabel}
                      </span>
                      <span className="text-[11px] text-white/40 leading-snug">
                        Inicia sesión más rápido y seguro la próxima vez.
                      </span>
                    </div>
                  </div>
                )}

                {biometricEnabled && !biometricFailed && (
                  <div className="flex items-center gap-2 text-xs text-brand-lime/70 bg-brand-lime/5 border border-brand-lime/10 px-4 py-3 rounded-2xl">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>{biometryLabel} lista — <button type="button" className="text-brand-lime font-bold hover:underline" onClick={() => setView("welcome-back")}>usar huella/rostro</button></span>
                  </div>
                )}

                {biometricFailed && (
                  <div className="flex items-center gap-2 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Biometría bloqueada. Usa tu contraseña.</span>
                  </div>
                )}

                <div className="flex justify-end px-1 pb-2 pt-1">
                  <button type="button" onClick={() => setView("forgot")} className="text-xs font-bold text-white/50 hover:text-white transition-colors">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                {validationError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-red-400 leading-snug">{validationError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-14 bg-brand-lime text-[#161625] font-black rounded-2xl flex items-center justify-center gap-2 tracking-wide disabled:opacity-50 active:scale-[0.98] transition-all shadow-[0_10px_30px_-10px_rgba(200,241,53,0.4)]"
                  disabled={loading || isLocked || password.length < 6}
                >
                  {loading ? <><RefreshCw className="h-5 w-5 animate-spin" /> Ingresando...</> : "Ingresar a mi cuenta"}
                </button>
              </form>
            </div>
          )}

          {view === "register-details" && (
            <div className="w-full flex flex-col animate-in slide-in-from-right-8 duration-500 pb-10">
              <div className="mb-6 mt-2">
                <h2 className="text-[28px] font-black text-white tracking-tight leading-tight">
                  Crea tu cuenta<br />ahora mismo
                </h2>
                <div className="inline-flex items-center gap-2 bg-brand-lime/10 border border-brand-lime/20 px-3 py-1 rounded-full mt-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-pulse" />
                  <p className="text-xs font-bold text-brand-lime tracking-wide">{maskEmail(email)}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="w-full space-y-3.5">

                <div className="flex gap-3">
                  <div className="relative w-full group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-brand-lime transition-colors z-10" />
                    <input
                      placeholder="Nombres"
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); setFullName(`${e.target.value} ${lastName}`.trim()); }}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 text-white text-sm focus:border-brand-lime/50 focus:bg-white/10 focus:outline-none transition-all font-medium"
                      required autoFocus
                    />
                  </div>
                  <div className="relative w-full group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-brand-lime transition-colors z-10" />
                    <input
                      placeholder="Apellidos"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); setFullName(`${firstName} ${e.target.value}`.trim()); }}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 text-white text-sm focus:border-brand-lime/50 focus:bg-white/10 focus:outline-none transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <select
                    value={cedulaPrefix}
                    onChange={(e) => setCedulaPrefix(e.target.value)}
                    className="h-14 w-[75px] shrink-0 bg-[#1e1e2d] border border-white/10 rounded-2xl text-center text-white font-black text-sm focus:border-brand-lime/50 focus:outline-none appearance-none shadow-sm transition-all"
                    style={{ background: '#1e1e2d', colorScheme: 'dark' }}
                  >
                    <option value="V">V</option><option value="E">E</option><option value="J">J</option><option value="G">G</option>
                  </select>
                  <div className="relative flex-1 group">
                    <input
                      placeholder="Cédula / RIF"
                      value={cedula}
                      onChange={(e) => setCedula(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-4 text-white text-sm focus:border-brand-lime/50 focus:bg-white/10 focus:outline-none transition-all font-medium tracking-wide"
                      inputMode="numeric" required
                    />
                  </div>
                </div>

                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-brand-lime transition-colors z-10" />
                  <input
                    type="email"
                    placeholder="Correo de contacto"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 text-white text-sm focus:border-brand-lime/50 focus:bg-white/10 focus:outline-none transition-all font-medium"
                    required autoComplete="username"
                  />
                </div>

                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-brand-lime transition-colors z-10" />
                  <input
                    placeholder="Teléfono (ej. 0412-1234567)"
                    value={phone}
                    onChange={(e) => {
                      let val = e.target.value.replace(/[^0-9+\-\s]/g, "");
                      const digits = val.replace(/\D/g, "");
                      if (digits.startsWith("5858")) val = "+58" + digits.slice(4);
                      else if (digits.startsWith("580")) val = "+58" + digits.slice(3);
                      setPhone(val);
                    }}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 text-white text-sm focus:border-brand-lime/50 focus:bg-white/10 focus:outline-none transition-all font-medium"
                    inputMode="tel" required
                  />
                </div>

                <div className="flex gap-3">
                  <select
                    value={estado}
                    onChange={(e) => { setEstado(e.target.value); setCiudad(""); }}
                    className="h-14 w-full bg-[#1e1e2d] border border-white/10 rounded-2xl px-4 text-white text-sm font-medium focus:border-brand-lime/50 focus:outline-none appearance-none transition-all"
                    style={{ background: '#1e1e2d', colorScheme: 'dark' }} required
                  >
                    <option value="" disabled>Estado</option>
                    {["Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", "Cojedes", "Delta Amacuro", "Distrito Capital", "Falcón", "Guárico", "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta", "Portuguesa", "Sucre", "Táchira", "Trujillo", "Vargas", "Yaracuy", "Zulia"].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="relative w-full group">
                    <input
                      placeholder="Ciudad Mnpio."
                      value={ciudad}
                      onChange={(e) => setCiudad(e.target.value)}
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-4 text-white text-sm focus:border-brand-lime/50 focus:bg-white/10 focus:outline-none transition-all font-medium"
                      required
                    />
                  </div>
                </div>

                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-brand-lime transition-colors z-10" />
                  <PasswordInput
                    placeholder="Contraseña segura (mín. 6 car.)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 bg-white/5 border-white/10 rounded-2xl pl-11 pr-12 text-white placeholder:text-white/30 text-sm font-medium focus-visible:ring-1 focus-visible:ring-brand-lime/50 focus-visible:border-brand-lime/50 focus:bg-white/10 transition-all"
                    required minLength={6} autoComplete="new-password"
                  />
                </div>

                <label className="flex items-start gap-3 mt-4 px-1 cursor-pointer transition-colors pt-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5 shrink-0 border-white/30 data-[state=checked]:bg-brand-lime data-[state=checked]:text-brand-dark"
                  />
                  <span className="text-xs text-white/40 font-medium leading-[1.6] select-none">
                    Al registrarme, acepto los <Link to="/terminos" className="text-brand-lime hover:underline font-bold" target="_blank">Términos y Condiciones</Link> para unirme a la plataforma de Subastándolo.
                  </span>
                </label>

                {validationError && (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mt-2">
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-red-400 leading-snug">{validationError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-14 mt-4 bg-brand-lime text-[#161625] font-black tracking-wide rounded-2xl text-base disabled:opacity-50 active:scale-[0.98] transition-all shadow-[0_10px_30px_-10px_rgba(200,241,53,0.4)] flex items-center justify-center gap-2"
                  disabled={loading || !termsAccepted || password.length < 6 || !firstName.trim() || !lastName.trim()}
                >
                  {loading ? <><RefreshCw className="h-5 w-5 animate-spin" /> Procesando...</> : "Finalizar Registro"}
                </button>
              </form>
            </div>
          )}

        </div>
      </div >
    </div >
  );
};

export default Auth;
