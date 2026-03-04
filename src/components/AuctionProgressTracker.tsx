import { Check, Clock, CreditCard, Package, Truck, PackageCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuctionProgressTrackerProps {
  paymentStatus: string;
  deliveryStatus: string;
  trackingNumber?: string | null;
}

const steps = [
  { key: "pending", label: "Pago Pendiente", icon: Clock, description: "Sube tu comprobante de pago para continuar." },
  { key: "under_review", label: "Verificando Pago", icon: CreditCard, description: "Estamos revisando tu comprobante de pago." },
  { key: "ready_to_ship", label: "Preparando Envío", icon: Package, description: "El vendedor está preparando tu paquete." },
  { key: "shipped", label: "En Camino", icon: Truck, description: "¡Tu paquete ya fue despachado! Revisa el número de guía." },
  { key: "delivered", label: "Entregado", icon: PackageCheck, description: "¡Producto entregado! Gracias por tu compra." },
];

const getActiveStep = (paymentStatus: string, deliveryStatus: string): number => {
  if (deliveryStatus === "delivered") return 5;
  if (deliveryStatus === "shipped") return 4;
  if (deliveryStatus === "ready_to_ship") return 3;
  if (paymentStatus === "verified") return 3;
  if (paymentStatus === "under_review") return 2;
  return 1;
};

const AuctionProgressTracker = ({ paymentStatus, deliveryStatus, trackingNumber }: AuctionProgressTrackerProps) => {
  const activeStep = getActiveStep(paymentStatus, deliveryStatus);
  const currentStepData = steps[activeStep - 1];

  return (
    <div className="bg-card border border-border rounded-sm p-4 space-y-4">
      <h3 className="text-sm font-heading font-bold">Progreso de tu compra</h3>

      {/* Desktop: horizontal */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border" />
          {/* Active line */}
          <div
            className="absolute top-5 left-[10%] h-0.5 bg-[hsl(152,55%,38%)] transition-all duration-700 ease-out"
            style={{ width: `${Math.max(0, ((Math.min(activeStep, steps.length) - 1) / (steps.length - 1)) * 80)}%` }}
          />

          {steps.map((step, i) => {
            const stepNum = i + 1;
            const Icon = step.icon;
            const isComplete = stepNum < activeStep;
            const isCurrent = stepNum === activeStep;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isComplete
                      ? "bg-[hsl(152,55%,38%)] border-[hsl(152,55%,38%)] text-white"
                      : isCurrent
                        ? "bg-[hsl(152,60%,94%)] dark:bg-[hsl(152,40%,20%)] border-[hsl(152,55%,38%)] text-[hsl(152,55%,38%)] dark:text-[#A6E300] ring-4 ring-[hsl(152,55%,38%)]/20 animate-pulse"
                        : "bg-card dark:bg-white/5 border-border dark:border-white/15 text-muted-foreground dark:text-white/40"
                    }`}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`text-[10px] text-center leading-tight font-medium max-w-[72px] ${isComplete ? "text-[hsl(152,55%,38%)]" : isCurrent ? "text-foreground dark:text-white font-bold" : "text-muted-foreground dark:text-white/40"
                    }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical list */}
      <div className="sm:hidden space-y-1">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const Icon = step.icon;
          const isComplete = stepNum < activeStep;
          const isCurrent = stepNum === activeStep;
          const isFuture = stepNum > activeStep;

          return (
            <div key={step.key} className="flex items-center gap-3">
              {/* Connector + icon */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${isComplete
                      ? "bg-[hsl(152,55%,38%)] border-[hsl(152,55%,38%)] text-white"
                      : isCurrent
                        ? "bg-[hsl(152,60%,94%)] dark:bg-[hsl(152,40%,20%)] border-[hsl(152,55%,38%)] text-[hsl(152,55%,38%)] dark:text-[#A6E300] ring-2 ring-[hsl(152,55%,38%)]/20"
                        : "bg-card dark:bg-white/5 border-border dark:border-white/15 text-muted-foreground dark:text-white/40"
                    }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-0.5 h-4 ${stepNum < activeStep ? "bg-[hsl(152,55%,38%)]" : "bg-border"}`} />
                )}
              </div>
              <span
                className={`text-xs pb-4 ${isComplete ? "text-[hsl(152,55%,38%)] font-medium" : isCurrent ? "text-foreground dark:text-white font-bold" : "text-muted-foreground dark:text-white/40"
                  }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status description */}
      <div className="bg-secondary/40 dark:bg-white/5 rounded-sm px-3 py-2.5 text-xs text-muted-foreground dark:text-slate-300 text-center">
        {currentStepData.description}
      </div>

      {/* Tracking button when shipped */}
      {activeStep >= 4 && trackingNumber && (
        <Button
          className="w-full bg-[hsl(152,55%,38%)] hover:bg-[hsl(152,55%,32%)] text-white rounded-sm font-bold"
          onClick={() => {
            const url = `https://www.google.com/search?q=${encodeURIComponent(trackingNumber + " rastreo envío")}`;
            window.open(url, "_blank");
          }}
        >
          <Truck className="h-4 w-4 mr-2" />
          Rastrear mi paquete — Guía: {trackingNumber}
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      )}
    </div>
  );
};

export default AuctionProgressTracker;
