import { useState, useEffect } from "react";
import { Shield, Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const COOKIE_CONSENT_KEY = "cookie_consent";

type ConsentValue = "all" | "necessary" | null;

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    let t: ReturnType<typeof setTimeout>;
    if (!stored) {
      t = setTimeout(() => setVisible(true), 1200);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [user]);

  const accept = (value: ConsentValue) => {
    if (!value) return;
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
    setLeaving(true);
    setTimeout(() => setVisible(false), 400);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-lg transition-all duration-400",
        leaving
          ? "translate-y-8 opacity-0"
          : "translate-y-0 opacity-100 animate-fade-in"
      )}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur-xl">
        {/* Subtle gradient accent bar */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="px-5 pt-5 pb-4">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              <Cookie className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Tu privacidad importa
            </h3>
          </div>

          {/* Body */}
          <p className="text-xs leading-relaxed text-muted-foreground mb-4">
            Usamos cookies esenciales para el funcionamiento de la app y opcionales para mejorar tu experiencia.{" "}
            <Link
              to="/privacidad"
              className="underline underline-offset-2 text-primary hover:text-primary/80 transition-colors"
            >
              Política de privacidad
            </Link>
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => accept("all")}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.97]"
            >
              <Shield className="h-3.5 w-3.5" />
              Aceptar todas
            </button>
            <button
              onClick={() => accept("necessary")}
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-[0.97]"
            >
              Solo necesarias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
