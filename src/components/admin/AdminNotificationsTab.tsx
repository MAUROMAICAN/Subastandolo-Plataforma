import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Send, Loader2, Bell, Users, User, Search, X, Zap, Clock,
  MessageSquare, ChevronDown, ChevronUp, Megaphone, Wrench, AlertTriangle, Tag
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fuzzyFilter } from "@/lib/fuzzySearch";

interface UserOption {
  id: string;
  full_name: string;
  email?: string;
  phone: string | null;
}

interface NotificationLog {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface Template {
  name: string;
  title: string;
  body: string;
  tag: string;
  url: string;
  icon: any;
}

const TEMPLATES: Template[] = [
  { name: "Nueva subasta", title: "🔥 ¡Nueva subasta disponible!", body: "Tenemos un nuevo producto en subasta. ¡No te lo pierdas!", tag: "promo", url: "/explorar", icon: Megaphone },
  { name: "Mantenimiento", title: "🔧 Mantenimiento programado", body: "Realizaremos mantenimiento breve. Volveremos pronto.", tag: "maintenance", url: "/", icon: Wrench },
  { name: "Oferta flash", title: "⚡ ¡Oferta flash por tiempo limitado!", body: "Precio especial solo por las próximas horas. ¡Apúrate!", tag: "promo", url: "/explorar", icon: Zap },
  { name: "Recordatorio", title: "⏰ No olvides tu subasta", body: "Tienes subastas activas que están por finalizar. ¡Revisa tus pujas!", tag: "admin_custom", url: "/mis-subastas", icon: Clock },
  { name: "Alerta urgente", title: "🚨 Aviso importante", body: "Tenemos información importante que compartir contigo.", tag: "urgent", url: "/", icon: AlertTriangle },
];

const AdminNotificationsTab = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [tag, setTag] = useState("admin_custom");
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [sending, setSending] = useState(false);

  // User picker state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // History state
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  // Load notification history on mount
  useEffect(() => { fetchHistory(); }, []);

  // Load users when switching to specific
  useEffect(() => {
    if (targetType === "specific" && users.length === 0) {
      loadUsers();
    }
  }, [targetType]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    // Get recent admin notifications (those with admin-type tags)
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .in("type", ["admin_custom", "promo", "announcement", "urgent", "maintenance"])
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory((data || []) as NotificationLog[]);
    setLoadingHistory(false);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name");

      let emailMap: Record<string, string> = {};
      try {
        const { data: emailData } = await supabase.functions.invoke("admin-manage-user", {
          body: { action: "list_users", userId: "dummy" },
        });
        if (emailData?.emails) {
          emailMap = emailData.emails;
        }
      } catch { }

      if (profiles) {
        const mapped: UserOption[] = profiles.map((p) => ({
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          email: emailMap[p.id] || undefined,
        }));
        setUsers(mapped);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = fuzzyFilter(
    users,
    searchQuery,
    (u) => `${u.full_name} ${u.email || ""} ${u.phone || ""}`,
    undefined,
    0.2
  );

  const handleSelectUser = (user: UserOption) => {
    setSelectedUser(user);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const applyTemplate = (template: Template) => {
    setTitle(template.title);
    setBody(template.body);
    setTag(template.tag);
    setUrl(template.url);
    toast({ title: `📝 Template "${template.name}" aplicado` });
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Error", description: "Título y mensaje son obligatorios", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      if (targetType === "all") {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id");

        if (profilesError) throw profilesError;
        const userIds = (profiles || []).map((p) => p.id);

        if (userIds.length === 0) {
          toast({ title: "Sin usuarios", description: "No hay usuarios registrados aún", variant: "destructive" });
          setSending(false);
          return;
        }

        // Insert in-app notifications in batches of 50
        const notifs = userIds.map((uid) => ({
          user_id: uid,
          title,
          message: body,
          type: tag,
          link: url || "/",
        }));
        for (let i = 0; i < notifs.length; i += 50) {
          const { error } = await supabase.from("notifications").insert(notifs.slice(i, i + 50));
          if (error) throw error;
        }

        // Send FCM push notifications in batches of 10
        let pushed = 0;
        for (let i = 0; i < userIds.length; i += 10) {
          const batch = userIds.slice(i, i + 10);
          await Promise.allSettled(
            batch.map((uid) =>
              supabase.functions.invoke("notify-push", {
                body: { user_id: uid, title, message: body, type: tag, link: url || "/" },
              })
            )
          );
          pushed += batch.length;
        }

        toast({ title: "✅ Enviado", description: `Notificación enviada a ${pushed} usuario(s) con push nativo` });
      } else {
        if (!selectedUser) {
          toast({ title: "Error", description: "Selecciona un usuario", variant: "destructive" });
          setSending(false);
          return;
        }

        // In-app notification
        const { error } = await supabase.from("notifications").insert({
          user_id: selectedUser.id,
          title,
          message: body,
          type: tag,
          link: url || "/",
        });
        if (error) throw error;

        // FCM push
        await supabase.functions.invoke("notify-push", {
          body: {
            user_id: selectedUser.id,
            title,
            message: body,
            type: tag,
            link: url || "/",
          },
        });

        toast({ title: "✅ Enviado", description: `Notificación push enviada a ${selectedUser.full_name}` });
      }

      setTitle("");
      setBody("");
      setUrl("/");
      setSelectedUser(null);
      fetchHistory();
    } catch (err: any) {
      toast({ title: "Error al enviar", description: err.message || "Error desconocido", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = history.length;
    const today = history.filter(h => new Date(h.created_at).toDateString() === new Date().toDateString()).length;
    const unread = history.filter(h => !h.is_read).length;
    const uniqueUsers = new Set(history.map(h => h.user_id)).size;
    return { total, today, unread, uniqueUsers };
  }, [history]);

  const tagConfig: Record<string, { label: string; icon: string; class: string }> = {
    admin_custom: { label: "Admin", icon: "🔔", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
    promo: { label: "Promoción", icon: "📢", class: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    announcement: { label: "Anuncio", icon: "📣", class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    urgent: { label: "Urgente", icon: "🚨", class: "bg-destructive/10 text-destructive border-destructive/20" },
    maintenance: { label: "Mantenimiento", icon: "🔧", class: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary dark:text-accent" /> Notificaciones Push
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envía notificaciones push nativas e in-app a los usuarios
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Enviadas", value: stats.total, icon: Bell, color: "text-primary dark:text-accent" },
          { label: "Hoy", value: stats.today, icon: Zap, color: "text-foreground" },
          { label: "Sin Leer", value: stats.unread, icon: MessageSquare, color: stats.unread > 0 ? "text-warning" : "text-primary dark:text-accent" },
          { label: "Usuarios Alcanzados", value: stats.uniqueUsers, icon: Users, color: "text-muted-foreground" },
        ].map((stat, idx) => (
          <Card key={idx} className="border border-border rounded-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] text-muted-foreground dark:text-gray-300 font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className={`text-lg font-heading font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Send Form */}
        <Card className="border border-border rounded-sm">
          <CardContent className="p-5 space-y-4">
            <p className="text-xs font-heading font-bold uppercase tracking-wide text-muted-foreground dark:text-gray-300 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Componer notificación
            </p>

            {/* Target */}
            <div>
              <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 mb-1.5 block">Destinatarios</label>
              <div className="flex gap-2">
                <Button
                  variant={targetType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setTargetType("all"); setSelectedUser(null); }}
                  className="text-xs rounded-sm h-8"
                >
                  <Users className="h-3.5 w-3.5 mr-1" />Todos
                </Button>
                <Button
                  variant={targetType === "specific" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTargetType("specific")}
                  className="text-xs rounded-sm h-8"
                >
                  <User className="h-3.5 w-3.5 mr-1" />Usuario específico
                </Button>
              </div>
            </div>

            {targetType === "specific" && (
              <div ref={dropdownRef} className="relative">
                {selectedUser ? (
                  <div className="flex items-center gap-2 border border-border rounded-sm px-3 py-2 bg-secondary/30">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-[10px] font-bold">
                        {(selectedUser.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{selectedUser.full_name}</span>
                      <span className="text-[10px] text-muted-foreground dark:text-gray-300 truncate block">{selectedUser.email || "Sin correo"}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedUser(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Nombre o correo..."
                        className="pl-8 text-xs rounded-sm h-9"
                      />
                    </div>

                    {showDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-sm shadow-lg overflow-hidden">
                        {loadingUsers ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground dark:text-gray-300 ml-2">Cargando usuarios...</span>
                          </div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="py-4 text-center text-xs text-muted-foreground">
                            {searchQuery ? "Sin resultados" : "Escribe para buscar"}
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto">
                            {filteredUsers.slice(0, 50).map((u) => {
                              const initials = (u.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                              return (
                                <button
                                  key={u.id}
                                  onClick={() => handleSelectUser(u)}
                                  className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-secondary/50 transition-colors text-left"
                                >
                                  <Avatar className="h-7 w-7 shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-[10px] font-bold">{initials}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-medium truncate block">{u.full_name}</span>
                                    <span className="text-[10px] text-muted-foreground dark:text-gray-300 truncate block">{u.email || "Sin correo"}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 mb-1 block">Título</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la notificación" className="text-xs rounded-sm h-9" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 mb-1 block">Tipo / Sonido</label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger className="text-xs rounded-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin_custom">🔔 Administrador</SelectItem>
                    <SelectItem value="promo">📢 Promoción</SelectItem>
                    <SelectItem value="announcement">📣 Anuncio</SelectItem>
                    <SelectItem value="urgent">🚨 Urgente</SelectItem>
                    <SelectItem value="maintenance">🔧 Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 mb-1 block">Mensaje</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Contenido del mensaje..." rows={3} className="text-xs rounded-sm" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground dark:text-gray-300 mb-1 block">URL al hacer clic</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/" className="text-xs rounded-sm h-9" />
            </div>

            {/* Preview */}
            {title && (
              <div className="bg-secondary/30 border border-border rounded-sm p-3">
                <p className="text-[10px] font-medium text-muted-foreground dark:text-gray-300 uppercase tracking-wide mb-2">Vista previa</p>
                <div className="bg-card border border-border rounded-lg p-3 shadow-sm max-w-sm">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-primary/10 dark:bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="h-4 w-4 text-primary dark:text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">Subastandolo</p>
                      <p className="text-xs font-bold mt-0.5 truncate">{title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{body}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={handleSend} disabled={sending} className="w-full rounded-sm h-9 text-xs">
              {sending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-2" />}
              {sending ? "Enviando..." : targetType === "all" ? "Enviar a todos" : "Enviar a usuario"}
            </Button>
          </CardContent>
        </Card>

        {/* Templates Sidebar */}
        <div className="space-y-3">
          <p className="text-xs font-heading font-bold uppercase tracking-wide text-muted-foreground dark:text-gray-300 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Templates rápidos
          </p>
          <div className="space-y-2">
            {TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => applyTemplate(tpl)}
                className="w-full text-left border border-border rounded-sm p-3 bg-card hover:bg-secondary/20 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <tpl.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary dark:group-hover:text-accent transition-colors" />
                  <span className="text-xs font-semibold">{tpl.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{tpl.title}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wide text-muted-foreground dark:text-gray-300 hover:text-foreground transition-colors mb-3"
        >
          <Clock className="h-3.5 w-3.5" />
          Historial de envíos ({history.length})
          {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showHistory && (
          <Card className="border border-border rounded-sm">
            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary dark:text-accent" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
                  <p className="text-xs text-muted-foreground">No hay notificaciones enviadas</p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                      <tr className="border-b border-border">
                        <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2.5">Tipo</th>
                        <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2.5">Título</th>
                        <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2.5 hidden sm:table-cell">Mensaje</th>
                        <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2.5">Estado</th>
                        <th className="text-right font-semibold text-muted-foreground dark:text-gray-300 px-3 py-2.5">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.slice(0, 50).map((notif) => {
                        const tc = tagConfig[notif.type] || tagConfig.admin_custom;
                        return (
                          <tr key={notif.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-3 py-2.5">
                              <Badge variant="outline" className={`text-[9px] ${tc.class}`}>{tc.icon} {tc.label}</Badge>
                            </td>
                            <td className="px-3 py-2.5 font-medium max-w-[160px] truncate">{notif.title}</td>
                            <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate hidden sm:table-cell">{notif.message}</td>
                            <td className="px-3 py-2.5">
                              {notif.is_read ? (
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary dark:text-accent border-primary/20">Leída</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">Pendiente</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                              {new Date(notif.created_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationsTab;
