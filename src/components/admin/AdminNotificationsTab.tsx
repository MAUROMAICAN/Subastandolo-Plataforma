import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Bell, Users, User, Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fuzzyFilter } from "@/lib/fuzzySearch";

interface UserOption {
  id: string;
  full_name: string;
  email?: string;
  phone: string | null;
}

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

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name");

      // Get emails via list_users action
      let emailMap: Record<string, string> = {};
      try {
        const { data: emailData } = await supabase.functions.invoke("admin-manage-user", {
          body: { action: "list_users", userId: "dummy" },
        });
        if (emailData?.emails) {
          emailMap = emailData.emails;
        }
      } catch {}

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

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Error", description: "Título y mensaje son obligatorios", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      if (targetType === "all") {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("user_id");

        const uniqueIds = [...new Set((subs || []).map((s) => s.user_id))];

        if (uniqueIds.length === 0) {
          toast({ title: "Sin suscriptores", description: "No hay usuarios registrados para push", variant: "destructive" });
          setSending(false);
          return;
        }

        const notifs = uniqueIds.map((uid) => ({
          user_id: uid,
          title,
          message: body,
          type: tag,
          link: url || "/",
        }));

        for (let i = 0; i < notifs.length; i += 50) {
          await supabase.from("notifications").insert(notifs.slice(i, i + 50));
        }

        toast({ title: "✅ Enviado", description: `Notificación enviada a ${uniqueIds.length} usuarios` });
      } else {
        if (!selectedUser) {
          toast({ title: "Error", description: "Selecciona un usuario", variant: "destructive" });
          setSending(false);
          return;
        }

        await supabase.from("notifications").insert({
          user_id: selectedUser.id,
          title,
          message: body,
          type: tag,
          link: url || "/",
        });

        toast({ title: "✅ Enviado", description: `Notificación enviada a ${selectedUser.full_name}` });
      }

      setTitle("");
      setBody("");
      setUrl("/");
      setSelectedUser(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="font-heading font-bold text-lg">Enviar Notificación Push</h2>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-xl">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinatarios</label>
          <div className="flex gap-2">
            <Button
              variant={targetType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => { setTargetType("all"); setSelectedUser(null); }}
              className="text-xs"
            >
              <Users className="h-3.5 w-3.5 mr-1" />Todos
            </Button>
            <Button
              variant={targetType === "specific" ? "default" : "outline"}
              size="sm"
              onClick={() => setTargetType("specific")}
              className="text-xs"
            >
              <User className="h-3.5 w-3.5 mr-1" />Usuario específico
            </Button>
          </div>
        </div>

        {targetType === "specific" && (
          <div ref={dropdownRef} className="relative">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar usuario</label>

            {selectedUser ? (
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-secondary/30">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                    {(selectedUser.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{selectedUser.full_name}</span>
                  <span className="text-[10px] text-muted-foreground truncate block">{selectedUser.email || "Sin correo"}</span>
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
                    className="pl-8 text-sm"
                  />
                </div>

                {showDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground ml-2">Cargando usuarios...</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        {searchQuery ? "Sin resultados" : "Escribe para buscar"}
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto">
                        {filteredUsers.slice(0, 80).map((u) => {
                          const initials = (u.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                          return (
                            <button
                              key={u.id}
                              onClick={() => handleSelectUser(u)}
                              className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                            >
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{initials}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium truncate block">{u.full_name}</span>
                                <span className="text-[10px] text-muted-foreground truncate block">{u.email || "Sin correo"}</span>
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

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Título</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la notificación" className="text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensaje</label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Contenido del mensaje..." rows={3} className="text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">URL al hacer clic</label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/" className="text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Sonido / Tipo</label>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_custom">🔔 Administrador</SelectItem>
              <SelectItem value="promo">📢 Promoción</SelectItem>
              <SelectItem value="announcement">📣 Anuncio</SelectItem>
              <SelectItem value="urgent">🚨 Urgente</SelectItem>
              <SelectItem value="maintenance">🔧 Mantenimiento</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSend} disabled={sending} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {sending ? "Enviando..." : "Enviar notificación"}
        </Button>
      </div>
    </div>
  );
};

export default AdminNotificationsTab;
