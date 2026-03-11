import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Image as ImageIcon, Clock, CheckCircle, Package,
  Trophy, User, AlertTriangle, Truck, Camera, Edit3, Save, Printer
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { AuctionWithImages, WinnerProfile } from "./types";

interface Props {
  auctions: AuctionWithImages[];
  winnerProfiles: Record<string, WinnerProfile>;
  shippingInfoMap: Record<string, any>;
  trackingNumber: Record<string, string>;
  setTrackingNumber: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  trackingFile: Record<string, File | null>;
  setTrackingFile: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
  trackingCompany: Record<string, string>;
  setTrackingCompany: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  submittingTracking: string | null;
  handleSubmitTracking: (auctionId: string) => Promise<void>;
  fetchMyAuctions: () => void;
}

export default function DealerShipmentsTab({
  auctions, winnerProfiles, shippingInfoMap,
  trackingNumber, setTrackingNumber, trackingFile, setTrackingFile,
  trackingCompany, setTrackingCompany, submittingTracking,
  handleSubmitTracking, fetchMyAuctions,
}: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const logoUrl = `${window.location.origin}/favicon.png`;

  const [editingShipping, setEditingShipping] = useState<string | null>(null);
  const [editShippingData, setEditShippingData] = useState<Record<string, any>>({});
  const [savingShipping, setSavingShipping] = useState(false);
  const [editingTracking, setEditingTracking] = useState<string | null>(null);
  const [editTrackingData, setEditTrackingData] = useState<Record<string, { company: string; number: string; file: File | null }>>({});
  const [savingTracking, setSavingTracking] = useState(false);

  const shippableAuctions = auctions.filter(a => {
    const isEnded = new Date(a.end_time).getTime() <= Date.now();
    return (a.status === "finalized" || (a.status === "active" && isEnded)) && a.winner_id;
  });

  const pendingShip = shippableAuctions.filter(a => (a as any).delivery_status === "ready_to_ship" && !(a as any).tracking_number);
  const awaitingPayment = shippableAuctions.filter(a => ["pending", "under_review"].includes((a as any).payment_status));
  const shipped = shippableAuctions.filter(a => (a as any).delivery_status === "shipped");
  const delivered = shippableAuctions.filter(a => (a as any).delivery_status === "delivered");

  const handleEditShipping = (auctionId: string) => {
    const s = shippingInfoMap[auctionId];
    if (!s) return;
    setEditShippingData(prev => ({ ...prev, [auctionId]: { ...s } }));
    setEditingShipping(auctionId);
  };

  const handleSaveShipping = async (auctionId: string) => {
    const data = editShippingData[auctionId];
    const original = shippingInfoMap[auctionId];
    if (!data || !user) return;
    setSavingShipping(true);
    try {
      const { error } = await supabase.from("shipping_info").update({
        full_name: data.full_name, cedula: data.cedula, shipping_company: data.shipping_company,
        office_name: data.office_name, city: data.city, state: data.state,
      }).eq("id", data.id);
      if (error) throw error;

      const fields = ["full_name", "cedula", "shipping_company", "office_name", "city", "state"];
      const labels: Record<string, string> = { full_name: "Nombre", cedula: "Cédula", shipping_company: "Empresa", office_name: "Oficina", city: "Ciudad", state: "Estado" };
      const auditEntries = fields.filter(f => original[f] !== data[f]).map(f => ({
        auction_id: auctionId, changed_by: user.id, change_type: "shipping_info_updated",
        field_name: labels[f] || f, old_value: original[f] || "", new_value: data[f] || "",
      }));
      if (auditEntries.length > 0) await supabase.from("shipping_audit_log").insert(auditEntries as any);

      toast({ title: "✅ Datos de envío actualizados" });
      setEditingShipping(null);
      fetchMyAuctions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSavingShipping(false);
  };

  const handleEditTracking = (auctionId: string, auction: any) => {
    setEditTrackingData(prev => ({
      ...prev,
      [auctionId]: { company: trackingCompany[auctionId] || "", number: auction.tracking_number || "", file: null },
    }));
    setEditingTracking(auctionId);
  };

  const handleSaveTracking = async (auctionId: string) => {
    const data = editTrackingData[auctionId];
    if (!data || !user) return;
    if (!data.number.trim()) {
      toast({ title: "El número de guía es obligatorio", variant: "destructive" });
      return;
    }
    setSavingTracking(true);
    try {
      const auction = auctions.find(a => a.id === auctionId) as any;
      const oldNumber = auction?.tracking_number || "";
      const updateData: any = { tracking_number: data.number.trim() };

      if (data.file) {
        const ext = data.file.name.split(".").pop();
        const filePath = `${user.id}/${auctionId}-tracking-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("auction-images").upload(filePath, data.file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("auction-images").getPublicUrl(filePath);
        updateData.tracking_photo_url = urlData.publicUrl;
      }

      const { error } = await supabase.from("auctions").update(updateData).eq("id", auctionId);
      if (error) throw error;

      const auditEntries: any[] = [];
      if (oldNumber !== data.number.trim()) {
        auditEntries.push({ auction_id: auctionId, changed_by: user.id, change_type: "tracking_updated", field_name: "Número de guía", old_value: oldNumber, new_value: data.number.trim() });
      }
      if (data.file) {
        auditEntries.push({ auction_id: auctionId, changed_by: user.id, change_type: "tracking_updated", field_name: "Foto de comprobante", old_value: "Anterior", new_value: "Nueva foto subida" });
      }
      if (auditEntries.length > 0) await supabase.from("shipping_audit_log").insert(auditEntries as any);

      toast({ title: "✅ Datos de envío actualizados" });
      setEditingTracking(null);
      fetchMyAuctions();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSavingTracking(false);
  };

  const renderShipmentCard = (auction: AuctionWithImages, showForm: boolean) => {
    const winner = auction.winner_id ? winnerProfiles[auction.winner_id] : null;
    const shipping = shippingInfoMap[auction.id];
    const mainImage = auction.images[0]?.image_url || auction.image_url;
    const a = auction as any;

    return (
      <Card key={auction.id} className="border border-border rounded-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            {mainImage && <img src={mainImage} className="w-14 h-14 rounded-sm object-cover shrink-0" alt="" />}
            <div className="flex-1 min-w-0">
              <h4 className="font-heading font-bold text-sm truncate">{auction.title}</h4>
              <p className="text-xs text-muted-foreground">Precio final: <strong className="text-foreground">${auction.current_price.toLocaleString("es-MX")}</strong></p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {a.delivery_status === "ready_to_ship" && !a.tracking_number && (
                <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30 font-bold">📦 Pendiente</Badge>
              )}
              {a.delivery_status === "shipped" && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">🚚 En Camino</Badge>
              )}
              {a.delivery_status === "delivered" && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary dark:text-[#A6E300] border-primary/20">✅ Entregado</Badge>
              )}
              {["pending", "under_review"].includes(a.payment_status) && (
                <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">⏳ Esperando pago</Badge>
              )}
            </div>
          </div>

          {winner && (
            <div className="bg-secondary/30 border border-border rounded-sm p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <User className="h-3 w-3" /> Ganador / Destinatario
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                <div><span className="text-muted-foreground">Nombre:</span> <strong>{winner.full_name}</strong></div>
                {winner.phone && <div><span className="text-muted-foreground">Teléfono:</span> <strong>{winner.phone}</strong></div>}
              </div>
            </div>
          )}

          {shipping && (
            <div className="bg-primary/5 border border-primary/10 rounded-sm p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Package className="h-3 w-3" /> Datos de Envío del Comprador
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => {
                  const dealerName = profile?.full_name || "Dealer";
                  const dealerPhone = (profile as any)?.phone || "";
                  const printContent = `
                    <html><head><title>Guía de Envío - SUBASTANDOLO</title>
                    <style>
                      body{font-family:Arial,sans-serif;padding:20px;margin:0}
                      .guide{border:2px solid #000;padding:24px;max-width:480px;margin:0 auto}
                      .header{text-align:center;border-bottom:3px solid #1a365d;padding-bottom:12px;margin-bottom:16px}
                      .header img{height:40px;margin-bottom:6px}
                      .header h1{font-size:11px;color:#1a365d;text-transform:uppercase;letter-spacing:2px;margin:4px 0 0}
                      .section{margin-bottom:14px;padding:10px;border:1px solid #ddd;border-radius:4px}
                      .section-title{font-size:10px;font-weight:bold;text-transform:uppercase;color:#666;letter-spacing:1px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px}
                      .row{display:flex;margin-bottom:5px;font-size:12px}
                      .row span{color:#888;min-width:90px;font-size:11px}
                      .row strong{color:#000}
                      .product{margin-top:14px;padding-top:10px;border-top:2px dashed #ccc;font-size:11px;color:#555;text-align:center}
                      .footer{text-align:center;font-size:9px;color:#aaa;margin-top:12px}
                    </style></head><body>
                    <div class="guide">
                      <div class="header">
                        <img src="${logoUrl}" alt="SUBASTANDOLO" onerror="this.style.display='none'" />
                        <h1>Guía de Envío</h1>
                      </div>
                      <div class="section">
                        <div class="section-title">📤 Remitente (Dealer)</div>
                        <div class="row"><span>Nombre:</span><strong>${dealerName}</strong></div>
                        ${dealerPhone ? `<div class="row"><span>Teléfono:</span><strong>${dealerPhone}</strong></div>` : ""}
                      </div>
                      <div class="section">
                        <div class="section-title">📦 Destinatario</div>
                        <div class="row"><span>Nombre:</span><strong>${shipping.full_name}</strong></div>
                        <div class="row"><span>Cédula:</span><strong>${shipping.cedula}</strong></div>
                        <div class="row"><span>Teléfono:</span><strong>${shipping.phone || "No proporcionado"}</strong></div>
                        <div class="row"><span>Empresa:</span><strong>${shipping.shipping_company}</strong></div>
                        <div class="row"><span>Oficina:</span><strong>${shipping.office_name}</strong></div>
                        <div class="row"><span>Ciudad:</span><strong>${shipping.city}</strong></div>
                        <div class="row"><span>Estado:</span><strong>${shipping.state}</strong></div>
                      </div>
                      <div class="product">Producto: <strong>${auction.title}</strong></div>
                      <div class="footer">Generado por SUBASTANDOLO — subastandolo.com</div>
                    </div></body></html>`;
                  const w = window.open("", "_blank", "width=550,height=600");
                  if (w) { w.document.write(printContent); w.document.close(); w.print(); }
                }}>
                  <Printer className="h-3 w-3 mr-1" /> Imprimir
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                <div><span className="text-muted-foreground">Nombre:</span> <strong>{shipping.full_name}</strong></div>
                <div><span className="text-muted-foreground">Cédula:</span> <strong className="font-mono">{shipping.cedula}</strong></div>
                <div><span className="text-muted-foreground">Teléfono:</span> <strong>{shipping.phone || "—"}</strong></div>
                <div><span className="text-muted-foreground">Empresa:</span> <strong>{shipping.shipping_company}</strong></div>
                <div><span className="text-muted-foreground">Oficina:</span> <strong>{shipping.office_name}</strong></div>
                <div><span className="text-muted-foreground">Ciudad:</span> <strong>{shipping.city}</strong></div>
                <div><span className="text-muted-foreground">Estado:</span> <strong>{shipping.state}</strong></div>
              </div>
            </div>
          )}

          {!shipping && showForm && (
            <div className="bg-warning/5 border border-warning/20 rounded-sm p-3">
              <p className="text-xs text-warning flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> El comprador aún no ha proporcionado datos de envío.
              </p>
            </div>
          )}

          {a.dealer_ship_deadline && showForm && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-sm border ${new Date(a.dealer_ship_deadline).getTime() < Date.now()
              ? "bg-destructive/5 border-destructive/20 text-destructive"
              : "bg-secondary/30 border-border text-muted-foreground"
              }`}>
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Plazo de envío: <strong>{new Date(a.dealer_ship_deadline).toLocaleString("es-MX")}</strong></span>
              {new Date(a.dealer_ship_deadline).getTime() < Date.now() && <span className="font-bold ml-1">— VENCIDO</span>}
            </div>
          )}

          {showForm && (
            <div className="bg-card border-2 border-dashed border-primary/30 rounded-sm p-4 space-y-3">
              <p className="text-sm font-heading font-bold text-foreground flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-primary dark:text-[#A6E300]" /> Confirmar Envío
              </p>

              <div className="space-y-1">
                <Label className="text-xs">Método de Envío *</Label>
                <Select value={trackingCompany[auction.id] || ""} onValueChange={(v) => setTrackingCompany(prev => ({ ...prev, [auction.id]: v }))}>
                  <SelectTrigger className="rounded-sm text-xs h-9"><SelectValue placeholder="Selecciona el método" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrega Personal" className="text-xs">🤝 Entrega Personal</SelectItem>
                    <SelectItem value="Delivery" className="text-xs">🛵 Delivery</SelectItem>
                    {["MRW", "Zoom", "Tealca", "Domesa", "Liberty Express", "Servientrega", "DHL", "FedEx", "Otra"].map(c => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!["Entrega Personal", "Delivery"].includes(trackingCompany[auction.id] || "") && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Número de Guía *</Label>
                    <Input placeholder="Ej: 123456789" value={trackingNumber[auction.id] || ""} onChange={(e) => setTrackingNumber(prev => ({ ...prev, [auction.id]: e.target.value }))} className="rounded-sm text-xs h-9 font-mono" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Foto del Comprobante de Envío *</Label>
                    <label className="flex items-center gap-2 border-2 border-dashed border-border rounded-sm p-3 cursor-pointer hover:border-primary/50 hover:bg-secondary/20 transition-colors text-xs">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setTrackingFile(prev => ({ ...prev, [auction.id]: e.target.files?.[0] || null }))} />
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span className={trackingFile[auction.id] ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {trackingFile[auction.id] ? trackingFile[auction.id]!.name : "Tomar o subir foto del comprobante"}
                      </span>
                    </label>
                    {trackingFile[auction.id] && (
                      <div className="mt-2">
                        <img src={URL.createObjectURL(trackingFile[auction.id]!)} alt="Preview" className="h-24 rounded-sm border border-border object-cover" />
                      </div>
                    )}
                  </div>
                </>
              )}

              {["Entrega Personal", "Delivery"].includes(trackingCompany[auction.id] || "") && (
                <div className="bg-primary/5 border border-primary/20 rounded-sm p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    {trackingCompany[auction.id] === "Entrega Personal"
                      ? "🤝 Se confirmará la entrega en persona. No se requiere número de guía."
                      : "🛵 Se enviará por delivery. No se requiere número de guía."}
                  </p>
                </div>
              )}

              <Button
                onClick={() => handleSubmitTracking(auction.id)}
                disabled={submittingTracking === auction.id || !trackingCompany[auction.id] || (
                  !["Entrega Personal", "Delivery"].includes(trackingCompany[auction.id] || "") && (
                    !trackingNumber[auction.id]?.trim() || !trackingFile[auction.id]
                  )
                )}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-sm"
              >
                {submittingTracking === auction.id ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Registrando envío...</>
                ) : (
                  <><Truck className="h-4 w-4 mr-2" /> Confirmar Envío y Notificar Comprador</>
                )}
              </Button>
            </div>
          )}

          {a.tracking_number && editingTracking !== auction.id && (
            <div className="bg-primary/5 border border-primary/20 rounded-sm p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-primary dark:text-[#A6E300] flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> Envío Registrado
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => handleEditTracking(auction.id, a)}>
                  <Edit3 className="h-3 w-3 mr-1" /> Editar
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                <div><span className="text-muted-foreground">Guía:</span> <strong className="font-mono">{a.tracking_number}</strong></div>
                {a.tracking_photo_url && (
                  <a href={a.tracking_photo_url} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-[#A6E300] hover:underline flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> Ver comprobante
                  </a>
                )}
              </div>
            </div>
          )}

          {a.tracking_number && editingTracking === auction.id && (
            <div className="bg-primary/5 border-2 border-primary/30 rounded-sm p-3 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Edit3 className="h-3 w-3" /> Editando Comprobante de Envío
              </p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Número de Guía</Label>
                  <Input className="h-8 text-xs rounded-sm font-mono" value={editTrackingData[auction.id]?.number || ""} onChange={e => setEditTrackingData(prev => ({ ...prev, [auction.id]: { ...prev[auction.id], number: e.target.value } }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Nueva Foto del Comprobante (opcional)</Label>
                  <label className="flex items-center gap-2 border-2 border-dashed border-border rounded-sm p-2.5 cursor-pointer hover:border-primary/50 hover:bg-secondary/20 transition-colors text-xs">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setEditTrackingData(prev => ({ ...prev, [auction.id]: { ...prev[auction.id], file: e.target.files?.[0] || null } }))} />
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    <span className={editTrackingData[auction.id]?.file ? "text-foreground font-medium" : "text-muted-foreground"}>
                      {editTrackingData[auction.id]?.file ? editTrackingData[auction.id].file!.name : "Subir nueva foto (dejar vacío para mantener la actual)"}
                    </span>
                  </label>
                  {editTrackingData[auction.id]?.file && (
                    <img src={URL.createObjectURL(editTrackingData[auction.id].file!)} alt="Preview" className="h-20 rounded-sm border border-border object-cover mt-1" />
                  )}
                  {!editTrackingData[auction.id]?.file && a.tracking_photo_url && (
                    <a href={a.tracking_photo_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary dark:text-[#A6E300] hover:underline flex items-center gap-1 mt-1">
                      <ImageIcon className="h-3 w-3" /> Foto actual
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs rounded-sm" disabled={savingTracking} onClick={() => handleSaveTracking(auction.id)}>
                  {savingTracking ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Guardar
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs rounded-sm" onClick={() => setEditingTracking(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-heading font-bold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Gestión de Envíos
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pendingShip.length} pendientes · {shipped.length} en camino · {delivered.length} entregados
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pendientes de Envío", count: pendingShip.length, color: "text-warning", icon: Package },
          { label: "Esperando Pago", count: awaitingPayment.length, color: "text-warning", icon: Clock },
          { label: "En Camino", count: shipped.length, color: "text-primary dark:text-[#A6E300]", icon: Truck },
          { label: "Entregados", count: delivered.length, color: "text-primary dark:text-[#A6E300]", icon: CheckCircle },
        ].map((s, i) => (
          <Card key={i} className="border border-border rounded-sm">
            <CardContent className="p-3 text-center">
              <s.icon className={`h-5 w-5 ${s.color} mx-auto mb-1`} />
              <p className="text-xl font-heading font-bold">{s.count}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Guía de Embalaje Seguro */}
      <Card className="border border-primary/20 bg-primary/5 rounded-sm">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-heading font-bold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary dark:text-[#A6E300]" /> 📦 Guía de Embalaje Seguro
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="bg-card border border-border rounded-sm p-3 space-y-1.5">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">✅ Obligatorio</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Envolver el producto con plástico burbuja o espuma</li>
                <li>Usar caja rígida de tamaño adecuado</li>
                <li>Rellenar espacios vacíos con papel o relleno</li>
                <li>Sellar la caja con cinta de embalaje resistente</li>
                <li>Incluir identificación del pedido dentro del paquete</li>
              </ul>
            </div>
            <div className="bg-card border border-border rounded-sm p-3 space-y-1.5">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">⚠️ Importante</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Eres responsable del embalaje hasta la entrega a la agencia</li>
                <li>Una vez entregado, la responsabilidad es de la empresa de encomiendas</li>
                <li>Siempre guarda tu comprobante de envío y foto del paquete</li>
                <li>Envía dentro de las 48h tras la verificación de pago</li>
                <li>Productos frágiles requieren doble protección</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {pendingShip.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-heading font-bold flex items-center gap-1.5 text-foreground">
            <AlertTriangle className="h-4 w-4 text-warning" /> Acción Requerida — Envíos Pendientes ({pendingShip.length})
          </h3>
          {pendingShip.map(a => renderShipmentCard(a, true))}
        </div>
      )}

      {awaitingPayment.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-heading font-bold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-warning" /> Esperando Verificación de Pago ({awaitingPayment.length})
          </h3>
          {awaitingPayment.map(a => renderShipmentCard(a, false))}
        </div>
      )}

      {shipped.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-heading font-bold flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-primary dark:text-[#A6E300]" /> En Camino ({shipped.length})
          </h3>
          {shipped.map(a => renderShipmentCard(a, false))}
        </div>
      )}

      {delivered.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-heading font-bold flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-primary dark:text-[#A6E300]" /> Entregados ({delivered.length})
          </h3>
          {delivered.map(a => renderShipmentCard(a, false))}
        </div>
      )}

      {shippableAuctions.length === 0 && (
        <Card className="border border-border rounded-sm">
          <CardContent className="p-8 text-center">
            <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tienes envíos pendientes.</p>
            <p className="text-xs text-muted-foreground mt-1">Cuando una subasta finalice y se verifique el pago, aparecerá aquí.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
