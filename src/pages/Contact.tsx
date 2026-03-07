import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/BackButton";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail, MessageCircle, Shield, Clock, Send, Headphones, Ticket, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Loader2, Plus, ArrowRight, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface SupportTicket {
  id: string;
  ticket_number: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "pago", label: "Pagos" },
  { value: "envio", label: "Envíos" },
  { value: "subasta", label: "Subastas" },
  { value: "cuenta", label: "Mi Cuenta" },
  { value: "dealer", label: "Dealer / Vendedor" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Abierto", color: "text-blue-600", bg: "bg-blue-500/10" },
  in_progress: { label: "En Proceso", color: "text-amber-600", bg: "bg-amber-500/10" },
  resolved: { label: "Resuelto", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  closed: { label: "Cerrado", color: "text-muted-foreground", bg: "bg-muted" },
};

const Contact = () => {
  const { getSetting } = useSiteSettings();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const siteName = getSetting("site_name", "SUBASTANDOLO");

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, TicketMessage[]>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Guest form (not logged in)
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const fetchTickets = async () => {
    if (!user) return;
    setLoadingTickets(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (data) setTickets(data as SupportTicket[]);
    setLoadingTickets(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
    if (data) setTicketMessages(prev => ({ ...prev, [ticketId]: data as TicketMessage[] }));
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const toggleTicket = async (ticketId: string) => {
    if (expandedTicket === ticketId) {
      setExpandedTicket(null);
    } else {
      setExpandedTicket(ticketId);
      if (!ticketMessages[ticketId]) await fetchMessages(ticketId);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      // Fallback: mailto for guests
      const s = encodeURIComponent(`Contacto ${siteName} — ${subject}`);
      const b = encodeURIComponent(`Nombre: ${guestName}\nCorreo: ${guestEmail}\nCategoría: ${category}\n\nMensaje:\n${message}`);
      window.location.href = `mailto:soporte@subastandolo.com?subject=${s}&body=${b}`;
      toast({ title: "📧 Abriendo tu correo", description: "Se abrirá tu cliente de email para enviar el mensaje." });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create ticket
      const { data: ticket, error: ticketErr } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          user_name: profile?.full_name || user.email?.split("@")[0] || "Usuario",
          user_email: user.email || "",
          subject,
          category,
          priority: "medium",
        })
        .select()
        .single();

      if (ticketErr) throw ticketErr;

      // 2. Create initial message
      await supabase.from("ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: "user",
        message,
      });

      // 3. Notify admin via edge function
      try {
        await supabase.functions.invoke("notify-ticket", {
          body: { ticketId: ticket.id, type: "new_ticket" },
        });
      } catch { /* non-blocking */ }

      toast({ title: "🎫 Ticket creado", description: `Ticket #${ticket.ticket_number} creado exitosamente. Te responderemos pronto.` });
      setSubject("");
      setCategory("general");
      setMessage("");
      setShowForm(false);
      fetchTickets();

    } catch (err: any) {
      toast({ title: "Error", description: err.message || "No se pudo crear el ticket", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleReply = async (ticketId: string) => {
    const text = replyText[ticketId]?.trim();
    if (!text || !user) return;
    setReplying(ticketId);
    try {
      await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_role: "user",
        message: text,
      });
      setReplyText(prev => ({ ...prev, [ticketId]: "" }));
      await fetchMessages(ticketId);
      toast({ title: "✉️ Respuesta enviada" });
    } catch { }
    setReplying(null);
  };

  const handleDeleteTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Estás seguro de eliminar este ticket? Esta acción no se puede deshacer.")) return;
    try {
      await supabase.from("ticket_messages").delete().eq("ticket_id", ticketId);
      await supabase.from("support_tickets").delete().eq("id", ticketId);
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      if (expandedTicket === ticketId) setExpandedTicket(null);
      toast({ title: "🗑️ Ticket eliminado" });
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el ticket", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <BackButton />

      {/* Hero */}
      <section className="relative bg-nav overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-accent rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-16 sm:py-20 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
            <Headphones className="h-4 w-4 text-accent" />
            <span className="text-xs font-medium text-white/90">Centro de Soporte</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-heading font-bold text-white mb-4">
            ¿Cómo podemos ayudarte?
          </h1>
          <p className="text-white/70 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Crea un ticket de soporte y nuestro equipo te responderá lo antes posible.
            Cada caso es atendido de forma personalizada.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 -mt-8 relative z-20 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {[
            { icon: Clock, title: "Respuesta < 24h", desc: "Te respondemos en menos de 24 horas hábiles" },
            { icon: Shield, title: "100% Seguro", desc: "Tu información está protegida en todo momento" },
            { icon: Ticket, title: "Sistema de Tickets", desc: "Seguimiento completo de cada caso" },
          ].map((item, i) => (
            <div key={i} className="bg-card border border-border rounded-sm p-5 text-center shadow-sm">
              <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-[#A6E300]/10 flex items-center justify-center mx-auto mb-3">
                <item.icon className="h-5 w-5 text-primary dark:text-[#A6E300]" />
              </div>
              <h3 className="text-sm font-heading font-bold mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* New Ticket Button / Form */}
          {user ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                  <Ticket className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Soporte
                </h2>
                <Button
                  onClick={() => setShowForm(!showForm)}
                  className={`gap-2 rounded-sm font-bold text-sm ${showForm ? "bg-muted text-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground"}`}
                >
                  {showForm ? (
                    <><ChevronUp className="h-4 w-4" /> Cancelar</>
                  ) : (
                    <><Plus className="h-4 w-4" /> Nuevo Ticket</>
                  )}
                </Button>
              </div>

              {showForm && (
                <Card className="border border-primary/20 rounded-sm animate-in slide-in-from-top-2">
                  <CardContent className="p-5">
                    <h3 className="text-base font-heading font-bold mb-4">Crear Ticket de Soporte</h3>
                    <form onSubmit={handleSubmitTicket} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium mb-1.5 block">Asunto *</label>
                          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Resumen del problema" required className="rounded-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1.5 block">Categoría</label>
                          <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="rounded-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1.5 block">Mensaje *</label>
                        <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe tu problema con el mayor detalle posible..." required rows={5} className="rounded-sm" />
                      </div>
                      <div className="flex items-center gap-3 justify-between">
                        <p className="text-[10px] text-muted-foreground">
                          Enviando como <strong>{profile?.full_name || user.email}</strong>
                        </p>
                        <Button type="submit" disabled={submitting || !subject || !message} className="bg-primary text-primary-foreground rounded-sm font-bold gap-2">
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Enviar Ticket
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Ticket History */}
              <div>
                <h3 className="text-sm font-heading font-bold text-muted-foreground mb-3 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Mis Tickets ({tickets.length})
                </h3>

                {loadingTickets ? (
                  <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary dark:text-[#A6E300]" /></div>
                ) : tickets.length === 0 ? (
                  <Card className="border border-border rounded-sm">
                    <CardContent className="p-8 text-center">
                      <Ticket className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No tienes tickets de soporte aún.</p>
                      <p className="text-xs text-muted-foreground mt-1">Crea uno con el botón de arriba.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {tickets.map(t => {
                      const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                      const isExpanded = expandedTicket === t.id;
                      const msgs = ticketMessages[t.id] || [];

                      return (
                        <Card key={t.id} className={`border rounded-sm overflow-hidden transition-all ${isExpanded ? "border-primary/30" : ""}`}>
                          {/* Ticket Header */}
                          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => toggleTicket(t.id)}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-muted-foreground">TK-{String(t.ticket_number).padStart(8, '0')}</span>
                                <p className="text-sm font-bold truncate">{t.subject}</p>
                                <Badge variant="outline" className={`text-[9px] ${st.bg} ${st.color} border-transparent`}>{st.label}</Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] text-muted-foreground">{CATEGORIES.find(c => c.value === t.category)?.label}</span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })}</span>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </div>

                          {/* Conversation */}
                          {isExpanded && (
                            <div className="border-t border-border">
                              <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                {msgs.length === 0 ? (
                                  <div className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
                                ) : msgs.map(m => (
                                  <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] rounded-lg px-3 py-2.5 ${m.sender_role === "user" ? "bg-primary/10 border border-primary/20" : "bg-accent/10 border border-accent/20"}`}>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold ${m.sender_role === "admin" ? "text-accent" : "text-primary dark:text-[#A6E300]"}`}>
                                          {m.sender_role === "admin" ? "🛡️ Soporte" : "Tú"}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground">
                                          {new Date(m.created_at).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                      <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.message}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Reply box (only if ticket is not closed) */}
                              {t.status !== "closed" && t.status !== "resolved" && (
                                <div className="border-t border-border p-3 flex gap-2">
                                  <Input
                                    value={replyText[t.id] || ""}
                                    onChange={e => setReplyText(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    placeholder="Escribe tu respuesta..."
                                    className="rounded-sm text-sm"
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(t.id); } }}
                                  />
                                  <Button size="sm" className="rounded-sm shrink-0" disabled={!replyText[t.id]?.trim() || replying === t.id} onClick={() => handleReply(t.id)}>
                                    {replying === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                  </Button>
                                </div>
                              )}

                              {(t.status === "closed" || t.status === "resolved") && (
                                <div className="border-t border-border p-3 flex items-center justify-between">
                                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Este ticket fue {t.status === "resolved" ? "resuelto" : "cerrado"}
                                  </p>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 text-[10px] h-7 gap-1 rounded-sm" onClick={(e) => handleDeleteTicket(t.id, e)}>
                                    <Trash2 className="h-3 w-3" /> Eliminar
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Guest Form (not logged in) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-heading font-bold mb-2">Escríbenos directamente</h2>
                  <p className="text-sm text-muted-foreground">
                    Para una mejor experiencia, <a href="/auth" className="text-primary font-bold hover:underline">inicia sesión</a> y crea un ticket de soporte con seguimiento completo.
                  </p>
                </div>
                <a href="mailto:soporte@subastandolo.com" className="flex items-center gap-4 p-5 bg-primary/5 border border-primary/20 rounded-sm hover:bg-primary/10 transition-colors group">
                  <div className="w-12 h-12 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Correo de soporte</p>
                    <p className="text-base font-heading font-bold text-primary">soporte@subastandolo.com</p>
                  </div>
                </a>
                <div className="bg-accent/5 border border-accent/20 rounded-sm p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold mb-1">¿Eres usuario registrado?</p>
                    <p className="text-xs text-muted-foreground">
                      <a href="/auth" className="text-primary font-bold hover:underline">Inicia sesión</a> para acceder al sistema de tickets con seguimiento, historial y respuestas directas.
                    </p>
                  </div>
                </div>
              </div>

              <Card className="border border-border rounded-sm">
                <CardContent className="p-6">
                  <h2 className="text-lg font-heading font-bold mb-1">Envíanos un mensaje</h2>
                  <p className="text-xs text-muted-foreground mb-5">Completa el formulario y te responderemos pronto.</p>
                  <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Nombre completo</label>
                      <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Tu nombre" required className="rounded-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Correo electrónico</label>
                      <Input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="tu@email.com" required className="rounded-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Asunto</label>
                      <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="¿Sobre qué necesitas ayuda?" required className="rounded-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Mensaje</label>
                      <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe tu consulta..." required rows={5} className="rounded-sm" />
                    </div>
                    <Button type="submit" disabled={!guestName || !guestEmail || !subject || !message} className="w-full bg-primary text-primary-foreground rounded-sm font-bold">
                      <Send className="h-4 w-4 mr-2" /> Enviar mensaje
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-nav py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-heading font-bold text-white mb-2">Estamos aquí para ti</h2>
          <p className="text-white/60 text-sm max-w-md mx-auto mb-5">
            En {siteName}, cada usuario importa. No dudes en contactarnos ante cualquier duda o inconveniente.
          </p>
          <a href="mailto:soporte@subastandolo.com">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold rounded-sm">
              <Mail className="h-4 w-4 mr-2" /> soporte@subastandolo.com
            </Button>
          </a>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Contact;
