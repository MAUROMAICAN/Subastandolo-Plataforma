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
      <div className="bg-card rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 h-full flex flex-col border border-border/60 hover:border-primary/30">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              className="w-full h-full object-contain p-2 group-hover:scale-[1.03] transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              Sin imagen
            </div>
          )}

          {/* Status */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isScheduled && (
              <Badge className="bg-primary/90 text-primary-foreground border-0 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                <Clock className="h-3 w-3 mr-1" />
                PRÓXIMAMENTE
              </Badge>
            )}
            {isLive && (
              <>
                <Badge className="bg-destructive text-destructive-foreground border-0 text-[10px] px-2 py-0.5 rounded-md font-semibold animate-pulse">
                  🔴 EN VIVO
                </Badge>
                {(auction as any).is_extended && (
                  <Badge className="bg-warning text-warning-foreground border-0 text-[10px] px-2 py-0.5 rounded-md font-semibold">
                    ⚡ EXTENDIDA
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Ended */}
          {isEnded && (
            <div className="absolute inset-0 bg-foreground/25 flex items-center justify-center backdrop-blur-[1px]">
              <span className="bg-card text-muted-foreground text-[11px] font-semibold px-3 py-1.5 rounded-md">
                Finalizada
              </span>
            </div>
          )}

          {/* Favorite */}
          {user && onToggleFavorite && (
            <button
              onClick={handleFavoriteClick}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-card/80 hover:bg-card border border-border/40 flex items-center justify-center transition-all z-10 backdrop-blur-sm"
            >
              <Heart
                className={`h-4 w-4 transition-colors ${isFavorite ? "fill-destructive text-destructive" : "text-muted-foreground"}`}
              />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col flex-1 gap-1.5">
          {/* Dealer */}
          {dealer && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-primary font-medium truncate">
                {dealer.name}
              </span>
              {dealer.isVerified && <VerifiedBadge size="sm" salesCount={dealer.salesCount} />}
            </div>
          )}

          {/* Title */}
          <h3 className="font-medium text-[13px] leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {auction.title}
          </h3>

          {/* Price */}
          <div className="mt-auto pt-1.5">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5 font-medium">
              {isScheduled ? "Precio inicial" : hasBids ? "Puja actual" : "Precio inicial"}
            </p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[11px] text-foreground font-medium">US$</span>
              <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-none">
                {Math.floor(displayPrice).toLocaleString("es-MX")}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                {(displayPrice % 1).toFixed(2).substring(1)}
              </span>
            </div>
          </div>

          {/* Timer */}
          <div className="border-t border-border/30 pt-2 mt-1.5">
            {isScheduled ? (
              <div>
                <p className="text-[9px] text-muted-foreground mb-1 font-medium">
                  {auction.status === "scheduled" ? "Próximamente" : "Inicia en"}
                </p>
                {startTime ? (
                  <Countdown endTime={startTime} />
                ) : (
                  <span className="text-[11px] text-primary font-medium">Por definir</span>
                )}
              </div>
            ) : !isEnded ? (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />Termina en
                </span>
                <Countdown endTime={auction.end_time} />
              </div>
            ) : null}
          </div>

          {/* Winner */}
          {isEnded && auction.winner_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 rounded-md px-2 py-1.5">
              <Trophy className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium truncate">Ganador: {maskName(auction.winner_name)}</span>
            </div>
          )}

          {/* CTA */}
          {isLive && (
            <div className="flex items-center justify-center gap-1.5 bg-accent text-accent-foreground text-[11px] font-bold rounded-md py-2 mt-0.5">
              <Gavel className="h-3.5 w-3.5" />
              ¡Pujar ahora!
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;
