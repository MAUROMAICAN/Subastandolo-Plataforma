import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Shield, Clock, Trophy, Lock, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  {
    number: "01",
    Icon: Trophy,
    title: "Explora y Elige",
    description:
      "Regístrate en segundos y navega por nuestras categorías. Desde tecnología hasta vehículos, encuentra el producto que te interesa y revisa las fotos, descripción y el precio base.",
    highlights: [
      "Registro gratuito e inmediato",
      "Catálogo verificado por Subastándolo",
      "Filtros por categoría, precio y tiempo",
    ],
    color: "from-blue-600 to-blue-800",
  },
  {
    number: "02",
    Icon: Clock,
    title: "Haz tu Oferta",
    description:
      "¿Viste algo que te gusta? ¡Entra en la puja! Coloca tu monto y nuestra plataforma te avisará en tiempo real si alguien supera tu oferta. Recuerda: ¡el tiempo corre y el último segundo cuenta!",
    highlights: [
      "Pujas en tiempo real",
      "Notificaciones instantáneas si te superan",
      "El cronómetro crea la emoción de la subasta",
    ],
    color: "from-amber-500 to-orange-600",
  },
  {
    number: "03",
    Icon: Trophy,
    title: "¡Gana y Recibe!",
    description:
      "Si al final del cronómetro eres el postor más alto, el artículo es tuyo. Te contactaremos de inmediato para coordinar el pago (Transferencia Bancaria) y la entrega de tu producto. ¡Así de fácil es ganar!",
    highlights: [
      "Confirmación instantánea al ganar",
      "Pago por Transferencia Bancaria",
      "Coordinación de envío personalizada",
    ],
    color: "from-green-600 to-emerald-700",
  },
  {
    number: "04",
    Icon: Lock,
    title: "Tu Dinero Está 100% Protegido",
    description:
      "No le pagarás directamente al dealer (vendedor). Tu dinero queda resguardado por la empresa hasta que tu producto sea retirado en la agencia de envío de tu preferencia. Tu dinero no será liberado hasta que tú lo tengas. Esto garantiza 100% tu dinero.",
    highlights: [
      "Sistema de pago en custodia (escrow)",
      "El vendedor no recibe el pago hasta tu confirmación",
      "Resolución de disputas con equipo dedicado",
    ],
    color: "from-purple-600 to-purple-800",
  },
];

const guarantees = [
  { Icon: Shield, label: "Vendedores verificados" },
  { Icon: Lock, label: "Pagos en custodia" },
  { Icon: CheckCircle, label: "Productos inspeccionados" },
  { Icon: Trophy, label: "Ganadores certificados" },
];

const HowItWorksPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      {/* Hero */}
      <section className="bg-nav py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--accent)) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(var(--primary)) 0%, transparent 50%)" }} />
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-accent/20 border border-accent/30 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-accent text-xs font-semibold tracking-wider uppercase">Guía completa</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-4 leading-tight">
            ¿Cómo Funciona<br />
            <span className="text-accent">Subastándolo?</span>
          </h1>
          <p className="text-white/70 max-w-xl mx-auto text-base sm:text-lg">
            Un proceso simple, transparente y seguro. En 4 pasos, convierte cualquier puja en una compra exitosa.
          </p>
        </div>
      </section>

      {/* Garantías rápidas */}
      <div className="bg-nav-solid border-b border-white/10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {guarantees.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-white/70 text-xs font-medium">
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Steps */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="space-y-16">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} gap-8 md:gap-12 items-center`}
              >
                {/* Icon side */}
                <div className="flex-shrink-0 w-full md:w-64 flex flex-col items-center text-center gap-4">
                  <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-2xl`}>
                    <step.Icon className="h-10 w-10 text-white" />
                  </div>
                  <div className="text-6xl font-heading font-black text-border/40 leading-none">
                    {step.number}
                  </div>
                </div>

                {/* Content side */}
                <div className="flex-1 bg-card border border-border rounded-2xl p-8 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-3">
                    {step.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-6 text-justify">
                    {step.description}
                  </p>
                  <ul className="space-y-2">
                    {step.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-foreground/80">
                        <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-nav py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
            ¿Listo para tu primera puja?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">
            Únete a miles de usuarios que ya compran de forma segura en Subastándolo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
                <Link to="/">Ver Subastas Activas <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            ) : (
              <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
                <Link to="/auth">Registrarme Ahora <ArrowRight className="h-4 w-4 ml-2" /></Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorksPage;
