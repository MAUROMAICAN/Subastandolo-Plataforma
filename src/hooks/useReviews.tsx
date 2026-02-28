import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReviewData {
  id: string;
  auction_id: string;
  reviewer_id: string;
  reviewed_id: string;
  review_type: string;
  rating: number;
  comment: string | null;
  product_accuracy: number | null;
  attention_quality: number | null;
  shipping_speed: number | null;
  payment_compliance: number | null;
  communication_quality: number | null;
  tags: string[];
  created_at: string;
  reviewer_name?: string;
}

export interface ReputationStats {
  totalReviews: number;
  avgRating: number;
  positivePercentage: number;
  avgProductAccuracy: number;
  avgAttentionQuality: number;
  avgShippingSpeed: number;
  avgPaymentCompliance: number;
  avgCommunicationQuality: number;
}

const emptyStats: ReputationStats = {
  totalReviews: 0, avgRating: 0, positivePercentage: 0,
  avgProductAccuracy: 0, avgAttentionQuality: 0, avgShippingSpeed: 0,
  avgPaymentCompliance: 0, avgCommunicationQuality: 0,
};

/** Fetch reputation stats via DB computed function + reviews list */
export function useUserReviews(userId: string | undefined) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [dealerStats, setDealerStats] = useState<ReputationStats>(emptyStats);
  const [buyerStats, setBuyerStats] = useState<ReputationStats>(emptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetchAll = async () => {
      // Fetch reviews list + computed stats in parallel
      const [reviewsRes, dealerStatsRes, buyerStatsRes] = await Promise.all([
        supabase.from("reviews").select("*").eq("reviewed_id", userId).order("created_at", { ascending: false }),
        supabase.rpc("get_user_reputation_stats", { p_user_id: userId, p_review_type: "buyer_to_dealer" }),
        supabase.rpc("get_user_reputation_stats", { p_user_id: userId, p_review_type: "dealer_to_buyer" }),
      ]);

      // Parse computed stats
      const mapStats = (row: any): ReputationStats => row ? {
        totalReviews: Number(row.total_reviews) || 0,
        avgRating: Number(row.avg_rating) || 0,
        positivePercentage: Number(row.positive_percentage) || 0,
        avgProductAccuracy: Number(row.avg_product_accuracy) || 0,
        avgAttentionQuality: Number(row.avg_attention_quality) || 0,
        avgShippingSpeed: Number(row.avg_shipping_speed) || 0,
        avgPaymentCompliance: Number(row.avg_payment_compliance) || 0,
        avgCommunicationQuality: Number(row.avg_communication_quality) || 0,
      } : emptyStats;

      const dsData = Array.isArray(dealerStatsRes.data) ? dealerStatsRes.data[0] : dealerStatsRes.data;
      const bsData = Array.isArray(buyerStatsRes.data) ? buyerStatsRes.data[0] : buyerStatsRes.data;
      setDealerStats(mapStats(dsData));
      setBuyerStats(mapStats(bsData));

      // Fetch reviewer names
      const data = reviewsRes.data || [];
      const reviewerIds = [...new Set(data.map(r => (r as any).reviewer_id))];
      let names: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", reviewerIds);
        (profiles || []).forEach(p => { names[p.id] = p.full_name; });
      }

      setReviews(data.map(r => ({ ...r as any, reviewer_name: names[(r as any).reviewer_id] || "Usuario" })));
      setLoading(false);
    };
    fetchAll();
  }, [userId]);

  return { reviews, loading, dealerStats, buyerStats };
}

/** Fetch reviews for a specific auction */
export function useAuctionReviews(auctionId: string | undefined) {
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auctionId) { setLoading(false); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("auction_id", auctionId)
        .order("created_at", { ascending: false });

      const reviewerIds = [...new Set((data || []).map(r => (r as any).reviewer_id))];
      let names: Record<string, string> = {};
      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", reviewerIds);
        (profiles || []).forEach(p => { names[p.id] = p.full_name; });
      }

      setReviews((data || []).map(r => ({ ...r as any, reviewer_name: names[(r as any).reviewer_id] || "Usuario" })));
      setLoading(false);
    };
    fetch();
  }, [auctionId]);

  return { reviews, loading };
}
