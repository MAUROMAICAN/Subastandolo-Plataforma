import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ShieldCheck, CreditCard, Clock, Truck, AlertTriangle, Ban, Lock } from "lucide-react";
import { Link } from "react-router-dom";

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

const BuyerFAQSection = () => {
  return (
    <section className="py-12 bg-secondary/20">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold">Preguntas Frecuentes</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Resolvemos tus dudas para que compres con total confianza.
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {buyerFaqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-home-${i}`}
              className="border border-border rounded-sm overflow-hidden bg-card px-0"
            >
              <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline hover:bg-secondary/30 gap-3">
                <div className="flex items-center gap-2.5 text-left">
                  <faq.icon className="h-4 w-4 text-primary shrink-0" />
                  {faq.question}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-0">
                <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-6.5">
                  {faq.answer}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="text-center mt-6">
          <Link to="/compradores" className="text-sm text-primary hover:underline font-medium">
            Ver todas las preguntas →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default BuyerFAQSection;
