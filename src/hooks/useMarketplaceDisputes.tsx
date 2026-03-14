import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface MarketplaceDispute {
  id: string;
  order_id: string;
  product_id: string | null;
  buyer_id: string;
  seller_id: string;
  reason: string;
  description: string | null;
  evidence_urls: string[];
  status: string;
  resolution: string | null;
  resolution_type: string | null;
  refund_amount: number | null;
  seller_response: string | null;
  seller_evidence_urls: string[];
  seller_responded_at: string | null;
  admin_notes: string | null;
  mediated_by: string | null;
  seller_deadline: string | null;
  auto_resolve_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  product_title?: string;
  buyer_name?: string;
  seller_name?: string;
}

export const MARKETPLACE_DISPUTE_REASONS = [
  { value: "not_received", label: "No recibí el producto", icon: "📦" },
  { value: "not_as_described", label: "No coincide con la descripción", icon: "❌" },
  { value: "damaged", label: "Producto dañado o defectuoso", icon: "💔" },
  { value: "incomplete", label: "Producto incompleto (faltan piezas)", icon: "🧩" },
  { value: "other", label: "Otro motivo", icon: "❓" },
];

export const DISPUTE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "Abierta", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  seller_responded: { label: "Respondida por vendedor", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  in_mediation: { label: "En Mediación", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  resolved_buyer: { label: "Resuelta (a favor comprador)", color: "bg-green-500/10 text-green-600 border-green-200" },
  resolved_seller: { label: "Resuelta (a favor vendedor)", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  cancelled: { label: "Cancelada", color: "bg-muted text-muted-foreground" },
};

export function useMarketplaceDisputes(role?: "buyer" | "seller" | "admin") {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [disputes, setDisputes] = useState<MarketplaceDispute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisputes = async () => {
    if (!user) return;

    let query = supabase
      .from("marketplace_disputes" as any)
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by role unless admin
    if (role === "buyer") {
      query = query.eq("buyer_id", user.id);
    } else if (role === "seller") {
      query = query.eq("seller_id", user.id);
    }
    // admin sees all

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching marketplace disputes:", error);
      setLoading(false);
      return;
    }

    // Enrich with product titles and names
    const productIds = [...new Set((data || []).map((d: any) => d.product_id).filter(Boolean))];
    const userIds = [...new Set((data || []).flatMap((d: any) => [d.buyer_id, d.seller_id]))];

    const [productsRes, profilesRes] = await Promise.all([
      productIds.length > 0
        ? supabase.from("marketplace_products").select("id, title").in("id", productIds)
        : { data: [] },
      userIds.length > 0
        ? supabase.from("profiles").select("id, full_name").in("id", userIds)
        : { data: [] },
    ]);

    const productMap: Record<string, string> = {};
    (productsRes.data || []).forEach((p: any) => { productMap[p.id] = p.title; });

    const profileMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => { profileMap[p.id] = p.full_name; });

    const enriched: MarketplaceDispute[] = (data || []).map((d: any) => ({
      ...d,
      evidence_urls: d.evidence_urls || [],
      seller_evidence_urls: d.seller_evidence_urls || [],
      product_title: productMap[d.product_id] || "Producto",
      buyer_name: profileMap[d.buyer_id] || "Comprador",
      seller_name: profileMap[d.seller_id] || "Vendedor",
    }));

    setDisputes(enriched);
    setLoading(false);

    // Client-side auto-resolve: resolve expired disputes that the server hasn't caught yet
    const now = Date.now();
    const expired = enriched.filter(d =>
      d.status === "open" &&
      d.auto_resolve_at &&
      new Date(d.auto_resolve_at).getTime() < now
    );
    
    if (expired.length > 0 && (role === "admin" || role === "buyer")) {
      for (const d of expired) {
        await supabase.from("marketplace_disputes" as any).update({
          status: "resolved_buyer",
          resolution: "Resolución automática: el vendedor no respondió dentro del plazo de 3 días.",
          resolution_type: "auto_refund",
          updated_at: new Date().toISOString(),
        } as any).eq("id", d.id).eq("status", "open"); // eq status to prevent race conditions
      }
      // Re-fetch to show updated state
      fetchDisputes();
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [user]);

  const createDispute = async (
    orderId: string,
    productId: string,
    sellerId: string,
    reason: string,
    description: string,
    evidenceFiles: File[]
  ) => {
    if (!user) return null;

    // Upload evidence
    const evidenceUrls: string[] = [];
    for (const file of evidenceFiles) {
      const filePath = `marketplace/${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(filePath, file);
      if (!upErr) evidenceUrls.push(filePath);
    }

    const deadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days

    const { data, error } = await supabase.from("marketplace_disputes" as any).insert({
      order_id: orderId,
      product_id: productId,
      buyer_id: user.id,
      seller_id: sellerId,
      reason,
      description,
      evidence_urls: evidenceUrls,
      seller_deadline: deadline,
      auto_resolve_at: deadline,
    } as any).select().single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return null;
    }

    toast({ title: "📋 Disputa creada", description: "El vendedor tiene 3 días para responder." });
    fetchDisputes();
    return data;
  };

  const respondAseSeller = async (disputeId: string, response: string, evidenceFiles: File[]) => {
    if (!user) return;

    const evidenceUrls: string[] = [];
    for (const file of evidenceFiles) {
      const filePath = `marketplace/${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("dispute-evidence").upload(filePath, file);
      if (!upErr) evidenceUrls.push(filePath);
    }

    const { error } = await supabase.from("marketplace_disputes" as any).update({
      seller_response: response,
      seller_evidence_urls: evidenceUrls,
      seller_responded_at: new Date().toISOString(),
      status: "seller_responded",
    } as any).eq("id", disputeId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Respuesta enviada", description: "Tu respuesta ha sido registrada." });
      fetchDisputes();
    }
  };

  const resolveDispute = async (
    disputeId: string,
    inFavorOf: "buyer" | "seller",
    resolutionType: string,
    resolution: string,
    refundAmount?: number
  ) => {
    if (!user || !isAdmin) return;

    const { error } = await supabase.from("marketplace_disputes" as any).update({
      status: inFavorOf === "buyer" ? "resolved_buyer" : "resolved_seller",
      resolution,
      resolution_type: resolutionType,
      refund_amount: refundAmount || null,
      mediated_by: user.id,
      admin_notes: resolution,
    } as any).eq("id", disputeId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "⚖️ Disputa resuelta", description: `Resuelta a favor del ${inFavorOf === "buyer" ? "comprador" : "vendedor"}.` });
      fetchDisputes();
    }
  };

  const escalateToMediation = async (disputeId: string) => {
    const { error } = await supabase.from("marketplace_disputes" as any).update({
      status: "in_mediation",
    } as any).eq("id", disputeId);

    if (!error) {
      toast({ title: "⚖️ Escalada a mediación", description: "Un administrador revisará tu caso." });
      fetchDisputes();
    }
  };

  return {
    disputes,
    loading,
    createDispute,
    respondAseSeller,
    resolveDispute,
    escalateToMediation,
    refetch: fetchDisputes,
  };
}
