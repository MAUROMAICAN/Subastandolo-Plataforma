import { Link } from "react-router-dom";
import Countdown from "@/components/Countdown";
import { Trophy, Heart, Zap, Timer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { maskName } from "@/lib/utils";

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
      <div className="relative rounded-2xl overflow-hidden h-full flex flex-col bg-card border border-white/5 shadow-md hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer">

        {/* ── IMAGE ZONE ── */}
        <div className="relative aspect-square overflow-hidden bg-muted/10">
          {auction.image_url ? (
            <img
              src={auction.image_url}
              alt={auction.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs">
              Sin imagen
            </div>
          )}

          {/* Deep gradient: covers bottom 60% of the image for guaranteed contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.1) 60%, transparent 100%)' }} />

          {/* ── TOP-LEFT: Status badge ── */}
          <div className="absolute top-2 left-2 z-10">
            {isLive && (
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/15 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow-lg">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#A6E300" }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: "#A6E300" }} />
                </span>
                En vivo
              </div>
            )}
            {isScheduled && (
              <div className="flex items-center gap-1 bg-primary/90 backdrop-blur-sm text-primary-foreground text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shadow">
                <Timer className="h-2.5 w-2.5" />
                Pronto
              </div>
            )}
          </div>

          {/* ── TOP-RIGHT: Favorite ── */}
          {user && onToggleFavorite && (
            <button
              onClick={handleFavoriteClick}
              className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/50 backdrop-blur-sm border border-white/15 text-white/80 hover:text-red-400 flex items-center justify-center transition-all hover:scale-110 hover:bg-black/70"
            >
              <Heart className={`h-3.5 w-3.5 transition-colors ${isFavorite ? "fill-red-400 text-red-400" : ""}`} />
            </button>
          )}

          {/* ── ENDED OVERLAY ── */}
          {isEnded && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center z-20">
              <span className="bg-foreground/90 text-background text-[10px] uppercase tracking-widest font-bold px-4 py-1.5 rounded-full shadow-xl">
                Finalizada
              </span>
            </div>
          )}

          {/* ── BOTTOM OF IMAGE: Price overlaid ── */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-3 pt-8">
            {/* Extended badge */}
            {(auction as any).is_extended && (
              <div className="mb-1.5 inline-flex items-center gap-1 bg-amber-500/90 text-white text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                <Zap className="h-2.5 w-2.5" /> Extendida
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-0.5">
              <span className="text-white/80 text-[10px] font-bold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>US$</span>
              <span className="text-white text-xl font-black tracking-tight leading-none" style={{ textShadow: '0 2px 8px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.8)' }}>
                {displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {hasBids && !isEnded && (
                <span className="ml-1.5 text-[8px] font-bold uppercase tracking-wide text-emerald-300 border border-emerald-400/30 bg-emerald-500/20 px-1.5 py-0.5 rounded-full">
                  Pujado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── INFO ZONE ── */}
        <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2.5">
          {/* Title */}
          <h3 className="font-semibold text-[11px] sm:text-sm leading-snug line-clamp-2 text-foreground dark:text-white/90 group-hover:text-primary transition-colors">
            {auction.title}
          </h3>

          {/* Dealer Link */}
          {dealer && (
            <div
              className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/dealer/${auction.created_by}`;
              }}
            >
              <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                <span className="text-[8px] font-bold text-secondary-foreground">{dealer.name.substring(0, 1)}</span>
              </div>
              <span className="truncate font-medium hover:underline">{dealer.name}</span>
            </div>
          )}

          {/* Countdown */}
          {!isEnded && (
            <div className="mt-2 flex items-center justify-center gap-1.5 bg-primary/5 border border-primary/15 rounded-lg py-1.5 px-2">
              <Timer className="h-3 w-3 text-primary/70 shrink-0 hidden sm:block" />
              <span className="font-mono text-[10px] sm:text-xs font-bold text-foreground/90 tracking-wide">
                {startTime && isScheduled ? (
                  <Countdown endTime={startTime} />
                ) : isLive ? (
                  <Countdown endTime={auction.end_time} />
                ) : ("--:--:--")}
              </span>
            </div>
          )}

          {/* Winner badge */}
          {isEnded && auction.winner_name && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-foreground dark:text-gray-200 bg-secondary/80 dark:bg-white/10 rounded-lg px-2.5 py-1.5 border border-border">
              <Trophy className="h-3 w-3 shrink-0 text-yellow-500" />
              <span className="font-bold truncate">Ganador: {maskName(auction.winner_name)}</span>
            </div>
          )}

          {/* CTA */}
          {isLive && (
            <div className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent text-accent-foreground font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-sm shadow-accent/30 group-hover:shadow-accent/50 group-hover:brightness-110 transition-all cursor-pointer">
              Ofertar →
            </div>
          )}
        </div>

      </div>
    </Link>
  );
};

export default AuctionCard;
