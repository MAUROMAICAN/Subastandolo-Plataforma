import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Headphones, Send, Loader2, MessageSquare, Clock, CheckCheck
} from "lucide-react";

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    is_read: boolean;
    created_at: string;
}

export default function DealerSupportInbox() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [adminProfiles, setAdminProfiles] = useState<Record<string, string>>({});
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user) {
            fetchMessages();
            fetchAdminProfiles();
            // Subscribe to new messages in real-time
            const channel = supabase
                .channel("dealer-support-messages")
                .on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${user.id}`,
                }, () => fetchMessages())
                .subscribe();

            return () => { void supabase.removeChannel(channel); };
        }
        return undefined;
    }, [user]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Mark messages as read when viewed
    useEffect(() => {
        if (user && messages.length > 0) {
            const unread = messages.filter(m => m.receiver_id === user.id && !m.is_read);
            if (unread.length > 0) {
                supabase.from("messages")
                    .update({ is_read: true })
                    .in("id", unread.map(m => m.id))
                    .then(() => { });
            }
        }
    }, [messages, user]);

    const fetchMessages = async () => {
        if (!user) return;
        const { data } = await supabase
            .from("messages")
            .select("*")
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order("created_at", { ascending: true });

        // Filter to only admin conversations
        setMessages((data || []) as Message[]);
        setLoading(false);
    };

    const fetchAdminProfiles = async () => {
        // Get admin user IDs
        const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
        if (!adminRoles || adminRoles.length === 0) return;
        const adminIds = adminRoles.map((r: any) => r.user_id);
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", adminIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => { map[p.id] = p.full_name || "Soporte"; });
        setAdminProfiles(map);
    };

    // Filter messages to only those exchanged with admins
    const adminIds = Object.keys(adminProfiles);
    const supportMessages = messages.filter(m =>
        adminIds.includes(m.sender_id) || adminIds.includes(m.receiver_id)
    );

    const handleSend = async () => {
        if (!newMessage.trim() || !user) return;
        setSending(true);

        // Find the first admin to reply to, or use the most recent conversation
        let targetAdmin = "";
        for (let i = supportMessages.length - 1; i >= 0; i--) {
            const m = supportMessages[i];
            if (adminIds.includes(m.sender_id)) { targetAdmin = m.sender_id; break; }
            if (adminIds.includes(m.receiver_id)) { targetAdmin = m.receiver_id; break; }
        }
        // If no previous conversation, send to first admin
        if (!targetAdmin && adminIds.length > 0) targetAdmin = adminIds[0];

        if (!targetAdmin) {
            toast({ title: "Error", description: "No se encontró un administrador disponible.", variant: "destructive" });
            setSending(false);
            return;
        }

        const { error } = await supabase.from("messages").insert({
            sender_id: user.id,
            receiver_id: targetAdmin,
            content: newMessage.trim(),
        });

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setNewMessage("");
            fetchMessages();
        }
        setSending(false);
    };

    const unreadCount = supportMessages.filter(m => m.receiver_id === user?.id && !m.is_read).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#A6E300]" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                        <Headphones className="h-5 w-5 text-primary dark:text-[#A6E300]" /> Soporte
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {supportMessages.length} mensajes · {unreadCount > 0 ? `${unreadCount} sin leer` : "todo leído"}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Badge className="bg-primary/15 text-primary dark:text-accent border-0 text-xs">{unreadCount} nuevos</Badge>
                )}
            </div>

            {/* Chat Area */}
            <Card className="border border-border rounded-sm overflow-hidden">
                <CardContent className="p-0">
                    {/* Messages */}
                    <div className="h-[400px] overflow-y-auto p-4 space-y-3 bg-secondary/10">
                        {supportMessages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">Sin mensajes de soporte</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[250px]">
                                    Cuando un administrador te contacte, verás los mensajes aquí. También puedes iniciar una conversación.
                                </p>
                            </div>
                        ) : (
                            supportMessages.map((msg) => {
                                const isMe = msg.sender_id === user?.id;
                                const senderName = isMe ? "Tú" : (adminProfiles[msg.sender_id] || "Soporte");
                                return (
                                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[80%] ${isMe ? "order-2" : ""}`}>
                                            <div className={`rounded-sm px-3 py-2 text-sm ${isMe
                                                ? "bg-primary text-primary-foreground dark:bg-accent dark:text-accent-foreground"
                                                : "bg-card border border-border"
                                                }`}>
                                                {!isMe && (
                                                    <p className="text-[10px] font-bold text-primary dark:text-accent mb-0.5 flex items-center gap-1">
                                                        <Headphones className="h-2.5 w-2.5" /> {senderName}
                                                    </p>
                                                )}
                                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                            </div>
                                            <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
                                                <span className="text-[9px] text-muted-foreground">
                                                    {new Date(msg.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                {isMe && (
                                                    msg.is_read
                                                        ? <CheckCheck className="h-2.5 w-2.5 text-primary dark:text-accent" />
                                                        : <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-border p-3 bg-card">
                        <div className="flex gap-2">
                            <Textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe tu mensaje al soporte..."
                                className="min-h-[40px] max-h-[80px] text-sm rounded-sm resize-none"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <Button
                                onClick={handleSend}
                                disabled={sending || !newMessage.trim()}
                                className="rounded-sm bg-primary text-primary-foreground h-10 w-10 p-0 shrink-0"
                            >
                                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1">Presiona Enter para enviar · Shift+Enter para nueva línea</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
