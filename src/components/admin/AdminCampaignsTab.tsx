import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, PenLine, Save, Eye, Pause, Megaphone, RotateCcw, Users, User, Search, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import CampaignImageUploader from "./CampaignImageUploader";
import { fuzzyFilter } from "@/lib/fuzzySearch";

interface Campaign {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  target_user_ids: string[] | null;
}

interface UserOption {
  id: string;
  full_name: string;
  email?: string;
  phone: string | null;
}

const AdminCampaignsTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // New campaign form
  const [imageUrl, setImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [sendImmediate, setSendImmediate] = useState(true);

  // Target type: all or specific users
  const [targetType, setTargetType] = useState<"all" | "specific">("all");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Load users when switching to specific target
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
    users.filter((u) => !selectedUsers.some((s) => s.id === u.id)),
    searchQuery,
    (u) => `${u.full_name} ${u.email || ""} ${u.phone || ""}`,
    undefined,
    0.2
  );

  const handleSelectUser = (user: UserOption) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns(((data || []) as any[]).map((c: any) => ({ ...c, target_user_ids: c.target_user_ids || null })) as Campaign[]);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleCreate = async () => {
    if (!imageUrl || !title || !user) return;
    if (endsAt) {
      const endsDate = new Date(endsAt);
      if (endsDate <= new Date()) {
        toast({ title: "Error", description: "La fecha de expiración debe ser posterior a la fecha actual.", variant: "destructive" });
        return;
      }
    }
    if (targetType === "specific" && selectedUsers.length === 0) {
      toast({ title: "Error", description: "Selecciona al menos un usuario", variant: "destructive" });
      return;
    }

    setCreating(true);

    const insertData: any = {
      title,
      image_url: imageUrl,
      link_url: linkUrl || null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      created_by: user.id,
      is_active: true,
      target_user_ids: targetType === "specific" ? selectedUsers.map((u) => u.id) : null,
    };

    if (sendImmediate) {
      insertData.starts_at = new Date().toISOString();
    }

    await supabase.from("campaigns").insert(insertData);
    toast({ title: "✅ Campaña creada y enviada" });
    setImageUrl(""); setTitle(""); setLinkUrl(""); setEndsAt("");
    setSelectedUsers([]); setTargetType("all"); setSendImmediate(true);
    setCreating(false); fetchCampaigns();

    // Trigger CampaignModal refresh on all clients
    window.dispatchEvent(new CustomEvent("campaign-resent"));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("campaigns").delete().eq("id", id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
    toast({ title: "Campaña eliminada" });
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("campaigns").update({ is_active: active } as any).eq("id", id);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c));
    toast({ title: active ? "Campaña activada" : "Campaña desactivada" });
  };

  const handleResend = async (id: string) => {
    const { error } = await supabase
      .from("campaign_dismissals")
      .delete()
      .eq("campaign_id", id);

    if (error) {
      toast({ title: "❌ Error al reenviar", description: error.message, variant: "destructive" });
      return;
    }

    window.dispatchEvent(new CustomEvent("campaign-resent"));
    toast({ title: "✅ Campaña reenviada", description: "Se mostrará de nuevo a los usuarios." });
  };

  const startEdit = (c: Campaign) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditLink(c.link_url || "");
    setEditEndsAt(c.ends_at ? c.ends_at.slice(0, 16) : "");
    setEditImageUrl(c.image_url);
  };

  const handleSave = async (id: string) => {
    if (editEndsAt) {
      const endsDate = new Date(editEndsAt);
      if (endsDate <= new Date()) {
        toast({ title: "Error", description: "La fecha de expiración debe ser posterior a la fecha actual.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const updateData: any = {
      title: editTitle,
      link_url: editLink || null,
      ends_at: editEndsAt ? new Date(editEndsAt).toISOString() : null,
      image_url: editImageUrl,
    };
    await supabase.from("campaigns").update(updateData).eq("id", id);
    toast({ title: "✅ Campaña actualizada" });
    setEditingId(null);
    setSaving(false);
    fetchCampaigns();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary dark:text-accent" /></div>;

  // Stats
  const now = new Date();
  const activeCampaigns = campaigns.filter(c => c.is_active && (!c.ends_at || new Date(c.ends_at) > now));
  const inactiveCampaigns = campaigns.filter(c => !c.is_active);
  const expiredCampaigns = campaigns.filter(c => c.ends_at && new Date(c.ends_at) < now);
  const targetedCampaigns = campaigns.filter(c => c.target_user_ids && c.target_user_ids.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary dark:text-accent" /> Campañas Publicitarias
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCampaigns.length} activas · {inactiveCampaigns.length} inactivas · {expiredCampaigns.length} expiradas
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{campaigns.length} campañas</Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Activas", value: activeCampaigns.length, icon: Eye, color: "text-primary dark:text-accent" },
          { label: "Inactivas", value: inactiveCampaigns.length, icon: Pause, color: "text-muted-foreground" },
          { label: "Expiradas", value: expiredCampaigns.length, icon: RotateCcw, color: expiredCampaigns.length > 0 ? "text-warning" : "text-muted-foreground" },
          { label: "Segmentadas", value: targetedCampaigns.length, icon: User, color: "text-foreground" },
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

      {/* Create form */}
      <Card className="border border-border rounded-lg">
        <CardContent className="p-5 space-y-4">
          <p className="text-sm font-semibold">Nueva Campaña</p>

          <CampaignImageUploader
            onUploadComplete={(url) => setImageUrl(url)}
            existingUrl={imageUrl || null}
            onClear={() => setImageUrl("")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Título de la campaña *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Promo Navidad" className="rounded-md text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link (opcional, abre al tocar imagen)</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="rounded-md text-xs" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fecha de expiración (opcional)</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="rounded-md text-xs w-fit" />
          </div>

          {/* ── Target selector ── */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Destinatarios</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={targetType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setTargetType("all"); setSelectedUsers([]); }}
                className="rounded-md text-xs"
              >
                <Users className="h-3 w-3 mr-1" /> Todos
              </Button>
              <Button
                type="button"
                variant={targetType === "specific" ? "default" : "outline"}
                size="sm"
                onClick={() => setTargetType("specific")}
                className="rounded-md text-xs"
              >
                <User className="h-3 w-3 mr-1" /> Específicos
              </Button>
            </div>
          </div>

          {/* ── User picker ── */}
          {targetType === "specific" && (
            <div className="space-y-2">
              {/* Selected users chips */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((u) => (
                    <Badge key={u.id} variant="secondary" className="text-[10px] pl-2 pr-1 py-0.5 flex items-center gap-1">
                      {u.full_name}
                      <button onClick={() => handleRemoveUser(u.id)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder={loadingUsers ? "Cargando usuarios..." : "Buscar usuario..."}
                    className="pl-8 rounded-md text-xs"
                    disabled={loadingUsers}
                  />
                </div>

                {showDropdown && filteredUsers.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
                    {filteredUsers.slice(0, 20).map((u) => (
                      <button
                        key={u.id}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent transition-colors"
                        onClick={() => handleSelectUser(u)}
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarFallback className="text-[9px] bg-primary/20">{u.full_name?.charAt(0) || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{u.full_name}</p>
                          <p className="truncate text-muted-foreground text-[10px]">{u.email || u.phone || ""}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Send immediately toggle ── */}
          <div className="flex items-center gap-2">
            <Switch checked={sendImmediate} onCheckedChange={setSendImmediate} id="send-immediate" />
            <Label htmlFor="send-immediate" className="text-xs cursor-pointer">
              Enviar inmediatamente
            </Label>
          </div>

          <Button onClick={handleCreate} disabled={!imageUrl || !title || creating || (targetType === "specific" && selectedUsers.length === 0)} className="rounded-md text-xs">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Megaphone className="h-3.5 w-3.5 mr-1" />} Crear y Enviar Campaña
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-lg overflow-hidden">
            {editingId === c.id ? (
              <div className="p-4 space-y-3">
                <CampaignImageUploader
                  onUploadComplete={(url) => setEditImageUrl(url)}
                  existingUrl={editImageUrl}
                  onClear={() => setEditImageUrl(c.image_url)}
                />
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Título" className="rounded-md text-xs" />
                <Input value={editLink} onChange={(e) => setEditLink(e.target.value)} placeholder="Link (opcional)" className="rounded-md text-xs" />
                <Input type="datetime-local" value={editEndsAt} onChange={(e) => setEditEndsAt(e.target.value)} className="rounded-md text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSave(c.id)} disabled={saving} className="rounded-md text-xs flex-1">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="rounded-md text-xs">Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative aspect-[9/16] w-full bg-muted/30">
                  <img
                    src={c.image_url}
                    className={`h-full w-full object-contain ${!c.is_active ? 'opacity-40 grayscale' : ''}`}
                    alt={c.title}
                    loading="lazy"
                  />
                  {!c.is_active && <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">Inactiva</Badge>}
                  {c.ends_at && new Date(c.ends_at) < new Date() && <Badge variant="destructive" className="absolute top-2 right-2 text-[10px]">Expirada</Badge>}
                  {c.target_user_ids && (
                    <Badge variant="outline" className="absolute top-2 left-2 text-[10px] bg-background/80">
                      <User className="h-2.5 w-2.5 mr-0.5" /> {c.target_user_ids.length} usuario(s)
                    </Badge>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  {c.ends_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Expira: {new Date(c.ends_at).toLocaleString("es-VE", { timeZone: "America/Caracas", dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                  {c.link_url && <p className="text-[10px] text-muted-foreground dark:text-gray-300 truncate">{c.link_url}</p>}
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => startEdit(c)} className="rounded-md text-[10px] h-7 flex-1"><PenLine className="h-3 w-3 mr-1" /> Editar</Button>
                    <Button variant="outline" size="icon" onClick={() => handleResend(c.id)} className="rounded-md h-7 w-7 text-primary dark:text-accent" title="Reenviar">
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleToggle(c.id, !c.is_active)} className={`rounded-md h-7 w-7 ${c.is_active ? 'text-primary dark:text-accent' : 'text-muted-foreground'}`}>
                      {c.is_active ? <Eye className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground dark:text-gray-300 text-sm">No hay campañas creadas aún.</div>
        )}
      </div>
    </div>
  );
};

export default AdminCampaignsTab;
