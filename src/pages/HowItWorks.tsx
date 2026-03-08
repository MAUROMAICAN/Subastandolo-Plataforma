import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";
import SEOHead from "@/components/SEOHead";
import { Shield, Clock, Trophy, Lock, ArrowRight, CheckCircle, Sparkles, Search as SearchIcon, Gavel, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  {
    number: "01",
    Icon: SearchIcon,
    title: "Explora y Elige",
    description:
      "Regístrate en segundos y navega por nuestras categorías. Desde tecnología hasta vehículos, encuentra el producto que te interesa y revisa las fotos, descripción y el precio base.",
    highlights: [
      "Registro gratuito e inmediato",
      "Catálogo verificado por Subastándolo",
      "Filtros por categoría, precio y tiempo",
    ],
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    numBg: "bg-sky-500",
  },
  {
    number: "02",
    Icon: Gavel,
    title: "Haz tu Oferta",
    description:
      "¿Viste algo que te gusta? ¡Entra en la puja! Coloca tu monto y nuestra plataforma te avisará en tiempo real si alguien supera tu oferta. Recuerda: ¡el tiempo corre y el último segundo cuenta!",
    highlights: [
      "Pujas en tiempo real",
      "Notificaciones instantáneas si te superan",
      "El cronómetro crea la emoción de la subasta",
    ],
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    numBg: "bg-amber-500",
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
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    numBg: "bg-emerald-500",
  },
  {
    number: "04",
    Icon: Lock,
    title: "Tu Dinero Está 100% Protegido",
    description:
      "No le pagarás directamente al dealer (vendedor). Tu dinero queda resguardado por la empresa hasta que tu producto sea retirado en la agencia de envío de tu preferencia. Tu dinero no será liberado hasta que tú lo tengas.",
    highlights: [
      "Sistema de pago en custodia (escrow)",
      "El vendedor no recibe el pago hasta tu confirmación",
      "Resolución de disputas con equipo dedicado",
    ],
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    numBg: "bg-violet-500",
  },
];

const guarantees = [
  { Icon: Shield, label: "Vendedores verificados" },
  { Icon: Lock, label: "Pagos en custodia" },
  { Icon: PackageCheck, label: "Productos inspeccionados" },
  { Icon: Trophy, label: "Ganadores certificados" },
];

const HowItWorksPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="¿Cómo Funciona?" description="Aprende cómo funcionan las subastas en Subastándolo. 4 pasos simples para comprar de forma segura." />
      <Navbar />
      <BackButton />
      <main className="pb-24">

        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(132,204,22,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(250,204,21,0.08),transparent_50%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

          <div className="container mx-auto px-4 py-16 sm:py-24 text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-white/70 text-xs font-medium tracking-wider uppercase">Guía completa</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-heading font-black text-white leading-tight mb-4">
              ¿Cómo Funciona<br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Subastándolo?</span>
            </h1>
            <p className="text-white/50 max-w-xl mx-auto text-sm sm:text-base leading-relaxed mb-8">
              Un proceso simple, transparente y seguro. En 4 pasos, convierte cualquier puja en una compra exitosa.
            </p>

            {/* Guarantee badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              {guarantees.map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-full px-3 py-1.5 backdrop-blur-sm">
                  <Icon className="h-3.5 w-3.5 text-primary dark:text-[#A6E300]" />
                  <span className="text-white/60 text-[10px] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── STEPS ─── */}
        <section className="py-12 sm:py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="relative">
              {/* Vertical timeline line - desktop */}
              <div className="hidden md:block absolute left-[39px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-sky-500/30 via-amber-500/30 via-emerald-500/30 to-violet-500/30" />

              <div className="space-y-6 sm:space-y-10">
                {steps.map((step, i) => (
                  <div key={step.number} className="flex gap-5 sm:gap-8 items-start group">
                    {/* Number badge - desktop */}
                    <div className="hidden md:flex flex-col items-center shrink-0">
                      <div className={`w-20 h-20 rounded-2xl ${step.numBg} text-white flex items-center justify-center font-heading font-black text-2xl shadow-xl group-hover:scale-105 transition-transform relative z-10`}>
                        {step.number}
                      </div>
                    </div>

                    {/* Content card */}
                    <div className={`flex-1 bg-card border ${step.border} rounded-2xl p-6 sm:p-8 hover:shadow-xl hover:shadow-${step.color.replace('text-', '')}/5 transition-all group-hover:-translate-y-0.5`}>
                      {/* Mobile number + icon row */}
                      <div className="flex items-center gap-3 mb-4 md:mb-0">
                        <div className={`md:hidden w-12 h-12 rounded-xl ${step.numBg} text-white flex items-center justify-center font-heading font-black text-lg shrink-0`}>
                          {step.number}
                        </div>
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`hidden md:flex w-12 h-12 rounded-xl ${step.bg} items-center justify-center shrink-0`}>
                            <step.Icon className={`h-6 w-6 ${step.color}`} />
                          </div>
                          <h2 className="text-lg sm:text-xl font-heading font-black text-foreground">{step.title}</h2>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed mb-5 text-justify md:pl-0">
                        {step.description}
                      </p>

                      <div className="space-y-2.5">
                        {step.highlights.map((h) => (
                          <div key={h} className="flex items-start gap-2.5">
                            <CheckCircle className={`h-4 w-4 ${step.color} shrink-0 mt-0.5`} />
                            <span className="text-sm text-foreground/80 font-medium">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(132,204,22,0.08),transparent_60%)]" />
          <div className="container mx-auto px-4 py-16 sm:py-20 text-center relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="h-8 w-8 text-accent" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-white mb-3">
              ¿Listo para tu primera puja?
            </h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto text-sm">
              Únete a miles de usuarios que ya compran de forma segura en Subastándolo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {user ? (
                <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-xl shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all gap-2">
                  <Link to="/">
                    Ver Subastas Activas
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-xl shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all gap-2">
                  <Link to="/auth">
                    <Sparkles className="h-4 w-4" />
                    Registrarme Ahora
                  </Link>
                </Button>
              )}
              <Button size="lg" asChild className="bg-white/[0.06] border border-white/[0.15] text-white hover:bg-white/[0.12] rounded-xl font-bold gap-2 backdrop-blur-sm transition-all">
                <Link to="/nosotros">
                  Conocer más
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

      </main>
      <div className="hidden sm:block"><Footer /></div>
      <div className="sm:hidden h-14" />
      <BottomNav />
    </div>
  );
};

export default HowItWorksPage;
