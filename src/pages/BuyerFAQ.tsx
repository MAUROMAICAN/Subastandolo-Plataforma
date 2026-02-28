import Navbar from "@/components/Navbar";
import BackButton from "@/components/BackButton";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, PackageCheck, CreditCard, Clock, Truck, AlertTriangle, Ban, MessageCircle } from "lucide-react";
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
    question: "¿Puedo cancelar una puja (oferta) que ya hice?",
    answer: "No. Las pujas en una subasta son compromisos de compra legal. Antes de ofertar, asegúrate de estar seguro, ya que cancelar ofertas afecta tu reputación como comprador y puede llevar a la suspensión de tu cuenta.",
    icon: Ban,
  },
];

const BuyerFAQ = () => {
  const { getSetting } = useSiteSettings();
  const siteName = getSetting("site_name", "SUBASTANDOLO");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />
      <main className="container mx-auto px-4 py-10 max-w-3xl space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(152,60%,94%)] mb-1">
            <Lock className="h-8 w-8 text-[hsl(152,55%,38%)]" />
          </div>
          <h1 className="text-3xl font-heading font-bold">
            🛍️ Preguntas Frecuentes para Compradores
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Tu tranquilidad es nuestra prioridad. Aquí resolvemos las dudas más comunes para que compres con total confianza en {siteName}.
          </p>
        </div>

        {/* Trust Banner */}
        <Card className="border border-[hsl(152,40%,80%)] bg-[hsl(152,60%,96%)] rounded-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex items-center justify-center w-11 h-11 rounded-full bg-[hsl(152,55%,38%)]/10 shrink-0">
              <PackageCheck className="h-5 w-5 text-[hsl(152,55%,38%)]" />
            </div>
            <p className="text-sm text-[hsl(152,30%,25%)]">
              <strong>Compra protegida:</strong> Tu dinero queda retenido en la plataforma hasta que confirmes que recibiste el producto en perfecto estado.
            </p>
          </CardContent>
        </Card>

        {/* FAQ Accordion */}
        <div className="space-y-3">
          <Accordion type="single" collapsible className="space-y-2">
            {buyerFaqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border border-border rounded-sm overflow-hidden bg-card px-0"
              >
                <AccordionTrigger className="px-4 py-3.5 text-sm font-medium hover:no-underline hover:bg-secondary/30 gap-3">
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[hsl(152,60%,94%)] shrink-0">
                      <faq.icon className="h-4 w-4 text-[hsl(152,55%,38%)]" />
                    </div>
                    {faq.question}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-11">
                    {faq.answer}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Security Guide */}
        <div className="space-y-4">
          <h2 className="text-lg font-heading font-bold flex items-center gap-2">
            🛡️ Guía de Seguridad para el Cliente
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border border-accent/30 bg-accent/5 rounded-sm">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10 shrink-0 mt-0.5">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-foreground mb-1">¡Tu dinero está seguro!</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify">
                    No le pagues directamente al Dealer. Al pagarle a Subastandolo.com, nosotros resguardamos tu dinero hasta que tengas el producto en tus manos.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-amber-500/30 bg-amber-500/5 rounded-sm">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 shrink-0 mt-0.5">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-sm text-foreground mb-1">¡Retira a tiempo!</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed text-justify">
                    Tienes 3 días para buscar tu paquete en la agencia desde que llega. Pasado ese tiempo, el sistema asume que todo está correcto y libera el pago al vendedor. ¡No te demores!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact Support */}
        <Card className="border border-border rounded-sm bg-card">
          <CardContent className="p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-heading font-bold text-lg">¿Aún tienes dudas?</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Nuestro equipo de soporte está listo para ayudarte. Abre una disputa o escríbenos y te responderemos lo antes posible.
            </p>
            <Button
              onClick={() => navigate("/disputes")}
              className="rounded-sm font-bold"
            >
              <MessageCircle className="h-4 w-4 mr-1.5" />
              Contacta a Soporte
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BuyerFAQ;
