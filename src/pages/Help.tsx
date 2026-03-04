import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle, Download, BookOpen, ShieldCheck, DollarSign, Truck, Clock,
  UserCheck, AlertTriangle, Star, ShoppingCart, CreditCard, PackageCheck, Ban, Lock
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

const FAQAccordion = ({ faqs, prefix }: { faqs: typeof dealerFaqs; prefix: string }) => (
  <Accordion type="single" collapsible className="space-y-2">
    {faqs.map((faq, i) => (
      <AccordionItem
        key={i}
        value={`${prefix}-${i}`}
        className="border border-border rounded-sm overflow-hidden bg-card px-0"
      >
        <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-secondary/30 gap-3">
          <div className="flex items-center gap-2.5 text-left">
            <faq.icon className="h-4 w-4 text-primary dark:text-gray-300 shrink-0" />
            {faq.question}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-0">
          <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-6.5 text-justify">
            {faq.answer}
          </div>
        </AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
);

const Help = () => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "SUBASTANDOLO");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
            <HelpCircle className="h-7 w-7 text-primary dark:text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Centro de Ayuda</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Encuentra respuestas a las preguntas más comunes sobre {siteName}.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="buyer" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="buyer" className="text-sm font-heading font-bold gap-1.5">
              <ShoppingCart className="h-4 w-4" />
              Guía del Comprador
            </TabsTrigger>
            <TabsTrigger value="dealer" className="text-sm font-heading font-bold gap-1.5">
              <UserCheck className="h-4 w-4" />
              Guía del Dealer
            </TabsTrigger>
          </TabsList>

          {/* Buyer Tab */}
          <TabsContent value="buyer" className="space-y-6">
            <Card className="border border-accent/20 bg-accent/5 rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Lock className="h-5 w-5 text-accent" />
                  🛍️ Guía del Comprador — Tu dinero está protegido
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2 text-justify">
                <p>
                  En {siteName}, tu seguridad es nuestra prioridad. Nunca le pagas directamente al vendedor:
                  tu dinero queda resguardado por la plataforma hasta que confirmes que recibiste el producto
                  en perfecto estado. Aquí resolvemos todas tus dudas.
                </p>
              </CardContent>
            </Card>

            {/* Security Tips */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border border-accent/30 bg-accent/5 rounded-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-xs text-foreground mb-1">¡Tu dinero está seguro!</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed text-justify">
                      No le pagues directamente al Dealer. Al pagarle a {siteName}, nosotros resguardamos tu dinero hasta que tengas el producto en tus manos.
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-amber-500/30 bg-amber-500/5 rounded-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-xs text-foreground mb-1">¡Retira a tiempo!</h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed text-justify">
                      Tienes 3 días para buscar tu paquete en la agencia desde que llega. Pasado ese tiempo, el sistema libera el pago al vendedor automáticamente.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                ❓ Preguntas Frecuentes — Compradores
              </h2>
              <FAQAccordion faqs={buyerFaqs} prefix="buyer" />
            </div>
          </TabsContent>

          {/* Dealer Tab */}
          <TabsContent value="dealer" className="space-y-6">
            <Card className="border border-primary/20 bg-primary/5 rounded-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary dark:text-white" />
                  🚀 Guía del Dealer — Vende con confianza
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2 text-justify">
                <p>
                  ¡Estamos felices de que seas parte de nuestra comunidad de subastas! Para asegurar que tengas éxito
                  y mantengas una excelente reputación, hemos preparado esta guía rápida y un manual descargable.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                ❓ Preguntas Frecuentes — Dealers
              </h2>
              <FAQAccordion faqs={dealerFaqs} prefix="dealer" />
            </div>

            {/* Publication Policies */}
            <Card className="border border-primary/20 bg-primary/5 rounded-sm">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 shrink-0">
                  <BookOpen className="h-6 w-6 text-primary dark:text-white" />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h3 className="font-heading font-bold text-sm">📋 Políticas de Publicación</h3>
                  <p className="text-xs text-muted-foreground">
                    Conoce las normas obligatorias sobre imágenes, descripciones y comunicación al publicar tus productos.
                  </p>
                </div>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm font-bold shrink-0"
                  onClick={() => window.open("/politicas-publicacion", "_blank")}
                >
                  <BookOpen className="h-4 w-4 mr-1.5" />
                  Ver Políticas
                </Button>
              </CardContent>
            </Card>

            {/* Download Manual */}
            <Card className="border border-border rounded-sm">
              <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 shrink-0">
                  <Download className="h-6 w-6 text-accent" />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h3 className="font-heading font-bold text-sm">📖 Manual del Dealer (PDF)</h3>
                  <p className="text-xs text-muted-foreground">
                    Descarga nuestra guía completa con todas las reglas, procesos y mejores prácticas para vender en la plataforma.
                  </p>
                </div>
                <Button
                  className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-sm font-bold shrink-0"
                  onClick={() => window.open("/manual-dealer.pdf", "_blank")}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Descargar PDF
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Contact Support */}
        <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 rounded-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <HelpCircle className="h-7 w-7 text-primary dark:text-white" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-heading font-bold text-base">¿Necesitas más ayuda?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nuestro equipo de soporte está listo para asistirte. Escríbenos y te responderemos lo antes posible.
              </p>
            </div>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm font-bold px-8 h-11 text-sm gap-2"
              onClick={() => window.location.href = "/contacto"}
            >
              <HelpCircle className="h-4 w-4" />
              Contactar a Soporte
            </Button>
          </CardContent>
        </Card>

        <div className="pb-6" />
      </main>
      <Footer />
    </div>
  );
};

export default Help;
