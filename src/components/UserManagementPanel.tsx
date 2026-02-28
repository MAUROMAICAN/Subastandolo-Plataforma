import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, Search, Loader2, Users, User, Package, Award, Phone, KeyRound,
  ChevronRight, ArrowUpDown, Filter, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserExpediente from "@/components/UserExpediente";
import AdminBadge from "@/components/AdminBadge";
import { BUYER_TIERS } from "@/components/BuyerBadge";
import UserStatsBar from "@/components/users/UserStatsBar";
import UserTableRow from "@/components/users/UserTableRow";

const ADMIN_PERMISSIONS = [
  { key: "manage_auctions", label: "Subastas", description: "Revisar, aprobar, pausar y eliminar subastas", emoji: "🔨" },
  { key: "manage_payments", label: "Pagos", description: "Aprobar/rechazar comprobantes de pago", emoji: "💳" },
  { key: "manage_dealers", label: "Dealers", description: "Aprobar/rechazar solicitudes de dealer", emoji: "🏪" },
  { key: "manage_users", label: "Usuarios", description: "Suspender, reactivar y eliminar usuarios", emoji: "👥" },
  { key: "manage_disputes", label: "Disputas", description: "Resolver disputas y reembolsos", emoji: "⚖️" },
  { key: "manage_cms", label: "Configuración", description: "Editar configuración del sitio", emoji: "⚙️" },
  { key: "manage_messages", label: "Mensajes", description: "Enviar mensajes a dealers y usuarios", emoji: "💬" },
  { key: "manage_reports", label: "Reportes", description: "Revisar reportes de avisos", emoji: "🚩" },
  { key: "manage_team", label: "Equipo", description: "Gestionar administradores y permisos", emoji: "🛡️" },
];

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
  allUsers: DealerUser[];
  onRefresh: () => void;
}

type RoleFilter = "all" | "admins" | "dealers" | "buyers";
type StatusFilter = "all" | "active" | "banned";
type SortField = "name" | "date" | "role";
type SortDir = "asc" | "desc";

export default function UserManagementPanel({ allUsers, onRefresh }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters & sort
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Processing
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  // Dialogs
  const [expedienteUserId, setExpedienteUserId] = useState<string | null>(null);
  const [expedienteUserName, setExpedienteUserName] = useState("");
  const [promoteDialog, setPromoteDialog] = useState<DealerUser | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [promoting, setPromoting] = useState(false);
  const [tierDialog, setTierDialog] = useState<DealerUser | null>(null);
  const [selectedTier, setSelectedTier] = useState("");
  const [savingTier, setSavingTier] = useState(false);
  const [phoneDialog, setPhoneDialog] = useState<DealerUser | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<DealerUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Utils
  const formatPhone = (phone: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
    if (cleaned.startsWith("+58")) return cleaned;
    if (cleaned.startsWith("58") && cleaned.length > 10) return "+" + cleaned;
    if (cleaned.startsWith("0")) return "+58" + cleaned.slice(1);
    if (cleaned.startsWith("+")) return cleaned;
    return "+58" + cleaned;
  };

  const generateSecurePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*';
    const all = upper + lower + digits + symbols;
    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    pwd += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 14; i++) pwd += all[Math.floor(Math.random() * all.length)];
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      total: allUsers.length,
      admins: allUsers.filter(u => u.roles?.includes("admin")).length,
      dealers: allUsers.filter(u => u.roles?.includes("dealer") && !u.roles?.includes("admin")).length,
      buyers: allUsers.filter(u => !u.roles?.includes("admin") && !u.roles?.includes("dealer")).length,
      banned: allUsers.filter(u => u.banned).length,
      newThisWeek: allUsers.filter(u => new Date(u.created_at) >= weekAgo).length,
    };
  }, [allUsers]);

  // Filtered + sorted
  const filteredUsers = useMemo(() => {
    let list = [...allUsers];

    // Role filter
    if (roleFilter === "admins") list = list.filter(u => u.roles?.includes("admin"));
    else if (roleFilter === "dealers") list = list.filter(u => u.roles?.includes("dealer") && !u.roles?.includes("admin"));
    else if (roleFilter === "buyers") list = list.filter(u => !u.roles?.includes("admin") && !u.roles?.includes("dealer"));

    // Status filter
    if (statusFilter === "active") list = list.filter(u => !u.banned);
    else if (statusFilter === "banned") list = list.filter(u => u.banned);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(searchQuery)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = (a.full_name || "").localeCompare(b.full_name || "");
      else if (sortField === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === "role") {
        const roleOrder = (u: DealerUser) => u.roles?.includes("admin") ? 0 : u.roles?.includes("dealer") ? 1 : 2;
        cmp = roleOrder(a) - roleOrder(b);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return list;
  }, [allUsers, roleFilter, statusFilter, searchQuery, sortField, sortDir]);

  // Actions
  const handleUserAction = async (userId: string, action: string) => {
    setProcessingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action, userId },
      });
      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      } else {
        const msgs: Record<string, string> = {
          ban_user: "🚫 Usuario suspendido", unban_user: "✅ Usuario reactivado",
          delete_user: "🗑️ Usuario eliminado", remove_admin: "Rol de admin removido",
          promote_to_dealer: "🏪 Promovido a Dealer", remove_dealer: "Rol de dealer removido",
        };
        toast({ title: msgs[action] || "Acción completada" });
        onRefresh();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setProcessingUserId(null);
  };

  const handlePromoteToAdmin = async () => {
    if (!promoteDialog) return;
    setPromoting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "promote_to_admin", userId: promoteDialog.user_id },
      });
      if (error || data?.error) { toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" }); setPromoting(false); return; }
      if (selectedPermissions.length > 0) {
        await supabase.functions.invoke("admin-manage-user", {
          body: { action: "set_permissions", userId: promoteDialog.user_id, permissions: selectedPermissions },
        });
      }
      toast({ title: "🛡️ Promovido a Administrador", description: `${selectedPermissions.length} permisos asignados` });
      setPromoteDialog(null);
      setSelectedPermissions([]);
      onRefresh();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setPromoting(false);
  };

  const handleSetTier = async () => {
    if (!tierDialog) return;
    setSavingTier(true);
    try {
      const tierValue = selectedTier === "auto" ? null : selectedTier;
      const { error } = await supabase.from("profiles").update({ manual_buyer_tier: tierValue } as any).eq("id", tierDialog.user_id);
      if (error) throw error;
      toast({ title: "⭐ Nivel actualizado" });
      setTierDialog(null); setSelectedTier(""); onRefresh();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSavingTier(false);
  };

  const handleUpdatePhone = async () => {
    if (!phoneDialog) return;
    setSavingPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "update_phone", userId: phoneDialog.user_id, phone: newPhone.trim() },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: "📱 Teléfono actualizado" });
      setPhoneDialog(null); setNewPhone(""); onRefresh();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSavingPhone(false);
  };

  const handleResetPassword = async () => {
    if (!passwordDialog) return;
    setSavingPassword(true);
    try {
      const passwordToSend = newPassword || generateSecurePassword();
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "reset_password", userId: passwordDialog.user_id, password: passwordToSend },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "";
        if (msg.toLowerCase().includes("weak") || msg.toLowerCase().includes("easy to guess")) {
          const securePwd = generateSecurePassword();
          const { data: d2, error: e2 } = await supabase.functions.invoke("admin-manage-user", {
            body: { action: "reset_password", userId: passwordDialog.user_id, password: securePwd },
          });
          if (e2 || d2?.error) throw new Error(d2?.error || e2?.message);
          toast({ title: "🔑 Contraseña restablecida", description: `Generada: ${securePwd}`, duration: 30000 });
          setPasswordDialog(null); setNewPassword(""); onRefresh(); setSavingPassword(false); return;
        }
        throw new Error(msg);
      }
      toast({ title: "🔑 Contraseña restablecida", description: `Temporal: ${passwordToSend}`, duration: 30000 });
      setPasswordDialog(null); setNewPassword(""); onRefresh();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    setSavingPassword(false);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const roleFilterOptions: { key: RoleFilter; label: string; icon: any }[] = [
    { key: "all", label: "Todos", icon: Users },
    { key: "admins", label: "Admins", icon: Shield },
    { key: "dealers", label: "Dealers", icon: Package },
    { key: "buyers", label: "Compradores", icon: User },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Gestión de Usuarios
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Administra todos los usuarios de la plataforma
        </p>
      </div>

      {/* Stats */}
      <UserStatsBar stats={stats} />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Role filter tabs */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {roleFilterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setRoleFilter(opt.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                roleFilter === opt.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card hover:bg-secondary/50 text-muted-foreground"
              }`}
            >
              <opt.icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
              <Filter className="h-3.5 w-3.5" />
              {statusFilter === "all" ? "Estado" : statusFilter === "active" ? "Activos" : "Suspendidos"}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter("all")}>Todos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("active")}>Activos</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("banned")}>Suspendidos</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nombre, correo o teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Results count */}
        <Badge variant="secondary" className="text-xs px-3 py-1.5 shrink-0 self-center">
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Data Table */}
      <Card className="border border-border rounded-lg overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      Usuario
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left hidden md:table-cell">
                    <span className="text-xs font-semibold text-muted-foreground">Teléfono</span>
                  </th>
                  <th className="px-3 py-3 text-left hidden sm:table-cell">
                    <button onClick={() => toggleSort("role")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      Rol
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left">
                    <span className="text-xs font-semibold text-muted-foreground">Estado</span>
                  </th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">
                    <button onClick={() => toggleSort("date")} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      Registro
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <span className="text-xs font-semibold text-muted-foreground">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {searchQuery ? "No se encontraron usuarios con esa búsqueda." : "No hay usuarios en esta categoría."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <UserTableRow
                      key={u.user_id}
                      user={u}
                      isCurrentAdmin={u.user_id === user?.id}
                      isProcessing={processingUserId === u.user_id}
                      intlPhone={formatPhone(u.phone)}
                      onAction={handleUserAction}
                      onExpediente={() => { setExpedienteUserId(u.user_id); setExpedienteUserName(u.full_name); }}
                      onTier={() => { setTierDialog(u); setSelectedTier(""); }}
                      onPhone={() => { setPhoneDialog(u); setNewPhone(u.phone || ""); }}
                      onPassword={() => { setPasswordDialog(u); setNewPassword(""); }}
                      onPromoteAdmin={() => { setPromoteDialog(u); setSelectedPermissions(ADMIN_PERMISSIONS.map(p => p.key)); }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== DIALOGS ===== */}

      {/* Admin Promotion Dialog */}
      <Dialog open={!!promoteDialog} onOpenChange={open => { if (!open) { setPromoteDialog(null); setSelectedPermissions([]); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Promover a Administrador
            </DialogTitle>
          </DialogHeader>
          {promoteDialog && (
            <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pr-1">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {(promoteDialog.full_name || "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">{promoteDialog.full_name}</p>
                  <p className="text-xs text-muted-foreground">{promoteDialog.email}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">Admin</Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-heading font-bold">Permisos</p>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 text-primary" onClick={() => setSelectedPermissions(ADMIN_PERMISSIONS.map(p => p.key))}>
                    Seleccionar todos
                  </Button>
                </div>
                <div className="grid gap-2">
                  {ADMIN_PERMISSIONS.map(perm => {
                    const isSelected = selectedPermissions.includes(perm.key);
                    return (
                      <button key={perm.key} type="button" onClick={() => setSelectedPermissions(prev => prev.includes(perm.key) ? prev.filter(p => p !== perm.key) : [...prev, perm.key])}
                        className={`flex items-center gap-3 p-3 rounded-md border-2 transition-all text-left ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"}`}>
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span className="text-base">{perm.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>{perm.label}</p>
                          <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Badge variant="outline" className="text-[10px]">{selectedPermissions.length}/{ADMIN_PERMISSIONS.length} permisos</Badge>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setPromoteDialog(null); setSelectedPermissions([]); }}>Cancelar</Button>
            <Button onClick={handlePromoteToAdmin} disabled={promoting || selectedPermissions.length === 0} className="gap-1.5">
              {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              Promover a Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier Dialog */}
      <Dialog open={!!tierDialog} onOpenChange={open => { if (!open) { setTierDialog(null); setSelectedTier(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Asignar Nivel
            </DialogTitle>
          </DialogHeader>
          {tierDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{(tierDialog.full_name || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <div><p className="font-semibold text-sm">{tierDialog.full_name}</p><p className="text-xs text-muted-foreground">{tierDialog.email}</p></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Selecciona el nivel</p>
                <Select value={selectedTier} onValueChange={setSelectedTier}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar nivel..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto"><span className="flex items-center gap-2">🔄 Automático</span></SelectItem>
                    {[...BUYER_TIERS].reverse().map(tier => (
                      <SelectItem key={tier.key} value={tier.key}><span className="flex items-center gap-2">⭐ {tier.label} ({tier.minWins}+)</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setTierDialog(null); setSelectedTier(""); }}>Cancelar</Button>
            <Button onClick={handleSetTier} disabled={savingTier || !selectedTier} className="gap-1.5">
              {savingTier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Dialog */}
      <Dialog open={!!phoneDialog} onOpenChange={open => { if (!open) { setPhoneDialog(null); setNewPhone(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> Editar Teléfono</DialogTitle>
          </DialogHeader>
          {phoneDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{(phoneDialog.full_name || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <div><p className="font-semibold text-sm">{phoneDialog.full_name}</p><p className="text-xs text-muted-foreground">{phoneDialog.email}</p></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Nuevo teléfono</p>
                <Input placeholder="04XX-XXXXXXX" value={newPhone} onChange={e => {
                  let val = e.target.value.replace(/[^0-9+\-\s]/g, "");
                  const digits = val.replace(/\D/g, "");
                  if (digits.startsWith("5858")) val = "+58" + digits.slice(4);
                  else if (digits.startsWith("580")) val = "+58" + digits.slice(3);
                  setNewPhone(val);
                }} />
                <p className="text-[11px] text-muted-foreground">Formato venezolano: 04XX-XXXXXXX</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setPhoneDialog(null); setNewPhone(""); }}>Cancelar</Button>
            <Button onClick={handleUpdatePhone} disabled={savingPhone} className="gap-1.5">
              {savingPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={!!passwordDialog} onOpenChange={open => { if (!open) { setPasswordDialog(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Restablecer Contraseña</DialogTitle>
          </DialogHeader>
          {passwordDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">{(passwordDialog.full_name || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                <div><p className="font-semibold text-sm">{passwordDialog.full_name}</p><p className="text-xs text-muted-foreground">{passwordDialog.email}</p></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Contraseña temporal</p>
                <div className="flex gap-2">
                  <Input type="text" placeholder="Escribe o genera una contraseña" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="flex-1" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewPassword(generateSecurePassword())}>Generar</Button>
                </div>
                {newPassword.length > 0 && newPassword.length < 8 && <p className="text-[11px] text-destructive">Mínimo 8 caracteres</p>}
                <p className="text-[11px] text-muted-foreground">⚠️ Presiona "Generar" para una contraseña segura. Envíasela al usuario.</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setPasswordDialog(null); setNewPassword(""); }}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={savingPassword} className="gap-1.5">
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Restablecer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expediente */}
      <UserExpediente userId={expedienteUserId} userName={expedienteUserName} onClose={() => setExpedienteUserId(null)} />
    </div>
  );
}
