import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Save, Loader2, Palette, FileText, ImagePlus, PenLine, Eye, Pause, Trash2, LayoutTemplate, Globe } from "lucide-react";
import type { BannerImage, SiteSetting, SiteSection } from "./types";

// Convert HSL string "H S% L%" to hex color
const hslToHex = (hsl: string): string => {
  try {
    const parts = hsl.replace(/%/g, "").split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return "#808080";
    let [h, s, l] = parts;
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return "#808080"; }
};

// Convert hex color to HSL string "H S% L%"
const hexToHsl = (hex: string): string => {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch { return "0 0% 50%"; }
};


interface Props {
  siteSettings: SiteSetting[];
  siteSections: SiteSection[];
  banners: BannerImage[];
  editingSettings: Record<string, string>;
  setEditingSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingSettings: boolean;
  setSavingSettings: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveSettings: () => Promise<void>;
  fetchAllData: () => Promise<void>;
}

const AdminCMSTab = ({ siteSettings, siteSections, banners: initialBanners, editingSettings, setEditingSettings, savingSettings, setSavingSettings, handleSaveSettings, fetchAllData }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [banners, setBanners] = useState(initialBanners);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerSubtitle, setBannerSubtitle] = useState("");
  const [bannerDescription, setBannerDescription] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [editingBanner, setEditingBanner] = useState<string | null>(null);
  const [editBannerTitle, setEditBannerTitle] = useState("");
  const [editBannerSubtitle, setEditBannerSubtitle] = useState("");
  const [editBannerDescription, setEditBannerDescription] = useState("");
  const [editBannerFile, setEditBannerFile] = useState<File | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [localSections, setLocalSections] = useState(siteSections);

  // Sync props
  useEffect(() => { setBanners(initialBanners); setLocalSections(siteSections); }, [initialBanners, siteSections]);

  const handleAddBanner = async () => {
    if (!bannerFile || !user) return;
    setUploadingBanner(true);
    const filePath = `${crypto.randomUUID()}.${bannerFile.name.split(".").pop()}`;
    const { error: upErr } = await supabase.storage.from("banner-images").upload(filePath, bannerFile);
    if (upErr) { toast({ title: "Error", description: upErr.message, variant: "destructive" }); setUploadingBanner(false); return; }
    const { data: urlData } = supabase.storage.from("banner-images").getPublicUrl(filePath);
    const { error: dbErr } = await supabase.from("banner_images").insert({ image_url: urlData.publicUrl, title: bannerTitle || null, subtitle: bannerSubtitle || null, description: bannerDescription || null, display_order: banners.length, created_by: user.id });
    if (dbErr) {
      toast({ title: "Error en Base de Datos", description: dbErr.message, variant: "destructive" });
      setUploadingBanner(false);
      return;
    }
    toast({ title: "Banner agregado" }); setBannerFile(null); setBannerTitle(""); setBannerSubtitle(""); setBannerDescription(""); setUploadingBanner(false); fetchAllData();
  };

  const handleDeleteBanner = async (id: string) => {
    await supabase.from("banner_images").delete().eq("id", id);
    setBanners(prev => prev.filter(b => b.id !== id)); toast({ title: "Banner eliminado" });
  };

  const handleEditBannerStart = (b: BannerImage) => {
    setEditingBanner(b.id); setEditBannerTitle(b.title || ""); setEditBannerSubtitle(b.subtitle || ""); setEditBannerDescription(b.description || ""); setEditBannerFile(null);
  };

  const handleSaveBanner = async (id: string) => {
    setSavingBanner(true);
    const updateData: any = { title: editBannerTitle || null, subtitle: editBannerSubtitle || null, description: editBannerDescription || null };
    if (editBannerFile) {
      const filePath = `${crypto.randomUUID()}.${editBannerFile.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("banner-images").upload(filePath, editBannerFile);
      if (upErr) { toast({ title: "Error subiendo imagen", variant: "destructive" }); setSavingBanner(false); return; }
      const { data: urlData } = supabase.storage.from("banner-images").getPublicUrl(filePath);
      updateData.image_url = urlData.publicUrl;
    }
    const { error: dbErr } = await supabase.from("banner_images").update(updateData).eq("id", id);
    if (dbErr) {
      toast({ title: "Error guardando", description: dbErr.message, variant: "destructive" });
      setSavingBanner(false);
      return;
    }
    toast({ title: "✅ Banner actualizado" }); setEditingBanner(null); setSavingBanner(false); fetchAllData();
  };

  const handleToggleBannerActive = async (id: string, active: boolean) => {
    await supabase.from("banner_images").update({ is_active: active }).eq("id", id);
    setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: active } : b));
    toast({ title: active ? "Banner activado" : "Banner desactivado" });
  };

  const handleSectionToggle = async (id: string, visible: boolean) => {
    await supabase.from("site_sections").update({ is_visible: visible } as any).eq("id", id);
    setLocalSections(prev => prev.map(s => s.id === id ? { ...s, is_visible: visible } : s));
  };

  const handleSectionUpdate = async (id: string, field: string, value: string) => {
    await supabase.from("site_sections").update({ [field]: value } as any).eq("id", id);
    toast({ title: "Sección actualizada" });
  };

  const handleUploadSettingImage = async (file: File, settingKey: string) => {
    try {
      setSavingSettings(true);
      const filePath = `${settingKey}-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("banner-images").upload(filePath, file);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("banner-images").getPublicUrl(filePath);

      // Update local state directly
      setEditingSettings(p => ({ ...p, [settingKey]: urlData.publicUrl }));

      // Upsert to DB for this specific setting so it's immediate
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", settingKey).maybeSingle();
      if (existing) {
        const { error: dbErr } = await supabase.from("site_settings").update({ setting_value: urlData.publicUrl }).eq("setting_key", settingKey);
        if (dbErr) throw dbErr;
      } else {
        const { error: dbErr } = await supabase.from("site_settings").insert({
          setting_key: settingKey,
          setting_value: urlData.publicUrl,
          setting_type: 'image',
          category: 'branding',
          label: settingKey === 'site_logo' ? 'Logo Principal' : settingKey === 'favicon_url' ? 'Favicon' : 'Imagen'
        });
        if (dbErr) throw dbErr;
      }

      toast({ title: "✅ Imagen actualizada correctamente" });
      fetchAllData();
    } catch (e: any) {
      toast({ title: "Error al subir imagen", description: e.message, variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Settings className="h-5 w-5 text-primary dark:text-accent" /> Configuración Central</h1>
        <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground rounded-sm text-xs">
          {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Guardar Cambios
        </Button>
      </div>
      <Accordion type="multiple" defaultValue={["settings"]} className="space-y-2">
        {/* BRANDING / VISUAL IDENTITY */}
        <AccordionItem value="branding" className="border border-border rounded-sm overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-heading font-bold hover:no-underline hover:bg-secondary/30">
            <div className="flex items-center gap-2"><Palette className="h-4 w-4 text-primary dark:text-accent" /> Identidad Visual</div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-6 pt-2">

            {/* Logos & Media */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">Logotipos e Imágenes Clave</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'site_logo', label: 'Logotipo Principal' },
                  { key: 'favicon_url', label: 'Favicon (Icono de pestaña)' },
                  { key: 'quiero_vender_hero', label: 'Hero Image "Quiero Vender"' }
                ].map(setting => (
                  <div key={setting.key} className="bg-card border border-border p-3 rounded-sm space-y-3">
                    <Label className="text-xs font-semibold">{setting.label}</Label>
                    <div className="flex flex-col gap-3">
                      <div className="h-20 w-full bg-secondary/50 rounded-sm border border-dashed border-border flex items-center justify-center overflow-hidden p-2 relative group">
                        {editingSettings[setting.key] ? (
                          <img src={editingSettings[setting.key]} alt={setting.label} className="max-h-full max-w-full object-contain drop-shadow-md" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin imagen</span>
                        )}
                      </div>
                      <label className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs rounded-sm cursor-pointer transition-colors">
                        <ImagePlus className="h-3.5 w-3.5" /> Cambiar Imagen
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          if (e.target.files?.[0]) handleUploadSettingImage(e.target.files[0], setting.key);
                        }} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">Colores del Tema</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { key: 'primary_color', label: 'Color Primario (General)' },
                  { key: 'secondary_color', label: 'Color Secundario' },
                  { key: 'accent_color', label: 'Color de Acento (Botones, Destacados)' },
                  { key: 'background_color', label: 'Color de Fondo Global' }
                ].map(setting => (
                  <div key={setting.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 bg-secondary/10 rounded-sm border border-transparent hover:border-border transition-colors">
                    <Label className="text-xs w-full sm:w-48 shrink-0">{setting.label}</Label>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="color"
                        value={hslToHex(editingSettings[setting.key] || "0 0% 50%")}
                        onChange={(e) => setEditingSettings(p => ({ ...p, [setting.key]: hexToHsl(e.target.value) }))}
                        className="w-8 h-8 rounded border border-border cursor-pointer p-0 bg-transparent shrink-0"
                        title="Seleccionar color"
                      />
                      <Input
                        value={hslToHex(editingSettings[setting.key] || "0 0% 50%")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^#[0-9A-Fa-f]{6}$/.test(val)) setEditingSettings(p => ({ ...p, [setting.key]: hexToHsl(val) }));
                        }}
                        className="rounded-sm text-xs font-mono uppercase h-8 w-24"
                        placeholder="#A6E300"
                        maxLength={7}
                      />
                      <span className="text-[10px] text-muted-foreground font-mono hidden sm:block ml-2 w-24 truncate">
                        {editingSettings[setting.key]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* GENERAL INFO */}
        <AccordionItem value="general" className="border border-border rounded-sm overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-heading font-bold hover:no-underline hover:bg-secondary/30">
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary dark:text-accent" /> Información General</div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4">
              {[
                { key: 'site_name', label: 'Nombre del Sitio', isTextarea: false },
                { key: 'site_description', label: 'Descripción Corta (SEO)', isTextarea: true },
                { key: 'contact_email', label: 'Email de Contacto', isTextarea: false },
                { key: 'whatsapp_number', label: 'Número de WhatsApp', isTextarea: false },
                { key: 'footer_text', label: 'Texto del Copyright (Footer)', isTextarea: false },
              ].map(setting => (
                <div key={setting.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{setting.label}</Label>
                  {setting.isTextarea ? (
                    <Textarea value={editingSettings[setting.key] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, [setting.key]: e.target.value }))} className="rounded-sm text-sm min-h-[80px]" />
                  ) : (
                    <Input value={editingSettings[setting.key] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, [setting.key]: e.target.value }))} className="rounded-sm text-sm h-9" />
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SYSTEM & DISPLAY CONFIG */}
        <AccordionItem value="system" className="border border-border rounded-sm overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-heading font-bold hover:no-underline hover:bg-secondary/30">
            <div className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 text-primary dark:text-accent" /> Configuración de Visualización</div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4">
              {[
                { key: 'announcement_bar', label: 'Texto del Ticker (Mensaje Superior)' },
                { key: 'ticker_speed', label: 'Velocidad de Tickers (Segs)' },
                { key: 'commission_percentage', label: 'Porcentaje de Comisión (%)' }
              ].map(setting => (
                <div key={setting.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-secondary/10 rounded-sm border border-transparent">
                  <Label className="text-xs font-medium w-full sm:w-60 shrink-0">{setting.label}</Label>
                  {setting.key === "ticker_speed" ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={editingSettings[setting.key] || "50"}
                        onChange={(e) => setEditingSettings(p => ({ ...p, [setting.key]: e.target.value }))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-xs font-mono w-10 text-muted-foreground text-right">{editingSettings[setting.key] || "50"}s</span>
                    </div>
                  ) : setting.key === "announcement_bar" ? (
                    <Input value={editingSettings[setting.key] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, [setting.key]: e.target.value }))} className="rounded-sm text-sm h-9 flex-1" placeholder="Ej: ¡Envíos gratis este fin de semana!" />
                  ) : (
                    <Input value={editingSettings[setting.key] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, [setting.key]: e.target.value }))} className="rounded-sm text-sm h-9 flex-1" />
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="sections" className="border border-border rounded-sm overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-heading font-bold hover:no-underline hover:bg-secondary/30">
            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary dark:text-accent" /> Secciones de la Página<Badge variant="outline" className="text-[10px] ml-1">{localSections.length}</Badge></div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {localSections.map(section => (
              <div key={section.id} className="border border-border rounded-sm p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="text-xs font-medium">{section.section_key}</span><Badge variant="outline" className="text-[10px]">{section.section_type}</Badge></div>
                  <div className="flex items-center gap-2"><Label className="text-xs text-muted-foreground">Visible</Label><Switch checked={section.is_visible} onCheckedChange={(v) => handleSectionToggle(section.id, v)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Título</Label><Input defaultValue={section.title || ""} onBlur={(e) => handleSectionUpdate(section.id, "title", e.target.value)} className="rounded-sm text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs">Contenido</Label><Textarea defaultValue={section.content || ""} onBlur={(e) => handleSectionUpdate(section.id, "content", e.target.value)} rows={2} className="rounded-sm text-xs" /></div>
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="banners" className="border border-border rounded-sm overflow-hidden">
          <AccordionTrigger className="px-4 py-3 text-sm font-heading font-bold hover:no-underline hover:bg-secondary/30">
            <div className="flex items-center gap-2"><ImagePlus className="h-4 w-4 text-primary dark:text-accent" /> Banners del Hero<Badge variant="outline" className="text-[10px] ml-1">{banners.length}</Badge></div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <Card className="border border-border rounded-sm">
              <CardContent className="p-4 space-y-4">
                <label className="flex items-center gap-2 px-4 py-3 rounded-sm border border-dashed border-primary/40 text-sm text-primary dark:text-accent cursor-pointer hover:bg-primary/5 transition-colors w-full justify-center">
                  <ImagePlus className="h-4 w-4" /> {bannerFile ? bannerFile.name : "Seleccionar imagen"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Título" className="rounded-sm text-xs" />
                  <Input value={bannerSubtitle} onChange={(e) => setBannerSubtitle(e.target.value)} placeholder="Subtítulo" className="rounded-sm text-xs" />
                  <Input value={bannerDescription} onChange={(e) => setBannerDescription(e.target.value)} placeholder="Descripción adicional" className="rounded-sm text-xs col-span-2" />
                </div>
                <Button onClick={handleAddBanner} disabled={!bannerFile || uploadingBanner} className="bg-primary text-primary-foreground rounded-sm text-xs">
                  {uploadingBanner ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ImagePlus className="h-3.5 w-3.5 mr-1" />} Agregar
                </Button>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {banners.map(b => (
                <div key={b.id} className="bg-card border border-border rounded-sm overflow-hidden">
                  {editingBanner === b.id ? (
                    <div className="p-4 space-y-3">
                      <img src={editBannerFile ? URL.createObjectURL(editBannerFile) : b.image_url} className="w-full aspect-[16/9] object-cover rounded-sm" alt="" />
                      <label className="flex items-center gap-2 px-3 py-2 rounded-sm border border-dashed border-primary/40 text-xs text-primary dark:text-accent cursor-pointer hover:bg-primary/5 w-full justify-center">
                        <ImagePlus className="h-3.5 w-3.5" /> {editBannerFile ? editBannerFile.name : "Cambiar imagen"}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditBannerFile(e.target.files?.[0] || null)} />
                      </label>
                      <Input value={editBannerTitle} onChange={(e) => setEditBannerTitle(e.target.value)} placeholder="Título" className="rounded-sm text-xs" />
                      <Input value={editBannerSubtitle} onChange={(e) => setEditBannerSubtitle(e.target.value)} placeholder="Subtítulo" className="rounded-sm text-xs" />
                      <Input value={editBannerDescription} onChange={(e) => setEditBannerDescription(e.target.value)} placeholder="Descripción adicional" className="rounded-sm text-xs" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveBanner(b.id)} disabled={savingBanner} className="bg-primary text-primary-foreground rounded-sm text-xs flex-1">
                          {savingBanner ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingBanner(null)} className="rounded-sm text-xs">Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <img src={b.image_url} className={`w-full aspect-[16/9] object-cover ${!b.is_active ? 'opacity-40 grayscale' : ''}`} alt="" />
                        {!b.is_active && <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">Inactivo</Badge>}
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-sm font-medium truncate">{b.title || "Sin título"}</p>
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => handleEditBannerStart(b)} className="rounded-sm text-[10px] h-7 flex-1"><PenLine className="h-3 w-3 mr-1" /> Editar</Button>
                          <Button variant="outline" size="icon" onClick={() => handleToggleBannerActive(b.id, !b.is_active)} className={`rounded-sm h-7 w-7 ${b.is_active ? 'text-primary dark:text-accent' : 'text-muted-foreground'}`}>
                            {b.is_active ? <Eye className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>¿Eliminar banner?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteBanner(b.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default AdminCMSTab;
