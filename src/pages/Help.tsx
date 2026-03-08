import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import SEOHead from "@/components/SEOHead";
import {
  HelpCircle, Download, BookOpen, ShieldCheck, DollarSign, Truck, Clock,
  UserCheck, AlertTriangle, Star, ShoppingCart, CreditCard, PackageCheck, Ban,
  Lock, Search, Headphones, ChevronRight, MessageCircle, Zap, Eye
} from "lucide-react";

const dealerFaqs = [
  {
    question: "¿Cómo me convierto en un Dealer Verificado?",
    answer: "Debes completar tu perfil y subir:\n\n• Foto de tu identificación (Cédula/DNI) por ambos lados.\n• Un comprobante de residencia actual.\n• Una Selfie de Verificación sosteniendo tu documento al lado de tu rostro (sin gorra ni lentes).\n\nUna vez enviada tu solicitud, nuestro equipo la revisará en un plazo de 24-48 horas.",
    icon: UserCheck,
  },
  {
    question: "¿Cuándo recibo el pago por mis ventas?",
    answer: "Una vez que el comprador confirma la recepción o pasan 72 horas tras la entrega sin reclamos, los fondos se liberan en tu billetera. Puedes solicitar el retiro a tu cuenta bancaria registrada en cualquier momento.",
    icon: Clock,
  },
  {
    question: "¿Cuál es la comisión de la plataforma?",
    answer: "Cobramos una comisión fija del 5% sobre el precio final de cada subasta exitosa. Esta comisión se descuenta automáticamente del monto que recibe el vendedor al momento de liberar los fondos. El comprador no paga ninguna comisión adicional. Ejemplo: si un producto se vende en $100, el vendedor recibe $95 y Subastándolo retiene $5 para cubrir los costos de operación, soporte técnico y seguridad de la plataforma.",
    icon: DollarSign,
  },
  {
    question: "¿Cómo funciona el sistema de reputación?",
    answer: "Después de cada transacción, tanto el comprador como el vendedor pueden dejar una reseña. Tu reputación se calcula en base al promedio de todas tus reseñas. Un puntaje alto te da acceso a beneficios como mayor visibilidad y badges especiales.",
    icon: Star,
  },
  {
    question: "¿Qué hago si tengo un problema con una venta?",
    answer: "Puedes gestionar las disputas desde la sección 'Disputas' en tu panel. Nuestro equipo de soporte mediará entre comprador y vendedor para encontrar una solución justa.",
    icon: AlertTriangle,
  },
  {
    question: "¿Cómo se protege mi dinero?",
    answer: "Utilizamos un sistema de escrow (fondos retenidos). Cuando un comprador paga, el dinero queda protegido en la plataforma hasta que se confirme la entrega exitosa. Esto protege tanto al comprador como al vendedor.",
    icon: ShieldCheck,
  },
];

const buyerFaqs = [
  {
    question: "¿Es seguro comprar en Subastándolo?",
    answer: "Totalmente. Todos nuestros Dealers pasan por un riguroso proceso de verificación de identidad (KYV). Además, tu dinero queda retenido por la plataforma hasta que confirmes que recibiste el producto. Nunca le pagas directamente al vendedor.",
    icon: ShieldCheck,
  },
  {
    question: "¿Cómo pago si gano una subasta?",
    answer: "Una vez que resultes ganador, ve a tu panel de \"Subastas Ganadas\". Allí encontrarás los datos bancarios oficiales de Subastándolo. Debes realizar la transferencia y subir el comprobante (capture) en esa misma sección para que podamos validar tu pago.",
    icon: CreditCard,
  },
  {
    question: "¿Cuánto tiempo tengo para pagar?",
    answer: "Tienes un plazo de 24 a 48 horas para reportar tu pago. Si no lo haces, la subasta podría cancelarse y tu cuenta podría ser sancionada por incumplimiento.",
    icon: Clock,
  },
  {
    question: "¿Quién paga el envío y por qué agencia se envía?",
    answer: "El costo del envío corre por cuenta del comprador (cobro en destino), a menos que la subasta indique lo contrario. Los Dealers trabajan con las agencias principales (MRW, Zoom, Tealca, etc.). Podrás ver el número de guía en tu panel en cuanto el vendedor despache el producto.",
    icon: Truck,
  },
  {
    question: "¿Qué pasa si el producto llega dañado o no es lo que pedí?",
    answer: "Tienes 72 horas desde que recibes el paquete para abrir una Disputa si hay algún problema. Si demuestras que el producto no coincide con la descripción, gestionaremos el reembolso de tu dinero.",
    icon: AlertTriangle,
  },
  {
    question: "¿Cuánto tiempo tengo para retirar mi paquete?",
    answer: "Tienes 3 días continuos para buscar tu paquete en la agencia de encomiendas desde que llega. Pasado ese tiempo, el sistema asume que la entrega fue exitosa y libera el pago al vendedor automáticamente. ¡No te demores!",
    icon: PackageCheck,
  },
  {
    question: "¿Puedo cancelar una puja (oferta) que ya hice?",
    answer: "No. Las pujas en una subasta son compromisos de compra. Antes de ofertar, asegúrate de estar seguro, ya que cancelar ofertas afecta tu reputación como comprador y puede llevar a la suspensión de tu cuenta.",
    icon: Ban,
  },
];

const FAQAccordion = ({ faqs, prefix, searchQuery }: { faqs: typeof dealerFaqs; prefix: string; searchQuery: string }) => {
  const filtered = searchQuery.trim()
    ? faqs.filter(f =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : faqs;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8">
        <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No se encontraron resultados para "{searchQuery}"</p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="space-y-2">
      {filtered.map((faq, i) => (
        <AccordionItem
          key={i}
          value={`${prefix}-${i}`}
          className="border border-border/60 rounded-xl overflow-hidden bg-card hover:border-primary/20 transition-colors px-0"
        >
          <AccordionTrigger className="px-5 py-4 text-sm font-medium hover:no-underline hover:bg-secondary/20 gap-3">
            <div className="flex items-center gap-3 text-left">
              <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-primary/5 flex items-center justify-center shrink-0">
                <faq.icon className="h-4 w-4 text-primary dark:text-[#A6E300]" />
              </div>
              <span className="font-heading font-bold text-[13px]">{faq.question}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 pt-0">
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-11 text-justify">
              {faq.answer}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

const Help = () => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const [activeTab, setActiveTab] = useState<"buyer" | "dealer">("buyer");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Centro de Ayuda" description="Encuentra respuestas a las preguntas más comunes sobre compras, ventas y subastas en Subastándolo." />
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-6 max-w-4xl pb-24">

        {/* ─── HERO SECTION ─── */}
        <div className="relative rounded-2xl overflow-hidden mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(132,204,22,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(250,204,21,0.08),transparent_50%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

          <div className="relative z-10 p-6 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
              <HelpCircle className="h-8 w-8 text-primary dark:text-[#A6E300]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight mb-2">
              Centro de Ayuda
            </h1>
            <p className="text-sm text-white/50 max-w-md mx-auto mb-6">
              Encuentra respuestas rápidas sobre {siteName}. Compras, ventas, envíos y más.
            </p>

            {/* Search bar */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar pregunta..."
                className="w-full h-11 pl-11 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all backdrop-blur-sm"
              />
            </div>
          </div>
        </div>

        {/* ─── QUICK LINKS ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-8">
          {[
            { label: "Pagos", icon: CreditCard, color: "text-emerald-500", onClick: () => setSearchQuery("pago") },
            { label: "Envíos", icon: Truck, color: "text-sky-500", onClick: () => setSearchQuery("envío") },
            { label: "Seguridad", icon: ShieldCheck, color: "text-amber-500", onClick: () => setSearchQuery("seguro") },
            { label: "Disputas", icon: AlertTriangle, color: "text-rose-500", onClick: () => setSearchQuery("disputa") },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 transition-all group"
            >
              <item.icon className={`h-5 w-5 ${item.color} mx-auto mb-1.5 group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-heading font-bold text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>

        {/* ─── TABS ─── */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => { setActiveTab("buyer"); setSearchQuery(""); }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-heading font-bold transition-all ${activeTab === "buyer"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Compradores
          </button>
          <button
            onClick={() => { setActiveTab("dealer"); setSearchQuery(""); }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-heading font-bold transition-all ${activeTab === "dealer"
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
          >
            <UserCheck className="h-4 w-4" />
            Dealers
          </button>
        </div>

        {/* ─── BUYER TAB ─── */}
        {activeTab === "buyer" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Trust Banner */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-accent/5 border border-emerald-500/20 rounded-xl p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Lock className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm mb-1">Tu dinero está protegido</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify">
                    En {siteName}, nunca le pagas directamente al vendedor. Tu dinero queda resguardado por la plataforma
                    hasta que confirmes que recibiste el producto en perfecto estado.
                  </p>
                </div>
              </div>
            </div>

            {/* Security Tips */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-card border border-accent/20 rounded-xl p-4 flex items-start gap-3 hover:border-accent/40 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-xs mb-1">Paga solo a {siteName}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    No le pagues directamente al Dealer. Nosotros resguardamos tu dinero hasta que tengas el producto.
                  </p>
                </div>
              </div>
              <div className="bg-card border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 hover:border-amber-500/40 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-xs mb-1">¡Retira a tiempo!</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Tienes 3 días para buscar tu paquete. Pasado ese tiempo, el pago se libera automáticamente.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-sm font-heading font-bold text-muted-foreground mb-4 flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-primary" />
                Preguntas Frecuentes — Compradores
              </h2>
              <FAQAccordion faqs={buyerFaqs} prefix="buyer" searchQuery={searchQuery} />
            </div>
          </div>
        )}

        {/* ─── DEALER TAB ─── */}
        {activeTab === "dealer" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Dealer Welcome Banner */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/20 rounded-xl p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-primary dark:text-[#A6E300]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm mb-1">Vende con confianza</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify">
                    ¡Bienvenido a la comunidad de subastas! Tu éxito como dealer depende de una excelente reputación.
                    Aquí encontrarás todo lo que necesitas saber para vender con confianza.
                  </p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div>
              <h2 className="text-sm font-heading font-bold text-muted-foreground mb-4 flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-primary" />
                Preguntas Frecuentes — Dealers
              </h2>
              <FAQAccordion faqs={dealerFaqs} prefix="dealer" searchQuery={searchQuery} />
            </div>

            {/* Resources */}
            <div>
              <h2 className="text-sm font-heading font-bold text-muted-foreground mb-4 flex items-center gap-2">
                <div className="h-4 w-1 rounded-full bg-accent" />
                Recursos para Dealers
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Políticas de Publicación */}
                <div
                  className="bg-card border border-primary/20 rounded-xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group hover:-translate-y-0.5"
                  onClick={() => window.open("/politicas-publicacion", "_blank")}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Eye className="h-5 w-5 text-primary dark:text-[#A6E300]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold text-sm">Políticas de Publicación</p>
                      <p className="text-[11px] text-muted-foreground">Normas sobre imágenes y descripciones</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                  </div>
                </div>

                {/* Manual del Dealer */}
                <div
                  className="bg-card border border-accent/20 rounded-xl p-5 cursor-pointer hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all group hover:-translate-y-0.5"
                  onClick={() => window.open("/manual-dealer.pdf", "_blank")}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                      <Download className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold text-sm">Manual del Dealer</p>
                      <p className="text-[11px] text-muted-foreground">Guía completa en PDF</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:translate-x-1 group-hover:text-accent transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── CONTACT SUPPORT CTA ─── */}
        <div className="mt-10 relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(132,204,22,0.08),transparent_70%)]" />
          <div className="relative z-10 p-6 sm:p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-7 w-7 text-primary dark:text-[#A6E300]" />
            </div>
            <h3 className="font-heading font-bold text-lg mb-1.5">¿Necesitas más ayuda?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto mb-5">
              Nuestro equipo de soporte está listo para asistirte. Escríbenos y te responderemos lo antes posible.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold px-8 h-11 text-sm gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                onClick={() => window.location.href = "/contacto"}
              >
                <Headphones className="h-4 w-4" />
                Contactar Soporte
              </Button>
              <Button
                variant="outline"
                className="rounded-xl font-bold px-6 h-11 text-sm gap-2 border-border hover:border-primary/30 transition-all"
                onClick={() => window.location.href = "/mi-panel"}
              >
                <HelpCircle className="h-4 w-4" />
                Ir a Mi Panel
              </Button>
            </div>
          </div>
        </div>

      </main>
      <div className="hidden sm:block"><Footer /></div>
      <div className="sm:hidden h-14" />
      <BottomNav />
    </div>
  );
};

export default Help;
