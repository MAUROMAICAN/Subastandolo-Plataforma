import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import type { AuctionExtended } from "./types";

interface Props {
  auctions: AuctionExtended[];
  fetchAllData: () => Promise<void>;
}

const AdminReviewTab = ({ auctions, fetchAllData }: Props) => {
  const { toast } = useToast();
  const [processingAuction, setProcessingAuction] = useState<string | null>(null);
  const [reviewEndTime, setReviewEndTime] = useState<Record<string, string>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const pendingAuctions = auctions.filter(a => a.status === "pending" || a.status === "in_review");

  const handleAuctionReview = async (auctionId: string, action: "in_review" | "approved" | "rejected") => {
    setProcessingAuction(auctionId);
    const updateData: any = { status: action };
    if (action === "approved") {
      const auction = auctions.find(a => a.id === auctionId);
      const durationHours = parseInt(reviewEndTime[auctionId] || String((auction as any)?.requested_duration_hours || "24")) || 24;
      // El tiempo SIEMPRE empieza desde el momento de aprobación
      updateData.end_time = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      updateData.start_time = new Date().toISOString();
      updateData.status = "active";
      updateData.requested_duration_hours = durationHours;
      updateData.status = "active";
      updateData.requested_duration_hours = durationHours;
    }
    if (reviewNotes[auctionId]) updateData.admin_notes = reviewNotes[auctionId];
    const { error } = await supabase.from("auctions").update(updateData).eq("id", auctionId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: action === "rejected" ? "❌ Rechazada" : action === "in_review" ? "👁️ En revisión" : "✅ Aprobada" });
      try {
        await supabase.functions.invoke("notify-auction-status", {
          body: { auction_id: auctionId, action, reason: reviewNotes[auctionId] || "" },
        });
        toast({ title: "📧 Notificación enviada al dealer" });
      } catch (e) {
        console.error("Error sending auction status notification:", e);
      }
      fetchAllData();
    }
    setProcessingAuction(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Eye className="h-5 w-5 text-primary dark:text-accent" /> Revisión de Subastas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{pendingAuctions.length} subastas pendientes de moderación</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">{pendingAuctions.filter(a => a.status === "pending").length} pendientes</Badge>
          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">{pendingAuctions.filter(a => a.status === "in_review").length} en revisión</Badge>
        </div>
      </div>
      {pendingAuctions.length === 0 ? (
        <Card className="border border-border rounded-sm"><CardContent className="p-12 text-center"><Eye className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" /><p className="text-sm font-medium text-muted-foreground">No hay subastas pendientes</p><p className="text-xs text-muted-foreground/70 mt-1">Todas las subastas han sido revisadas</p></CardContent></Card>
      ) : pendingAuctions.map(auction => (
        <Card key={auction.id} className="border border-border rounded-sm hover:border-primary/30 transition-all">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="font-medium text-sm">{auction.title}</h4>
                <p className="text-xs text-muted-foreground">Dealer: <strong>{auction.dealer_name}</strong> · Precio: ${auction.starting_price.toLocaleString("es-MX")}</p>
                {(auction as any).requested_duration_hours && (
                  <p className="text-xs text-primary dark:text-accent mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Duración solicitada: <strong>{(auction as any).requested_duration_hours}h ({((auction as any).requested_duration_hours / 24).toFixed(1)} días)</strong>
                  </p>
                )}
                {auction.description && <p className="text-xs text-muted-foreground dark:text-gray-300 mt-2 bg-secondary/30 p-2 rounded-sm">{auction.description}</p>}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{auction.status === "pending" ? "Pendiente" : "En Revisión"}</Badge>
            </div>
            {auction.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {auction.images.map((img) => <img key={img.id} src={img.image_url} className="w-24 h-24 rounded-sm object-cover shrink-0 border border-border" alt="" />)}
              </div>
            )}
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <Label className="text-xs">Duración de la subasta (horas) *</Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <select
                    value={reviewEndTime[auction.id] || String((auction as any).requested_duration_hours || "24")}
                    onChange={(e) => setReviewEndTime(p => ({ ...p, [auction.id]: e.target.value }))}
                    className="flex h-10 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="1">1 hora</option>
                    <option value="2">2 horas</option>
                    <option value="3">3 horas</option>
                    <option value="4">4 horas</option>
                    <option value="5">5 horas</option>
                    <option value="6">6 horas</option>
                    <option value="12">12 horas</option>
                    <option value="24">1 día (24h)</option>
                    <option value="48">2 días (48h)</option>
                    <option value="72">3 días (72h)</option>
                    <option value="96">4 días (96h)</option>
                    <option value="120">5 días (120h)</option>
                    <option value="144">6 días (144h)</option>
                  </select>
                </div>
                {(auction as any).requested_duration_hours && reviewEndTime[auction.id] && reviewEndTime[auction.id] !== String((auction as any).requested_duration_hours) && (
                  <p className="text-[10px] text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Diferente a lo solicitado por el dealer ({(auction as any).requested_duration_hours}h)
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notas (opcional)</Label>
                <Textarea value={reviewNotes[auction.id] || ""} onChange={(e) => setReviewNotes(p => ({ ...p, [auction.id]: e.target.value }))} rows={2} className="rounded-sm" maxLength={500} />
              </div>
              <div className="flex gap-2">
                {auction.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => handleAuctionReview(auction.id, "in_review")} disabled={processingAuction === auction.id} className="text-xs h-7 rounded-sm">
                    <Eye className="h-3 w-3 mr-1" /> En Revisión
                  </Button>
                )}
                <Button size="sm" onClick={() => handleAuctionReview(auction.id, "approved")} disabled={processingAuction === auction.id} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm text-xs h-7">
                  <CheckCircle className="h-3 w-3 mr-1" /> Aprobar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAuctionReview(auction.id, "rejected")} disabled={processingAuction === auction.id} className="text-destructive border-destructive/30 rounded-sm text-xs h-7">
                  <XCircle className="h-3 w-3 mr-1" /> Rechazar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminReviewTab;
