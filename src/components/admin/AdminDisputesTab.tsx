import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShieldAlert, CheckCircle } from "lucide-react";

interface Props {
  adminDisputes: any[];
  fetchAllData: () => Promise<void>;
}

const AdminDisputesTab = ({ adminDisputes, fetchAllData }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAdminDispute, setSelectedAdminDispute] = useState<string | null>(null);
  const [disputeResolution, setDisputeResolution] = useState("");

  const handleResolveDispute = async (disputeId: string, status: string) => {
    if (!disputeResolution.trim() && status !== "refunded") {
      toast({ title: "Escribe una resolución", variant: "destructive" }); return;
    }
    await supabase.from("disputes").update({
      status, resolution: disputeResolution || `Caso ${status === "refunded" ? "reembolsado" : "resuelto"} por administrador`,
      resolved_by: user!.id, resolved_at: new Date().toISOString(),
    }).eq("id", disputeId);
    await supabase.from("dispute_messages").insert({
      dispute_id: disputeId, sender_id: user!.id,
      content: `⚖️ Resolución del administrador: ${disputeResolution || status}`, is_system: true,
    });
    supabase.functions.invoke("notify-dispute-resolution", { body: { dispute_id: disputeId } }).catch(err => console.error("Error sending resolution email:", err));
    if (status === "refunded") {
      const dispute = adminDisputes.find((d: any) => d.id === disputeId);
      if (dispute) {
        const lostCount = adminDisputes.filter((d: any) =>
          d.dealer_id === dispute.dealer_id && d.status === "refunded" && d.resolved_at &&
          new Date(d.resolved_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
        ).length + 1;
        if (lostCount >= 3) {
          toast({ title: "🚨 Dealer suspendido", description: `${dispute.dealer_name} acumuló ${lostCount} disputas perdidas en 30 días.`, variant: "destructive" });
        }
      }
    }
    toast({ title: status === "refunded" ? "💰 Reembolso aplicado" : "✅ Disputa resuelta" });
    setSelectedAdminDispute(null); setDisputeResolution(""); fetchAllData();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" /> Disputas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {adminDisputes.filter(d => d.status === "open").length} abiertas · {adminDisputes.filter(d => d.status === "mediation").length} en mediación · {adminDisputes.filter(d => d.status === "resolved").length} resueltas · {adminDisputes.filter(d => d.status === "refunded").length} reembolsadas
        </p>
      </div>
      {adminDisputes.length === 0 ? (
        <Card className="border border-border rounded-sm"><CardContent className="p-8 text-center text-muted-foreground"><CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary dark:text-accent" />Sin disputas abiertas</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {adminDisputes.map((d: any) => (
            <Card key={d.id} className={`border rounded-sm ${d.admin_requested ? "border-destructive/30" : "border-border"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-heading font-bold text-sm truncate">{d.auction_title}</h3>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${d.status === "open" ? "bg-amber-500/10 text-amber-600" : d.status === "mediation" ? "bg-primary/10 text-primary dark:text-accent" : d.status === "resolved" ? "bg-primary/10 text-primary dark:text-accent" : "bg-destructive/10 text-destructive"}`}>
                        {d.status === "open" ? "Abierta" : d.status === "mediation" ? "En Mediación" : d.status === "resolved" ? "Resuelta" : "Reembolsada"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">🛒 <strong>{d.buyer_name}</strong> — 🏪 <strong>{d.dealer_name}</strong></p>
                    <p className="text-xs text-muted-foreground dark:text-gray-300 mt-1">{d.description}</p>
                  </div>
                </div>
                {selectedAdminDispute === d.id ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <Label className="text-xs">Resolución</Label>
                    <Textarea value={disputeResolution} onChange={e => setDisputeResolution(e.target.value)} placeholder="Describe la decisión..." rows={3} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleResolveDispute(d.id, "resolved")} className="flex-1"><CheckCircle className="h-3 w-3 mr-1" /> Resolver</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleResolveDispute(d.id, "refunded")} className="flex-1">💰 Reembolsar</Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedAdminDispute(null); setDisputeResolution(""); }}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    {(d.status === "open" || d.status === "mediation") && <Button size="sm" variant="outline" onClick={() => setSelectedAdminDispute(d.id)}>⚖️ Resolver</Button>}
                    {d.resolution && <p className="text-xs text-primary dark:text-accent flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {d.resolution}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDisputesTab;
