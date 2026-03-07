import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Send, MessageCircle, Search } from "lucide-react";
import type { DealerUser, Message } from "./types";

interface Props {
  dealers: DealerUser[];
  messages: Message[];
  dealerProfiles: Record<string, { full_name: string; phone: string | null; email: string | null }>;
  fetchAllData: () => Promise<void>;
  globalSearch?: string;
}

const AdminMessagesTab = ({ dealers, messages, dealerProfiles, fetchAllData, globalSearch = "" }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [dealerSearch, setDealerSearch] = useState("");

  useEffect(() => { if (globalSearch) setDealerSearch(globalSearch); }, [globalSearch]);

  const totalUnread = messages.filter(m => m.receiver_id === user?.id && !m.is_read).length;
  const filteredDealers = dealers.filter(d => d.full_name.toLowerCase().includes(dealerSearch.toLowerCase()));

  const handleSendMessage = async () => {
    if (!selectedDealerId || !messageText.trim() || !user) return;
    setSendingMessage(true);
    await supabase.from("messages").insert({ sender_id: user.id, receiver_id: selectedDealerId, content: messageText.trim() });
    toast({ title: "Mensaje enviado" }); setMessageText(""); setSendingMessage(false); fetchAllData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary dark:text-accent" /> Mensajes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Comunicación directa con dealers</p>
        </div>
        {totalUnread > 0 && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20 animate-pulse">{totalUnread} sin leer</Badge>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border border-border rounded-sm md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-heading">Dealers</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} placeholder="Buscar dealer..." className="rounded-sm text-xs h-8 pl-8" />
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredDealers.map(d => {
                const unread = messages.filter(m => m.sender_id === d.user_id && m.receiver_id === user?.id && !m.is_read).length;
                return (
                  <button key={d.user_id} onClick={() => setSelectedDealerId(d.user_id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs border-b border-border hover:bg-secondary/30 transition-colors ${selectedDealerId === d.user_id ? "bg-primary/5" : ""}`}>
                    <User className="h-3.5 w-3.5 text-muted-foreground dark:text-gray-300 shrink-0" />
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
                <div className="px-4 py-2.5 border-b border-border bg-secondary/30"><p className="text-xs font-medium">{dealerProfiles[selectedDealerId]?.full_name || "Dealer"}</p></div>
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
              <div className="flex-1 flex items-center justify-center text-muted-foreground dark:text-gray-300 text-xs">Selecciona un dealer para chatear</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMessagesTab;
