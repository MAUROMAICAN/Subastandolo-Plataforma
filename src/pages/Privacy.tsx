import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { ShieldCheck, Database, Lock, Eye, UserCheck, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const sections = [
  {
    Icon: Database,
    title: "1. Recolección de Datos",
    content: "Recopilamos información básica (Nombre, Teléfono, Correo, Ubicación) necesaria para validar la identidad de los postores y garantizar la seguridad de las transacciones.",
  },
  {
    Icon: Eye,
    title: "2. Uso de la Información",
    content: "Sus datos solo serán compartidos con la contraparte (vendedor/comprador) una vez finalizada la subasta para concretar la entrega. No vendemos bases de datos a terceros.",
  },
  {
    Icon: Lock,
    title: "3. Seguridad",
    content: "Utilizamos protocolos de encriptación para proteger su información personal. El usuario es responsable de mantener la confidencialidad de su contraseña.",
  },
  {
    Icon: UserCheck,
    title: "4. Verificación de Identidad",
    content: "Para subastas de alto valor (Vehículos/Inmuebles), Subastándolo podrá solicitar una verificación de identidad adicional para prevenir fraudes.",
  },
];

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      {/* Hero */}
      <section className="bg-nav py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 70% 30%, hsl(var(--accent)) 0%, transparent 60%), radial-gradient(circle at 20% 80%, hsl(var(--primary)) 0%, transparent 50%)",
          }}
        />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 rounded-full px-4 py-1.5 mb-6">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span className="text-accent text-xs font-semibold tracking-wider uppercase">Privacidad</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-4 leading-tight">
            Política de<br />
            <span className="text-accent">Privacidad</span>
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Tu información está segura con nosotros. Conoce cómo protegemos tus datos.
          </p>
        </div>
      </section>

      {/* Last updated */}
      <div className="bg-nav-solid border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center gap-2 text-white/50 text-xs">
          <Clock className="h-3.5 w-3.5" />
          <span>Última actualización: Febrero 2026</span>
        </div>
      </div>

      {/* Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-6">
            {sections.map(({ Icon, title, content }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-7 hover:shadow-lg transition-shadow group">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-lg text-foreground mb-2">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed text-justify">{content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Commitment box */}
          <div className="mt-12 bg-secondary/20 border border-border rounded-2xl p-7 text-center">
            <ShieldCheck className="h-8 w-8 text-accent mx-auto mb-4" />
            <h3 className="font-heading font-bold text-foreground mb-2">Nuestro Compromiso</h3>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-lg mx-auto">
              En Subastándolo nos comprometemos a proteger tu privacidad y a usar tus datos
              únicamente con el fin de brindarte un servicio seguro y transparente.
              Cualquier cambio en esta política será comunicado oportunamente.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-nav py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
            ¿Preguntas sobre tu privacidad?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">
            Estamos aquí para resolver cualquier duda sobre el manejo de tu información personal.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              <Link to="/contacto">Contáctanos</Link>
            </Button>
            <Button size="lg" asChild className="bg-white/10 border border-white/30 text-white hover:bg-white/20 rounded-sm">
              <Link to="/terminos">Términos y Condiciones</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPage;
