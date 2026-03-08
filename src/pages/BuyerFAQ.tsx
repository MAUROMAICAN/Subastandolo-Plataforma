import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import BottomNav from "@/components/BottomNav";
import SEOHead from "@/components/SEOHead";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Lock, PackageCheck, CreditCard, Clock, Truck,
  AlertTriangle, Ban, MessageCircle, Search, Headphones, ChevronRight,
  Zap, CheckCircle, HelpCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const buyerFaqs = [
  {
    question: "¿Es seguro comprar en la plataforma?",
    answer: "Totalmente. Todos nuestros Dealers pasan por un riguroso proceso de verificación de identidad (KYV) que incluye validación de documentos oficiales y biometría. Además, nosotros retenemos tu dinero hasta que recibes el producto.",
    icon: ShieldCheck,
  },
  {
    question: "¿Cómo pago si gano una subasta?",
    answer: "Una vez que resultes ganador, ve a tu panel de \"Subastas Ganadas\". Allí encontrarás los datos bancarios de la plataforma. Debes realizar la transferencia y subir el comprobante (capture) en esa misma sección para que podamos validar tu pago.",
    icon: CreditCard,
  },
  {
    question: "¿Cuánto tiempo tengo para pagar?",
    answer: "Para mantener la agilidad de las subastas, tienes un plazo de 24-48 horas para reportar tu pago. Si no lo haces, la subasta podría cancelarse y tu cuenta podría ser sancionada por incumplimiento.",
    icon: Clock,
  },
  {
    question: "¿Quién paga el envío y por qué agencia se envía?",
    answer: "El costo del envío corre por cuenta del comprador (cobro en destino), a menos que la subasta indique lo contrario. Los Dealers trabajan con las agencias principales (MRW, Zoom, Tealca, etc.). Podrás ver el número de guía en tu panel en cuanto el vendedor despache el producto.",
    icon: Truck,
  },
  {
    question: "¿Qué pasa si el producto llega dañado o no es lo que pedí?",
    answer: "No te preocupes. Tienes 72 horas desde que recibes el paquete para abrir una Disputa si hay algún problema. Si demuestras que el producto no coincide con la descripción, gestionaremos el reembolso de tu dinero.",
    icon: AlertTriangle,
  },
  {
    question: "¿Cuánto tiempo tengo para retirar mi paquete?",
    answer: "Tienes 3 días continuos para buscar tu paquete en la agencia de encomiendas desde que llega. Pasado ese tiempo, el sistema asume que la entrega fue exitosa y libera el pago al vendedor automáticamente. ¡No te demores!",
    icon: PackageCheck,
  },
  {
    question: "¿Puedo cancelar una puja (oferta) que ya hice?",
    answer: "No. Las pujas en una subasta son compromisos de compra legal. Antes de ofertar, asegúrate de estar seguro, ya que cancelar ofertas afecta tu reputación como comprador y puede llevar a la suspensión de tu cuenta.",
    icon: Ban,
  },
];

const BuyerFAQ = () => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? buyerFaqs.filter(f =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : buyerFaqs;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Preguntas Frecuentes para Compradores" description="Resolvemos tus dudas sobre compras, pagos, envíos y seguridad en Subastándolo." />
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-6 max-w-4xl pb-24">

        {/* ─── HERO SECTION ─── */}
        <div className="relative rounded-2xl overflow-hidden mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#161b22] to-[#0d1117]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(132,204,22,0.12),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.1),transparent_50%)]" />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-60" />

          <div className="relative z-10 p-6 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
              <Lock className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight mb-2">
              Guía del Comprador
            </h1>
            <p className="text-sm text-white/50 max-w-lg mx-auto mb-6">
              Tu tranquilidad es nuestra prioridad. Resolvemos las dudas más comunes para que compres con total confianza en {siteName}.
            </p>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar pregunta..."
                className="w-full h-11 pl-11 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all backdrop-blur-sm"
              />
            </div>
          </div>
        </div>

        {/* ─── TRUST HIGHLIGHTS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: ShieldCheck, title: "Compra Protegida", desc: "Tu dinero queda retenido hasta que confirmes la entrega", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { icon: Clock, title: "Retira a Tiempo", desc: "3 días para buscar tu paquete en la agencia", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            { icon: Zap, title: "Pago Rápido", desc: "24-48h para subir tu comprobante de pago", color: "text-sky-500", bg: "bg-sky-500/10", border: "border-sky-500/20" },
          ].map((item, idx) => (
            <div key={idx} className={`bg-card border ${item.border} rounded-xl p-4 flex items-start gap-3 hover:shadow-md transition-all`}>
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <h4 className="font-heading font-bold text-xs mb-0.5">{item.title}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ─── HOW IT WORKS ─── */}
        <div className="mb-8">
          <h2 className="text-sm font-heading font-bold text-muted-foreground mb-4 flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-emerald-500" />
            ¿Cómo Funciona?
          </h2>
          <div className="relative">
            <div className="hidden sm:block absolute left-[23px] top-10 bottom-10 w-[2px] bg-gradient-to-b from-emerald-500/40 via-primary/20 to-transparent" />
            <div className="space-y-4">
              {[
                { step: "1", title: "Encuentra tu producto", desc: "Explora las subastas activas y puja por lo que te interesa", color: "bg-emerald-500", text: "text-white" },
                { step: "2", title: "Gana y paga", desc: "Si ganas, sube tu comprobante de pago en 24-48 horas", color: "bg-primary", text: "text-primary-foreground" },
                { step: "3", title: "Recibe tu producto", desc: "El dealer envía y tú retiras en la agencia", color: "bg-sky-500", text: "text-white" },
                { step: "4", title: "Confirma y califica", desc: "Confirma la recepción y califica al dealer", color: "bg-accent", text: "text-accent-foreground" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 group">
                  <div className={`w-12 h-12 rounded-xl ${item.color} ${item.text} flex items-center justify-center shrink-0 font-heading font-black text-lg shadow-lg group-hover:scale-105 transition-transform`}>
                    {item.step}
                  </div>
                  <div className="pt-1.5">
                    <p className="font-heading font-bold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── FAQ ─── */}
        <div className="mb-8">
          <h2 className="text-sm font-heading font-bold text-muted-foreground mb-4 flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-primary" />
            Preguntas Frecuentes
            {searchQuery && <span className="text-xs font-normal text-muted-foreground/60">— buscando "{searchQuery}"</span>}
          </h2>

          {filtered.length === 0 ? (
            <div className="text-center py-10">
              <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No se encontraron resultados para "{searchQuery}"</p>
              <button onClick={() => setSearchQuery("")} className="text-xs text-primary hover:underline mt-2">Limpiar búsqueda</button>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {filtered.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
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
          )}
        </div>

        {/* ─── SECURITY GUIDE ─── */}
        <div className="mb-8">
          <h2 className="text-sm font-heading font-bold text-muted-foreground mb-4 flex items-center gap-2">
            <div className="h-4 w-1 rounded-full bg-emerald-500" />
            Guía de Seguridad
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-card border border-emerald-500/20 rounded-xl p-5 flex items-start gap-4 hover:border-emerald-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-xs mb-1">Paga solo a {siteName}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  No le pagues directamente al Dealer. Nosotros resguardamos tu dinero hasta que tengas el producto en tus manos.
                </p>
              </div>
            </div>
            <div className="bg-card border border-amber-500/20 rounded-xl p-5 flex items-start gap-4 hover:border-amber-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-xs mb-1">¡No pierdas tu compra!</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Retira a tiempo: tienes 3 días para buscar tu paquete. Pasado ese plazo, el pago se libera automáticamente al vendedor.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CONTACT SUPPORT CTA ─── */}
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-emerald-500/5 to-primary/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.06),transparent_70%)]" />
          <div className="relative z-10 p-6 sm:p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-7 w-7 text-primary dark:text-[#A6E300]" />
            </div>
            <h3 className="font-heading font-bold text-lg mb-1.5">¿Aún tienes dudas?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto mb-5">
              Nuestro equipo de soporte está listo para ayudarte. Escríbenos y te responderemos lo antes posible.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold px-8 h-11 text-sm gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                onClick={() => navigate("/contacto")}
              >
                <Headphones className="h-4 w-4" />
                Contactar Soporte
              </Button>
              <Button
                variant="outline"
                className="rounded-xl font-bold px-6 h-11 text-sm gap-2 border-border hover:border-primary/30 transition-all"
                onClick={() => navigate("/ayuda")}
              >
                <HelpCircle className="h-4 w-4" />
                Centro de Ayuda
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

export default BuyerFAQ;
