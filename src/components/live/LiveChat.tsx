// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Send, Ban, Flag, AlertTriangle } from "lucide-react";

// Spanish profanity / offensive word filter
const BAD_WORDS = [
    "puta", "coño", "mierda", "verga", "marico", "marica", "pendejo", "joder",
    "culo", "cojones", "idiota", "estúpido", "imbécil", "mamón", "pinga",
    "güevón", "guevon", "pajúo", "pajuo", "malparido", "gonorrea", "hijueputa",
    "cdsm", "ctm", "hdp", "hp", "ptm", "mrda",
];

function filterBadWords(text: string): string {
    let filtered = text;
    for (const word of BAD_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        filtered = filtered.replace(regex, "***");
    }
    return filtered;
}

interface ChatMessage {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    is_hidden?: boolean;
}

interface LiveChatProps {
    eventId: string;
    dealerId?: string; // The host dealer's user ID — enables moderation controls
}

export default function LiveChat({ eventId, dealerId }: LiveChatProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [bannedUsers, setBannedUsers] = useState<Set<string>>(new Set());
    const [isBanned, setIsBanned] = useState(false);
    const [lastSentAt, setLastSentAt] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const isHost = user?.id === dealerId;

    // Load messages + bans
    useEffect(() => {
        const loadMessages = async () => {
            const { data } = await supabase
                .from("live_chat")
                .select("id, user_id, message, created_at, is_hidden")
                .eq("event_id", eventId)
                .order("created_at", { ascending: true })
                .limit(200);
            if (data) setMessages(data as ChatMessage[]);
        };

        const loadBans = async () => {
            const { data } = await supabase
                .from("live_chat_bans")
                .select("user_id")
                .eq("event_id", eventId);
            if (data) {
                const bannedSet = new Set(data.map((b: any) => b.user_id));
                setBannedUsers(bannedSet);
                if (user && bannedSet.has(user.id)) setIsBanned(true);
            }
        };

        loadMessages();
        loadBans();

        // Realtime subscription
        const channel = supabase
            .channel(`live-chat-${eventId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "live_chat", filter: `event_id=eq.${eventId}` },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;
                    if (!newMsg.is_hidden) {
                        setMessages((prev) => [...prev, newMsg]);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [eventId, user]);

    // Auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    // Rate-limited send
    const sendMessage = async () => {
        if (!input.trim() || !user || sending || isBanned) return;

        // Rate limit: 1 msg per 3 seconds
        const now = Date.now();
        if (now - lastSentAt < 3000) {
            return; // silently block
        }

        setSending(true);
        const msg = filterBadWords(input.trim());
        setInput("");
        setLastSentAt(now);

        await supabase.from("live_chat").insert({
            event_id: eventId,
            user_id: user.id,
            message: msg,
        });
        setSending(false);
    };

    // Ban user from chat (host only)
    const banUser = async (userId: string) => {
        if (!isHost || !user) return;
        await supabase.from("live_chat_bans").insert({
            event_id: eventId,
            user_id: userId,
            banned_by: user.id,
            reason: "Silenciado por el dealer",
        });
        setBannedUsers((prev) => new Set([...prev, userId]));
        // Hide their messages
        await supabase.from("live_chat")
            .update({ is_hidden: true })
            .eq("event_id", eventId)
            .eq("user_id", userId);
        setMessages((prev) => prev.filter((m) => m.user_id !== userId));
    };

    // Report message (any user)
    const reportMessage = async (msg: ChatMessage) => {
        if (!user) return;
        await supabase.from("live_reports").insert({
            event_id: eventId,
            reporter_id: user.id,
            reason: `Mensaje reportado: "${msg.message}" (de usuario ${msg.user_id.slice(0, 8)})`,
        });
        // Visual feedback — set local state
        alert("Mensaje reportado. Un administrador lo revisará.");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Filter out hidden/banned messages
    const visibleMessages = messages.filter(
        (m) => !m.is_hidden && !bannedUsers.has(m.user_id)
    );

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="text-sm font-bold text-foreground">Chat en Vivo</h3>
                <p className="text-xs text-muted-foreground">{visibleMessages.length} mensajes</p>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {visibleMessages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                        Sé el primero en enviar un mensaje 💬
                    </p>
                )}
                {visibleMessages.map((msg) => {
                    const isMe = msg.user_id === user?.id;
                    const isDealer = msg.user_id === dealerId;
                    return (
                        <div key={msg.id} className={`group flex gap-2 ${isMe ? "justify-end" : ""}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                                isMe
                                    ? "bg-accent text-accent-foreground font-medium"
                                    : isDealer
                                    ? "bg-red-600/20 text-foreground border border-red-500/30"
                                    : "bg-secondary/50 text-foreground"
                            }`}>
                                {!isMe && (
                                    <p className={`font-bold mb-0.5 text-[10px] ${isDealer ? "text-red-400" : "text-accent"}`}>
                                        {isDealer ? "🎙️ Dealer" : msg.user_id.slice(0, 8)}
                                    </p>
                                )}
                                {msg.message}
                            </div>

                            {/* Moderation buttons (visible on hover) */}
                            {!isMe && user && (
                                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                                    {isHost && (
                                        <button
                                            onClick={() => banUser(msg.user_id)}
                                            title="Silenciar usuario"
                                            className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                                        >
                                            <Ban className="h-3 w-3" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => reportMessage(msg)}
                                        title="Reportar mensaje"
                                        className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center hover:bg-amber-500/20 transition-colors"
                                    >
                                        <Flag className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            {isBanned ? (
                <div className="p-3 border-t border-border bg-red-500/5">
                    <div className="flex items-center gap-2 text-xs text-red-400">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Has sido silenciado en este chat por el dealer.</span>
                    </div>
                </div>
            ) : user ? (
                <div className="p-2 border-t border-border">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un mensaje..."
                            maxLength={200}
                            className="flex-1 bg-secondary/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || sending}
                            className="w-9 h-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 disabled:opacity-50 transition-colors shrink-0"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-3 border-t border-border text-center">
                    <p className="text-xs text-muted-foreground">
                        <a href="/auth" className="text-accent font-bold">Inicia sesión</a> para participar en el chat
                    </p>
                </div>
            )}
        </div>
    );
}
