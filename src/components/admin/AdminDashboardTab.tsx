import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, TrendingUp, Clock, Users, DollarSign, Shield, CreditCard, BarChart3, Save, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AdminTab, AuctionExtended, DealerUser } from "./types";

interface Props {
  auctions: AuctionExtended[];
  allUsers: DealerUser[];
  editingSettings: Record<string, string>;
  setEditingSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savingSettings: boolean;
  handleSaveSettings: () => Promise<void>;
  setActiveTab: (tab: AdminTab) => void;
}

const AdminDashboardTab = ({ auctions, allUsers, editingSettings, setEditingSettings, savingSettings, handleSaveSettings, setActiveTab }: Props) => {
  const navigate = useNavigate();

  const now = new Date().toISOString();
  const pendingAuctions = auctions.filter(a => a.status === "pending" || a.status === "in_review");
  const activeAuctions = auctions.filter(a => ["active", "paused"].includes(a.status) && new Date(a.end_time) > new Date());
  const totalBids = auctions.reduce((s, a) => s + (a.bids_count || 0), 0);
  const totalRevenue = auctions.filter(a => a.winner_id).reduce((s, a) => s + a.current_price, 0);
  const commissionPct = parseFloat(editingSettings["commission_percentage"] || "0");
  const dealers = allUsers.filter(u => u.role === "dealer");

  const escrowAuctions = auctions.filter(a => a.payment_status === "escrow" || (a.payment_status === "verified" && !a.funds_released_at));
  const totalEscrow = escrowAuctions.reduce((s, a) => s + a.current_price, 0);
  const completedSales = auctions.filter(a => a.winner_id && (a.payment_status === "verified" || a.payment_status === "escrow" || a.funds_released_at));
  const totalCompletedRevenue = completedSales.reduce((s, a) => s + a.current_price, 0);
  const totalCommissions = totalCompletedRevenue * commissionPct / 100;
  const releasedAuctions = auctions.filter(a => a.funds_released_at && a.payment_status !== "refunded");
  const pendingDealerPayout = releasedAuctions.reduce((s, a) => s + (a.current_price * (1 - commissionPct / 100)), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-heading font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Subastas", value: auctions.length, icon: Package, color: "text-primary", tab: "auctions" as AdminTab },
          { label: "Activas", value: activeAuctions.length, icon: TrendingUp, color: "text-primary", tab: "auctions" as AdminTab },
          { label: "Pendientes", value: pendingAuctions.length, icon: Clock, color: "text-warning", tab: "review" as AdminTab },
          { label: "Usuarios", value: allUsers.length, icon: Users, color: "text-primary", tab: "users" as AdminTab },
        ].map((m, i) => (
          <Card key={i} className="border border-border rounded-sm cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={() => setActiveTab(m.tab)}>
            <CardContent className="p-4">
              <m.icon className={`h-5 w-5 ${m.color} mb-2`} />
              <p className="text-2xl font-heading font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border border-border rounded-sm cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={() => setActiveTab("auctions")}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Ventas Totales</p>
            <p className="text-xl font-heading font-bold">${totalRevenue.toLocaleString("es-MX")}</p>
          </CardContent>
        </Card>
        <Card className="border border-border rounded-sm cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={() => setActiveTab("auctions")}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Pujas</p>
            <p className="text-xl font-heading font-bold">{totalBids}</p>
          </CardContent>
        </Card>
        <Card className="border border-border rounded-sm cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all" onClick={() => setActiveTab("dealers")}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Dealers Activos</p>
            <p className="text-xl font-heading font-bold">{dealers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tesorería */}
      <Card className="border border-primary/30 rounded-sm bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> 💰 Tesorería
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-sm p-4 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Shield className="h-3 w-3" /> Balance en Escrow
              </p>
              <p className="text-2xl font-heading font-bold text-foreground">${totalEscrow.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{escrowAuctions.length} subastas con fondos retenidos</p>
            </div>
            <div className="bg-card border border-border rounded-sm p-4 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Comisiones Acumuladas
              </p>
              <p className="text-2xl font-heading font-bold text-primary">${totalCommissions.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{commissionPct}% sobre {completedSales.length} ventas completadas</p>
            </div>
            <div className="bg-card border border-border rounded-sm p-4 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Pendiente Pago a Dealers
              </p>
              <p className="text-2xl font-heading font-bold text-foreground">${pendingDealerPayout.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{releasedAuctions.length} ventas con fondos liberados</p>
            </div>
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/dealer-payments")} className="rounded-sm text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
              <DollarSign className="h-3.5 w-3.5" /> Ver Panel de Pagos a Dealers →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Finanzas */}
      <Card className="border border-primary/30 rounded-sm bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> 💰 Finanzas — Tasa & Comisiones
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="bg-card border border-border rounded-sm p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Tasa BCV del Día (Bs/$)
            </p>
            <p className="text-[10px] text-muted-foreground">Este valor afecta todos los cálculos de conversión USD → Bs en la plataforma.</p>
            <div className="flex items-center gap-3">
              <Input type="number" step="0.01" value={editingSettings["bcv_rate"] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, bcv_rate: e.target.value }))} className="rounded-sm text-lg font-bold max-w-[200px]" placeholder="Ej: 72.50" />
              <span className="text-sm text-muted-foreground font-medium">Bs/$</span>
            </div>
            {editingSettings["bcv_rate"] && (
              <p className="text-xs text-muted-foreground">
                Ejemplo: $100 = <strong className="text-foreground">Bs. {(100 * parseFloat(editingSettings["bcv_rate"] || "0")).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong>
              </p>
            )}
          </div>
          <div className="bg-card border border-border rounded-sm p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Comisión de la Plataforma (%)
            </p>
            <p className="text-[10px] text-muted-foreground">Porcentaje que se descuenta al dealer por cada venta exitosa.</p>
            <div className="flex items-center gap-3">
              <Input type="number" step="0.5" min="0" max="50" value={editingSettings["commission_percentage"] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, commission_percentage: e.target.value }))} className="rounded-sm text-lg font-bold max-w-[200px]" placeholder="Ej: 10" />
              <span className="text-sm text-muted-foreground font-medium">%</span>
            </div>
            {editingSettings["commission_percentage"] && (
              <div className="bg-secondary/50 border border-border rounded-sm p-3 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase">Ejemplo con subasta de $100:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-muted-foreground">Comprador paga</p><p className="font-bold text-foreground">$100.00</p></div>
                  <div><p className="text-muted-foreground">Tu comisión</p><p className="font-bold text-primary">${(100 * parseFloat(editingSettings["commission_percentage"] || "0") / 100).toFixed(2)}</p></div>
                  <div><p className="text-muted-foreground">Dealer recibe</p><p className="font-bold text-foreground">${(100 - 100 * parseFloat(editingSettings["commission_percentage"] || "0") / 100).toFixed(2)}</p></div>
                </div>
              </div>
            )}
          </div>
          <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground rounded-sm text-xs">
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      {/* Recent auctions */}
      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-heading">Actividad Reciente</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {auctions.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center gap-3 text-xs p-2 hover:bg-secondary/30 rounded-sm cursor-pointer transition-colors" onClick={() => navigate(`/auction/${a.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{a.title}</p>
                  <p className="text-muted-foreground">{a.dealer_name} · {a.bids_count} pujas</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardTab;
