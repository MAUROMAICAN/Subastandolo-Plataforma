import { useEffect, useState, useRef } from "react";
import { Trophy, PartyPopper, Clock, Gift, ChevronDown } from "lucide-react";
import AuctionProgressTracker from "@/components/AuctionProgressTracker";
import ShippingForm from "@/components/ShippingForm";
import PaymentFlow from "@/components/PaymentFlow";
import confetti from "canvas-confetti";

interface WinnerCelebrationProps {
  auction: {
    id: string;
    title: string;
    current_price: number;
    image_url: string | null;
    payment_status: string;
    delivery_status: string;
    tracking_number: string | null;
    end_time: string;
    status: string;
    created_by: string;
  };
  userId: string;
  productImages: string[];
}

const WinnerCelebration = ({ auction, userId, productImages }: WinnerCelebrationProps) => {
  const [shippingComplete, setShippingComplete] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const confettiRef = useRef(false);

  const heroImage = productImages[0] || auction.image_url;

  useEffect(() => {
    if (confettiRef.current) return;
    confettiRef.current = true;

    // Only fire confetti if payment is still pending (first visit feel)
    if (auction.payment_status === "pending") {
      const timer = setTimeout(() => {
        const count = 150;
        const defaults = { origin: { y: 0.6 }, zIndex: 9999 };
        const fire = (ratio: number, opts: confetti.Options) =>
          confetti({ ...defaults, ...opts, particleCount: Math.floor(count * ratio) });
        fire(0.25, { spread: 26, startVelocity: 55, colors: ["#FFD700", "#FFA500", "#FF6347"] });
        fire(0.2, { spread: 60, colors: ["#00CED1", "#1E90FF", "#FFD700"] });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ["#FFD700", "#32CD32", "#FF69B4"] });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [auction.payment_status]);

  const timeSinceEnd = Math.floor((Date.now() - new Date(auction.end_time).getTime()) / (1000 * 60 * 60));
  const hoursLabel = timeSinceEnd < 1 ? "hace menos de 1 hora" : `hace ${timeSinceEnd}h`;

  return (
    <div className="space-y-4">
      {/* Hero Congratulations Banner */}
      <div className="relative overflow-hidden rounded-sm border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10">
        {/* Decorative gold corner accents */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-primary/40 rounded-tl-sm" />
        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-primary/40 rounded-tr-sm" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-primary/40 rounded-bl-sm" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-primary/40 rounded-br-sm" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Product Image */}
            {heroImage && (
              <div className="relative shrink-0">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-sm overflow-hidden border-2 border-primary/20 shadow-lg shadow-primary/10 bg-white">
                  <img
                    src={heroImage}
                    alt={auction.title}
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Trophy badge overlay */}
                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg animate-bounce">
                  <Trophy className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
            )}

            {/* Congratulations Text */}
            <div className="flex-1 text-center sm:text-left space-y-3">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <PartyPopper className="h-5 w-5 text-accent" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent">¡Felicidades!</span>
                <PartyPopper className="h-5 w-5 text-accent scale-x-[-1]" />
              </div>

              <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-foreground leading-tight">
                ¡Ganaste esta subasta!
              </h2>

              <p className="text-sm text-muted-foreground">
                Has ganado <strong className="text-foreground">{auction.title}</strong> por un precio final de:
              </p>

              <div className="inline-flex items-baseline gap-1 bg-primary/10 border border-primary/20 rounded-sm px-4 py-2">
                <span className="text-3xl sm:text-4xl font-heading font-black text-primary dark:text-[#A6E300]">
                  ${auction.current_price.toLocaleString("es-MX")}
                </span>
                <span className="text-sm text-muted-foreground font-medium">USD</span>
              </div>

              <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Finalizada {hoursLabel}
                </span>
                <span className="flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  ¡Tu producto te espera!
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps CTA */}
      {auction.payment_status === "pending" && (
        <div className="bg-accent/10 border border-accent/20 rounded-sm p-4 text-center space-y-2">
          <p className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
            <span className="text-lg">📋</span> Próximos pasos
          </p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Para recibir tu producto, completa tus <strong className="text-foreground">datos de envío</strong> y luego
            sube tu <strong className="text-foreground">comprobante de pago</strong>. Recuerda que tienes
            <strong className="text-foreground"> 24-48 horas</strong> para reportar tu pago.
          </p>
        </div>
      )}

      {/* Progress Tracker */}
      <AuctionProgressTracker
        paymentStatus={auction.payment_status}
        deliveryStatus={auction.delivery_status}
        trackingNumber={auction.tracking_number}
      />

      {/* Collapsible details toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary dark:hover:text-[#A6E300] py-2 transition-colors"
      >
        <span>{showDetails ? "Ocultar formularios" : "Mostrar formularios de envío y pago"}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
      </button>

      {/* Shipping + Payment Flow */}
      {showDetails && (
        <div className="space-y-4">
          <ShippingForm
            auctionId={auction.id}
            userId={userId}
            onComplete={() => setShippingComplete(true)}
          />
          {shippingComplete && (
            <PaymentFlow auctionId={auction.id} amountUsd={auction.current_price} userId={userId} />
          )}
        </div>
      )}
    </div>
  );
};

export default WinnerCelebration;
