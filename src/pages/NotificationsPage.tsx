import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Trash2, ArrowLeft, BellOff, MailOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const notifTypeConfig: Record<string, { color: string; label: string; emoji: string }> = {
    outbid: { color: "bg-red-500/10 text-red-600 border-red-200", label: "Sobrepujado", emoji: "⚡" },
    auction_won: { color: "bg-green-500/10 text-green-600 border-green-200", label: "¡Ganaste!", emoji: "🏆" },
    new_bid: { color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Nueva puja", emoji: "📈" },
    payment_verified: { color: "bg-green-500/10 text-green-600 border-green-200", label: "Pago verificado", emoji: "✅" },
    auction_finalized: { color: "bg-gray-500/10 text-gray-600 border-gray-200", label: "Finalizada", emoji: "🔔" },
    admin_custom: { color: "bg-primary/10 text-primary border-primary/20", label: "Admin", emoji: "📢" },
    admin_notification: { color: "bg-primary/10 text-primary border-primary/20", label: "Admin", emoji: "📢" },
    promo: { color: "bg-accent/10 text-accent-foreground border-accent/20", label: "Promoción", emoji: "🎉" },
    announcement: { color: "bg-accent/10 text-accent-foreground border-accent/20", label: "Anuncio", emoji: "📣" },
    urgent: { color: "bg-red-500/10 text-red-600 border-red-200", label: "Urgente", emoji: "🚨" },
    maintenance: { color: "bg-orange-500/10 text-orange-600 border-orange-200", label: "Mantenimiento", emoji: "🔧" },
    info: { color: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Info", emoji: "ℹ️" },
};

const NotificationsPage = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<"all" | "unread">("all");

    const filtered = filter === "unread" ? notifications.filter(n => !n.is_read) : notifications;

    const handleClick = (notif: typeof notifications[0]) => {
        if (!notif.is_read) markAsRead(notif.id);
        if (notif.link && notif.link !== "/") {
            navigate(notif.link);
        }
    };

    if (!user) {
        navigate("/auth");
        return null;
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-lg font-heading font-bold flex items-center gap-2">
                            <Bell className="h-5 w-5 text-primary" />
                            Centro de Notificaciones
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <Button variant="outline" size="sm" onClick={markAllAsRead} className="text-xs rounded-full">
                            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                            Marcar todas
                        </Button>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setFilter("all")}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === "all"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            }`}
                    >
                        Todas ({notifications.length})
                    </button>
                    <button
                        onClick={() => setFilter("unread")}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === "unread"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            }`}
                    >
                        Sin leer ({unreadCount})
                    </button>
                </div>

                {/* Notification list */}
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                            <BellOff className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-heading font-bold text-base text-foreground">Sin notificaciones</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {filter === "unread" ? "¡Estás al día! No tienes notificaciones pendientes." : "Aún no tienes notificaciones."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map((notif) => {
                            const config = notifTypeConfig[notif.type] ?? notifTypeConfig["info"];
                            return (
                                <div
                                    key={notif.id}
                                    onClick={() => handleClick(notif)}
                                    className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group
                    ${!notif.is_read
                                            ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                                            : "bg-card border-border hover:bg-secondary/40"
                                        }`}
                                >
                                    {/* Unread dot */}
                                    {!notif.is_read && (
                                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary" />
                                    )}

                                    {/* Emoji icon */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${config.color}`}>
                                        {config.emoji}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <p className="text-sm font-bold text-foreground truncate">{notif.title}</p>
                                            <Badge variant="outline" className={`text-[10px] px-2 py-0 shrink-0 border ${config.color}`}>
                                                {config.label}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                                        <div className="flex items-center gap-3 mt-2">
                                            <span className="text-[10px] text-muted-foreground/60">
                                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                            {notif.link && notif.link !== "/" && (
                                                <span className="text-[10px] text-primary flex items-center gap-0.5">
                                                    <ExternalLink className="h-3 w-3" /> Ver detalles
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notif.is_read && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                                className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                                                title="Marcar como leída"
                                            >
                                                <MailOpen className="h-3.5 w-3.5 text-primary" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                            className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <BottomNav />
        </div>
    );
};

export default NotificationsPage;
