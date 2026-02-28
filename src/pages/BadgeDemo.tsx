import Navbar from "@/components/Navbar";
import VerifiedBadge, { DEALER_TIERS, getDealerTier } from "@/components/VerifiedBadge";
import { User } from "lucide-react";

const demoData = [
  { name: "NuevoDealer", sales: 0 },
  { name: "TiendaTop", sales: 15 },
  { name: "MegaVentas", sales: 60 },
  { name: "EliteShop", sales: 150 },
  { name: "PlatinumStore", sales: 700 },
  { name: "RubyMaster", sales: 1200 },
];

const BadgeDemo = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-xl font-heading font-bold mb-2">Insignias de Dealer — Demo</h1>
        <p className="text-sm text-muted-foreground mb-8">Así se ven las insignias según el nivel del dealer.</p>

        <div className="space-y-4">
          {demoData.map((dealer) => {
            const tier = getDealerTier(dealer.sales);
            return (
              <div
                key={dealer.name}
                className={`flex items-center gap-3 bg-card border ${tier.colors.border} rounded-sm px-4 py-3`}
              >
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-semibold truncate">{dealer.name}</span>
                  <VerifiedBadge size="md" salesCount={dealer.sales} />
                </div>
                <span className={`text-[11px] ${tier.colors.bg} border ${tier.colors.border} ${tier.colors.text} rounded-sm px-2.5 py-1 shrink-0 font-semibold whitespace-nowrap`}>
                  Verificado {tier.label}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {dealer.sales} ventas
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-10 bg-secondary/50 rounded-sm p-4 space-y-2">
          <p className="text-xs font-semibold">Tabla de Niveles</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-muted-foreground font-medium">Nivel</th>
                <th className="text-left py-1.5 text-muted-foreground font-medium">Insignia</th>
                <th className="text-right py-1.5 text-muted-foreground font-medium">Ventas requeridas</th>
              </tr>
            </thead>
            <tbody>
              {[...DEALER_TIERS].reverse().map((tier) => (
                <tr key={tier.key} className="border-b border-border last:border-0">
                  <td className={`py-2 font-semibold ${tier.colors.text}`}>{tier.label}</td>
                  <td className="py-2">
                    <VerifiedBadge size="lg" salesCount={tier.minSales} showTooltip={false} />
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {tier.minSales === 0 ? "0 – 9" : `${tier.minSales}+`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default BadgeDemo;
