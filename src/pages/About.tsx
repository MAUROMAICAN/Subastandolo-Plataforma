import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { Shield, Eye, Zap, Target, Users, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const values = [
  {
    Icon: Shield,
    title: "Seguridad",
    description: "Tu dinero y tus datos están protegidos en todo momento. Usamos sistemas de custodia para garantizar que ninguna transacción quede sin respaldo.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    Icon: Eye,
    title: "Transparencia",
    description: "Cada puja, cada precio, cada movimiento es visible en tiempo real. No hay costos ocultos ni sorpresas. Lo que ves es lo que pagas.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    Icon: Zap,
    title: "Emoción",
    description: "Las subastas están diseñadas para que cada segundo cuente. La adrenalina del último segundo es parte de la experiencia Subastándolo.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
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
            <span className="text-accent text-xs font-semibold tracking-wider uppercase">Nuestra historia</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-4 leading-tight">
            Acerca de<br />
            <span className="text-accent">Subastándolo</span>
          </h1>
          <p className="text-white/70 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Revolucionando la manera en la que los venezolanos compran y venden.
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="bg-nav-solid border-b border-white/10">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {stats.map(({ Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="h-5 w-5 text-accent mb-1" />
                <span className="text-white font-heading font-bold text-xl">{value}</span>
                <span className="text-white/50 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mission */}
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-accent text-xs font-semibold uppercase tracking-widest">Nuestra misión</span>
              <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mt-2 mb-5">
                Bienvenido a Subastándolo
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed text-justify">
                <p>
                  En Subastándolo, estamos revolucionando la manera en la que los venezolanos compran y venden. Nacimos con una misión clara: democratizar el acceso a las mejores oportunidades mediante un sistema de subastas transparente, seguro y emocionante.
                </p>
                <p>
                  Creemos que el valor de las cosas lo decide el mercado, no una etiqueta. Por eso, hemos creado una plataforma tecnológica de última generación donde la velocidad y la confianza van de la mano.
                </p>
                <p>
                  Ya sea que busques un destornillador o el producto de tus sueños, tales como tecnología de punta, o quieras liquidar inventario de forma rápida, en Subastándolo tú tienes el control del martillo.
                </p>
              </div>
            </div>

            {/* Quote card */}
            <div className="relative">
              <div className="bg-nav rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: "radial-gradient(circle at 50% 50%, hsl(var(--accent)) 0%, transparent 70%)" }} />
                <div className="relative z-10">
                  <div className="text-5xl font-heading font-black text-accent/30 leading-none mb-4">"</div>
                  <p className="text-white text-lg font-heading font-semibold leading-relaxed mb-6">
                    Seguridad, Transparencia y Emoción. Eso es Subastándolo.
                  </p>
                  <div className="w-12 h-1 bg-accent mx-auto rounded-full" />
                  <p className="text-white/50 text-xs mt-4 uppercase tracking-widest">Nuestra promesa</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-secondary/20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <span className="text-accent text-xs font-semibold uppercase tracking-widest">Nuestros pilares</span>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mt-2">
              Los valores que nos definen
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map(({ Icon, title, description, color, bg }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-7 hover:shadow-lg transition-shadow group">
                <div className={`w-14 h-14 rounded-xl ${bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-7 w-7 ${color}`} />
                </div>
                <h3 className="font-heading font-bold text-lg text-foreground mb-3">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-justify">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-nav py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white mb-4">
            ¿Quieres ser parte de la comunidad?
          </h2>
          <p className="text-white/70 mb-8 max-w-md mx-auto">
            Únete a Subastándolo y descubre una nueva forma de comprar y vender en Venezuela.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              <Link to="/auth">Crear mi cuenta gratis</Link>
            </Button>
            <Button size="lg" asChild className="bg-white/10 border border-white/30 text-white hover:bg-white/20 rounded-sm">
              <Link to="/como-funciona">¿Cómo funciona?</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;
