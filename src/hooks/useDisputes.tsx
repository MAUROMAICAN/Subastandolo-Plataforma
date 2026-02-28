import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface Dispute {
  id: string;
  auction_id: string;
  buyer_id: string;
  dealer_id: string;
  category: string;
  description: string;
  status: string;
  evidence_urls: string[];
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  dealer_deadline: string | null;
  admin_requested: boolean;
  admin_requested_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  auction_title?: string;
  buyer_name?: string;
  dealer_name?: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  sender_name?: string;
}

const DISPUTE_CATEGORIES = [
  "Producto no coincide con las fotos",
  "Producto defectuoso o no funciona",
  "Faltan piezas o accesorios descritos",
  "El producto llegó dañado por el envío",
];

export { DISPUTE_CATEGORIES };

export function useDisputes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisputes = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching disputes:", error);
      setLoading(false);
      return;
    }

    // Enrich with names
    const auctionIds = [...new Set((data || []).map(d => d.auction_id))];
    const userIds = [...new Set((data || []).flatMap(d => [d.buyer_id, d.dealer_id]))];

    const [auctionsRes, profilesRes] = await Promise.all([
      auctionIds.length > 0 ? supabase.from("auctions").select("id, title").in("id", auctionIds) : { data: [] },
      userIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] },
    ]);

    const auctionMap: Record<string, string> = {};
    (auctionsRes.data || []).forEach((a: any) => { auctionMap[a.id] = a.title; });

    const profileMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });

    const enriched: Dispute[] = (data || []).map(d => ({
      ...d,
      evidence_urls: d.evidence_urls || [],
      auction_title: auctionMap[d.auction_id] || "Subasta",
      buyer_name: profileMap[d.buyer_id] || "Comprador",
      dealer_name: profileMap[d.dealer_id] || "Dealer",
    }));

    setDisputes(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchDisputes();
  }, [user]);

  const createDispute = async (auctionId: string, dealerId: string, category: string, description: string, evidenceFiles: File[], desiredResolution?: string, signatureData?: string) => {
    if (!user) return null;

    // Upload evidence
    const evidenceUrls: string[] = [];
    for (const file of evidenceFiles) {
      const filePath = `${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(filePath, file);
      if (!upErr) {
        // Store path for signed URL generation later
        evidenceUrls.push(filePath);
      }
    }

    const { data, error } = await supabase.from("disputes").insert({
      auction_id: auctionId,
      buyer_id: user.id,
      dealer_id: dealerId,
      category,
      description,
      evidence_urls: evidenceUrls,
      dealer_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      desired_resolution: desiredResolution || null,
      signature_data: signatureData || null,
    }).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }

    // Add system message
    await supabase.from("dispute_messages").insert({
      dispute_id: data.id,
      sender_id: user.id,
      content: `Disputa abierta: ${category}`,
      is_system: true,
    });

    // Notify dealer via email
    supabase.functions.invoke("notify-dispute", {
      body: { dispute_id: data.id },
    }).catch(err => console.error("Error notifying dealer:", err));

    toast({ title: "📋 Disputa creada", description: "El dealer tiene 48 horas para responder." });
    fetchDisputes();
    return data;
  };

  const requestAdminIntervention = async (disputeId: string) => {
    const { error } = await supabase.from("disputes").update({
      admin_requested: true,
      admin_requested_at: new Date().toISOString(),
      status: "mediation",
    }).eq("id", disputeId);

    if (!error) {
      toast({ title: "⚖️ Intervención solicitada", description: "Un administrador revisará tu caso." });
      fetchDisputes();
    }
  };

  return { disputes, loading, createDispute, requestAdminIntervention, refetch: fetchDisputes };
}

export function useDisputeMessages(disputeId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!disputeId) return;
    const { data } = await supabase
      .from("dispute_messages")
      .select("*")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });

    if (data) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", senderIds);
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p.full_name; });

      setMessages(data.map(m => ({
        ...m,
        is_system: m.is_system || false,
        sender_name: profileMap[m.sender_id] || "Usuario",
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    if (!disputeId) return;
    const channel = supabase
      .channel(`dispute-msgs-${disputeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${disputeId}` },
        () => fetchMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [disputeId]);

  const sendMessage = async (content: string) => {
    if (!user || !disputeId) return;
    await supabase.from("dispute_messages").insert({
      dispute_id: disputeId,
      sender_id: user.id,
      content,
    });
  };

  return { messages, loading, sendMessage };
}
