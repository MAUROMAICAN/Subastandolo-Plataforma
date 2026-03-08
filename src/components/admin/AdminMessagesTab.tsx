import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageCircle, Send, Search, Loader2, Users, Mail, MailOpen,
  MessagesSquare, Trash2, CheckCheck, Check, UserPlus
} from "lucide-react";

interface ContactUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  auction_id: string | null;
}

const AdminMessagesTab = ({ globalSearch = "" }: { globalSearch?: string }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactUser[]>([]);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactUser | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [searchResults, setSearchResults] = useState<ContactUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (globalSearch) setContactSearch(globalSearch); }, [globalSearch]);

  useEffect(() => { fetchData(); }, []);

  // Auto-scroll to bottom when messages change or contact selected
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedContact, allMessages]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const [messagesRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("messages").select("*")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("profiles").select("id, full_name, avatar_url"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const msgs = (messagesRes.data || []) as ChatMessage[];
    setAllMessages(msgs);

    // Build profile map
    const profileMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
    (profilesRes.data || []).forEach((p: any) => {
      profileMap[p.id] = { full_name: p.full_name || "Sin nombre", avatar_url: p.avatar_url };
    });

    // Build roles map
    const rolesMap: Record<string, string[]> = {};
    (rolesRes.data || []).forEach((r: any) => {
      if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
      rolesMap[r.user_id].push(r.role);
    });

    // Build contacts from messages — everyone who has messaged admin or admin has messaged
    const contactIds = new Set<string>();
    msgs.forEach(m => {
      if (m.sender_id !== user.id) contactIds.add(m.sender_id);
      if (m.receiver_id !== user.id) contactIds.add(m.receiver_id);
    });

    const contactList: ContactUser[] = Array.from(contactIds).map(id => {
      const profile = profileMap[id];
      const userMsgs = msgs.filter(m =>
        (m.sender_id === id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === id)
      );
      const lastMsg = userMsgs[0]; // Already sorted desc
      const unread = userMsgs.filter(m => m.sender_id === id && m.receiver_id === user.id && !m.is_read).length;
      const roles = rolesMap[id] || [];
      const role = roles.includes("admin") ? "admin" : roles.includes("dealer") ? "dealer" : "user";

      return {
        id,
        full_name: profile?.full_name || "Usuario",
        avatar_url: profile?.avatar_url || null,
        role,
        last_message: lastMsg?.content || "",
        last_message_at: lastMsg?.created_at || "",
        unread_count: unread,
      };
    });

    // Sort: unread first, then by most recent message
    contactList.sort((a, b) => {
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (b.unread_count > 0 && a.unread_count === 0) return 1;
      return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
    });

    setContacts(contactList);
    setLoading(false);
  };

  // Stats
  const stats = useMemo(() => {
    const totalMessages = allMessages.length;
    const unreadMessages = allMessages.filter(m => m.receiver_id === user?.id && !m.is_read).length;
    const activeConversations = contacts.length;
    const todayMessages = allMessages.filter(m => {
      const d = new Date(m.created_at);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length;
    return { totalMessages, unreadMessages, activeConversations, todayMessages };
  }, [allMessages, contacts, user]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => c.full_name.toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  // Search all users when typing
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!contactSearch || contactSearch.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    searchTimeout.current = setTimeout(() => {
      searchAllUsers(contactSearch);
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [contactSearch]);

  const searchAllUsers = async (query: string) => {
    if (!user) return;
    setSearchingUsers(true);
    const q = query.toLowerCase().trim();

    // Fetch profiles by name + emails in parallel
    const [profilesRes, rolesRes, emailsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").ilike("full_name", `%${q}%`).limit(15),
      supabase.from("user_roles").select("user_id, role"),
      supabase.functions.invoke("admin-manage-user", { body: { action: "list_users", userId: "all" } }),
    ]);

    const profiles = profilesRes.data || [];
    const emailMap: Record<string, string> = emailsRes.data?.emails || {};

    // Find users whose email matches the query
    const emailMatchIds = new Set<string>();
    for (const [uid, email] of Object.entries(emailMap)) {
      if (email.toLowerCase().includes(q)) emailMatchIds.add(uid);
    }

    // Fetch profiles for email matches not already in name results
    const nameIds = new Set(profiles.map(p => p.id));
    const extraIds = Array.from(emailMatchIds).filter(id => !nameIds.has(id));
    let extraProfiles: any[] = [];
    if (extraIds.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", extraIds.slice(0, 10));
      extraProfiles = data || [];
    }

    const allProfiles = [...profiles, ...extraProfiles];

    const rolesMap: Record<string, string> = {};
    (rolesRes.data || []).forEach((r: any) => {
      if (r.role === "admin") rolesMap[r.user_id] = "admin";
      else if (!rolesMap[r.user_id]) rolesMap[r.user_id] = r.role === "dealer" ? "dealer" : "user";
    });

    const existingIds = new Set(contacts.map(c => c.id));
    const seen = new Set<string>();
    const results: ContactUser[] = allProfiles
      .filter(p => {
        if (p.id === user.id || existingIds.has(p.id) || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map(p => ({
        id: p.id,
        full_name: p.full_name || "Sin nombre",
        avatar_url: (p as any).avatar_url || null,
        role: rolesMap[p.id] || "user",
        last_message: emailMap[p.id] || "",
        last_message_at: "",
        unread_count: 0,
      }));

    setSearchResults(results);
    setSearchingUsers(false);
  };

  // Messages for selected contact
  const chatMessages = useMemo(() => {
    if (!selectedContact || !user) return [];
    return allMessages
      .filter(m =>
        (m.sender_id === selectedContact.id && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === selectedContact.id)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [selectedContact, allMessages, user]);

  // Mark messages as read when selecting a contact
  const handleSelectContact = async (contact: ContactUser) => {
    setSelectedContact(contact);
    if (contact.unread_count > 0 && user) {
      await supabase.from("messages").update({ is_read: true })
        .eq("sender_id", contact.id)
        .eq("receiver_id", user.id)
        .eq("is_read", false);
      setContacts(prev => prev.map(c =>
        c.id === contact.id ? { ...c, unread_count: 0 } : c
      ));
      setAllMessages(prev => prev.map(m =>
        m.sender_id === contact.id && m.receiver_id === user.id ? { ...m, is_read: true } : m
      ));
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContact || !messageText.trim() || !user) return;
    setSendingMessage(true);

    const { data, error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: selectedContact.id,
      content: messageText.trim(),
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data) {
      // Update local state immediately
      const newMsg = data as ChatMessage;
      setAllMessages(prev => [newMsg, ...prev]);
      setContacts(prev => prev.map(c =>
        c.id === selectedContact.id
          ? { ...c, last_message: newMsg.content, last_message_at: newMsg.created_at }
          : c
      ));
      toast({ title: "✅ Mensaje enviado" });
    }

    setMessageText("");
    setSendingMessage(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAllMessages(prev => prev.filter(m => m.id !== messageId));
      toast({ title: "🗑️ Mensaje eliminado" });
    }
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { label: string; class: string }> = {
      admin: { label: "Admin", class: "bg-primary/10 text-primary dark:text-accent border-primary/20" },
      dealer: { label: "Dealer", class: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
      user: { label: "Usuario", class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
    };
    const c = config[role] || config.user;
    return <Badge variant="outline" className={`text-[9px] ${c.class}`}>{c.label}</Badge>;
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const oneDay = 86400000;

    if (diff < oneDay && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    }
    if (diff < oneDay * 2) return "Ayer";
    if (diff < oneDay * 7) return d.toLocaleDateString("es-MX", { weekday: "short" });
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary dark:text-accent" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-heading font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary dark:text-accent" /> Mensajes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comunicación directa con usuarios de la plataforma
          </p>
        </div>
        <Button variant="outline" size="sm" className="text-xs h-8 rounded-sm gap-1.5" onClick={fetchData}>
          <Loader2 className="h-3 w-3" /> Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Conversaciones", value: stats.activeConversations, icon: MessagesSquare, color: "text-primary dark:text-accent" },
          { label: "Sin Leer", value: stats.unreadMessages, icon: Mail, color: stats.unreadMessages > 0 ? "text-destructive" : "text-primary dark:text-accent" },
          { label: "Mensajes Hoy", value: stats.todayMessages, icon: MailOpen, color: "text-foreground" },
          { label: "Total Mensajes", value: stats.totalMessages, icon: MessageCircle, color: "text-muted-foreground" },
        ].map((stat, idx) => (
          <Card key={idx} className="border border-border rounded-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] text-muted-foreground dark:text-gray-300 font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
              <p className={`text-lg font-heading font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 border border-border rounded-sm overflow-hidden bg-card" style={{ height: "calc(100vh - 340px)", minHeight: "450px" }}>

        {/* Contact List */}
        <div className="border-r border-border flex flex-col overflow-hidden md:max-h-none max-h-[200px] md:max-h-full">
          <div className="p-3 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Buscar por nombre o correo..."
                className="rounded-sm text-xs h-8 pl-8"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 && (!contactSearch || contactSearch.length < 2 || (searchResults.length === 0 && !searchingUsers)) && (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {contactSearch ? "Buscando usuarios..." : "No hay conversaciones"}
                </p>
              </div>
            )}

            {/* Existing contacts */}
            {filteredContacts.map(contact => (
              <button
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                className={`w-full flex items-center gap-2.5 px-3 py-3 text-left border-b border-border/50 hover:bg-secondary/30 transition-colors ${selectedContact?.id === contact.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9">
                    {contact.avatar_url && <AvatarImage src={contact.avatar_url} alt={contact.full_name} className="object-cover" />}
                    <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-xs font-bold">
                      {(contact.full_name || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {contact.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">
                      {contact.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-xs truncate ${contact.unread_count > 0 ? "font-bold" : "font-medium"}`}>
                      {contact.full_name}
                    </span>
                    {contact.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTime(contact.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getRoleBadge(contact.role)}
                    <span className={`text-[10px] truncate ${contact.unread_count > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {contact.last_message || "Sin mensajes"}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Global search results — new users not in contacts */}
            {contactSearch && contactSearch.length >= 2 && searchResults.length > 0 && (
              <>
                <div className="px-3 py-2 bg-secondary/30 border-y border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
                    <UserPlus className="h-3 w-3" /> Nuevos usuarios encontrados
                  </p>
                </div>
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    onClick={() => {
                      // Add to contacts and select
                      setContacts(prev => {
                        if (prev.some(c => c.id === result.id)) return prev;
                        return [result, ...prev];
                      });
                      setSelectedContact(result);
                      setContactSearch("");
                      setSearchResults([]);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left border-b border-border/50 hover:bg-primary/5 transition-colors"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {result.avatar_url && <AvatarImage src={result.avatar_url} alt={result.full_name} className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-xs font-bold">
                        {(result.full_name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block truncate">{result.full_name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {getRoleBadge(result.role)}
                        <span className="text-[10px] text-muted-foreground">{result.last_message || "Iniciar conversación"}</span>
                      </div>
                    </div>
                    <UserPlus className="h-3.5 w-3.5 text-primary dark:text-accent shrink-0" />
                  </button>
                ))}
              </>
            )}
            {contactSearch && contactSearch.length >= 2 && searchingUsers && searchResults.length === 0 && filteredContacts.length > 0 && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex flex-col min-h-0">
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    {selectedContact.avatar_url && <AvatarImage src={selectedContact.avatar_url} alt={selectedContact.full_name} className="object-cover" />}
                    <AvatarFallback className="bg-primary/10 text-primary dark:text-accent text-xs font-bold">
                      {(selectedContact.full_name || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold leading-tight">{selectedContact.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {getRoleBadge(selectedContact.role)}
                      <span className="text-[10px] text-muted-foreground">{chatMessages.length} mensajes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageCircle className="h-10 w-10 text-muted-foreground/15 mb-2" />
                    <p className="text-xs text-muted-foreground">No hay mensajes aún</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Envía el primer mensaje</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isAdmin = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"} group`}>
                        <div className={`max-w-[75%] relative`}>
                          <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${isAdmin
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary border border-border rounded-bl-sm"
                            }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <div className={`flex items-center gap-1.5 mt-1 ${isAdmin ? "justify-end" : "justify-start"}`}>
                            <span className={`text-[10px] ${isAdmin ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                              {new Date(msg.created_at).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                            </span>
                            {isAdmin && (
                              <span className="text-[10px]">
                                {msg.is_read
                                  ? <CheckCheck className="h-3 w-3 text-primary dark:text-accent inline" />
                                  : <Check className="h-3 w-3 text-muted-foreground inline" />
                                }
                              </span>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive"
                                title="Eliminar mensaje"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
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
              <div className="p-3 border-t border-border bg-card shrink-0">
                <div className="flex gap-2">
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="rounded-sm text-xs h-9"
                    maxLength={2000}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={sendingMessage || !messageText.trim()}
                    className="rounded-sm h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {sendingMessage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-full bg-primary/5 dark:bg-accent/5 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-primary/30 dark:text-accent/30" />
              </div>
              <h3 className="text-sm font-heading font-bold mb-1">Centro de Mensajes</h3>
              <p className="text-xs text-muted-foreground max-w-[250px]">
                Selecciona una conversación para ver los mensajes o busca un usuario para iniciar una nueva.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessagesTab;
