// @ts-nocheck — live_* tables not yet in generated Supabase types; remove after migration + type regen
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Send } from "lucide-react";

interface ChatMessage {
    id: string;
    user_id: string;
    message: string;
    created_at: string;
    profiles?: { display_name: string; avatar_url: string };
}

export default function LiveChat({ eventId }: { eventId: string }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load initial messages + subscribe to new ones
    useEffect(() => {
        const loadMessages = async () => {
            const { data } = await supabase
                .from("live_chat")
                .select("id, user_id, message, created_at")
                .eq("event_id", eventId)
                .order("created_at", { ascending: true })
                .limit(200);
            if (data) setMessages(data as ChatMessage[]);
        };
        loadMessages();

        // Realtime subscription
        const channel = supabase
            .channel(`live-chat-${eventId}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "live_chat", filter: `event_id=eq.${eventId}` },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as ChatMessage]);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [eventId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || !user || sending) return;
        setSending(true);
        const msg = input.trim();
        setInput("");

        await supabase.from("live_chat").insert({
            event_id: eventId,
            user_id: user.id,
            message: msg,
        });
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-secondary/30">
                <h3 className="text-sm font-bold text-foreground">Chat en Vivo</h3>
                <p className="text-xs text-muted-foreground">{messages.length} mensajes</p>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                {messages.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                        Sé el primero en enviar un mensaje 💬
                    </p>
                )}
                {messages.map((msg) => {
                    const isMe = msg.user_id === user?.id;
                    return (
                        <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : ""}`}>
                            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                                isMe
                                    ? "bg-accent text-accent-foreground font-medium"
                                    : "bg-secondary/50 text-foreground"
                            }`}>
                                {!isMe && (
                                    <p className="font-bold text-accent mb-0.5 text-[10px]">
                                        {msg.user_id.slice(0, 8)}
                                    </p>
                                )}
                                {msg.message}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            {user ? (
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
