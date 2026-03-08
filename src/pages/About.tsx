import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";
import SEOHead from "@/components/SEOHead";
import { Shield, Eye, Zap, Target, Users, Award, ChevronRight, Sparkles, Heart, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const values = [
  {
    Icon: Shield,
    title: "Seguridad",
    description: "Tu dinero y tus datos están protegidos en todo momento. Usamos sistemas de custodia para garantizar que ninguna transacción quede sin respaldo.",
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    glow: "hover:shadow-sky-500/10",
  },
  {
    Icon: Eye,
    title: "Transparencia",
    description: "Cada puja, cada precio, cada movimiento es visible en tiempo real. No hay costos ocultos ni sorpresas. Lo que ves es lo que pagas.",
    color: "text-primary dark:text-[#A6E300]",
    bg: "bg-primary/10",
    border: "border-primary/20",
    glow: "hover:shadow-primary/10",
  },
  {
    Icon: Zap,
    title: "Emoción",
    description: "Las subastas están diseñadas para que cada segundo cuente. La adrenalina del último segundo es parte de la experiencia Subastándolo.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "hover:shadow-amber-500/10",
  },
];

const stats = [
  { Icon: Users, value: "1,000+", label: "Usuarios registrados" },
  { Icon: Award, value: "500+", label: "Subastas completadas" },
  { Icon: Shield, value: "100%", label: "Pagos garantizados" },
  { Icon: Target, value: "0", label: "Fraudes reportados" },
];

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Nosotros" description="Conoce la historia, misión y valores de Subastándolo — la plataforma de subastas online más segura de Venezuela." />
      <Navbar />
      <BackButton />
      <main className="pb-24">

        {/* ─── HERO ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(250,204,21,0.12),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(132,204,22,0.1),transparent_50%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />

          <div className="container mx-auto px-4 py-16 sm:py-24 text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] rounded-full px-4 py-1.5 mb-6 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <span className="text-white/70 text-xs font-medium tracking-wider uppercase">Nuestra historia</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-heading font-black text-white leading-tight mb-4">
              Acerca de<br />
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Subastándolo</span>
            </h1>
            <p className="text-white/50 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              Revolucionando la manera en la que los venezolanos compran y venden. Seguridad, transparencia y emoción en cada subasta.
            </p>
          </div>

          {/* Integrated Stats */}
          <div className="container mx-auto px-4 pb-8 relative z-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 max-w-3xl mx-auto">
              {stats.map(({ Icon, value, label }) => (
                <div key={label} className="backdrop-blur-sm bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 text-center hover:bg-white/[0.08] transition-all">
                  <Icon className="h-4 w-4 text-accent mx-auto mb-2" />
                  <p className="text-xl sm:text-2xl font-heading font-black text-white">{value}</p>
                  <p className="text-[10px] text-white/40 font-medium uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MISSION ─── */}
        <section className="py-14 sm:py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-4 w-1 rounded-full bg-accent" />
                  <span className="text-accent text-xs font-bold uppercase tracking-widest">Nuestra misión</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-heading font-black text-foreground mb-5 leading-tight">
                  Bienvenido a <span className="text-primary dark:text-[#A6E300]">Subastándolo</span>
                </h2>
                <div className="space-y-4 text-muted-foreground text-sm leading-relaxed text-justify">
                  <p>
                    En Subastándolo, estamos revolucionando la manera en la que los venezolanos compran y venden. Nacimos con una misión clara: <strong className="text-foreground">democratizar el acceso a las mejores oportunidades</strong> mediante un sistema de subastas transparente, seguro y emocionante.
                  </p>
                  <p>
                    Creemos que el valor de las cosas lo decide el mercado, no una etiqueta. Por eso, hemos creado una plataforma tecnológica de última generación donde la velocidad y la confianza van de la mano.
                  </p>
                  <p>
                    Ya sea que busques un destornillador o el producto de tus sueños, tales como tecnología de punta, o quieras liquidar inventario de forma rápida, en Subastándolo <strong className="text-foreground">tú tienes el control del martillo</strong>.
                  </p>
                </div>
              </div>

              {/* Quote card */}
              <div className="relative">
                <div className="relative rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(250,204,21,0.1),transparent_70%)]" />
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-40" />
                  <div className="relative z-10 p-8 sm:p-10 text-center">
                    <div className="text-5xl font-heading font-black text-accent/20 leading-none mb-4">"</div>
                    <p className="text-white text-base sm:text-lg font-heading font-bold leading-relaxed mb-6">
                      Seguridad, Transparencia y Emoción. Eso es Subastándolo.
                    </p>
                    <div className="w-12 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full" />
                    <p className="text-white/40 text-[10px] mt-4 uppercase tracking-[0.2em] font-medium">Nuestra promesa</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── VALUES ─── */}
        <section className="py-14 sm:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-4 w-1 rounded-full bg-primary" />
                <span className="text-primary dark:text-[#A6E300] text-xs font-bold uppercase tracking-widest">Nuestros pilares</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-foreground">
                Los valores que nos definen
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 sm:gap-5">
              {values.map(({ Icon, title, description, color, bg, border, glow }) => (
                <div key={title} className={`bg-card border ${border} rounded-2xl p-6 sm:p-7 hover:shadow-xl ${glow} hover:-translate-y-1 transition-all group`}>
                  <div className={`w-14 h-14 rounded-xl ${bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <Icon className={`h-7 w-7 ${color}`} />
                  </div>
                  <h3 className="font-heading font-bold text-base text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed text-justify">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── WHAT MAKES US DIFFERENT ─── */}
        <section className="py-14 sm:py-16 bg-secondary/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-4 w-1 rounded-full bg-accent" />
                <span className="text-accent text-xs font-bold uppercase tracking-widest">¿Por qué elegirnos?</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-foreground">
                Lo que nos hace diferentes
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Shield, title: "Verificación KYV", desc: "Todos los dealers pasan por verificación de identidad con documentos oficiales y biometría.", color: "text-sky-500", bg: "bg-sky-500/10" },
                { icon: Heart, title: "Sistema Escrow", desc: "Tu dinero solo se libera al vendedor cuando confirmas que recibiste el producto.", color: "text-rose-500", bg: "bg-rose-500/10" },
                { icon: Zap, title: "Subastas en Vivo", desc: "Experimenta la adrenalina de pujar en tiempo real con actualizaciones instantáneas.", color: "text-amber-500", bg: "bg-amber-500/10" },
                { icon: Award, title: "Reputación", desc: "Sistema de reseñas que premia a los mejores compradores y vendedores de la comunidad.", color: "text-emerald-500", bg: "bg-emerald-500/10" },
              ].map((item, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 hover:border-primary/20 hover:shadow-md transition-all">
                  <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm mb-1">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(132,204,22,0.08),transparent_60%)]" />
          <div className="container mx-auto px-4 py-16 sm:py-20 text-center relative z-10">
            <h2 className="text-2xl sm:text-3xl font-heading font-black text-white mb-3">
              ¿Quieres ser parte de la comunidad?
            </h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto text-sm">
              Únete a Subastándolo y descubre una nueva forma de comprar y vender en Venezuela.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-xl shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-all gap-2">
                <Link to="/auth">
                  <Sparkles className="h-4 w-4" />
                  Crear mi cuenta gratis
                </Link>
              </Button>
              <Button size="lg" asChild className="bg-white/[0.06] border border-white/[0.15] text-white hover:bg-white/[0.12] rounded-xl font-bold gap-2 backdrop-blur-sm transition-all">
                <Link to="/como-funciona">
                  ¿Cómo funciona?
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

export default AboutPage;
