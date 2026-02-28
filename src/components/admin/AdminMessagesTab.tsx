import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Send } from "lucide-react";
import type { DealerUser, Message } from "./types";

interface Props {
  dealers: DealerUser[];
  messages: Message[];
  dealerProfiles: Record<string, string>;
  fetchAllData: () => Promise<void>;
}

const AdminMessagesTab = ({ dealers, messages, dealerProfiles, fetchAllData }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const handleSendMessage = async () => {
    if (!selectedDealerId || !messageText.trim() || !user) return;
    setSendingMessage(true);
    await supabase.from("messages").insert({ sender_id: user.id, receiver_id: selectedDealerId, content: messageText.trim() });
    toast({ title: "Mensaje enviado" }); setMessageText(""); setSendingMessage(false); fetchAllData();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-heading font-bold">Mensajes</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border rounded-sm md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-heading">Dealers</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {dealers.map(d => {
                const unread = messages.filter(m => m.sender_id === d.user_id && m.receiver_id === user?.id && !m.is_read).length;
                return (
                  <button key={d.user_id} onClick={() => setSelectedDealerId(d.user_id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs border-b border-border hover:bg-secondary/30 transition-colors ${selectedDealerId === d.user_id ? "bg-primary/5" : ""}`}>
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-left truncate">{d.full_name}</span>
                    {unread > 0 && <span className="w-5 h-5 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">{unread}</span>}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border rounded-sm md:col-span-2">
          <CardContent className="p-0 flex flex-col h-96">
            {selectedDealerId ? (
              <>
                <div className="px-4 py-2.5 border-b border-border bg-secondary/30"><p className="text-xs font-medium">{dealerProfiles[selectedDealerId] || "Dealer"}</p></div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.filter(m => (m.sender_id === selectedDealerId && m.receiver_id === user?.id) || (m.sender_id === user?.id && m.receiver_id === selectedDealerId))
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(m => (
                      <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-sm text-xs ${m.sender_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                          <p>{m.content}</p>
                          <p className={`text-[10px] mt-1 ${m.sender_id === user?.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{new Date(m.created_at).toLocaleString("es-MX")}</p>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="p-3 border-t border-border flex gap-2">
                  <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Escribe un mensaje..." className="rounded-sm text-xs" maxLength={1000}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                  <Button size="sm" onClick={handleSendMessage} disabled={sendingMessage || !messageText.trim()} className="rounded-sm"><Send className="h-3.5 w-3.5" /></Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">Selecciona un dealer para chatear</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMessagesTab;
