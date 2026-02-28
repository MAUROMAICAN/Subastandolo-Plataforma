import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import Countdown from "@/components/Countdown";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Trophy, Clock, Heart, Gavel } from "lucide-react";
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
      <div className="bg-card rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 h-full flex flex-col border-2 border-transparent hover:border-primary/20 relative">
        {/* Image Area */}
        <div className="relative aspect-[4/3] overflow-hidden bg-white flex items-center justify-center p-4">
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-xs bg-muted/10 rounded-xl">
              Sin imagen
            </div>
          )}

          {/* Status Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
            {isScheduled && (
              <Badge className="bg-primary/95 text-primary-foreground border-0 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm shadow-sm backdrop-blur-sm">
                <Clock className="h-3 w-3 mr-1.5" />
                Próximamente
              </Badge>
            )}
            {isLive && (
              <>
                {/* Modern minimalist LIVE badge */}
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-lg">
                  {/* Pulsing ring + dot — brand green */}
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#A6E300" }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#A6E300" }} />
                  </span>
                  Activa
                </div>
                {(auction as any).is_extended && (
                  <div className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-sm border border-amber-400/30 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md mt-1">
                    ⚡ Extendida
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ended Overlay */}
          {isEnded && (
            <div className="absolute inset-0 bg-background/40 flex items-center justify-center backdrop-blur-[2px] z-20">
              <span className="bg-foreground text-background text-xs uppercase tracking-widest font-bold px-4 py-2 rounded-sm shadow-xl">
                Finalizada
              </span>
            </div>
          )}

          {/* Favorite Button */}
          {user && onToggleFavorite && (
            <button
              onClick={handleFavoriteClick}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 hover:bg-white text-muted-foreground shadow-sm flex items-center justify-center transition-all z-20 hover:scale-110"
            >
              <Heart
                className={`h-4 w-4 transition-colors ${isFavorite ? "fill-destructive text-destructive" : "hover:text-destructive"}`}
              />
            </button>
          )}

          {/* Subtle gradient overlay at bottom of image for contrast */}
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
        </div>

        {/* Info Area */}
        <div className="p-4 sm:p-5 flex flex-col flex-1 bg-gradient-to-b from-card to-muted/10">

          {/* Dealer Info */}
          {dealer && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs text-muted-foreground font-medium truncate uppercase tracking-wider">
                {dealer.name}
              </span>
              {dealer.isVerified && <VerifiedBadge size="sm" salesCount={dealer.salesCount} />}
            </div>
          )}

          {/* Title */}
          <h3 className="font-heading font-semibold text-sm sm:text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors mb-3">
            {auction.title}
          </h3>

          {/* Price & Timer Row */}
          <div className="mt-auto flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold">
                  {isScheduled ? "Precio Inicial" : hasBids ? "Puja Actual" : "Precio Inicial"}
                </p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-sm text-foreground/80 font-bold">US$</span>
                  <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-none">
                    {Math.floor(displayPrice).toLocaleString("es-MX")}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold ml-0.5">
                    {(displayPrice % 1).toFixed(2).substring(1)}
                  </span>
                </div>
              </div>

              {/* Timer Block */}
              {!isEnded && (
                <div className="text-right flex flex-col items-end">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isScheduled ? "Inicia en" : "Termina"}
                  </p>
                  <div className="bg-secondary/50 px-2 py-1 rounded-sm">
                    {startTime && isScheduled ? (
                      <Countdown endTime={startTime} />
                    ) : isLive ? (
                      <Countdown endTime={auction.end_time} />
                    ) : (
                      <span className="text-xs font-bold font-mono">--:--:--</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Winner Info */}
            {isEnded && auction.winner_name && (
              <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-sm px-3 py-2 border border-primary/20">
                <Trophy className="h-4 w-4 shrink-0" />
                <span className="font-bold truncate">Ganador: {maskName(auction.winner_name)}</span>
              </div>
            )}

            {/* Premium CTA Button */}
            {isLive && (
              <div className="w-full bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-black uppercase tracking-widest rounded-sm py-3 mt-2 flex items-center justify-center gap-2 transition-transform group-hover:scale-[1.02] shadow-sm">
                <Gavel className="h-4 w-4" />
                Ofertar Ahora
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;
