import type { ReputationStats } from "@/hooks/useReviews";
import ReputationThermometer, { getReputationLevel } from "@/components/ReputationThermometer";
import { Star, TrendingUp, ShoppingBag, Store, Award, Shield, Zap } from "lucide-react";

interface UnifiedReputationCardProps {
  unifiedStats: ReputationStats;
  dealerStats: ReputationStats;
  buyerStats: ReputationStats;
  /** Compact mode for sidebars / small areas */
  compact?: boolean;
  className?: string;
}

/** Map % to color palette */
function getScoreColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#84cc16";
  if (pct >= 40) return "#eab308";
  if (pct >= 20) return "#f97316";
  return "#ef4444";
}

const RoleStat = ({
  icon: Icon,
  label,
  total,
  pct,
  color,
}: {
  icon: any;
  label: string;
  total: number;
  pct: number;
  color: string;
}) => (
  <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3.5 py-2.5 hover:bg-white/[0.07] transition-colors">
    <div
      className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: color + "18" }}
    >
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-white/40 font-medium">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-white">{total}</span>
        <span className="text-[10px] text-white/30">review{total !== 1 ? "s" : ""}</span>
        {total > 0 && (
          <span
            className="text-[10px] font-bold ml-auto"
            style={{ color }}
          >
            {Math.round(pct)}% positivo
          </span>
        )}
      </div>
    </div>
  </div>
);

const MetricPill = ({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2">
    <Icon className="h-3 w-3 text-white/25 shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold truncate">{label}</p>
      <p className="text-xs font-bold text-white/70">{value}</p>
    </div>
  </div>
);

export default function UnifiedReputationCard({
  unifiedStats,
  dealerStats,
  buyerStats,
  compact = false,
  className = "",
}: UnifiedReputationCardProps) {
  const totalTx = unifiedStats.totalReviews;
  const pct = unifiedStats.positivePercentage;
  const level = getReputationLevel(pct, totalTx);
  const scoreColor = totalTx > 0 ? getScoreColor(pct) : "#3b82f6";

  if (compact) {
    return (
      <div className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 ${className}`}>
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center"
            style={{ background: scoreColor + "18" }}
          >
            <Shield className="h-3.5 w-3.5" style={{ color: scoreColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-white/35 font-medium">Reputación</p>
            <p className="text-sm font-bold" style={{ color: scoreColor }}>
              {totalTx > 0 ? `${Math.round(pct)}%` : "Sin datos"}
            </p>
          </div>
        </div>
        <ReputationThermometer
          percentage={pct}
          totalReviews={totalTx}
          size="sm"
          showLabel={false}
          fullWidth
        />
        <div className="flex items-center gap-3 mt-2 text-[9px] text-white/30">
          <span className="flex items-center gap-1">
            <Store className="h-2.5 w-2.5" />{dealerStats.totalReviews} ventas
          </span>
          <span className="flex items-center gap-1">
            <ShoppingBag className="h-2.5 w-2.5" />{buyerStats.totalReviews} compras
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(13,17,23,0.95), rgba(22,27,34,0.98))",
      }}
    >
      {/* Top accent line */}
      <div
        className="h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${scoreColor}, transparent)`,
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top left, ${scoreColor}25, transparent 60%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom right, ${scoreColor}15, transparent 50%)`,
        }}
      />

      <div className="relative z-10 p-5 sm:p-6">
        {/* Header: Score + Thermometer */}
        <div className="flex items-start gap-4 mb-5">
          {/* Big score circle */}
          <div className="relative shrink-0">
            <div
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex flex-col items-center justify-center border"
              style={{
                borderColor: scoreColor + "30",
                background: `linear-gradient(135deg, ${scoreColor}12, ${scoreColor}06)`,
                boxShadow: `0 0 20px ${scoreColor}10`,
              }}
            >
              {totalTx > 0 ? (
                <>
                  <span
                    className="text-2xl sm:text-3xl font-black leading-none"
                    style={{ color: scoreColor }}
                  >
                    {Math.round(pct)}
                  </span>
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider mt-0.5">
                    puntos
                  </span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 text-blue-400/60" />
                  <span className="text-[8px] font-bold text-white/30 uppercase tracking-wider mt-1">
                    nuevo
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-3.5 w-3.5" style={{ color: scoreColor }} />
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/50">
                Reputación Unificada
              </h3>
            </div>
            <p className="text-base sm:text-lg font-bold mb-2" style={{ color: level.color }}>
              {level.label}
            </p>

            <ReputationThermometer
              percentage={pct}
              totalReviews={totalTx}
              size="md"
              showLabel={false}
              fullWidth
            />

            <div className="flex items-center gap-4 mt-2 text-[10px] text-white/35">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-400" />
                {totalTx > 0 ? `${unifiedStats.avgRating.toFixed(1)} promedio` : "Sin calificaciones"}
              </span>
              <span>
                {totalTx} transacción{totalTx !== 1 ? "es" : ""} calificada{totalTx !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Role breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <RoleStat
            icon={Store}
            label="Como Vendedor"
            total={dealerStats.totalReviews}
            pct={dealerStats.positivePercentage}
            color="#A6E300"
          />
          <RoleStat
            icon={ShoppingBag}
            label="Como Comprador"
            total={buyerStats.totalReviews}
            pct={buyerStats.positivePercentage}
            color="#3b82f6"
          />
        </div>

        {/* Detailed metrics */}
        {totalTx > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricPill
              icon={Star}
              label="Calidad"
              value={unifiedStats.avgProductAccuracy > 0 ? `${unifiedStats.avgProductAccuracy.toFixed(1)}/5` : "—"}
            />
            <MetricPill
              icon={TrendingUp}
              label="Atención"
              value={unifiedStats.avgAttentionQuality > 0 ? `${unifiedStats.avgAttentionQuality.toFixed(1)}/5` : "—"}
            />
            <MetricPill
              icon={Zap}
              label="Velocidad"
              value={unifiedStats.avgShippingSpeed > 0 ? `${unifiedStats.avgShippingSpeed.toFixed(1)}/5` : "—"}
            />
            <MetricPill
              icon={Shield}
              label="Cumplimiento"
              value={unifiedStats.avgPaymentCompliance > 0 ? `${unifiedStats.avgPaymentCompliance.toFixed(1)}/5` : "—"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
