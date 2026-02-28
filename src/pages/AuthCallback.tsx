import { useEffect } from "react";

const DEEP_LINK_SCHEME = "com.subastandolo.app://auth/callback";

const AuthCallback = () => {
  useEffect(() => {
    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const deepLink = `${DEEP_LINK_SCHEME}${search}${hash}`;

    window.location.replace(deepLink);
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
