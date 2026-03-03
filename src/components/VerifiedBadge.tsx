import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type DealerTier = "nuevo" | "bronce" | "plata" | "oro" | "platinum" | "ruby";

export type BadgeShape = "seal" | "diamond";

export interface TierConfig {
  key: DealerTier;
  label: string;
  minSales: number;
  shape: BadgeShape;
  colors: {
    fill: string;
    stroke: string;
    accent?: string; // secondary color for dual-tone badges
    text: string;
    bg: string;
    border: string;
    glow: string;
  };
}

export const DEALER_TIERS: TierConfig[] = [
  {
    key: "ruby",
    label: "Ruby Estelar",
    minSales: 1000,
    shape: "diamond",
    colors: {
      fill: "#7c3aed",
      stroke: "#6d28d9",
      accent: "#d4a017",
      text: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      glow: "drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]",
    },
  },
  {
    key: "platinum",
    label: "Platinum",
    minSales: 500,
    shape: "diamond",
    colors: {
      fill: "#1a1a2e",
      stroke: "#0f0f1a",
      accent: "#d4a017",
      text: "text-amber-500 dark:text-amber-400",
      bg: "bg-neutral-900/10",
      border: "border-amber-500/30",
      glow: "drop-shadow-[0_0_8px_rgba(212,160,23,0.45)]",
    },
  },
  {
    key: "oro",
    label: "Oro",
    minSales: 100,
    shape: "diamond",
    colors: {
      fill: "#f59e0b",
      stroke: "#d97706",
      accent: "#fbbf24",
      text: "text-amber-600 dark:text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      glow: "drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]",
    },
  },
  {
    key: "plata",
    label: "Plata",
    minSales: 50,
    shape: "seal",
    colors: {
      fill: "#94a3b8",
      stroke: "#64748b",
      text: "text-slate-500 dark:text-slate-400",
      bg: "bg-slate-400/10",
      border: "border-slate-400/25",
      glow: "drop-shadow-[0_0_4px_rgba(148,163,184,0.4)]",
    },
  },
  {
    key: "bronce",
    label: "Bronce",
    minSales: 10,
    shape: "seal",
    colors: {
      fill: "#c2783e",
      stroke: "#a3622e",
      text: "text-orange-700 dark:text-orange-500",
      bg: "bg-orange-700/10",
      border: "border-orange-700/20",
      glow: "drop-shadow-[0_0_4px_rgba(194,120,62,0.35)]",
    },
  },
  {
    key: "nuevo",
    label: "Verificado",
    minSales: 0,
    shape: "seal",
    colors: {
      fill: "#3b82f6",
      stroke: "#2563eb",
      text: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/25",
      glow: "drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]",
    },
  },
];

export function getDealerTier(salesCount: number): TierConfig {
  return DEALER_TIERS.find((t) => salesCount >= t.minSales) || DEALER_TIERS[DEALER_TIERS.length - 1];
}

/** Starburst / Instagram-style seal check */
const SealIcon = ({ fill, stroke, size = 16 }: { fill: string; stroke: string; size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none">
    <path
      d="M12 1.5l2.09 3.36L18 3.54l-.36 3.91 3.36 2.09-2.46 3.05 1.32 3.68-3.91.36-2.09 3.36L12 18.53l-3.05 1.46-2.09-3.36-3.91-.36 1.32-3.68L1.81 9.54l3.36-2.09L4.81 3.54l3.91.36L12 1.5z"
      fill={fill} stroke={stroke} strokeWidth="0.8" strokeLinejoin="round"
    />
    <path d="M8.5 12.5l2 2 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Premium brilliant-cut diamond — side view with wide crown and pointed pavilion */
const DiamondIcon = ({
  fill,
  stroke,
  accent,
  size = 16,
}: {
  fill: string;
  stroke: string;
  accent?: string;
  size?: number;
}) => {
  const uid = `d-${fill.replace(/[^a-zA-Z0-9]/g, "")}`;
  const accentColor = accent || "#ffffff";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 34" width={size} height={size * 0.85} fill="none">
      <defs>
        <linearGradient id={`${uid}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.7" />
          <stop offset="35%" stopColor={fill} />
          <stop offset="65%" stopColor={fill} />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${uid}-crown`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-shim`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0">
            <animate attributeName="offset" values="-0.5;1.5" dur="2.4s" repeatCount="indefinite" />
          </stop>
          <stop offset="12%" stopColor="white" stopOpacity="0.65">
            <animate attributeName="offset" values="-0.38;1.62" dur="2.4s" repeatCount="indefinite" />
          </stop>
          <stop offset="25%" stopColor="white" stopOpacity="0">
            <animate attributeName="offset" values="-0.25;1.75" dur="2.4s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <polygon points="4,10 20,30 36,10 27,4 13,4" />
        </clipPath>
      </defs>

      {/* ── CROWN ── */}
      {/* Table (top flat facet) */}
      <polygon points="13,4 27,4 24,10 16,10" fill={`url(#${uid}-body)`} stroke={stroke} strokeWidth="0.4" />
      {/* Crown highlight */}
      <polygon points="13,4 27,4 24,10 16,10" fill={`url(#${uid}-crown)`} opacity="0.35" />

      {/* Star facets */}
      <polygon points="13,4 16,10 10,10" fill={fill} stroke={stroke} strokeWidth="0.3" opacity="0.9" />
      <polygon points="27,4 24,10 30,10" fill={fill} stroke={stroke} strokeWidth="0.3" opacity="0.85" />

      {/* Upper kite facets */}
      <polygon points="13,4 4,10 10,10" fill={fill} stroke={stroke} strokeWidth="0.3" opacity="0.8" />
      <polygon points="27,4 36,10 30,10" fill={fill} stroke={stroke} strokeWidth="0.3" opacity="0.75" />

      {/* Crown facet lines */}
      <line x1="16" y1="4" x2="13" y2="10" stroke={accentColor} strokeWidth="0.3" opacity="0.4" />
      <line x1="24" y1="4" x2="27" y2="10" stroke={accentColor} strokeWidth="0.3" opacity="0.4" />
      <line x1="20" y1="4" x2="20" y2="10" stroke={accentColor} strokeWidth="0.25" opacity="0.3" />

      {/* ── GIRDLE ── */}
      <rect x="4" y="9.5" width="32" height="1.2" fill={fill} stroke={accentColor} strokeWidth="0.4" opacity="0.8" rx="0.2" />

      {/* ── PAVILION ── */}
      <polygon points="4,11 20,30 14,11" fill={`url(#${uid}-body)`} stroke={stroke} strokeWidth="0.3" />
      <polygon points="14,11 20,30 20,11" fill={fill} stroke={stroke} strokeWidth="0.25" opacity="0.85" />
      <polygon points="20,11 20,30 26,11" fill={fill} stroke={stroke} strokeWidth="0.25" opacity="0.9" />
      <polygon points="26,11 20,30 36,11" fill={`url(#${uid}-body)`} stroke={stroke} strokeWidth="0.3" />

      {/* Pavilion facet lines */}
      <line x1="9" y1="11" x2="20" y2="30" stroke={accentColor} strokeWidth="0.2" opacity="0.25" />
      <line x1="31" y1="11" x2="20" y2="30" stroke={accentColor} strokeWidth="0.2" opacity="0.25" />

      {/* ── REFLECTIONS ── */}
      <polygon points="14,5 20,4 22,8 16,9.5" fill="white" opacity="0.2" />
      <polygon points="16,11 20,18 12,11" fill="white" opacity="0.07" />

      {/* Sparkle dots */}
      <circle cx="17" cy="6" r="0.7" fill="white" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.15;0.6" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="25" cy="8" r="0.45" fill="white" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2.3s" repeatCount="indefinite" />
      </circle>
      <circle cx="20" cy="4.5" r="0.4" fill="white" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
      </circle>

      {/* Shimmer sweep */}
      <rect x="0" y="0" width="40" height="34" fill={`url(#${uid}-shim)`} clipPath={`url(#${uid}-clip)`} />

      {/* Check mark */}
      <path d="M16 16l3 3 5.5-5.5" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
};

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  salesCount?: number;
  showLabel?: boolean;
}

const sizeMap = { sm: 14, md: 18, lg: 22 };

const VerifiedBadge = ({
  size = "sm",
  showTooltip = true,
  salesCount = 0,
  showLabel = false,
}: VerifiedBadgeProps) => {
  const tier = getDealerTier(salesCount);
  const iconSize = sizeMap[size];

  const icon =
    tier.shape === "diamond" ? (
      <DiamondIcon fill={tier.colors.fill} stroke={tier.colors.stroke} accent={tier.colors.accent} size={iconSize} />
    ) : (
      <SealIcon fill={tier.colors.fill} stroke={tier.colors.stroke} size={iconSize} />
    );

  const badge = (
    <span className={`inline-flex items-center gap-0.5 shrink-0 ${tier.colors.glow}`}>
      {icon}
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
              {tier.shape === "diamond" ? (
                <DiamondIcon fill={tier.colors.fill} stroke={tier.colors.stroke} accent={tier.colors.accent} size={18} />
              ) : (
                <SealIcon fill={tier.colors.fill} stroke={tier.colors.stroke} size={18} />
              )}
              <span className="font-bold">Verificado · Nivel {tier.label}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {salesCount} {salesCount === 1 ? "venta completada" : "ventas completadas"}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VerifiedBadge;
