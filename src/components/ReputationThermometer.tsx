interface ReputationThermometerProps {
  percentage: number; // 0-100, -1 means "new seller"
  totalReviews: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  fullWidth?: boolean;
}

// MercadoLibre-style segments
const SEGMENTS = [
  { color: "hsl(0 72% 51%)", label: "Crítico" },       // Red
  { color: "hsl(25 95% 53%)", label: "Bajo" },          // Orange
  { color: "hsl(45 93% 47%)", label: "Regular" },       // Yellow
  { color: "hsl(82 78% 45%)", label: "Bueno" },         // Light green
  { color: "hsl(142 71% 45%)", label: "Excelente" },    // Green
];

const NEW_SELLER_COLOR = "hsl(210 80% 60%)"; // Light blue for new sellers

export const getReputationLevel = (pct: number, totalReviews: number) => {
  if (totalReviews === 0) return { label: "Sin calificaciones", color: NEW_SELLER_COLOR, segmentIndex: -1 };
  if (pct >= 80) return { label: "Excelente", color: SEGMENTS[4].color, segmentIndex: 4 };
  if (pct >= 60) return { label: "Bueno", color: SEGMENTS[3].color, segmentIndex: 3 };
  if (pct >= 40) return { label: "Regular", color: SEGMENTS[2].color, segmentIndex: 2 };
  if (pct >= 20) return { label: "Bajo", color: SEGMENTS[1].color, segmentIndex: 1 };
  return { label: "Crítico", color: SEGMENTS[0].color, segmentIndex: 0 };
};

const sizeConfig = {
  sm: { h: 6, gap: 2, w: 100, text: "text-[9px]", indicator: 8 },
  md: { h: 8, gap: 2, w: 140, text: "text-[10px]", indicator: 10 },
  lg: { h: 10, gap: 3, w: 180, text: "text-xs", indicator: 12 },
};

const ReputationThermometer = ({ percentage, totalReviews, size = "md", showLabel = true, fullWidth = false }: ReputationThermometerProps) => {
  const level = getReputationLevel(percentage, totalReviews);
  const s = sizeConfig[size];
  const isNew = totalReviews === 0;
  const widthStyle = fullWidth ? "100%" : s.w;

  // For new sellers, show a single blue bar
  if (isNew) {
    return (
      <div className="flex flex-col" style={{ width: widthStyle }}>
        <div className="flex" style={{ gap: s.gap, height: s.h }}>
          {SEGMENTS.map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ background: NEW_SELLER_COLOR, opacity: 0.35 }}
            />
          ))}
        </div>
        {showLabel && (
          <div className="flex items-center justify-between mt-1">
            <span className={`${s.text} font-medium text-blue-600 dark:text-blue-400`}>
              Sin calificaciones
            </span>
            <span className={`${s.text} text-muted-foreground`}>
              0 ventas
            </span>
          </div>
        )}
      </div>
    );
  }

  // Active index (0-4)
  const activeIndex = level.segmentIndex;

  return (
    <div className="flex flex-col" style={{ width: widthStyle }}>
      <div className="flex" style={{ gap: s.gap, height: s.h }}>
        {SEGMENTS.map((seg, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              background: i <= activeIndex ? seg.color : "hsl(var(--muted))",
              opacity: i <= activeIndex ? 1 : 0.3,
            }}
          />
        ))}
      </div>
      {showLabel && (
        <div className="flex items-center justify-between mt-1">
          <span className={`${s.text} font-medium`} style={{ color: level.color }}>
            {level.label}
          </span>
          <span className={`${s.text} text-muted-foreground`}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default ReputationThermometer;
