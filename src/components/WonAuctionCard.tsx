import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ShippingForm from "@/components/ShippingForm";
import PaymentFlow from "@/components/PaymentFlow";
import AuctionProgressTracker from "@/components/AuctionProgressTracker";
import type { Tables } from "@/integrations/supabase/types";

type Auction = Tables<"auctions">;

interface WonAuctionCardProps {
  auction: Auction;
  userId: string;
  onNavigate: () => void;
}

const WonAuctionCard = ({ auction, userId, onNavigate }: WonAuctionCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [shippingComplete, setShippingComplete] = useState(false);
  const { toast } = useToast();

  const a = auction;

  return (
    <div className="bg-card border border-border rounded-sm">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-secondary/30 transition-colors flex items-center gap-4"
      >
        {a.image_url && (
          <img src={a.image_url} alt={a.title} className="w-14 h-14 rounded-sm object-cover border border-border shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-heading font-bold text-sm truncate">{a.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Precio final: <span className="font-bold text-primary dark:text-[#A6E300]">${a.current_price.toLocaleString("es-MX")}</span>
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={
              a.payment_status === "verified" ? "bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20" :
                a.payment_status === "under_review" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" :
                  "bg-muted text-muted-foreground border-border"
            }>
              {a.payment_status === "verified" ? "Pago Verificado" :
                a.payment_status === "under_review" ? "Pago en Revisión" : "Pago Pendiente"}
            </Badge>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-3 sm:p-4 space-y-4 overflow-x-auto">
          {/* Progress tracker */}
          <AuctionProgressTracker
            paymentStatus={a.payment_status}
            deliveryStatus={a.delivery_status}
            trackingNumber={a.tracking_number}
          />

          {/* Shipping form */}
          <ShippingForm
            auctionId={a.id}
            userId={userId}
            onComplete={() => setShippingComplete(true)}
          />

          {/* Always show PaymentFlow so user can see bank data & submit proof */}
          <PaymentFlow auctionId={a.id} amountUsd={a.current_price} userId={userId} />

          {/* Link to full detail */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Ver detalle completo
          </Button>
        </div>
      )}
    </div>
  );
};

export default WonAuctionCard;
