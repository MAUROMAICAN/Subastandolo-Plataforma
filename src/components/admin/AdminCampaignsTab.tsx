import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, PenLine, Save, Eye, Pause, Megaphone, RotateCcw } from "lucide-react";
import CampaignImageUploader from "./CampaignImageUploader";

interface Campaign {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
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

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) || []);
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
    setCreating(true);
    await supabase.from("campaigns").insert({
      title,
      image_url: imageUrl,
      link_url: linkUrl || null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      created_by: user.id,
    } as any);
    toast({ title: "✅ Campaña creada" });
    setImageUrl(""); setTitle(""); setLinkUrl(""); setEndsAt("");
    setCreating(false); fetchCampaigns();
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

    toast({ 
      title: "✅ Campaña reenviada", 
      description: "Se mostrará de nuevo a todos los usuarios." 
    });
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-heading font-bold">Campañas Publicitarias</h1>
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
          <Button onClick={handleCreate} disabled={!imageUrl || !title || creating} className="rounded-md text-xs">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Megaphone className="h-3.5 w-3.5 mr-1" />} Crear Campaña
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
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  {c.ends_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Expira: {new Date(c.ends_at).toLocaleString("es-VE", { timeZone: "America/Caracas", dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                  {c.link_url && <p className="text-[10px] text-muted-foreground truncate">{c.link_url}</p>}
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => startEdit(c)} className="rounded-md text-[10px] h-7 flex-1"><PenLine className="h-3 w-3 mr-1" /> Editar</Button>
                    <Button variant="outline" size="icon" onClick={() => handleResend(c.id)} className="rounded-md h-7 w-7 text-primary" title="Reenviar a todos">
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => handleToggle(c.id, !c.is_active)} className={`rounded-md h-7 w-7 ${c.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
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
          <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No hay campañas creadas aún.</div>
        )}
      </div>
    </div>
  );
};

export default AdminCampaignsTab;
