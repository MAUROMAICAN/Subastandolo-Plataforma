import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, Apple, Chrome, Share } from "lucide-react";

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">SUBASTANDOLO</h1>
          <p className="text-muted-foreground">
            Instala la app en tu teléfono y accede a todas las subastas desde tu pantalla de inicio.
          </p>
        </div>

        {isInstalled ? (
          <Card className="border-green-500">
            <CardContent className="pt-6">
              <p className="text-green-600 font-semibold">✅ ¡App ya instalada! Ábrela desde tu pantalla de inicio.</p>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="font-semibold text-foreground">Cómo instalar en iPhone / iPad:</p>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Share className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>1. Toca el botón <strong>Compartir</strong> en Safari (el cuadrado con la flecha hacia arriba)</p>
                </div>
                <div className="flex items-start gap-3">
                  <Apple className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>2. Desplázate y selecciona <strong>"Añadir a pantalla de inicio"</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>3. Toca <strong>"Añadir"</strong> y la app aparecerá en tu pantalla</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Button size="lg" className="w-full gap-2" onClick={handleInstall}>
            <Download className="w-5 h-5" />
            Instalar App en Android
          </Button>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="font-semibold text-foreground">Cómo instalar en Android:</p>
              <div className="space-y-3 text-left text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Chrome className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>1. Abre esta página en <strong>Chrome</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p>2. Toca el menú (⋮) y selecciona <strong>"Añadir a pantalla de inicio"</strong></p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>✅ Sin App Store ni Google Play</p>
          <p>✅ Actualizaciones automáticas</p>
          <p>✅ Funciona igual que la web</p>
        </div>
      </div>
    </div>
  );
}
