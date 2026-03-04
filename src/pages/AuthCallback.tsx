import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const DEEP_LINK_SCHEME = "com.subastandolo.app://auth/callback";

const AuthCallback = () => {
  useEffect(() => {
    const handleAuth = async () => {
      const isNative = Capacitor.isNativePlatform();
      const search = window.location.search || "";
      const hash = window.location.hash || "";

      if (isNative) {
        // App redirection flow
        const deepLink = `${DEEP_LINK_SCHEME}${search}${hash}`;
        window.location.replace(deepLink);
      } else {
        // Web redirection flow
        // The Supabase client automatically handles the hash/search to set the session
        // We just need to wait a tiny bit to ensure it's processed or check the session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          window.location.replace("/");
        } else {
          // Fallback if no session found immediately
          setTimeout(() => {
            window.location.replace("/");
          }, 1500);
        }
      }
    };

    handleAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-sm w-full text-center space-y-3">
        <h1 className="text-lg font-bold text-foreground">Completando inicio de sesión…</h1>
        <p className="text-sm text-muted-foreground">Si no se abre la app automáticamente, vuelve atrás y selecciona "Abrir con Subastandolo".</p>
      </div>
    </div>
  );
};

export default AuthCallback;
