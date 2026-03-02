import { Shield, Package, Users, UserCheck, Ban, TrendingUp } from "lucide-react";

interface UserStats {
  total: number;
  admins: number;
  dealers: number;
  buyers: number;
  banned: number;
  newThisWeek: number;
}

interface Props {
  stats: UserStats;
}

export default function UserStatsBar({ stats }: Props) {
  const items = [
    { label: "Total", value: stats.total, icon: Users, color: "text-foreground" },
    { label: "Admins", value: stats.admins, icon: Shield, color: "text-primary dark:text-accent" },
    { label: "Dealers", value: stats.dealers, icon: Package, color: "text-primary dark:text-accent" },
    { label: "Compradores", value: stats.buyers, icon: UserCheck, color: "text-primary dark:text-accent" },
    { label: "Suspendidos", value: stats.banned, icon: Ban, color: "text-destructive" },
    { label: "Nuevos (7d)", value: stats.newThisWeek, icon: TrendingUp, color: "text-primary dark:text-accent" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {items.map(item => (
        <div
          key={item.label}
          className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
        >
          <item.icon className={`h-4 w-4 ${item.color}`} />
          <span className={`text-xl font-bold tracking-tight ${item.color}`}>{item.value}</span>
          <span className="text-[10px] text-muted-foreground dark:text-gray-300 font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
