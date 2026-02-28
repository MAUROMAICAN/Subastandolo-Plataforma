import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserCheck, ShieldCheck, Gavel, Banknote, Search, Timer, Trophy, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface Step {
  Icon: LucideIcon;
  title: string;
  description: string;
}

const sellSteps: Step[] = [
  { Icon: UserCheck, title: "Verificación de Dealer", description: "Sube tus documentos y valida tu identidad para poder vender." },
  { Icon: ShieldCheck, title: "Revisión de Producto", description: "Cada producto es inspeccionado por nosotros antes de salir a subasta." },
  { Icon: Gavel, title: "Subasta en Vivo", description: "Tu producto se publica y los usuarios compiten en tiempo real." },
  { Icon: Banknote, title: "Venta Exitosa", description: "El mejor postor gana y coordinas la entrega." },
];

const buySteps: Step[] = [
  { Icon: Search, title: "Explora y Elige", description: "Regístrate en segundos y navega por nuestras categorías. Revisa fotos, descripción y precio base del producto que te interesa." },
  { Icon: Timer, title: "Haz tu Oferta", description: "¡Entra en la puja! Coloca tu monto y te avisaremos en tiempo real si alguien supera tu oferta. ¡El último segundo cuenta!" },
  { Icon: Trophy, title: "¡Gana y Recibe!", description: "Si al final del cronómetro eres el postor más alto, el artículo es tuyo. Te contactamos de inmediato para coordinar pago y entrega." },
  { Icon: CreditCard, title: "Tu Dinero Está Protegido", description: "No le pagas directo al vendedor. Tu dinero queda resguardado por nosotros hasta que retires tu producto en la agencia de envío. 100% garantizado." },
];

const StepCard = ({ step, index }: { step: Step; index: number }) => (
  <div className="flex flex-col items-center text-center px-4">
    <div className="relative mb-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <step.Icon className="h-7 w-7 text-primary" />
      </div>
      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center shadow">
        {index + 1}
      </span>
    </div>
    <h4 className="font-heading font-bold text-foreground text-sm mb-1.5">{step.title}</h4>
    <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">{step.description}</p>
  </div>
);

const Connector = () => (
  <div className="hidden md:flex items-center justify-center pt-2">
    <div className="w-10 border-t-2 border-dashed border-border" />
  </div>
);

const StepsGrid = ({ steps }: { steps: Step[] }) => (
  <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-6 md:gap-0">
    {steps.map((step, i) => (
      <div key={step.title} className="contents">
        <StepCard step={step} index={i} />
        {i < steps.length - 1 && <Connector />}
      </div>
    ))}
  </div>
);

const HowItWorks = () => (
  <section id="como-funciona" className="py-14 bg-card border-y border-border">
    <div className="container mx-auto px-4 max-w-5xl">
      <h2 className="text-xl sm:text-2xl font-heading font-bold text-center mb-1">
        ¿Cómo Funciona?
      </h2>
      <p className="text-center text-xs text-muted-foreground mb-8">
        Subastas seguras y verificadas — Tu ruta al éxito
      </p>

      <Tabs defaultValue="buy" className="w-full">
        <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2 mb-10">
          <TabsTrigger value="buy">Quiero Comprar</TabsTrigger>
          <TabsTrigger value="sell">Quiero Vender</TabsTrigger>
        </TabsList>

        <TabsContent value="buy">
          <StepsGrid steps={buySteps} />
        </TabsContent>

        <TabsContent value="sell">
          <StepsGrid steps={sellSteps} />
          <div className="flex justify-center mt-10">
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              <Link to="/dealer/apply">Convertirme en Dealer Ahora</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </section>
);

export default HowItWorks;
