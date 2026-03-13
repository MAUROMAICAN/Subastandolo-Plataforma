import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2, Pause, Play, ShieldAlert, Gavel, Ban, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  editingSettings: Record<string, string>;
  setEditingSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveSettings: () => Promise<void>;
  savingSettings: boolean;
}

export default function AdminEmergencyControls({ editingSettings, setEditingSettings, handleSaveSettings, savingSettings }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [closingAuctions, setClosingAuctions] = useState(false);
  const [forceEndingAll, setForceEndingAll] = useState(false);

  const isMaintenanceMode = editingSettings["maintenance_mode"] === "true";
  const isMarketplacePaused = editingSettings["marketplace_paused"] === "true";

  const toggleMaintenanceMode = async () => {
    const newVal = isMaintenanceMode ? "false" : "true";
    setEditingSettings(prev => ({ ...prev, maintenance_mode: newVal }));
    // Save immediately for emergency
    try {
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "maintenance_mode").maybeSingle();
      if (existing) {
        await supabase.from("site_settings").update({ setting_value: newVal } as any).eq("setting_key", "maintenance_mode");
      } else {
        await supabase.from("site_settings").insert({ setting_key: "maintenance_mode", setting_value: newVal, setting_type: "boolean", category: "system", label: "Modo Mantenimiento" } as any);
      }
      toast({ title: newVal === "true" ? "🔧 Modo mantenimiento ACTIVADO" : "✅ Modo mantenimiento desactivado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleMarketplacePause = async () => {
    const newVal = isMarketplacePaused ? "false" : "true";
    setEditingSettings(prev => ({ ...prev, marketplace_paused: newVal }));
    try {
      const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", "marketplace_paused").maybeSingle();
      if (existing) {
        await supabase.from("site_settings").update({ setting_value: newVal } as any).eq("setting_key", "marketplace_paused");
      } else {
        await supabase.from("site_settings").insert({ setting_key: "marketplace_paused", setting_value: newVal, setting_type: "boolean", category: "system", label: "Marketplace Pausado" } as any);
      }
      toast({ title: newVal === "true" ? "⏸️ Marketplace PAUSADO" : "▶️ Marketplace reanudado" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const closeAllMarketplaceAuctions = async () => {
    setClosingAuctions(true);
    try {
      const { data, error } = await (supabase
        .from("marketplace_products")
        .update({ status: "paused" } as any)
        .eq("listing_type", "auction")
        .eq("status", "active") as any);
      if (error) throw error;
      toast({ title: "✅ Todas las subastas del marketplace pausadas" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setClosingAuctions(false);
    }
  };

  const forceEndAllProducts = async () => {
    setForceEndingAll(true);
    try {
      const { error } = await (supabase
        .from("marketplace_products")
        .update({ status: "paused" } as any)
        .eq("status", "active") as any);
      if (error) throw error;
      toast({ title: "⚠️ TODOS los productos del marketplace han sido pausados" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setForceEndingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Warning header */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="font-heading font-bold text-sm text-destructive">Controles de Emergencia</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Estas acciones son de alto impacto y toman efecto inmediato. Úsalas solo en caso de emergencia.
          </p>
        </div>
      </div>

      {/* Maintenance mode */}
      <div className={`border rounded-lg p-5 space-y-3 transition-colors ${isMaintenanceMode ? "bg-amber-500/5 border-amber-500/30" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isMaintenanceMode ? "bg-amber-500/20" : "bg-secondary"}`}>
              <Wrench className={`h-5 w-5 ${isMaintenanceMode ? "text-amber-500" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                Modo Mantenimiento
                {isMaintenanceMode && <Badge className="bg-amber-500 text-white text-[9px]">ACTIVO</Badge>}
              </p>
              <p className="text-[10px] text-muted-foreground">Muestra un banner de mantenimiento a los usuarios. El sitio sigue funcionando.</p>
            </div>
          </div>
          <Button
            variant={isMaintenanceMode ? "default" : "outline"}
            size="sm"
            className={`rounded-lg text-xs ${isMaintenanceMode ? "bg-amber-500 text-white hover:bg-amber-600" : ""}`}
            onClick={toggleMaintenanceMode}
          >
            {isMaintenanceMode ? <Play className="h-3 w-3 mr-1" /> : <Wrench className="h-3 w-3 mr-1" />}
            {isMaintenanceMode ? "Desactivar" : "Activar"}
          </Button>
        </div>
        {isMaintenanceMode && (
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Mensaje de mantenimiento</Label>
            <Input
              value={editingSettings["maintenance_message"] || ""}
              onChange={(e) => setEditingSettings(prev => ({ ...prev, maintenance_message: e.target.value }))}
              placeholder="Ej: Estamos realizando mejoras. Volvemos pronto."
              className="h-9 rounded-lg text-sm mt-1"
            />
          </div>
        )}
      </div>

      {/* Pause marketplace */}
      <div className={`border rounded-lg p-5 space-y-3 transition-colors ${isMarketplacePaused ? "bg-red-500/5 border-red-500/30" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isMarketplacePaused ? "bg-red-500/20" : "bg-secondary"}`}>
              {isMarketplacePaused ? <Ban className="h-5 w-5 text-red-500" /> : <Pause className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                Pausar Marketplace Completo
                {isMarketplacePaused && <Badge className="bg-red-500 text-white text-[9px]">PAUSADO</Badge>}
              </p>
              <p className="text-[10px] text-muted-foreground">Impide nuevas compras, ofertas y pujas. Los dealers no pueden publicar.</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant={isMarketplacePaused ? "default" : "outline"}
                size="sm"
                className={`rounded-lg text-xs ${isMarketplacePaused ? "bg-success text-white hover:bg-success/90" : "border-red-500/30 text-red-500 hover:bg-red-500/5"}`}
              >
                {isMarketplacePaused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                {isMarketplacePaused ? "Reanudar" : "Pausar"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{isMarketplacePaused ? "¿Reanudar el marketplace?" : "¿Pausar TODO el marketplace?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {isMarketplacePaused
                    ? "El marketplace volverá a funcionar normalmente."
                    : "Esta acción bloqueará todas las transacciones del marketplace. Úsala solo en caso de emergencia."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={toggleMarketplacePause} className={isMarketplacePaused ? "bg-success" : "bg-destructive text-destructive-foreground"}>
                  {isMarketplacePaused ? "Sí, reanudar" : "Sí, pausar todo"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Close marketplace auctions */}
      <div className="border border-border rounded-lg p-5 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Gavel className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-bold text-sm">Pausar Subastas del Marketplace</p>
              <p className="text-[10px] text-muted-foreground">Pausa todas las subastas activas del marketplace (no afecta subastas legacy).</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-lg text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/5" disabled={closingAuctions}>
                {closingAuctions ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Pause className="h-3 w-3 mr-1" />} Pausar Subastas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Pausar TODAS las subastas del marketplace?</AlertDialogTitle>
                <AlertDialogDescription>Todas las subastas activas del marketplace pasarán a estado "pausado". Los dealers podrán reactivarlas manualmente.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={closeAllMarketplaceAuctions} className="bg-amber-500 text-white">Sí, pausar todas</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Force end all products */}
      <div className="border border-destructive/30 rounded-lg p-5 bg-destructive/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/20 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-sm text-destructive">Pausar TODOS los Productos</p>
              <p className="text-[10px] text-muted-foreground">Acción nuclear: pausa absolutamente todos los productos activos del marketplace.</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="rounded-lg text-xs" disabled={forceEndingAll}>
                {forceEndingAll ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Ban className="h-3 w-3 mr-1" />} PAUSAR TODO
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">⚠️ ¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta es la acción más drástica disponible. TODOS los productos activos del marketplace serán pausados. Los dealers tendrán que reactivar cada producto manualmente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>No, cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={forceEndAllProducts} className="bg-destructive text-destructive-foreground">Sí, pausar absolutamente todo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
