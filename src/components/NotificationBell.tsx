import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Trash2, ArrowRight, BellOff } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const notifEmoji: Record<string, string> = {
  outbid: "⚡", auction_won: "🏆", new_bid: "📈", payment_verified: "✅",
  auction_finalized: "🔔", admin_custom: "📢", admin_notification: "📢",
  promo: "🎉", announcement: "📣", urgent: "🚨", maintenance: "🔧", info: "ℹ️",
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Calculate position of dropdown relative to viewport
  const updatePosition = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  };

  // Open/close and position
  const toggleOpen = () => {
    if (!open) updatePosition();
    setOpen(prev => !prev);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        bellRef.current && !bellRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return undefined;
    const reposition = () => updatePosition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const handleNotifClick = (notif: typeof notifications[0]) => {
    if (!notif.is_read) markAsRead(notif.id);
    setOpen(false);
    navigate("/notificaciones");
  };

  const goToCenter = () => {
    setOpen(false);
    navigate("/notificaciones");
  };

  const preview = notifications.slice(0, 5);

  // Portal dropdown — renders directly in document.body, bypassing all overflow clipping
  const dropdown = open ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        right: dropdownPos.right,
        width: 360,
        zIndex: 9999,
      }}
      className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
        <div>
          <h3 className="font-heading font-bold text-sm text-foreground">Notificaciones</h3>
          <p className="text-[10px] text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} sin leer` : "Sin pendientes"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-primary hover:text-primary/80 h-7 gap-1">
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
          </Button>
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
        {preview.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center px-4">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-3">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Sin notificaciones</p>
            <p className="text-xs text-muted-foreground mt-0.5">Te avisaremos cuando haya novedades</p>
          </div>
        ) : (
          preview.map((notif) => {
            return (
              <div
                key={notif.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 cursor-pointer transition-colors group ${!notif.is_read ? "bg-primary/5" : ""
                  }`}
                onClick={() => handleNotifClick(notif)}
              >
                {/* Emoji icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-secondary"
                  }`}>
                  {notifEmoji[notif.type] ?? "🔔"}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!notif.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <p className="text-xs font-semibold text-foreground truncate">{notif.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                  className="w-6 h-6 shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center text-muted-foreground hover:text-destructive rounded transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-secondary/20 px-4 py-2.5">
        <button
          onClick={goToCenter}
          className="w-full text-xs font-semibold text-primary hover:text-primary/80 flex items-center justify-center gap-1.5 py-1 transition-colors"
        >
          Ver centro de notificaciones
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={bellRef}
        id="notification-bell-btn"
        onClick={toggleOpen}
        className="relative h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-bold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Portal dropdown (renders in document.body — no overflow clipping) */}
      {dropdown}
    </div>
  );
};

export default NotificationBell;
