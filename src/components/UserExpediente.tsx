import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Phone, Calendar, Shield, Gavel, Star, AlertTriangle, CreditCard, MessageCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface UserExpedienteProps {
  userId: string | null;
  userName?: string;
  onClose: () => void;
}

const UserExpediente = ({ userId, userName, onClose }: UserExpedienteProps) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    supabase.functions.invoke("admin-manage-user", {
      body: { action: "get_user_details", userId },
    }).then(({ data, error: err }) => {
      if (err || data?.error) {
        setError(data?.error || err?.message || "Error al cargar datos");
      } else {
        setDetails(data);
      }
      setLoading(false);
    });
  }, [userId]);

  if (!userId) return null;

  return (
    <Dialog open={!!userId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-heading">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary dark:text-accent font-bold">
                {(userName || "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base">Expediente: {userName || "Usuario"}</p>
              <p className="text-xs text-muted-foreground dark:text-gray-300 font-normal">ID: {userId.slice(0, 8)}...</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive text-sm">{error}</div>
        ) : details ? (
          <div className="space-y-4 mt-2">
            {/* Auth & Profile Info */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<Mail className="h-3.5 w-3.5" />} label="Correo electrónico" value={details.auth?.email || "—"} />
              <InfoCard icon={<Phone className="h-3.5 w-3.5" />} label="Teléfono" value={details.profile?.phone || "—"} />
              <InfoCard icon={<Calendar className="h-3.5 w-3.5" />} label="Registrado" value={details.auth?.created_at ? new Date(details.auth.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
              <InfoCard icon={<Calendar className="h-3.5 w-3.5" />} label="Último acceso" value={details.auth?.last_sign_in ? new Date(details.auth.last_sign_in).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Nunca"} />
              <InfoCard icon={<Shield className="h-3.5 w-3.5" />} label="Roles" value={(details.roles || []).join(", ") || "user"} />
              <InfoCard icon={<Mail className="h-3.5 w-3.5" />} label="Email confirmado" value={details.auth?.email_confirmed ? "✅ Sí" : "❌ No"} />
              {details.profile?.public_id && (
                <InfoCard icon={<Shield className="h-3.5 w-3.5" />} label="ID Público" value={details.profile.public_id} />
              )}
              {details.auth?.banned && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 col-span-2">
                  <p className="text-xs font-bold text-destructive dark:text-red-400">🚫 CUENTA SUSPENDIDA</p>
                  {details.auth.banned_until && <p className="text-[10px] text-destructive/80 dark:text-red-400">Hasta: {details.auth.banned_until}</p>}
                </div>
              )}
            </div>

            {/* Dealer info */}
            {details.dealer && (
              <Accordion type="single" collapsible defaultValue="dealer">
                <AccordionItem value="dealer" className="border border-border rounded-sm">
                  <AccordionTrigger className="px-4 py-2 text-xs font-bold hover:no-underline">
                    🏪 Información de Dealer
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Negocio:</span> <strong>{details.dealer.business_name}</strong></div>
                      <div><span className="text-muted-foreground">Estado:</span> <Badge variant="outline" className="text-[10px] ml-1">{details.dealer.status}</Badge></div>
                      <div><span className="text-muted-foreground">Cuenta:</span> <Badge variant="outline" className="text-[10px] ml-1">{details.dealer.account_status}</Badge></div>
                      <div><span className="text-muted-foreground">Balance:</span> <strong>${details.dealer.dealer_balance?.toFixed(2)}</strong></div>
                      {details.dealer.instagram_url && <div><span className="text-muted-foreground">Instagram:</span> {details.dealer.instagram_url}</div>}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Activity Stats */}
            <div className="grid grid-cols-4 gap-2">
              <StatCard label="Pujas" value={details.bids?.length || 0} icon="🔨" />
              <StatCard label="Ganadas" value={details.won_auctions?.length || 0} icon="🏆" />
              <StatCard label="Reseñas" value={(details.reviews_received?.length || 0) + (details.reviews_given?.length || 0)} icon="⭐" />
              <StatCard label="Disputas" value={details.disputes?.length || 0} icon="⚖️" />
            </div>

            {/* Bids */}
            {details.bids?.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="bids" className="border border-border rounded-sm">
                  <AccordionTrigger className="px-4 py-2 text-xs font-bold hover:no-underline">
                    <span className="flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5" /> Pujas ({details.bids.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {details.bids.slice(0, 15).map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{new Date(b.created_at).toLocaleDateString("es-MX")}</span>
                          <span className="font-bold">${b.amount?.toLocaleString("es-MX")}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Won Auctions */}
            {details.won_auctions?.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="won" className="border border-border rounded-sm">
                  <AccordionTrigger className="px-4 py-2 text-xs font-bold hover:no-underline">
                    <span className="flex items-center gap-1.5">🏆 Subastas Ganadas ({details.won_auctions.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {details.won_auctions.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                          <span className="truncate max-w-[200px]">{a.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px]">{a.status}</Badge>
                            <span className="font-bold">${a.current_price?.toLocaleString("es-MX")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Reviews */}
            {(details.reviews_received?.length > 0 || details.reviews_given?.length > 0) && (
              <Accordion type="single" collapsible>
                <AccordionItem value="reviews" className="border border-border rounded-sm">
                  <AccordionTrigger className="px-4 py-2 text-xs font-bold hover:no-underline">
                    <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> Reseñas</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-2">
                    {details.reviews_received?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground dark:text-gray-300 uppercase mb-1">Recibidas ({details.reviews_received.length})</p>
                        {details.reviews_received.slice(0, 5).map((r: any) => (
                          <div key={r.id} className="text-xs py-1 border-b border-border/50">
                            <span>{"⭐".repeat(r.rating)} </span>
                            <span className="text-muted-foreground">{r.comment || "Sin comentario"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Disputes */}
            {details.disputes?.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="disputes" className="border border-border rounded-sm">
                  <AccordionTrigger className="px-4 py-2 text-xs font-bold hover:no-underline">
                    <span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Disputas ({details.disputes.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-1">
                      {details.disputes.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                          <span>{d.category}</span>
                          <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Payments */}
            {details.payment_proofs?.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="payments" className="border border-border rounded-sm">
                  <AccordionTrigger className="px-4 py-2 text-xs font-bold hover:no-underline">
                    <span className="flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Pagos ({details.payment_proofs.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3">
                    <div className="space-y-1">
                      {details.payment_proofs.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                          <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString("es-MX")}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                            <span className="font-bold">${p.amount_usd?.toLocaleString("es-MX")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-secondary/30 rounded-md p-3">
    <p className="text-[10px] text-muted-foreground dark:text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1">{icon} {label}</p>
    <p className="text-sm font-medium break-all">{value}</p>
  </div>
);

const StatCard = ({ label, value, icon }: { label: string; value: number; icon: string }) => (
  <div className="bg-secondary/20 border border-border rounded-sm p-2 text-center">
    <p className="text-base">{icon}</p>
    <p className="text-lg font-bold">{value}</p>
    <p className="text-[9px] text-muted-foreground">{label}</p>
  </div>
);

export default UserExpediente;
