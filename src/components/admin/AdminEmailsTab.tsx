import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Mail, Search, CheckCircle, XCircle, Clock, Trophy, Zap,
    CreditCard, DollarSign, Truck, Bell, UserPlus, ChevronLeft,
    ChevronRight, RefreshCw, ExternalLink, Loader2
} from "lucide-react";

interface EmailLog {
    id: string;
    recipient_email: string;
    recipient_name: string | null;
    recipient_id: string | null;
    email_type: string;
    subject: string;
    auction_id: string | null;
    auction_title: string | null;
    status: "sent" | "failed";
    resend_id: string | null;
    error_message: string | null;
    metadata: Record<string, any>;
    created_at: string;
}

const EMAIL_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    auction_won: { label: "Subasta Ganada", icon: Trophy, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    outbid: { label: "Superado", icon: Zap, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    payment_approved: { label: "Pago Aprobado", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    payment_received: { label: "Pago Recibido", icon: DollarSign, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    shipment: { label: "Envío", icon: Truck, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
    new_auction: { label: "Nueva Subasta", icon: Bell, color: "text-primary dark:text-accent", bg: "bg-primary/10 dark:bg-accent/10" },
    welcome: { label: "Bienvenida", icon: UserPlus, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
};

const AdminEmailsTab = () => {
    const [emails, setEmails] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const fetchEmails = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("email_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(500);
        if (!error && data) setEmails(data as EmailLog[]);
        setLoading(false);
    };

    useEffect(() => { fetchEmails(); }, []);

    const filtered = useMemo(() => {
        let list = [...emails];
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(e =>
                e.recipient_email?.toLowerCase().includes(q) ||
                e.recipient_name?.toLowerCase().includes(q) ||
                e.subject?.toLowerCase().includes(q) ||
                e.auction_title?.toLowerCase().includes(q)
            );
        }
        if (typeFilter !== "all") list = list.filter(e => e.email_type === typeFilter);
        if (statusFilter !== "all") list = list.filter(e => e.status === statusFilter);
        return list;
    }, [emails, search, typeFilter, statusFilter]);

    useMemo(() => setPage(1), [search, typeFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    // Stats
    const stats = useMemo(() => {
        const total = emails.length;
        const sent = emails.filter(e => e.status === "sent").length;
        const failed = emails.filter(e => e.status === "failed").length;
        const today = emails.filter(e => {
            const d = new Date(e.created_at);
            const now = new Date();
            return d.toDateString() === now.toDateString();
        }).length;
        const typeCounts: Record<string, number> = {};
        emails.forEach(e => { typeCounts[e.email_type] = (typeCounts[e.email_type] || 0) + 1; });
        return { total, sent, failed, today, typeCounts };
    }, [emails]);

    const getTypeConfig = (type: string) => EMAIL_TYPE_CONFIG[type] || { label: type, icon: Mail, color: "text-muted-foreground", bg: "bg-muted" };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-heading font-bold flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary dark:text-accent" /> Correos Enviados
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {stats.total} total · {stats.sent} enviados · {stats.failed} fallidos · {stats.today} hoy
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={fetchEmails} disabled={loading}>
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={() => window.open("https://mail.spaceship.com", "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" /> Bandeja Spacemail
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                    { label: "Total", value: stats.total, icon: Mail, color: "text-primary dark:text-accent", bg: "bg-primary/5", action: () => { setTypeFilter("all"); setStatusFilter("all"); } },
                    { label: "Enviados", value: stats.sent, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/5", action: () => { setStatusFilter("sent"); setTypeFilter("all"); } },
                    { label: "Fallidos", value: stats.failed, icon: XCircle, color: "text-red-600", bg: "bg-red-500/5", action: () => { setStatusFilter("failed"); setTypeFilter("all"); } },
                    ...Object.entries(EMAIL_TYPE_CONFIG).slice(0, 4).map(([key, cfg]) => ({
                        label: cfg.label, value: stats.typeCounts[key] || 0, icon: cfg.icon, color: cfg.color, bg: cfg.bg.replace("/10", "/5"),
                        action: () => { setTypeFilter(key); setStatusFilter("all"); }
                    })),
                ].map((s, i) => (
                    <div key={i} className={`${s.bg} rounded-lg border border-border p-2.5 cursor-pointer hover:border-primary/30 transition-all`} onClick={s.action}>
                        <s.icon className={`h-3.5 w-3.5 ${s.color} mb-1`} />
                        <p className="text-lg font-heading font-bold leading-tight">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por email, nombre, asunto o subasta..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 rounded-sm text-sm"
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-[160px] rounded-sm text-xs">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        {Object.entries(EMAIL_TYPE_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 w-[130px] rounded-sm text-xs">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="sent">Enviados</SelectItem>
                        <SelectItem value="failed">Fallidos</SelectItem>
                    </SelectContent>
                </Select>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="flex h-9 rounded-sm border border-input bg-background px-2 py-1 text-xs">
                    <option value={25}>25/pág</option>
                    <option value={50}>50/pág</option>
                    <option value={100}>100/pág</option>
                </select>
            </div>

            {/* Results count */}
            <p className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>

            {/* Email List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-accent" />
                </div>
            ) : filtered.length === 0 ? (
                <Card className="border border-border rounded-sm">
                    <CardContent className="p-12 text-center">
                        <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No hay correos que coincidan con los filtros.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-1.5">
                    {paginated.map((email) => {
                        const cfg = getTypeConfig(email.email_type);
                        const TypeIcon = cfg.icon;
                        const isFailed = email.status === "failed";

                        return (
                            <Card key={email.id} className={`border rounded-sm overflow-hidden transition-all hover:border-primary/20 ${isFailed ? "border-red-500/30" : ""}`}>
                                <CardContent className="p-0">
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        {/* Type icon */}
                                        <div className={`h-9 w-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                                            <TypeIcon className={`h-4 w-4 ${cfg.color}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold truncate max-w-[300px]">
                                                    {email.recipient_name || email.recipient_email}
                                                </p>
                                                <Badge variant="outline" className={`text-[9px] ${cfg.bg} ${cfg.color} border-transparent`}>{cfg.label}</Badge>
                                                {isFailed && <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/20">Error</Badge>}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">{email.subject}</p>
                                            {email.recipient_name && (
                                                <p className="text-[10px] text-muted-foreground font-mono">{email.recipient_email}</p>
                                            )}
                                            {isFailed && email.error_message && (
                                                <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[400px]">⚠ {email.error_message}</p>
                                            )}
                                        </div>

                                        {/* Right side */}
                                        <div className="flex items-center gap-3 shrink-0">
                                            {email.auction_title && (
                                                <span className="hidden lg:inline text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded truncate max-w-[150px]">
                                                    {email.auction_title}
                                                </span>
                                            )}
                                            <div className="text-right">
                                                <p className="text-[10px] text-muted-foreground">
                                                    {new Date(email.created_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short" })}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {new Date(email.created_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                            </div>
                                            {isFailed ? (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            ) : (
                                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">
                        Mostrando {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} de {filtered.length}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Ant
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let p: number;
                            if (totalPages <= 7) p = i + 1;
                            else if (safePage <= 4) p = i + 1;
                            else if (safePage >= totalPages - 3) p = totalPages - 6 + i;
                            else p = safePage - 3 + i;
                            return (
                                <Button key={p} variant={p === safePage ? "default" : "outline"} size="sm" className="h-8 w-8 text-xs rounded-sm p-0" onClick={() => setPage(p)}>
                                    {p}
                                </Button>
                            );
                        })}
                        <Button variant="outline" size="sm" className="h-8 text-xs rounded-sm" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
                            Sig <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminEmailsTab;
