import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Mail, MessageCircle, Shield, Clock, Send, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Contact = () => {
  const { getSetting } = useSiteSettings();
  const { toast } = useToast();
  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Contacto desde ${siteName} — ${name}`);
    const body = encodeURIComponent(`Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`);
    window.location.href = `mailto:soporte@subastandolo.com?subject=${subject}&body=${body}`;
    toast({ title: "📧 Abriendo tu correo", description: "Se abrirá tu cliente de email para enviar el mensaje." });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      {/* Hero */}
      <section className="relative bg-nav overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-20 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Headphones className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium text-white/90">Soporte al Cliente</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-heading font-bold text-white mb-4">
            ¿Necesitas ayuda?
          </h1>
          <p className="text-white/70 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Nuestro equipo de soporte está listo para asistirte en todo lo que necesites.
            Tu satisfacción es nuestra prioridad.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 -mt-8 relative z-20 mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Clock, title: "Respuesta rápida", desc: "Respondemos en menos de 24 horas hábiles" },
            { icon: Shield, title: "100% Seguro", desc: "Tu información está protegida en todo momento" },
            { icon: MessageCircle, title: "Soporte dedicado", desc: "Atención personalizada para cada caso" },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-sm p-5 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-heading font-bold mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* Contact Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-heading font-bold mb-2">Escríbenos directamente</h2>
              <p className="text-sm text-muted-foreground">
                Puedes contactarnos por correo electrónico y te responderemos lo antes posible.
              </p>
            </div>

            <a
              href="mailto:soporte@subastandolo.com"
              className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/20 rounded-sm hover:bg-primary/10 transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Correo de soporte</p>
                <p className="text-base font-heading font-bold text-primary">soporte@subastandolo.com</p>
              </div>
            </a>

            <div className="bg-secondary/30 border border-border rounded-sm p-5">
              <h3 className="text-sm font-heading font-bold mb-3">📌 Antes de escribirnos</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">1.</span>
                  Incluye tu nombre completo y correo registrado
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">2.</span>
                  Describe tu problema o consulta con el mayor detalle posible
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">3.</span>
                  Si es sobre una subasta, incluye el nombre o enlace del producto
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">4.</span>
                  Adjunta capturas de pantalla si aplica
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-card border border-border rounded-sm p-6">
            <h2 className="text-lg font-heading font-bold mb-1">Envíanos un mensaje</h2>
            <p className="text-xs text-muted-foreground mb-5">Completa el formulario y te responderemos pronto.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block">Nombre completo</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  required
                  className="rounded-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Correo electrónico</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="rounded-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Mensaje</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe tu consulta o problema..."
                  required
                  rows={5}
                  className="rounded-sm"
                />
              </div>
              <Button
                type="submit"
                disabled={!name || !email || !message}
                className="w-full bg-primary text-primary-foreground rounded-sm font-bold"
              >
                <Send className="h-4 w-4 mr-2" /> Enviar mensaje
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-nav py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-heading font-bold text-white mb-2">
            Estamos aquí para ti
          </h2>
          <p className="text-white/60 text-sm max-w-md mx-auto mb-5">
            En {siteName}, cada usuario importa. No dudes en contactarnos ante cualquier duda o inconveniente.
          </p>
          <a href="mailto:soporte@subastandolo.com">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              <Mail className="h-4 w-4 mr-2" /> soporte@subastandolo.com
            </Button>
          </a>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
