import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VerifiedBadge, { getDealerTier, DEALER_TIERS } from "@/components/VerifiedBadge";
import {
  Trophy, TrendingUp, CheckCircle, User, Eye, BarChart3, DollarSign
} from "lucide-react";
import type { DealerInfo } from "@/hooks/useVerifiedDealers";

interface Props {
  dealer: DealerInfo | null;
}

export default function DealerLevelsTab({ dealer }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 mb-3">
          <Trophy className="h-6 w-6 text-primary dark:text-[#A6E300]" />
          <h2 className="text-xl font-heading font-bold">Sistema de Niveles</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          A medida que completas ventas exitosas, tu nivel de dealer sube automáticamente.
          Cada nivel desbloquea una insignia exclusiva que aparece junto a tu nombre, generando
          mayor confianza y visibilidad con los compradores.
        </p>
      </div>

      {dealer?.isVerified && (() => {
        const currentTier = getDealerTier(dealer.salesCount);
        return (
          <Card className={`border-2 ${currentTier.colors.border} rounded-sm overflow-hidden`}>
            <div className="flex items-center gap-4 p-5" style={{ background: `linear-gradient(135deg, ${currentTier.colors.fill}10, transparent)` }}>
              <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <VerifiedBadge size="lg" salesCount={dealer.salesCount} showTooltip={false} />
                <div className="absolute rounded-full blur-lg opacity-30 animate-pulse -z-10"
                  style={{ background: currentTier.colors.fill, width: 48, height: 48 }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Tu nivel actual</p>
                <p className={`text-lg font-heading font-bold ${currentTier.colors.text}`}>{currentTier.label}</p>
                <p className="text-xs text-muted-foreground">
                  {dealer.salesCount} {dealer.salesCount === 1 ? "venta completada" : "ventas completadas"}
                </p>
              </div>
            </div>
          </Card>
        );
      })()}

      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            Tabla de Niveles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...DEALER_TIERS].reverse().map((tier) => {
              const isCurrentTier = dealer?.isVerified && getDealerTier(dealer.salesCount).key === tier.key;
              const rangeText = tier.key === "nuevo" ? "0 – 9" :
                tier.key === "bronce" ? "10 – 49" :
                  tier.key === "plata" ? "50 – 99" :
                    tier.key === "oro" ? "100 – 499" :
                      tier.key === "platinum" ? "500 – 999" :
                        "1,000+";

              return (
                <div
                  key={tier.key}
                  className={`flex items-center gap-3 rounded-sm px-4 py-3 transition-colors ${isCurrentTier
                    ? `${tier.colors.bg} border-2 ${tier.colors.border}`
                    : "border border-border hover:bg-secondary/30"
                    }`}
                >
                  <div className="shrink-0">
                    <VerifiedBadge size="md" salesCount={tier.minSales} showTooltip={false} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${tier.colors.text}`}>{tier.label}</span>
                      {isCurrentTier && (
                        <span className="text-[9px] bg-accent text-accent-foreground rounded-sm px-1.5 py-0.5 font-bold uppercase">
                          Tu nivel
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{rangeText} ventas</span>
                  </div>
                  <div className={`text-[11px] ${tier.colors.bg} border ${tier.colors.border} ${tier.colors.text} rounded-sm px-2.5 py-1 font-semibold whitespace-nowrap shrink-0`}>
                    {tier.shape === "diamond" ? "💎 Premium" : "✓ Verificado"}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            ¿Cómo funciona?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: TrendingUp, title: "Ventas completadas", desc: "Tu nivel se basa en la cantidad de subastas que finalizaron exitosamente con un ganador." },
              { icon: CheckCircle, title: "Subida automática", desc: "Al alcanzar el mínimo de ventas de un nivel, tu insignia se actualiza automáticamente." },
              { icon: User, title: "Visible para todos", desc: "Tu insignia aparece junto a tu nombre en todas tus subastas, generando confianza." },
              { icon: Trophy, title: "Insignias premium", desc: "A partir de Oro, tu insignia cambia a un diamante exclusivo con animación de brillo." },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-sm bg-secondary/30">
                <item.icon className="h-5 w-5 text-primary dark:text-[#A6E300] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary dark:text-[#A6E300]" />
            Beneficios por nivel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { emoji: "🔵", color: "text-blue-500 dark:text-blue-400", name: "Nuevo", desc: "Insignia de verificación básica azul. Los compradores saben que eres un dealer legítimo." },
              { emoji: "🟤", color: "text-orange-600 dark:text-orange-400", name: "Bronce", desc: "Insignia bronce. Demuestras experiencia inicial con al menos 10 ventas completadas." },
              { emoji: "⚪", color: "text-slate-500 dark:text-slate-400", name: "Plata", desc: "Insignia de plata. Ya tienes buena rotación con más de 50 ventas." },
              { emoji: "🟡", color: "text-amber-500 dark:text-amber-400", name: "Oro", desc: "Insignia dorada. Eres un dealer consolidado con 100+ ventas y gran prestigio." },
              { emoji: "⚫", color: "text-gray-900 dark:text-gray-300", name: "Platinum", desc: "Insignia negra premium. Eres un peso pesado del sitio con más de 500 ventas." },
              { emoji: "💎", color: "text-pink-500 dark:text-pink-400", name: "Ruby Estelar", desc: "El nivel más alto. Diamante morado con dorado. Leyenda entre los dealers con 1,000+ ventas." },
            ].map((lvl, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`${lvl.color} font-bold shrink-0`}>{lvl.emoji}</span>
                <div><span className="font-semibold">{lvl.name}:</span> <span className="text-muted-foreground">{lvl.desc}</span></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
