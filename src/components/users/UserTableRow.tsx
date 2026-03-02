import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AdminBadge from "@/components/AdminBadge";
import UserActionMenu from "./UserActionMenu";

interface DealerUser {
  user_id: string;
  full_name: string;
  phone: string | null;
  role: string;
  roles: string[];
  created_at: string;
  email?: string;
  banned?: boolean;
}

interface Props {
  user: DealerUser;
  isCurrentAdmin: boolean;
  isProcessing: boolean;
  intlPhone: string | null;
  onAction: (userId: string, action: string) => void;
  onExpediente: () => void;
  onTier: () => void;
  onPhone: () => void;
  onPassword: () => void;
  onPromoteAdmin: () => void;
}

export default function UserTableRow({
  user: u, isCurrentAdmin, isProcessing, intlPhone,
  onAction, onExpediente, onTier, onPhone, onPassword, onPromoteAdmin,
}: Props) {
  const initials = (u.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <tr className={`border-b border-border hover:bg-secondary/20 transition-colors ${u.banned ? "opacity-60 bg-destructive/5" : ""}`}>
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate max-w-[160px]">{u.full_name}</span>
              {u.roles?.includes("admin") && <AdminBadge size="sm" />}
              {isCurrentAdmin && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 border-primary/40 dark:border-accent/40 text-primary dark:text-accent">TÚ</Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground dark:text-gray-300 truncate block max-w-[200px]">{u.email || "—"}</span>
          </div>
        </div>
      </td>

      {/* Phone */}
      <td className="px-3 py-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground">{intlPhone || "—"}</span>
      </td>

      {/* Roles */}
      <td className="px-3 py-3 hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {(u.roles || [u.role]).map(r => (
            <Badge
              key={r}
              variant="outline"
              className={`text-[9px] px-1.5 py-0 ${
                r === "admin" ? "bg-primary/10 text-primary dark:text-accent border-primary/30" :
                r === "dealer" ? "bg-accent/10 text-accent-foreground border-accent/30" :
                "bg-secondary text-muted-foreground"
              }`}
            >
              {r === "admin" ? "Admin" : r === "dealer" ? "Dealer" : "Usuario"}
            </Badge>
          ))}
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-3">
        {u.banned ? (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Suspendido</Badge>
        ) : (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/5 dark:bg-accent/5 text-primary dark:text-accent border-primary/20">Activo</Badge>
        )}
      </td>

      {/* Joined */}
      <td className="px-3 py-3 hidden lg:table-cell">
        <span className="text-xs text-muted-foreground">
          {new Date(u.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
        </span>
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-right">
        <UserActionMenu
          user={u}
          isCurrentAdmin={isCurrentAdmin}
          isProcessing={isProcessing}
          intlPhone={intlPhone}
          onAction={onAction}
          onExpediente={onExpediente}
          onTier={onTier}
          onPhone={onPhone}
          onPassword={onPassword}
          onPromoteAdmin={onPromoteAdmin}
        />
      </td>
    </tr>
  );
}
