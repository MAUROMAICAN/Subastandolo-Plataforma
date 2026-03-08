import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Eye, CheckCircle, XCircle, AlertTriangle, Mail, FileText, Settings,
  Users, ShieldCheck, Clock, UserCheck
} from "lucide-react";
import { DEALER_TIERS } from "@/components/VerifiedBadge";

interface Props {
  dealerApps: any[];
  fetchAllData: () => Promise<void>;
}

const REJECTION_REASONS = [
  "Documento borroso o ilegible",
  "Selfie sin el documento de identidad",
  "Recibo de domicilio vencido (más de 3 meses)",
  "Datos no coinciden entre documentos",
  "Foto de copia, no documento original",
  "Rostro no visible (gorra, lentes, sombras)",
  "Documento de identidad vencido",
];

const AdminDealersTab = ({ dealerApps, fetchAllData }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [processingApp, setProcessingApp] = useState<string | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<any | null>(null);
  const [dealerDocUrls, setDealerDocUrls] = useState<Record<string, string>>({});
  const [rejectionDialogApp, setRejectionDialogApp] = useState<{ appId: string; userId: string } | null>(null);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState("");
  const [customRejectionNote, setCustomRejectionNote] = useState("");

  // Extra dealers from user_roles not in dealer_verification
  const [extraDealers, setExtraDealers] = useState<any[]>([]);

  useEffect(() => {
    fetchExtraDealers();
  }, [dealerApps]);

  const fetchExtraDealers = async () => {
    // Get dealers from multiple sources
    const [rolesRes, auctionsRes, earningsRes] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "dealer"),
      supabase.from("auctions").select("created_by"),
      supabase.from("platform_earnings").select("dealer_id"),
    ]);

    // Merge all unique dealer IDs
    const allDealerIds = new Set<string>();
    ((rolesRes.data || []) as any[]).forEach((r: any) => { if (r.user_id) allDealerIds.add(r.user_id); });
    ((auctionsRes.data || []) as any[]).forEach((a: any) => { if (a.created_by) allDealerIds.add(a.created_by); });
    ((earningsRes.data || []) as any[]).forEach((e: any) => { if (e.dealer_id) allDealerIds.add(e.dealer_id); });

    // Find which ones are NOT in dealerApps (dealer_verification)
    const verifUserIds = new Set(dealerApps.map((a: any) => a.user_id));
    const missingIds = Array.from(allDealerIds).filter(id => !verifUserIds.has(id));

    if (missingIds.length === 0) { setExtraDealers([]); return; }

    // Get their profiles
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, phone").in("id", missingIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

    const extras = missingIds.map(id => {
      const p = profileMap[id];
      return {
        id: `role_${id}`,
        user_id: id,
        full_name: p?.full_name || "Dealer",
        business_name: p?.full_name || "—",
        phone: p?.phone || "—",
        avatar_url: p?.avatar_url || null,
        status: "role_only",
        created_at: new Date().toISOString(),
      };
    });
    setExtraDealers(extras);
  };

  // Merge dealer_verification apps + role-only dealers
  const allDealers = [...dealerApps, ...extraDealers];

  const stats = {
    total: allDealers.length,
    pending: dealerApps.filter((a: any) => a.status === "pending").length,
    approved: dealerApps.filter((a: any) => a.status === "approved").length,
    rejected: dealerApps.filter((a: any) => a.status === "rejected").length,
    roleOnly: extraDealers.length,
  };

  const handleDealerAction = async (appId: string, action: "approved" | "rejected", userId: string) => {
    if (action === "rejected") {
      setRejectionDialogApp({ appId, userId });
      return;
    }
    await executeDealerAction(appId, action, userId, "");
  };

  const handleConfirmRejection = async () => {
    if (!rejectionDialogApp || !selectedRejectionReason) {
      toast({ title: "Selecciona un motivo de rechazo", variant: "destructive" });
      return;
    }
    const reason = customRejectionNote ? `${selectedRejectionReason} — ${customRejectionNote}` : selectedRejectionReason;
    await executeDealerAction(rejectionDialogApp.appId, "rejected", rejectionDialogApp.userId, reason);
    setRejectionDialogApp(null);
    setSelectedRejectionReason("");
    setCustomRejectionNote("");
  };

  const executeDealerAction = async (appId: string, action: "approved" | "rejected", userId: string, reason: string) => {
    setProcessingApp(appId);
    await supabase.from("dealer_verification").update({
      status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString(), admin_notes: reason || null,
    }).eq("id", appId);
    if (action === "approved") {
      await supabase.from("user_roles").update({ role: "dealer" as any }).eq("user_id", userId);
    }
    try {
      await supabase.functions.invoke("notify-dealer-status", { body: { verification_id: appId, action, reason } });
    } catch (e) {
      console.error("Error sending notification:", e);
    }
    toast({ title: action === "approved" ? "✅ Dealer aprobado" : "❌ Rechazado y notificado por email" });
    setProcessingApp(null);
    fetchAllData();
  };

  const getStatusBadge = (status: string) => {
    if (status === "approved") return { label: "Verificado", color: "bg-primary/15 text-primary dark:text-accent", icon: "✓" };
    if (status === "rejected") return { label: "Rechazado", color: "bg-destructive/15 text-destructive", icon: "✗" };
    if (status === "role_only") return { label: "Activo (sin KYC)", color: "bg-warning/15 text-warning", icon: "⚡" };
    return { label: "Pendiente", color: "bg-warning/20 text-warning", icon: "⏳" };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Eye className="h-5 w-5 text-primary dark:text-accent" /> Gestión de Dealers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.pending} pendientes · {stats.approved} verificados · {stats.roleOnly} activos sin KYC · {stats.rejected} rechazados
          </p>
        </div>
        <Badge variant="outline" className="text-xs">{stats.total} dealers</Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Dealers", value: stats.total, icon: Users, color: "text-primary dark:text-accent" },
          { label: "Verificados", value: stats.approved, icon: ShieldCheck, color: "text-primary dark:text-accent" },
          { label: "Pendientes KYC", value: stats.pending, icon: Clock, color: "text-warning" },
          { label: "Activos sin KYC", value: stats.roleOnly, icon: UserCheck, color: "text-muted-foreground" },
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

      <Card className="border border-border rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3">Dealer</th>
                <th className="text-left font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3 hidden sm:table-cell">Teléfono</th>
                <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3">Estado</th>
                <th className="text-center font-semibold text-muted-foreground dark:text-gray-300 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allDealers.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">No hay dealers registrados</td>
                </tr>
              )}
              {allDealers.map((app: any) => {
                const badge = getStatusBadge(app.status);
                return (
                  <tr key={app.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {app.avatar_url && <AvatarImage src={app.avatar_url} alt={app.full_name} className="object-cover" />}
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary dark:text-accent">
                            {(app.full_name || app.business_name || "D").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{app.full_name || app.business_name}</p>
                          <p className="text-muted-foreground text-[10px]">{app.business_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">{app.phone}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`text-[10px] border-0 ${badge.color}`}>
                        {badge.icon} {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {app.status !== "role_only" && (
                          <Button size="sm" variant="outline" className="text-[10px] h-7 px-2 rounded-sm" onClick={async () => {
                            setSelectedDealer(app);
                            const docs = [{ key: "selfie", path: app.selfie_url }, { key: "cedula_front", path: app.cedula_front_url }, { key: "cedula_back", path: app.cedula_back_url }, { key: "address_proof", path: app.address_proof_url }].filter(d => d.path);
                            const urls: Record<string, string> = {};
                            await Promise.all(docs.map(async (doc) => { const { data } = await supabase.storage.from("dealer-documents").createSignedUrl(doc.path, 600); if (data?.signedUrl) urls[doc.key] = data.signedUrl; }));
                            setDealerDocUrls(urls);
                          }}><Eye className="h-3 w-3 mr-1" />Ver</Button>
                        )}
                        {app.status === "pending" && (
                          <>
                            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-[10px] h-7 px-2" onClick={() => handleDealerAction(app.id, "approved", app.user_id)} disabled={processingApp === app.id}><CheckCircle className="h-3 w-3" /></Button>
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 rounded-sm text-[10px] h-7 px-2" onClick={() => handleDealerAction(app.id, "rejected", app.user_id)} disabled={processingApp === app.id}><XCircle className="h-3 w-3" /></Button>
                          </>
                        )}
                        {app.status === "role_only" && (
                          <Badge variant="outline" className="text-[9px]">Solo rol</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {rejectionDialogApp && (
        <Card className="border border-destructive/30 rounded-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Selecciona el motivo del rechazo</p>
            <Select value={selectedRejectionReason} onValueChange={setSelectedRejectionReason}>
              <SelectTrigger className="h-8 text-xs rounded-sm"><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
              <SelectContent>{REJECTION_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Nota adicional (opcional)..." value={customRejectionNote} onChange={e => setCustomRejectionNote(e.target.value)} className="text-xs min-h-[50px] rounded-sm" maxLength={300} />
            <div className="flex gap-2">
              <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-sm text-xs h-7" onClick={handleConfirmRejection} disabled={!selectedRejectionReason || processingApp === rejectionDialogApp.appId}><Mail className="h-3 w-3 mr-1" />Rechazar y Notificar</Button>
              <Button size="sm" variant="ghost" className="rounded-sm text-xs h-7" onClick={() => { setRejectionDialogApp(null); setSelectedRejectionReason(""); setCustomRejectionNote(""); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={!!selectedDealer} onOpenChange={(open) => { if (!open) { setSelectedDealer(null); setDealerDocUrls({}); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedDealer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 font-heading">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary dark:text-accent font-bold">{(selectedDealer.full_name || selectedDealer.business_name || "D").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div><p className="text-base">{selectedDealer.full_name || selectedDealer.business_name}</p><p className="text-xs text-muted-foreground dark:text-gray-300 font-normal">{selectedDealer.business_name}</p></div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-md p-3"><p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wider mb-1">Teléfono</p><p className="text-sm font-medium">{selectedDealer.phone}</p></div>
                  <div className="bg-secondary/30 rounded-md p-3"><p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wider mb-1">Cédula</p><p className="text-sm font-medium">{selectedDealer.cedula_number || "No registrada"}</p></div>
                  <div className="bg-secondary/30 rounded-md p-3"><p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wider mb-1">Fecha</p><p className="text-sm font-medium">{new Date(selectedDealer.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })}</p></div>
                  <div className="bg-secondary/30 rounded-md p-3"><p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wider mb-1">Estado</p>
                    <Badge className={`text-[10px] border-0 ${getStatusBadge(selectedDealer.status).color}`}>
                      {getStatusBadge(selectedDealer.status).icon} {getStatusBadge(selectedDealer.status).label}
                    </Badge>
                  </div>
                </div>
                {selectedDealer.status !== "role_only" && (
                  <div>
                    <h3 className="text-sm font-heading font-bold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary dark:text-accent" /> Documentos KYC</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ key: "selfie", label: "📸 Selfie" }, { key: "cedula_front", label: "🪪 Cédula (Frontal)" }, { key: "cedula_back", label: "🪪 Cédula (Reverso)" }, { key: "address_proof", label: "🏠 Comprobante" }].map(doc => (
                        <div key={doc.key} className="border border-border rounded-md overflow-hidden">
                          <div className="bg-secondary/30 px-3 py-2"><p className="text-[11px] font-semibold">{doc.label}</p></div>
                          <div className="p-2 min-h-[140px] flex items-center justify-center bg-muted/30">
                            {dealerDocUrls[doc.key] ? <img src={dealerDocUrls[doc.key]} alt={doc.label} className="max-h-[200px] w-full object-contain rounded-sm cursor-pointer" onClick={() => window.open(dealerDocUrls[doc.key], "_blank")} /> : <p className="text-xs text-muted-foreground">No proporcionado</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDealer.status === "pending" && (
                  <div className="flex gap-2 border-t border-border pt-4">
                    <Button size="sm" onClick={() => { handleDealerAction(selectedDealer.id, "approved", selectedDealer.user_id); setSelectedDealer(null); }} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-xs h-8 flex-1"><CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprobar</Button>
                    <Button size="sm" variant="outline" onClick={() => { handleDealerAction(selectedDealer.id, "rejected", selectedDealer.user_id); setSelectedDealer(null); }} className="text-destructive border-destructive/30 rounded-sm text-xs h-8 flex-1"><XCircle className="h-3.5 w-3.5 mr-1" /> Rechazar</Button>
                  </div>
                )}
                {selectedDealer.status === "approved" && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <p className="text-xs font-heading font-bold flex items-center gap-1.5"><Settings className="h-3.5 w-3.5 text-primary dark:text-accent" /> Controles</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nivel Manual</Label>
                        <Select value={(selectedDealer.manual_tier) || "auto"} onValueChange={async (value) => {
                          const newTier = value === "auto" ? null : value;
                          await supabase.from("dealer_verification").update({ manual_tier: newTier, status_changed_at: new Date().toISOString(), status_changed_by: user!.id } as any).eq("id", selectedDealer.id);
                          toast({ title: newTier ? `Nivel cambiado` : "Nivel automático restaurado" }); fetchAllData(); setSelectedDealer(null);
                        }}>
                          <SelectTrigger className="h-8 text-xs rounded-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">🔄 Automático</SelectItem>
                            {[...DEALER_TIERS].reverse().map((tier: any) => <SelectItem key={tier.key} value={tier.key}>{tier.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Estado de Cuenta</Label>
                        <Select value={(selectedDealer.account_status) || "active"} onValueChange={async (value) => {
                          let reason = "";
                          if (value !== "active") { reason = prompt("Motivo:") || ""; if (!reason) { toast({ title: "Debes indicar un motivo", variant: "destructive" }); return; } }
                          await supabase.from("dealer_verification").update({ account_status: value, status_reason: reason || null, status_changed_at: new Date().toISOString(), status_changed_by: user!.id } as any).eq("id", selectedDealer.id);
                          toast({ title: "Estado actualizado" }); fetchAllData(); setSelectedDealer(null);
                        }}>
                          <SelectTrigger className="h-8 text-xs rounded-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">✅ Activo</SelectItem>
                            <SelectItem value="paused">⏸ Pausado</SelectItem>
                            <SelectItem value="under_review">🔍 En revisión</SelectItem>
                            <SelectItem value="banned">🚫 Suspendido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDealersTab;
