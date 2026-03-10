import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Flag, CheckCircle, Eye, Trash2, Filter } from "lucide-react";

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

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterReason, setFilterReason] = useState("all");

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("auction_reports" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reporte eliminado del historial" });
      fetchAllData();
    }
  };

  const filteredReports = auctionReports
    .filter(r => (filterStatus === "all" ? true : r.status === filterStatus))
    .filter(r => (filterReason === "all" ? true : r.reason === filterReason))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><Flag className="h-5 w-5 text-destructive" /> Reportes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {auctionReports.filter(r => r.status === "pending").length} pendientes · {auctionReports.filter(r => r.status === "reviewed").length} revisados
          </p>
        </div>
        <Badge variant="outline">{filteredReports.length} reportes</Badge>
      </div>

      <Card className="border border-border rounded-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px] h-9 text-xs rounded-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="reviewed">Revisados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterReason} onValueChange={setFilterReason}>
              <SelectTrigger className="w-[180px] h-9 text-xs rounded-sm">
                <SelectValue placeholder="Motivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los motivos</SelectItem>
                {Object.entries(reasonLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredReports.length === 0 ? (
        <Card className="border border-border rounded-sm"><CardContent className="p-8 text-center text-muted-foreground dark:text-gray-300 text-sm">No hay reportes que coincidan con los filtros.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report: any) => (
            <Card key={report.id} className={`border rounded-sm ${report.status === "pending" ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  {report.auction_image && (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-md overflow-hidden bg-secondary border border-border">
                      <img src={report.auction_image} alt="Miniatura" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={report.status === "pending" ? "destructive" : "default"} className="text-[10px]">{report.status === "pending" ? "Pendiente" : "Revisado"}</Badge>
                      <Badge variant="outline" className="text-[10px]">{reasonLabels[report.reason] || report.reason}</Badge>
                    </div>
                    <p className="text-sm font-medium">Subasta: <a href={`/auction/${report.auction_id}`} className="text-primary dark:text-accent hover:underline">{report.auction_title}</a></p>
                    <p className="text-xs text-muted-foreground">Reportado por: <strong>{report.reporter_name}</strong> · {new Date(report.created_at).toLocaleString("es-VE")}</p>
                    {report.details && <p className="text-xs text-muted-foreground dark:text-gray-300 bg-secondary/50 p-2 rounded-sm mt-1">{report.details}</p>}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0 min-w-[100px]">
                    {report.status === "pending" && (
                      <Button size="sm" variant="outline" className="text-xs rounded-sm h-7" onClick={async () => {
                        await supabase.from("auction_reports" as any).update({ status: "reviewed", reviewed_by: user!.id, reviewed_at: new Date().toISOString() } as any).eq("id", report.id);
                        toast({ title: "Reporte marcado como revisado" }); fetchAllData();
                      }}><CheckCircle className="h-3.5 w-3.5 mr-1" />Revisar</Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs rounded-sm h-7" onClick={() => navigate(`/auction/${report.auction_id}`)}><Eye className="h-3.5 w-3.5 mr-1" />Ver</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="text-xs rounded-sm h-7 text-destructive hover:bg-destructive/10 border-destructive/20"><Trash2 className="h-3.5 w-3.5 mr-1" />Borrar</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Borrar reporte del historial?</AlertDialogTitle>
                          <AlertDialogDescription>Esta acción no puede deshacerse. Asegúrate de que este reporte ya fue gestionado.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" onClick={() => handleDelete(report.id)}>Borrar Reporte</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
