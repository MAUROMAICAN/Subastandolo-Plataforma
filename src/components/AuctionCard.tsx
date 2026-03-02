import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import Countdown from "@/components/Countdown";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Trophy, Clock, Heart, Store, Gavel } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

const maskName = (name: string): string => {
  if (name.length <= 4) return name;
  return `${name.slice(0, 2)}${"*".repeat(name.length - 4)}${name.slice(-2)}`;
};

interface DealerInfo {
  name: string;
  isVerified: boolean;
  salesCount: number;
}

interface AuctionCardProps {
  auction: Tables<"auctions">;
  dealer?: DealerInfo | null;
  isFavorite?: boolean;
  onToggleFavorite?: (auctionId: string) => void;
}

const AuctionCard = ({ auction, dealer, isFavorite, onToggleFavorite }: AuctionCardProps) => {
  const { user } = useAuth();
  const isEnded = auction.status !== "scheduled" && new Date(auction.end_time).getTime() <= Date.now();
  const startTime = (auction as any).start_time;
  const isScheduled = auction.status === "scheduled" || (startTime && new Date(startTime).getTime() > Date.now());
  const displayPrice = auction.current_price > 0 ? auction.current_price : auction.starting_price;
  const hasBids = auction.current_price > 0;
  const isLive = !isScheduled && !isEnded;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleFavorite) onToggleFavorite(auction.id);
  };

  return (
    <Link to={`/auction/${auction.id}`} className="group block h-full">
      <div className="bg-card rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 h-full flex flex-col border border-border/50 hover:border-primary/20 relative">
        {/* Image Area */}
        <div className="relative aspect-square sm:aspect-[4/3] overflow-hidden bg-white/5 flex items-center justify-center p-2 sm:p-4">
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              className="w-full h-full object-cover sm:object-contain group-hover:scale-105 transition-transform duration-700 ease-out rounded-t-xl"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-[10px] sm:text-xs bg-muted/10 rounded-t-xl">
              Sin imagen
            </div>
          )}

          {/* Status Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {isScheduled && (
              <Badge className="bg-primary/95 text-primary-foreground border-0 text-[9px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm shadow-sm backdrop-blur-sm">
                <Clock className="h-2.5 w-2.5 mr-1" />
                Pronto
              </Badge>
            )}
            {isLive && (
              <>
                {/* Modern minimalist LIVE badge */}
                <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md border border-white/10 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shadow-lg">
                  {/* Pulsing ring + dot */}
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#A6E300" }} />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2" style={{ backgroundColor: "#A6E300" }} />
                  </span>
                  Activa
                </div>
                {(auction as any).is_extended && (
                  <div className="flex items-center gap-0.5 bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shadow-md mt-0.5">
                    ⚡ Ext.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ended Overlay */}
          {isEnded && (
            <div className="absolute inset-0 bg-background/40 flex items-center justify-center backdrop-blur-[1px] z-20">
              <span className="bg-foreground text-background text-[10px] sm:text-xs uppercase tracking-widest font-bold px-3 py-1.5 rounded-sm shadow-xl">
                Finalizada
              </span>
            </div>
          )}

          {/* Favorite Button (floating directly on image, Etsy style) */}
          {user && onToggleFavorite && (
            <button
              onClick={handleFavoriteClick}
              className="absolute top-2 right-2 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/90 hover:bg-white text-muted-foreground shadow-sm flex items-center justify-center transition-all z-20 hover:scale-110"
            >
              <Heart
                className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-colors ${isFavorite ? "fill-destructive text-destructive" : "hover:text-destructive"}`}
              />
            </button>
          )}

          {/* Subtle gradient overlay at bottom of image for contrast */}
          <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
        </div>

        {/* Info Area (Highly Compact) */}
        <div className="p-2.5 sm:p-4 flex flex-col flex-1 bg-gradient-to-b from-card to-muted/5">

          {/* Title */}
          <h3 className="font-heading font-semibold text-[11px] sm:text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-1 sm:mb-2" title={auction.title}>
            {auction.title}
          </h3>

          {/* Dealer Info - smaller and softer */}
          {dealer && (
            <div className="flex items-center gap-1 mb-2 opacity-75">
              <Store className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium truncate uppercase">
                {dealer.name}
              </span>
              {dealer.isVerified && <VerifiedBadge size="sm" salesCount={dealer.salesCount} />}
            </div>
          )}

          {/* Spacer to push price to bottom */}
          <div className="mt-auto flex flex-col gap-1.5">
            {/* Price Row (Etsy Style: Just the numbers bolded) */}
            <div className="flex items-baseline gap-0.5">
              <span className="text-[10px] sm:text-xs text-foreground/70 font-bold">US$</span>
              <span className="text-base sm:text-xl font-black text-foreground tracking-tight leading-none">
                {displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {hasBids && !isEnded && (
                <span className="text-[9px] sm:text-[10px] text-success font-medium ml-1 bg-success/10 px-1 py-0.5 rounded-sm shrink-0">
                  {hasBids ? "Con Ofertas" : "Sin Pujas"}
                </span>
              )}
            </div>

            {/* Timer / Progress */}
            {!isEnded && (
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground">
                {/* On mobile: hide the clock icon and label, show only the countdown */}
                <Clock className="hidden sm:block h-3 w-3 shrink-0" />
                <span className="hidden sm:inline truncate">
                  {isScheduled ? "Empieza en" : "Termina"}
                </span>
                <span className="text-foreground/80 font-bold font-mono bg-secondary/80 px-1.5 py-0.5 rounded-sm">
                  {startTime && isScheduled ? (
                    <Countdown endTime={startTime} />
                  ) : isLive ? (
                    <Countdown endTime={auction.end_time} />
                  ) : (
                    "--:--:--"
                  )}
                </span>
              </div>
            )}

            {/* Winner Info */}
            {isEnded && auction.winner_name && (
              <div className="flex items-center gap-1.5 text-[10px] text-primary bg-primary/10 rounded-sm px-2 py-1 border border-primary/20 mt-1">
                <Trophy className="h-3 w-3 shrink-0" />
                <span className="font-bold truncate">Gana: {maskName(auction.winner_name)}</span>
              </div>
            )}

            {/* CTA Button — Elegant full-width, live auctions only */}
            {isLive && (
              <div className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-accent/40 bg-accent/5 hover:bg-accent/15 text-accent font-semibold tracking-wide text-[11px] sm:text-xs uppercase transition-all group-hover:border-accent/80 group-hover:bg-accent/10 cursor-pointer">
                <Gavel className="h-3 w-3" />
                Ofertar
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;

