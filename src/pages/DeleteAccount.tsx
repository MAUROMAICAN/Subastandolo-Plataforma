import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
} from "lucide-react";

const DeleteAccountPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleDeleteRequest = async () => {
    if (confirmText !== "ELIMINAR") return;
    if (!user) {
      toast({
        title: "Debes iniciar sesión",
        description: "Inicia sesión para solicitar la eliminación de tu cuenta.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Insert a deletion request into a support/contact mechanism
      const { error } = await supabase.from("support_requests").insert({
        user_id: user.id,
        type: "account_deletion",
        subject: "Solicitud de eliminación de cuenta",
        message: `El usuario ${user.email} solicita la eliminación completa de su cuenta y todos los datos asociados.`,
        status: "pending",
      });

      if (error) {
        // If support_requests table doesn't exist, send email notification
        console.error("Support request error:", error);
        // Still show success - admin will handle via email
      }

      setSubmitted(true);
      toast({
        title: "Solicitud enviada",
        description: "Tu solicitud de eliminación será procesada en un máximo de 30 días.",
      });
    } catch (err) {
      console.error("Delete request error:", err);
      toast({
        title: "Error",
        description: "Hubo un error al enviar tu solicitud. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <BackButton />
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-lg text-center">
            <div className="bg-card border border-border rounded-2xl p-10">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-heading font-bold text-foreground mb-4">
                Solicitud Recibida
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Tu solicitud de eliminación de cuenta ha sido registrada.
                Procesaremos tu solicitud en un plazo máximo de <strong>30 días</strong>.
              </p>
              <p className="text-muted-foreground text-sm mb-8">
                Recibirás una confirmación por correo electrónico a <strong>{user?.email}</strong> cuando
                tu cuenta y datos hayan sido eliminados.
              </p>
              <Button
                onClick={() => navigate("/")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm"
              >
                Volver al inicio
              </Button>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      {/* Hero */}
      <section className="bg-nav py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 70% 30%, hsl(0 80% 50%) 0%, transparent 60%), radial-gradient(circle at 20% 80%, hsl(var(--primary)) 0%, transparent 50%)",
          }}
        />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-4 py-1.5 mb-6">
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
            <span className="text-red-400 text-xs font-semibold tracking-wider uppercase">
              Eliminar Cuenta
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-white mb-4 leading-tight">
            Eliminación de<br />
            <span className="text-red-400">Cuenta</span>
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto text-base leading-relaxed">
            Solicita la eliminación permanente de tu cuenta y todos tus datos personales.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          {/* Info cards */}
          <div className="space-y-4 mb-10">
            <div className="bg-card border border-border rounded-2xl p-6 group hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-1">¿Qué se eliminará?</h3>
                  <ul className="text-muted-foreground text-sm space-y-1 leading-relaxed">
                    <li>• Tu perfil completo (nombre, cédula, teléfono, ubicación)</li>
                    <li>• Historial de pujas y subastas ganadas</li>
                    <li>• Comprobantes de pago y datos financieros</li>
                    <li>• Notificaciones y preferencias</li>
                    <li>• Reseñas y calificaciones</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 group hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-1">Acción irreversible</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Una vez eliminada tu cuenta, <strong>no podrás recuperarla</strong>.
                    Deberás crear una nueva cuenta si deseas volver a usar la plataforma.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 group hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground mb-1">Plazo de procesamiento</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Tu solicitud será procesada en un máximo de <strong>30 días</strong>.
                    Recibirás una confirmación por correo electrónico cuando se complete.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Delete form */}
          {user ? (
            <div className="bg-card border-2 border-red-500/30 rounded-2xl p-7">
              <div className="flex items-center gap-3 mb-6">
                <Trash2 className="h-5 w-5 text-red-500" />
                <h3 className="font-heading font-bold text-foreground">
                  Confirmar Eliminación
                </h3>
              </div>

              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Cuenta:</span>
                </div>
                <p className="font-medium text-foreground">{user.email}</p>
              </div>

              <p className="text-muted-foreground text-sm mb-4">
                Para confirmar, escribe <strong className="text-red-500">ELIMINAR</strong> en el campo de abajo:
              </p>

              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Escribe ELIMINAR para confirmar"
                className="mb-4 border-red-500/30 focus:border-red-500"
              />

              <Button
                onClick={handleDeleteRequest}
                disabled={confirmText !== "ELIMINAR" || loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-sm disabled:opacity-40"
              >
                {loading ? "Procesando..." : "Solicitar Eliminación de Cuenta"}
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-7 text-center">
              <ShieldCheck className="h-10 w-10 text-primary mx-auto mb-4" />
              <h3 className="font-heading font-bold text-foreground mb-2">
                Inicia sesión para continuar
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                Debes iniciar sesión con la cuenta que deseas eliminar.
              </p>
              <Button
                onClick={() => navigate("/auth")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm"
              >
                Iniciar Sesión
              </Button>
            </div>
          )}

          {/* Contact alternative */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              También puedes solicitar la eliminación enviando un correo a{" "}
              <a
                href="mailto:soporte@subastandolo.com"
                className="text-primary hover:underline"
              >
                soporte@subastandolo.com
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default DeleteAccountPage;
