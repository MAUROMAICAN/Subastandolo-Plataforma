import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Shield, UserPlus, Trash2, Search, Loader2, Save, Eye, EyeOff, Gavel, CreditCard,
  Package, Users, ShieldAlert, Settings, MessageCircle, Flag, Mail, Lock, Phone, User,
  Crown, KeyRound, Calendar, ChevronDown, ChevronUp
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const ALL_PERMISSIONS = [
  { key: "manage_auctions", label: "Subastas", description: "Revisar, aprobar, pausar y eliminar subastas", icon: Gavel },
  { key: "manage_payments", label: "Pagos", description: "Aprobar/rechazar comprobantes de pago", icon: CreditCard },
  { key: "manage_dealers", label: "Dealers", description: "Aprobar/rechazar solicitudes de dealer, baneo global", icon: Package },
  { key: "manage_users", label: "Usuarios", description: "Suspender, reactivar y eliminar usuarios", icon: Users },
  { key: "manage_disputes", label: "Disputas", description: "Resolver disputas y reembolsos", icon: ShieldAlert },
  { key: "manage_cms", label: "Configuración", description: "Editar configuración del sitio, banners, secciones", icon: Settings },
  { key: "manage_messages", label: "Mensajes", description: "Enviar mensajes a dealers y usuarios", icon: MessageCircle },
  { key: "manage_reports", label: "Reportes", description: "Revisar reportes de avisos", icon: Flag },
  { key: "manage_team", label: "Equipo", description: "Agregar/eliminar administradores y asignar permisos", icon: Shield },
];

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  permissions: string[];
}

export default function TeamPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<{ user_id: string; full_name: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState<string | null>(null);
  const [editingPerms, setEditingPerms] = useState<Record<string, string[]>>({});
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin" as any);

    const adminIds = (adminRoles || []).map(r => r.user_id);

    if (adminIds.length === 0) {
      setTeamMembers([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at, avatar_url")
      .in("id", adminIds);

    const { data: perms } = await supabase
      .from("admin_permissions" as any)
      .select("user_id, permission")
      .in("user_id", adminIds);

    const permsMap: Record<string, string[]> = {};
    (perms || []).forEach((p: any) => {
      if (!permsMap[p.user_id]) permsMap[p.user_id] = [];
      permsMap[p.user_id].push(p.permission);
    });

    let emailMap: Record<string, string> = {};
    try {
      const { data: emailData } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "list_users", userId: "all" },
      });
      emailMap = emailData?.emails || {};
    } catch (e) {
      console.error("Error fetching emails:", e);
    }

    const members: TeamMember[] = (profiles || []).map(p => ({
      user_id: p.id,
      full_name: p.full_name,
      email: emailMap[p.id] || "",
      phone: p.phone,
      avatar_url: (p as any).avatar_url,
      created_at: p.created_at,
      permissions: permsMap[p.id] || [],
    }));

    setTeamMembers(members);

    const ep: Record<string, string[]> = {};
    members.forEach(m => { ep[m.user_id] = [...m.permissions]; });
    setEditingPerms(ep);

    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      const { data } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "list_users", userId: "all" },
      });
      const emails: Record<string, string> = data?.emails || {};
      const query = searchEmail.toLowerCase().trim();
      const matches: { user_id: string; email: string; full_name: string }[] = [];

      for (const [uid, email] of Object.entries(emails)) {
        if (email.toLowerCase().includes(query) && !teamMembers.some(m => m.user_id === uid)) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", uid).single();
          matches.push({ user_id: uid, email, full_name: profile?.full_name || "" });
          if (matches.length >= 5) break;
        }
      }

      setSearchResults(matches);
      if (matches.length === 0) {
        toast({ title: "No se encontraron usuarios con ese correo", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error buscando", description: e.message, variant: "destructive" });
    }
    setSearching(false);
  };

  const handlePromote = async (userId: string) => {
    setPromoting(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "promote_to_admin", userId },
      });
      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Administrador agregado al equipo" });
        setSearchResults([]);
        setSearchEmail("");
        fetchTeam();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setPromoting(null);
  };

  const handleRemoveAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "remove_admin", userId },
      });
      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "🗑️ Administrador removido del equipo" });
        fetchTeam();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleTogglePermission = (userId: string, permission: string) => {
    setEditingPerms(prev => {
      const current = prev[userId] || [];
      const updated = current.includes(permission)
        ? current.filter(p => p !== permission)
        : [...current, permission];
      return { ...prev, [userId]: updated };
    });
  };

  const handleSavePermissions = async (userId: string) => {
    setSavingPerms(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "set_permissions", userId, permissions: editingPerms[userId] || [] },
      });
      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Permisos actualizados" });
        fetchTeam();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSavingPerms(null);
  };

  const hasPermChanged = (userId: string) => {
    const member = teamMembers.find(m => m.user_id === userId);
    if (!member) return false;
    const orig = [...member.permissions].sort();
    const curr = [...(editingPerms[userId] || [])].sort();
    return JSON.stringify(orig) !== JSON.stringify(curr);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword.trim() || !newUserName.trim()) {
      toast({ title: "Completa todos los campos obligatorios", variant: "destructive" });
      return;
    }
    if (newUserPassword.length < 6) {
      toast({ title: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: {
          action: "create_user",
          userId: "new",
          email: newUserEmail.trim(),
          password: newUserPassword,
          fullName: newUserName.trim(),
          phone: newUserPhone.trim(),
          role: newUserRole,
        },
      });
      if (error || data?.error) {
        toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Usuario creado exitosamente", description: newUserRole === "admin" ? "Agregado como miembro del equipo" : "Agregado como usuario regular" });
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserName("");
        setNewUserPhone("");
        setNewUserRole("user");
        setShowCreateForm(false);
        if (newUserRole === "admin") fetchTeam();
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setCreatingUser(false);
  };

  const getRoleLabel = (member: TeamMember) => {
    if (member.permissions.length === 0) return { label: "Super Admin", color: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-500 border-yellow-500/30", icon: Crown };
    if (member.permissions.length >= 7) return { label: "Admin Senior", color: "bg-primary/15 text-primary dark:text-accent border-primary/30", icon: Shield };
    if (member.permissions.length >= 4) return { label: "Moderador", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: KeyRound };
    return { label: "Asistente", color: "bg-muted text-muted-foreground border-border", icon: User };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totalPerms = teamMembers.reduce((sum, m) => sum + m.permissions.length, 0);
  const superAdmins = teamMembers.filter(m => m.permissions.length === 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary dark:text-accent" /> Equipo de Trabajo
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {teamMembers.length} administradores · Gestión de roles y permisos
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)} className="gap-1 rounded-sm bg-primary text-primary-foreground">
          <UserPlus className="h-4 w-4" />
          Crear Usuario
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Equipo", value: teamMembers.length, icon: Users, color: "text-primary dark:text-accent" },
          { label: "Super Admins", value: superAdmins, icon: Crown, color: "text-yellow-500" },
          { label: "Permisos Activos", value: totalPerms, icon: KeyRound, color: "text-blue-400" },
          { label: "Módulos", value: ALL_PERMISSIONS.length, icon: Settings, color: "text-muted-foreground" },
        ].map((s, idx) => (
          <Card key={idx} className="border border-border rounded-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span>
              </div>
              <p className={`text-lg font-heading font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card className="border border-accent/30 bg-accent/5 rounded-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-accent" />
              Crear Nuevo Usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre completo *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Ej: Juan Pérez" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="pl-10 h-9 rounded-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Correo electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="correo@ejemplo.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="pl-10 h-9 rounded-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contraseña *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={newUserPassword}
                    onChange={e => setNewUserPassword(e.target.value)}
                    className="pl-10 pr-10 h-9 rounded-sm"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="+58 412 123 4567" value={newUserPhone} onChange={e => setNewUserPhone(e.target.value)} className="pl-10 h-9 rounded-sm" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <Select value={newUserRole} onValueChange={(v: "user" | "admin") => setNewUserRole(v)}>
                <SelectTrigger className="h-9 rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario (Comprador)</SelectItem>
                  <SelectItem value="admin">Administrador (Equipo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreateUser} disabled={creatingUser} className="gap-1 rounded-sm">
                {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Crear Usuario
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)} className="rounded-sm">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Admin Search */}
      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary dark:text-accent" />
            Agregar Administrador
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por correo electrónico..."
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                className="pl-10 h-9 rounded-sm"
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button size="sm" onClick={handleSearch} disabled={searching} className="h-9 rounded-sm">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(r => (
                <div key={r.user_id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-sm border border-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">{r.full_name?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {r.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePromote(r.user_id)}
                    disabled={promoting === r.user_id}
                    className="gap-1 rounded-sm"
                  >
                    {promoting === r.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                    Agregar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <div className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Users className="h-4 w-4" /> Miembros del Equipo
        </h2>

        {teamMembers.map(member => {
          const isCurrentUser = member.user_id === user?.id;
          const permsList = editingPerms[member.user_id] || [];
          const changed = hasPermChanged(member.user_id);
          const role = getRoleLabel(member);
          const RoleIcon = role.icon;
          const isExpanded = expandedMember === member.user_id;

          return (
            <Card key={member.user_id} className={`border rounded-sm overflow-hidden transition-all ${isCurrentUser
                ? "border-primary/30 bg-gradient-to-r from-primary/5 to-transparent"
                : "border-border hover:border-primary/20"
              }`}>
              <CardContent className="p-0">
                {/* Member Header — always visible */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                        {member.avatar_url && <AvatarImage src={member.avatar_url} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary dark:text-accent font-bold text-sm">
                          {member.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {isCurrentUser && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-primary rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold truncate">{member.full_name}</p>
                        {isCurrentUser && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary dark:text-accent h-4 px-1.5">Tú</Badge>}
                        <Badge className={`text-[9px] border ${role.color} h-4 px-1.5 gap-0.5`}>
                          <RoleIcon className="h-2.5 w-2.5" /> {role.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" /> {member.email || "—"}
                        </p>
                        {member.phone && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" /> {member.phone}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 hidden sm:flex">
                          <Calendar className="h-3 w-3" /> {new Date(member.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="hidden sm:flex items-center gap-1">
                      {permsList.length === 0 ? (
                        <Badge variant="outline" className="text-[9px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Acceso Total</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">{permsList.length}/{ALL_PERMISSIONS.length} permisos</Badge>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expandable Permissions */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 bg-secondary/5">
                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" /> Permisos del módulo
                      </p>
                      <div className="flex items-center gap-2">
                        {changed && (
                          <Button
                            size="sm"
                            onClick={() => handleSavePermissions(member.user_id)}
                            disabled={savingPerms === member.user_id}
                            className="gap-1 text-xs h-7 rounded-sm bg-primary text-primary-foreground"
                          >
                            {savingPerms === member.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Guardar Cambios
                          </Button>
                        )}
                        {!isCurrentUser && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-xs gap-1 h-7 border-destructive/30 text-destructive hover:bg-destructive/10 rounded-sm">
                                <Trash2 className="h-3 w-3" /> Remover
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Remover a {member.full_name} del equipo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se le quitará el rol de administrador y todos sus permisos. El usuario seguirá existiendo como usuario normal.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleRemoveAdmin(member.user_id)}>
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ALL_PERMISSIONS.map(perm => {
                        const checked = permsList.includes(perm.key);
                        const Icon = perm.icon;
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2.5 rounded-sm border cursor-pointer transition-all ${checked
                              ? "border-primary/40 bg-primary/5 dark:bg-accent/5 dark:border-accent/30"
                              : "border-border hover:border-primary/20 hover:bg-secondary/30"
                              } ${isCurrentUser ? "opacity-60 pointer-events-none" : ""}`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => handleTogglePermission(member.user_id, perm.key)}
                              disabled={isCurrentUser}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Icon className={`h-3.5 w-3.5 shrink-0 ${checked ? "text-primary dark:text-accent" : "text-muted-foreground"}`} />
                                <span className={`text-xs font-medium ${checked ? "text-foreground" : "text-muted-foreground"}`}>{perm.label}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{perm.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Permission Summary */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {permsList.length === 0 ? (
                        <span className="text-[10px] text-yellow-500 italic flex items-center gap-1">
                          <Crown className="h-3 w-3" /> Sin permisos asignados — acceso completo por defecto (Super Admin)
                        </span>
                      ) : (
                        permsList.map(p => {
                          const perm = ALL_PERMISSIONS.find(ap => ap.key === p);
                          return (
                            <Badge key={p} variant="outline" className="text-[9px] bg-primary/5 border-primary/20 text-primary dark:text-accent">
                              {perm?.label || p}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
