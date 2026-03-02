import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, CheckCircle, Eye } from "lucide-react";

interface Props {
  auctionReports: any[];
  fetchAllData: () => Promise<void>;
}

const AdminReportsTab = ({ auctionReports, fetchAllData }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const reasonLabels: Record<string, string> = {
    contact_info: "Datos de contacto", misleading_images: "Imágenes engañosas", prohibited_item: "Producto prohibido",
    external_deal: "Trato fuera de plataforma", fake_description: "Descripción falsa", other: "Otro motivo",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" /> Reportes</h1>
      {auctionReports.length === 0 ? (
        <Card className="border border-border rounded-sm"><CardContent className="p-8 text-center text-muted-foreground dark:text-gray-300 text-sm">No hay reportes.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {auctionReports.map((report: any) => (
            <Card key={report.id} className={`border rounded-sm ${report.status === "pending" ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={report.status === "pending" ? "destructive" : "default"} className="text-[10px]">{report.status === "pending" ? "Pendiente" : "Revisado"}</Badge>
                      <Badge variant="outline" className="text-[10px]">{reasonLabels[report.reason] || report.reason}</Badge>
                    </div>
                    <p className="text-sm font-medium">Subasta: <a href={`/auction/${report.auction_id}`} className="text-primary dark:text-accent hover:underline">{report.auction_title}</a></p>
                    <p className="text-xs text-muted-foreground">Reportado por: <strong>{report.reporter_name}</strong></p>
                    {report.details && <p className="text-xs text-muted-foreground dark:text-gray-300 bg-secondary/50 p-2 rounded-sm mt-1">{report.details}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {report.status === "pending" && (
                      <Button size="sm" variant="outline" className="text-xs rounded-sm h-7" onClick={async () => {
                        await supabase.from("auction_reports" as any).update({ status: "reviewed", reviewed_by: user!.id, reviewed_at: new Date().toISOString() } as any).eq("id", report.id);
                        toast({ title: "Reporte marcado como revisado" }); fetchAllData();
                      }}><CheckCircle className="h-3.5 w-3.5 mr-1" />Revisado</Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs rounded-sm h-7" onClick={() => navigate(`/auction/${report.auction_id}`)}><Eye className="h-3.5 w-3.5 mr-1" />Ver</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReportsTab;
