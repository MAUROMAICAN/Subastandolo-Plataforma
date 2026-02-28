import { useState, useRef, useEffect } from "react";
import { useDisputeMessages } from "@/hooks/useDisputes";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Shield } from "lucide-react";

interface DisputeChatProps {
  disputeId: string;
  disputeStatus: string;
}

const DisputeChat = ({ disputeId, disputeStatus }: DisputeChatProps) => {
  const { user, isAdmin } = useAuth();
  const { messages, loading, sendMessage } = useDisputeMessages(disputeId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    await sendMessage(text.trim());
    setText("");
    setSending(false);
  };

  const isClosed = disputeStatus === "resolved" || disputeStatus === "refunded";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[400px]">
        {loading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${msg.is_system ? "justify-center" : isMe ? "justify-end" : "justify-start"}`}>
              {msg.is_system ? (
                <div className="bg-muted text-muted-foreground text-xs px-3 py-1.5 rounded-full flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {msg.content}
                </div>
              ) : (
                <div className={`max-w-[80%] rounded-sm px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  <p className="text-[10px] font-semibold opacity-70 mb-0.5">{msg.sender_name}</p>
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-[9px] opacity-50 mt-1">
                    {new Date(msg.created_at).toLocaleString("es-MX", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!isClosed ? (
        <div className="border-t border-border p-2 flex gap-2">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Escribe un mensaje..."
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            className="rounded-sm"
          />
          <Button size="icon" onClick={handleSend} disabled={!text.trim() || sending} className="shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ) : (
        <div className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          Esta disputa ha sido cerrada.
        </div>
      )}
    </div>
  );
};

export default DisputeChat;
