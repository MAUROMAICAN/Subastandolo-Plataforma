import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Mail, Search, CheckCircle, XCircle, Ticket, ChevronLeft,
    ChevronRight, RefreshCw, ExternalLink, Loader2, Send,
    Clock, AlertTriangle, ArrowRight, X, User, Shield, ChevronDown, Trash2, Paperclip, FileText, Image as ImageIcon
} from "lucide-react";

interface SupportTicket {
    id: string;
    ticket_number: number;
    user_id: string;
    user_name: string;
    user_email: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    auction_id: string | null;
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

const CATEGORIES: Record<string, string> = {
    general: "General", pago: "Pagos", envio: "Envíos",
    subasta: "Subastas", cuenta: "Cuenta", dealer: "Dealer",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    open: { label: "Abierto", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", icon: Clock },
    in_progress: { label: "En Proceso", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", icon: ArrowRight },
    resolved: { label: "Resuelto", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
    closed: { label: "Cerrado", color: "text-muted-foreground", bg: "bg-muted", icon: XCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    low: { label: "Baja", color: "text-muted-foreground" },
    medium: { label: "Media", color: "text-amber-600" },
    high: { label: "Alta", color: "text-red-600" },
};

const AdminEmailsTab = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [showLogs, setShowLogs] = useState(false);

    const fetchTickets = async () => {
        setLoading(true);
        const { data } = await supabase
            .from("support_tickets")
            .select("*")
            .order("updated_at", { ascending: false });
        if (data) setTickets(data as SupportTicket[]);
        setLoading(false);
    };

    const fetchMessages = async (ticketId: string) => {
        setLoadingMsgs(true);
        const { data } = await supabase
            .from("ticket_messages")
            .select("*")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true });
        if (data) setMessages(data as TicketMessage[]);
        setLoadingMsgs(false);
    };

    useEffect(() => { fetchTickets(); }, []);

    const openTicket = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        await fetchMessages(ticket.id);
    };

    const handleReply = async () => {
        if (!replyText.trim() || !selectedTicket || !user) return;
        setSending(true);
        try {
            await supabase.from("ticket_messages").insert({
                ticket_id: selectedTicket.id,
                sender_id: user.id,
                sender_role: "admin",
                message: replyText.trim(),
            });

            // Update status to in_progress if was open
            if (selectedTicket.status === "open") {
                await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selectedTicket.id);
                setSelectedTicket({ ...selectedTicket, status: "in_progress" });
            }

            // Notify user via email
            try {
                await supabase.functions.invoke("notify-ticket", {
                    body: { ticketId: selectedTicket.id, type: "admin_reply" },
                });
            } catch { /* non-blocking */ }

            setReplyText("");
            await fetchMessages(selectedTicket.id);
            fetchTickets();
        } catch { }
        setSending(false);
    };

    const changeStatus = async (status: string) => {
        if (!selectedTicket) return;
        await supabase.from("support_tickets").update({ status }).eq("id", selectedTicket.id);
        setSelectedTicket({ ...selectedTicket, status });
        fetchTickets();
    };

    const handleDeleteTicket = async (ticketId: string) => {
        if (!confirm("¿Eliminar este ticket y todos sus mensajes? Esta acción no se puede deshacer.")) return;
        try {
            await supabase.from("ticket_messages").delete().eq("ticket_id", ticketId);
            await supabase.from("support_tickets").delete().eq("id", ticketId);
            setTickets(prev => prev.filter(t => t.id !== ticketId));
            if (selectedTicket?.id === ticketId) setSelectedTicket(null);
        } catch { }
    };

    const filtered = useMemo(() => {
        let list = [...tickets];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.subject.toLowerCase().includes(q) ||
                t.user_name.toLowerCase().includes(q) ||
                t.user_email.toLowerCase().includes(q) ||
                `TK-${String(t.ticket_number).padStart(8, '0')}`.toLowerCase().includes(q)
            );
        }
        if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
        if (categoryFilter !== "all") list = list.filter(t => t.category === categoryFilter);
        return list;
    }, [tickets, search, statusFilter, categoryFilter]);

    // Stats
    const stats = useMemo(() => ({
        total: tickets.length,
        open: tickets.filter(t => t.status === "open").length,
        in_progress: tickets.filter(t => t.status === "in_progress").length,
        resolved: tickets.filter(t => t.status === "resolved").length,
    }), [tickets]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-heading font-bold flex items-center gap-2">
                        <Ticket className="h-5 w-5 text-primary dark:text-accent" /> Soporte & Correos
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {stats.total} tickets · {stats.open} abiertos · {stats.in_progress} en proceso · {stats.resolved} resueltos
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={fetchTickets} disabled={loading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
                    </Button>

                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                    { label: "Total", value: stats.total, ...STATUS_CONFIG.open, action: () => setStatusFilter("all") },
                    { label: "Abiertos", value: stats.open, ...STATUS_CONFIG.open, action: () => setStatusFilter("open") },
                    { label: "En Proceso", value: stats.in_progress, ...STATUS_CONFIG.in_progress, action: () => setStatusFilter("in_progress") },
                    { label: "Resueltos", value: stats.resolved, ...STATUS_CONFIG.resolved, action: () => setStatusFilter("resolved") },
                ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30 transition-all`} onClick={s.action}>
                        <s.icon className={`h-4 w-4 ${s.color} mb-1`} />
                        <p className="text-xl font-heading font-bold leading-tight">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por #ticket, nombre, email, asunto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-sm text-sm" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[140px] rounded-sm text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-[140px] rounded-sm text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {/* Content: Ticket list + Conversation */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Ticket List */}
                <div className={`${selectedTicket ? "hidden lg:block" : ""} lg:col-span-2 space-y-1.5`}>
                    <p className="text-xs text-muted-foreground mb-1">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</p>
                    {loading ? (
                        <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
                    ) : filtered.length === 0 ? (
                        <Card className="rounded-sm"><CardContent className="p-8 text-center">
                            <Ticket className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No hay tickets</p>
                        </CardContent></Card>
                    ) : (
                        filtered.map(t => {
                            const st = STATUS_CONFIG[t.status] || STATUS_CONFIG.open;
                            const isSelected = selectedTicket?.id === t.id;
                            return (
                                <div key={t.id} className={`border rounded-sm p-3 cursor-pointer transition-all hover:border-primary/30 ${isSelected ? "border-primary/50 bg-primary/5" : "border-border"}`} onClick={() => openTicket(t)}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-mono text-muted-foreground">TK-{String(t.ticket_number).padStart(8, '0')}</span>
                                        <Badge variant="outline" className={`text-[8px] ${st.bg} ${st.color} border-transparent px-1.5 py-0`}>{st.label}</Badge>
                                        {t.priority === "high" && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                    </div>
                                    <p className="text-sm font-bold truncate">{t.subject}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-muted-foreground truncate">{t.user_name}</span>
                                        <span className="text-[10px] text-muted-foreground">·</span>
                                        <span className="text-[10px] text-muted-foreground">{CATEGORIES[t.category]}</span>
                                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(t.updated_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Conversation Panel */}
                <div className="lg:col-span-3">
                    {selectedTicket ? (
                        <Card className="border rounded-sm overflow-hidden h-full flex flex-col">
                            {/* Ticket header */}
                            <div className="border-b border-border p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden shrink-0" onClick={() => setSelectedTicket(null)}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-xs font-mono text-muted-foreground shrink-0">TK-{String(selectedTicket.ticket_number).padStart(8, '0')}</span>
                                        <h3 className="text-sm font-bold truncate">{selectedTicket.subject}</h3>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 hidden lg:flex" onClick={() => setSelectedTicket(null)}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" /> {selectedTicket.user_name}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{selectedTicket.user_email}</span>
                                    <Badge variant="outline" className="text-[9px]">{CATEGORIES[selectedTicket.category]}</Badge>
                                    <Badge variant="outline" className={`text-[9px] ${PRIORITY_CONFIG[selectedTicket.priority]?.color}`}>
                                        {PRIORITY_CONFIG[selectedTicket.priority]?.label}
                                    </Badge>
                                </div>
                                {/* Status actions */}
                                <div className="flex items-center gap-1.5 mt-3">
                                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                        <Button
                                            key={key}
                                            variant={selectedTicket.status === key ? "default" : "outline"}
                                            size="sm"
                                            className={`h-7 text-[10px] rounded-sm gap-1 ${selectedTicket.status === key ? "" : "text-muted-foreground"}`}
                                            onClick={() => changeStatus(key)}
                                        >
                                            <cfg.icon className="h-3 w-3" /> {cfg.label}
                                        </Button>
                                    ))}
                                </div>
                                {/* Quick contact */}
                                <div className="flex items-center gap-2 mt-2">
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-sm gap-1" onClick={() => window.open(`https://wa.me/${selectedTicket.user_email}`, "_blank")}>
                                        WhatsApp
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-sm gap-1" onClick={() => window.open(`mailto:${selectedTicket.user_email}`, "_blank")}>
                                        <Mail className="h-3 w-3" /> Email directo
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-sm gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTicket(selectedTicket.id)}>
                                        <Trash2 className="h-3 w-3" /> Eliminar
                                    </Button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
                                {loadingMsgs ? (
                                    <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
                                ) : messages.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">Sin mensajes</p>
                                ) : (
                                    messages.map(m => (
                                        <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                                            <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 ${m.sender_role === "admin" ? "bg-primary/10 border border-primary/20" : "bg-secondary border border-border"}`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    {m.sender_role === "admin" ? (
                                                        <Shield className="h-3 w-3 text-primary" />
                                                    ) : (
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                    )}
                                                    <span className={`text-[10px] font-bold ${m.sender_role === "admin" ? "text-primary" : "text-foreground"}`}>
                                                        {m.sender_role === "admin" ? "Soporte" : selectedTicket.user_name}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground">
                                                        {new Date(m.created_at).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                </div>
                                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.message}</p>
                                                {m.attachments && m.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {m.attachments.map((url: string, ai: number) => {
                                                            const isPdf = url.toLowerCase().endsWith(".pdf");
                                                            return isPdf ? (
                                                                <a key={ai} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20 transition-colors">
                                                                    <FileText className="h-3 w-3" /> PDF {ai + 1}
                                                                </a>
                                                            ) : (
                                                                <a key={ai} href={url} target="_blank" rel="noopener noreferrer">
                                                                    <img src={url} alt={`Adjunto ${ai + 1}`} className="h-16 w-16 object-cover rounded border border-border hover:border-primary transition-colors" />
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Reply box */}
                            <div className="border-t border-border p-3">
                                <div className="flex gap-2">
                                    <Textarea
                                        value={replyText}
                                        onChange={e => setReplyText(e.target.value)}
                                        placeholder="Escribe tu respuesta al usuario..."
                                        className="rounded-sm text-sm min-h-[60px] resize-none"
                                        rows={2}
                                    />
                                    <Button className="shrink-0 rounded-sm self-end" disabled={!replyText.trim() || sending} onClick={handleReply}>
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-1.5">
                                    Se enviará un email al usuario notificando tu respuesta.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <Card className="border rounded-sm h-full flex items-center justify-center min-h-[300px]">
                            <CardContent className="text-center p-8">
                                <Ticket className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                                <p className="text-sm text-muted-foreground">Selecciona un ticket para ver la conversación</p>
                                <p className="text-xs text-muted-foreground mt-1">Los tickets nuevos aparecen primero</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Email Logs (collapsible, secondary) */}
            <div className="border-t border-border pt-4 mt-4">
                <button className="flex items-center gap-2 text-sm font-heading font-bold text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowLogs(!showLogs)}>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showLogs ? "rotate-180" : ""}`} />
                    <Mail className="h-4 w-4" /> Logs de Emails Transaccionales
                </button>
                {showLogs && (
                    <div className="mt-3 bg-secondary/30 rounded-sm p-4 border border-border">
                        <p className="text-xs text-muted-foreground mb-2">
                            Registro de emails automáticos enviados por la plataforma (bienvenida, subastas, pagos, etc.)
                        </p>
                        <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => window.open("https://supabase.com/dashboard/project/oqjwrrttncfcznhmzlrk/editor", "_blank")}>
                            <ExternalLink className="h-3 w-3" /> Ver en Supabase → email_logs
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminEmailsTab;
