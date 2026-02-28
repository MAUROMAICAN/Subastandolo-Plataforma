import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = PackageOpen,
  title,
  message,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {message && <p className="text-sm text-muted-foreground mb-4 max-w-sm">{message}</p>}
      {children}
    </div>
  );
}
