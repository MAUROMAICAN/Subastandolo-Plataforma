import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type BuyerTier = "nuevo" | "activo" | "destacado" | "premium" | "elite" | "leyenda";

export interface BuyerTierConfig {
  key: BuyerTier;
  label: string;
  minWins: number;
  colors: {
    fill: string;
    text: string;
    bg: string;
    border: string;
    glow: string;
  };
}

export const BUYER_TIERS: BuyerTierConfig[] = [
  {
    key: "leyenda",
    label: "Leyenda",
    minWins: 500,
    colors: {
      fill: "hsl(263 70% 50%)",
      text: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      glow: "drop-shadow-[0_0_6px_rgba(139,92,246,0.45)]",
    },
  },
  {
    key: "elite",
    label: "Élite",
    minWins: 100,
    colors: {
      fill: "hsl(45 93% 47%)",
      text: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      glow: "drop-shadow-[0_0_5px_rgba(245,158,11,0.4)]",
    },
  },
  {
    key: "premium",
    label: "Premium",
    minWins: 50,
    colors: {
      fill: "hsl(210 40% 55%)",
      text: "text-slate-500",
      bg: "bg-slate-400/10",
      border: "border-slate-400/25",
      glow: "drop-shadow-[0_0_4px_rgba(148,163,184,0.35)]",
    },
  },
  {
    key: "destacado",
    label: "Destacado",
    minWins: 20,
    colors: {
      fill: "hsl(142 71% 45%)",
      text: "text-emerald-600",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/25",
      glow: "drop-shadow-[0_0_4px_rgba(16,185,129,0.35)]",
    },
  },
  {
    key: "activo",
    label: "Activo",
    minWins: 5,
    colors: {
      fill: "#c2783e",
      text: "text-orange-600 dark:text-orange-500",
      bg: "bg-orange-700/10",
      border: "border-orange-700/20",
      glow: "",
    },
  },
  {
    key: "nuevo",
    label: "Nuevo Comprador",
    minWins: 0,
    colors: {
      fill: "#3b82f6",
      text: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      glow: "",
    },
  },
];

// Admin minimum tier floor: Destacado (20 wins equivalent)
const ADMIN_MIN_WINS = 20;

export function getBuyerTier(winsCount: number, isAdmin?: boolean, manualTier?: string | null): BuyerTierConfig {
  // Manual tier takes priority if set
  if (manualTier) {
    const manual = BUYER_TIERS.find(t => t.key === manualTier);
    if (manual) {
      // Manual tier is the floor, actual wins can still push higher
      const effectiveWins = Math.max(winsCount, manual.minWins);
      return BUYER_TIERS.find((t) => effectiveWins >= t.minWins) || BUYER_TIERS[BUYER_TIERS.length - 1];
    }
  }
  const effectiveWins = isAdmin ? Math.max(winsCount, ADMIN_MIN_WINS) : winsCount;
  return BUYER_TIERS.find((t) => effectiveWins >= t.minWins) || BUYER_TIERS[BUYER_TIERS.length - 1];
}

const StarIcon = ({ fill, size = 14 }: { fill: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none">
    <path
      d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z"
      fill={fill}
      stroke={fill}
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    <path
      d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z"
      fill="white"
      opacity="0.2"
    />
  </svg>
);

interface BuyerBadgeProps {
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  winsCount?: number;
  showLabel?: boolean;
  isAdmin?: boolean;
  manualTier?: string | null;
}

const sizeMap = { sm: 12, md: 15, lg: 18 };

const BuyerBadge = ({
  size = "sm",
  showTooltip = true,
  winsCount = 0,
  showLabel = false,
  isAdmin = false,
  manualTier,
}: BuyerBadgeProps) => {
  const tier = getBuyerTier(winsCount, isAdmin, manualTier);
  const iconSize = sizeMap[size];

  const badge = (
    <span className={`inline-flex items-center gap-0.5 shrink-0 ${tier.colors.glow}`}>
      <StarIcon fill={tier.colors.fill} size={iconSize} />
      {showLabel && (
        <span className={`text-[10px] font-semibold ${tier.colors.text} whitespace-nowrap`}>
          {tier.label}
        </span>
      )}
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-card border-border text-xs font-medium px-3 py-2"
        >
          <div className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1.5">
              <StarIcon fill={tier.colors.fill} size={16} />
              <span className="font-bold">Comprador · {tier.label}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {winsCount} {winsCount === 1 ? "subasta ganada" : "subastas ganadas"}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BuyerBadge;
