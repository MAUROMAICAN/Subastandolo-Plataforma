import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AdminBadgeProps {
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  showLabel?: boolean;
}

const sizeConfig = {
  sm: { icon: 22, text: "text-[9px]" },
  md: { icon: 28, text: "text-[11px]" },
  lg: { icon: 34, text: "text-xs" },
};

/**
 * Classic brilliant-cut diamond viewed from the side:
 * wide crown on top, narrow culet point at bottom.
 * Dark/black version with silver reflections.
 */
const BlackDiamondIcon = ({ size = 22 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 34"
    width={size}
    height={size * 0.85}
    fill="none"
  >
    <defs>
      <linearGradient id="adm-body-main" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#383838" />
        <stop offset="30%" stopColor="#1a1a1a" />
        <stop offset="60%" stopColor="#0a0a0a" />
        <stop offset="100%" stopColor="#303030" />
      </linearGradient>
      <linearGradient id="adm-crown-l" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4a4a4a" />
        <stop offset="100%" stopColor="#222" />
      </linearGradient>
      <linearGradient id="adm-crown-r" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#444" />
        <stop offset="100%" stopColor="#1e1e1e" />
      </linearGradient>
      <linearGradient id="adm-pav-l" x1="0%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#333" />
        <stop offset="100%" stopColor="#0e0e0e" />
      </linearGradient>
      <linearGradient id="adm-pav-r" x1="100%" y1="0%" x2="20%" y2="100%">
        <stop offset="0%" stopColor="#3a3a3a" />
        <stop offset="100%" stopColor="#111" />
      </linearGradient>
      <linearGradient id="adm-shine1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.5" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="adm-flash-g" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="white" stopOpacity="0" />
        <stop offset="40%" stopColor="white" stopOpacity="0.7" />
        <stop offset="60%" stopColor="white" stopOpacity="0.7" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* ── CROWN (top wide part) ── */}
    {/* Table (top flat) */}
    <polygon points="13,4 27,4 24,10 16,10" fill="#2a2a2a" stroke="#555" strokeWidth="0.4" />

    {/* Star facets */}
    <polygon points="13,4 16,10 10,10" fill="url(#adm-crown-l)" stroke="#444" strokeWidth="0.3" />
    <polygon points="27,4 24,10 30,10" fill="url(#adm-crown-r)" stroke="#444" strokeWidth="0.3" />

    {/* Upper kite facets (outer crown) */}
    <polygon points="13,4 4,10 10,10" fill="#353535" stroke="#555" strokeWidth="0.3" />
    <polygon points="27,4 36,10 30,10" fill="#2d2d2d" stroke="#555" strokeWidth="0.3" />

    {/* ── GIRDLE (belt line) ── */}
    <rect x="4" y="9.5" width="32" height="1.2" fill="#1a1a1a" stroke="#4a4a4a" strokeWidth="0.3" rx="0.2" />

    {/* ── PAVILION (bottom V shape) ── */}
    {/* Main left pavilion */}
    <polygon points="4,11 20,31 14,11" fill="url(#adm-pav-l)" stroke="#3a3a3a" strokeWidth="0.3" />
    {/* Inner left */}
    <polygon points="14,11 20,31 20,11" fill="#0f0f0f" stroke="#333" strokeWidth="0.25" />
    {/* Inner right */}
    <polygon points="20,11 20,31 26,11" fill="#171717" stroke="#333" strokeWidth="0.25" />
    {/* Main right pavilion */}
    <polygon points="26,11 20,31 36,11" fill="url(#adm-pav-r)" stroke="#3a3a3a" strokeWidth="0.3" />

    {/* Extra facet lines in pavilion */}
    <line x1="9" y1="11" x2="20" y2="31" stroke="#2a2a2a" strokeWidth="0.2" />
    <line x1="31" y1="11" x2="20" y2="31" stroke="#2a2a2a" strokeWidth="0.2" />

    {/* ── REFLECTIONS & SHINE ── */}
    {/* Big shine on crown */}
    <polygon points="14,5 20,4 22,8 16,9.5" fill="url(#adm-shine1)" />

    {/* Small bright spot */}
    <circle cx="17" cy="6" r="0.8" fill="white" opacity="0.55" />
    <circle cx="24" cy="8" r="0.5" fill="white" opacity="0.3" />

    {/* Animated flash sweeping across */}
    <rect x="2" y="2" width="4" height="30" fill="url(#adm-flash-g)" className="admin-diamond-flash" />
  </svg>
);

const AdminBadge = ({
  size = "sm",
  showTooltip = true,
  showLabel = false,
}: AdminBadgeProps) => {
  const config = sizeConfig[size];

  const badge = (
    <span className="inline-flex items-center gap-0.5 shrink-0 animate-admin-badge">
      <BlackDiamondIcon size={config.icon} />
      {showLabel && (
        <span className={`${config.text} font-bold bg-gradient-to-r from-neutral-300 via-neutral-500 to-neutral-300 bg-clip-text text-transparent whitespace-nowrap`}>
          Admin
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
              <BlackDiamondIcon size={24} />
              <span className="font-bold">Administrador</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              Miembro del equipo oficial
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AdminBadge;
