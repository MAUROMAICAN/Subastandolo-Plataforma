import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Save, Gavel, MessageSquare, ShoppingCart, Clock, Package, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  editingSettings: Record<string, string>;
  setEditingSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSaveSettings: () => Promise<void>;
  savingSettings: boolean;
}

export default function AdminMarketplaceSettings({ editingSettings, setEditingSettings, handleSaveSettings, savingSettings }: Props) {
  const { toast } = useToast();
  const [stats, setStats] = useState({ fixed: 0, auction: 0, offers: 0, total: 0, dealers: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await (supabase
        .from("marketplace_products")
        .select("listing_type, seller_id")
        .eq("status", "active") as any);
      
      const products = data || [];
      const uniqueSellers = new Set(products.map((p: any) => p.seller_id));
      setStats({
        fixed: products.filter((p: any) => !p.listing_type || p.listing_type === 'fixed_price').length,
        auction: products.filter((p: any) => p.listing_type === 'auction').length,
        offers: products.filter((p: any) => p.listing_type === 'accepts_offers').length,
        total: products.length,
        dealers: uniqueSellers.size,
      });
    } catch { /* ignore */ }
    setLoadingStats(false);
  };

  const updateSetting = (key: string, value: string) => {
    setEditingSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Productos Activos", value: stats.total, icon: Package, color: "text-primary dark:text-accent" },
          { label: "Cómpralo Ahora", value: stats.fixed, icon: ShoppingCart, color: "text-success" },
          { label: "Subastas", value: stats.auction, icon: Gavel, color: "text-amber-500" },
          { label: "Acepta Ofertas", value: stats.offers, icon: MessageSquare, color: "text-blue-500" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{stat.label}</span>
            </div>
            <p className="text-2xl font-black text-foreground">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Commission */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary dark:text-accent" />
          <h4 className="font-heading font-bold text-sm">Comisión de la Plataforma</h4>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Porcentaje de comisión (%)</Label>
            <div className="flex items-center gap-3 mt-1">
              <Input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={editingSettings["commission_percentage"] || ""}
                onChange={(e) => updateSetting("commission_percentage", e.target.value)}
                className="h-10 w-24 rounded-lg text-lg font-bold text-center"
              />
              <span className="text-lg font-bold text-muted-foreground">%</span>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={editingSettings["commission_percentage"] || "0"}
                onChange={(e) => updateSetting("commission_percentage", e.target.value)}
                className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">Este porcentaje se cobra sobre el precio final de cada venta en la plataforma.</p>
      </div>

      {/* Offer Expiration */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <h4 className="font-heading font-bold text-sm">Configuración de Ofertas</h4>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tiempo de expiración de ofertas (horas)</Label>
          <div className="flex items-center gap-3 mt-1">
            <Input
              type="number"
              min="1"
              max="168"
              value={editingSettings["offer_expiry_hours"] || "48"}
              onChange={(e) => updateSetting("offer_expiry_hours", e.target.value)}
              className="h-9 w-24 rounded-lg text-sm font-bold text-center"
            />
            <span className="text-xs text-muted-foreground">horas ({Math.round(parseInt(editingSettings["offer_expiry_hours"] || "48") / 24)} días)</span>
          </div>
        </div>
      </div>

      {/* Listing Modes Control */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary dark:text-accent" />
          <h4 className="font-heading font-bold text-sm">Modos de Venta</h4>
          <Badge variant="secondary" className="text-[10px]">Control Global</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Activa o desactiva modos de venta a nivel global. Si desactivas un modo, los dealers no podrán crear nuevos productos con ese modo.</p>
        <div className="space-y-3">
          {[
            { key: "mode_fixed_price", label: "Cómpralo Ahora", desc: "Precio fijo, compra inmediata", icon: ShoppingCart, color: "text-success" },
            { key: "mode_auction", label: "Subasta", desc: "Los compradores pujan", icon: Gavel, color: "text-amber-500" },
            { key: "mode_offers", label: "Acepto Ofertas", desc: "Negociación de precio", icon: MessageSquare, color: "text-blue-500" },
          ].map(mode => (
            <div key={mode.key} className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg border border-transparent hover:border-border transition-colors">
              <div className="flex items-center gap-3">
                <mode.icon className={`h-4 w-4 ${mode.color}`} />
                <div>
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="text-[10px] text-muted-foreground">{mode.desc}</p>
                </div>
              </div>
              <Switch
                checked={editingSettings[mode.key] !== "false"}
                onCheckedChange={(v) => updateSetting(mode.key, v ? "true" : "false")}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Dealer Limits */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary dark:text-accent" />
          <h4 className="font-heading font-bold text-sm">Límites por Dealer</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Máx. productos activos por dealer</Label>
            <Input
              type="number"
              min="1"
              max="500"
              value={editingSettings["max_products_per_dealer"] || "50"}
              onChange={(e) => updateSetting("max_products_per_dealer", e.target.value)}
              className="h-9 rounded-lg text-sm mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Máx. fotos por producto</Label>
            <Input
              type="number"
              min="1"
              max="20"
              value={editingSettings["max_photos_per_product"] || "10"}
              onChange={(e) => updateSetting("max_photos_per_product", e.target.value)}
              className="h-9 rounded-lg text-sm mt-1"
            />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground rounded-sm text-xs">
          {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
