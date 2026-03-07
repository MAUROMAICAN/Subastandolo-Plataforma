import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TrendingUp, Users, DollarSign, Shield, CreditCard, BarChart3, Save, Loader2,
  Eye, ShieldAlert, MessageCircle, ArrowRight, Gavel, AlertTriangle, CheckCircle2, Banknote
} from "lucide-react";
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
  pendingPayments?: number;
  openDisputes?: number;
  unreadMessages?: number;
}

const AdminDashboardTab = ({ auctions, allUsers, editingSettings, setEditingSettings, savingSettings, handleSaveSettings, setActiveTab, pendingPayments = 0, openDisputes = 0, unreadMessages = 0 }: Props) => {
  const navigate = useNavigate();

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

  // Quick actions that need attention
  const quickActions = [
    pendingAuctions.length > 0 && { label: `${pendingAuctions.length} subastas pendientes de revisión`, icon: Eye, tab: "review" as AdminTab, color: "text-amber-500", bgColor: "bg-amber-500/10 border-amber-500/20" },
    pendingPayments > 0 && { label: `${pendingPayments} pagos por verificar`, icon: CreditCard, tab: "payments" as AdminTab, color: "text-blue-500", bgColor: "bg-blue-500/10 border-blue-500/20" },
    openDisputes > 0 && { label: `${openDisputes} disputas abiertas`, icon: ShieldAlert, tab: "disputes" as AdminTab, color: "text-red-500", bgColor: "bg-red-500/10 border-red-500/20" },
    unreadMessages > 0 && { label: `${unreadMessages} mensajes sin leer`, icon: MessageCircle, tab: "messages" as AdminTab, color: "text-purple-500", bgColor: "bg-purple-500/10 border-purple-500/20" },
  ].filter(Boolean) as { label: string; icon: any; tab: AdminTab; color: string; bgColor: string }[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Resumen general de la plataforma</p>
        </div>
        <Badge variant="outline" className="text-[10px] px-2 py-1">
          {new Date().toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}
        </Badge>
      </div>

      {/* Quick Actions Panel */}
      {quickActions.length > 0 && (
        <Card className="border border-amber-500/30 rounded-sm bg-amber-500/5">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Requiere tu atención
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickActions.map((action, i) => (
                <button key={i} onClick={() => setActiveTab(action.tab)}
                  className={`flex items-center gap-3 p-2.5 rounded-md border ${action.bgColor} hover:opacity-80 transition-all text-left w-full`}>
                  <action.icon className={`h-4 w-4 ${action.color} shrink-0`} />
                  <span className="text-xs font-medium flex-1">{action.label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ingresos Totales", value: `$${totalRevenue.toLocaleString("es-MX")}`, sub: `${completedSales.length} ventas`, icon: DollarSign, gradient: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-500", tab: "won" as AdminTab },
          { label: "Subastas Activas", value: activeAuctions.length.toString(), sub: `${auctions.length} total`, icon: Gavel, gradient: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-500", tab: "auctions" as AdminTab },
          { label: "Usuarios", value: allUsers.length.toString(), sub: `${dealers.length} dealers`, icon: Users, gradient: "from-purple-500/20 to-purple-500/5", iconColor: "text-purple-500", tab: "users" as AdminTab },
          { label: "Total Pujas", value: totalBids.toLocaleString(), sub: `${(totalBids / Math.max(auctions.length, 1)).toFixed(1)} por subasta`, icon: TrendingUp, gradient: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-500", tab: "auctions" as AdminTab },
        ].map((kpi, i) => (
          <Card key={i} className="border border-border rounded-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group" onClick={() => setActiveTab(kpi.tab)}>
            <CardContent className={`p-4 bg-gradient-to-br ${kpi.gradient} rounded-sm`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg bg-background/80 flex items-center justify-center shadow-sm`}>
                  <kpi.icon className={`h-4.5 w-4.5 ${kpi.iconColor}`} />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-heading font-bold tracking-tight">{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{kpi.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Treasury */}
      <Card className="border border-primary/30 dark:border-accent/30 rounded-sm bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary dark:text-accent" /> Tesorería
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-sm p-4 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wider flex items-center gap-1">
                <Shield className="h-3 w-3" /> Balance en Escrow
              </p>
              <p className="text-2xl font-heading font-bold text-foreground">${totalEscrow.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{escrowAuctions.length} subastas con fondos retenidos</p>
            </div>
            <div className="bg-card border border-border rounded-sm p-4 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Comisiones Acumuladas
              </p>
              <p className="text-2xl font-heading font-bold text-primary dark:text-accent">${totalCommissions.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{commissionPct}% sobre {completedSales.length} ventas</p>
            </div>
            <div className="bg-card border border-border rounded-sm p-4 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> Pendiente a Dealers
              </p>
              <p className="text-2xl font-heading font-bold text-foreground">${pendingDealerPayout.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-muted-foreground">{releasedAuctions.length} ventas con fondos liberados</p>
            </div>
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/dealer-payments")} className="rounded-sm text-xs h-8 gap-1.5 border-primary/30 dark:border-accent/30 text-primary dark:text-accent hover:bg-primary/5">
              <DollarSign className="h-3.5 w-3.5" /> Ver Panel de Pagos a Dealers →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Finance Settings */}
      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary dark:text-accent" /> Tasa & Comisiones
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-sm p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Tasa BCV (Bs/$)
              </p>
              <div className="flex items-center gap-3">
                <Input type="number" step="0.01" value={editingSettings["bcv_rate"] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, bcv_rate: e.target.value }))} className="rounded-sm text-lg font-bold max-w-[160px]" placeholder="Ej: 72.50" />
                <span className="text-sm text-muted-foreground font-medium">Bs/$</span>
              </div>
              {editingSettings["bcv_rate"] && (
                <p className="text-[10px] text-muted-foreground">
                  $100 = <strong className="text-foreground">Bs. {(100 * parseFloat(editingSettings["bcv_rate"] || "0")).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</strong>
                </p>
              )}
            </div>
            <div className="bg-card border border-border rounded-sm p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Comisión (%)
              </p>
              <div className="flex items-center gap-3">
                <Input type="number" step="0.5" min="0" max="50" value={editingSettings["commission_percentage"] || ""} onChange={(e) => setEditingSettings(p => ({ ...p, commission_percentage: e.target.value }))} className="rounded-sm text-lg font-bold max-w-[160px]" placeholder="Ej: 10" />
                <span className="text-sm text-muted-foreground font-medium">%</span>
              </div>
              {editingSettings["commission_percentage"] && (
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                  <span>$100 → Comisión: <strong className="text-primary dark:text-accent">${(100 * parseFloat(editingSettings["commission_percentage"] || "0") / 100).toFixed(2)}</strong></span>
                  <span>Dealer: <strong className="text-foreground">${(100 - 100 * parseFloat(editingSettings["commission_percentage"] || "0") / 100).toFixed(2)}</strong></span>
                </div>
              )}
            </div>
          </div>
          <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-primary text-primary-foreground rounded-sm text-xs">
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Guardar Cambios
          </Button>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border border-border rounded-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-heading">Actividad Reciente</CardTitle>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => setActiveTab("auctions")}>Ver todo →</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {auctions.slice(0, 6).map(a => (
              <div key={a.id} className="flex items-center gap-3 text-xs p-2.5 hover:bg-secondary/30 rounded-sm cursor-pointer transition-colors group" onClick={() => navigate(`/auction/${a.id}`)}>
                {a.image_url && (
                  <img src={a.image_url} alt={a.title} className="w-8 h-8 rounded-sm object-cover border border-border shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary dark:group-hover:text-accent transition-colors">{a.title}</p>
                  <p className="text-muted-foreground text-[10px]">{a.dealer_name} · {a.bids_count} pujas · ${a.current_price.toLocaleString("es-MX")}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] shrink-0 ${a.status === "active" ? "text-emerald-500 border-emerald-500/30" :
                  a.status === "finalized" ? "text-blue-500 border-blue-500/30" :
                    a.status === "pending" ? "text-amber-500 border-amber-500/30" :
                      ""
                  }`}>{a.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardTab;
