import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontal, Eye, Award, Phone, KeyRound, Shield, Package,
  Pause, Play, Trash2, MessageCircle, Ban,
} from "lucide-react";

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

export default function UserActionMenu({
  user: u, isCurrentAdmin, isProcessing, intlPhone,
  onAction, onExpediente, onTier, onPhone, onPassword, onPromoteAdmin,
}: Props) {
  const [confirmAction, setConfirmAction] = useState<{ action: string; title: string; desc: string; variant: "destructive" | "default" } | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isProcessing}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Acciones</DropdownMenuLabel>

          <DropdownMenuItem onClick={onExpediente}>
            <Eye className="h-4 w-4 mr-2" /> Ver Expediente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onTier}>
            <Award className="h-4 w-4 mr-2" /> Asignar Nivel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPhone}>
            <Phone className="h-4 w-4 mr-2" /> Editar Teléfono
          </DropdownMenuItem>

          {!isCurrentAdmin && (
            <DropdownMenuItem onClick={onPassword}>
              <KeyRound className="h-4 w-4 mr-2" /> Restablecer Clave
            </DropdownMenuItem>
          )}

          {intlPhone && (
            <DropdownMenuItem onClick={() => window.open(`https://wa.me/${intlPhone.replace("+", "")}`, "_blank")}>
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Roles</DropdownMenuLabel>

          {!isCurrentAdmin && !u.roles?.includes("admin") && (
            <DropdownMenuItem onClick={onPromoteAdmin}>
              <Shield className="h-4 w-4 mr-2 text-primary" /> Promover a Admin
            </DropdownMenuItem>
          )}
          {!isCurrentAdmin && u.roles?.includes("admin") && (
            <DropdownMenuItem onClick={() => setConfirmAction({
              action: "remove_admin", title: `¿Remover admin de ${u.full_name}?`,
              desc: "Perderá acceso al panel de administración y todos sus permisos.", variant: "destructive"
            })}>
              <Shield className="h-4 w-4 mr-2 text-destructive" /> Remover Admin
            </DropdownMenuItem>
          )}
          {!u.roles?.includes("dealer") && (
            <DropdownMenuItem onClick={() => setConfirmAction({
              action: "promote_to_dealer", title: `¿Promover a ${u.full_name} como Dealer?`,
              desc: "Podrá crear y gestionar subastas como dealer verificado.", variant: "default"
            })}>
              <Package className="h-4 w-4 mr-2" /> Promover a Dealer
            </DropdownMenuItem>
          )}
          {u.roles?.includes("dealer") && (
            <DropdownMenuItem onClick={() => setConfirmAction({
              action: "remove_dealer", title: `¿Remover dealer de ${u.full_name}?`,
              desc: "Ya no podrá crear subastas ni acceder al panel de dealer.", variant: "destructive"
            })}>
              <Package className="h-4 w-4 mr-2 text-destructive" /> Remover Dealer
            </DropdownMenuItem>
          )}

          {!isCurrentAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Cuenta</DropdownMenuLabel>

              {!u.banned ? (
                <DropdownMenuItem onClick={() => setConfirmAction({
                  action: "ban_user", title: `¿Suspender a ${u.full_name}?`,
                  desc: "No podrá iniciar sesión y su email/teléfono serán bloqueados.", variant: "destructive"
                })}>
                  <Ban className="h-4 w-4 mr-2 text-destructive" /> Suspender
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onAction(u.user_id, "unban_user")}>
                  <Play className="h-4 w-4 mr-2 text-primary" /> Reactivar
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmAction({
                  action: "delete_user", title: `¿Eliminar a ${u.full_name}?`,
                  desc: "Esta acción eliminará permanentemente la cuenta. No se puede deshacer.", variant: "destructive"
                })}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={open => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (confirmAction) onAction(u.user_id, confirmAction.action);
                setConfirmAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
