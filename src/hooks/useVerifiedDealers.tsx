import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DealerInfo {
  name: string;
  isVerified: boolean;
  salesCount: number;
  manualTier: string | null;
  accountStatus: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
}

/**
 * Fetches dealer display info (name + verified status + sales count) for a set of user IDs.
 */
export function useVerifiedDealers(userIds: string[]) {
  const [dealers, setDealers] = useState<Record<string, DealerInfo>>({});
  const [loading, setLoading] = useState(false);

  const stableKey = useMemo(() => {
    const sorted = [...new Set(userIds)].filter(Boolean).sort();
    return sorted.join(",");
  }, [userIds]);

  useEffect(() => {
    const uniqueIds = stableKey ? stableKey.split(",") : [];
    if (uniqueIds.length === 0) {
      setDealers({});
      return;
    }

    const fetchDealers = async () => {
      setLoading(true);

      const [profilesRes, verificationsRes, salesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, city, state").in("id", uniqueIds),
        supabase
          .from("dealer_verification")
          .select("user_id, status, business_name, manual_tier, account_status")
          .in("user_id", uniqueIds)
          .eq("status", "approved")
          .order("created_at", { ascending: false }),
        // Count finalized auctions with a winner for each dealer (= completed sales)
        supabase
          .from("auctions")
          .select("created_by")
          .in("created_by", uniqueIds)
          .eq("status", "finalized")
          .not("winner_id", "is", null),
      ]);

      const profiles = profilesRes.data || [];
      const verifications = verificationsRes.data || [];
      const sales = salesRes.data || [];

      // Build verified map
      const verifiedMap = new Map<string, { name: string; manualTier: string | null; accountStatus: string }>();
      for (const v of verifications) {
        if (!verifiedMap.has(v.user_id)) {
          verifiedMap.set(v.user_id, {
            name: v.business_name,
            manualTier: (v as any).manual_tier || null,
            accountStatus: (v as any).account_status || "active",
          });
        }
      }

      // Count sales per dealer
      const salesCountMap = new Map<string, number>();
      for (const s of sales) {
        salesCountMap.set(s.created_by, (salesCountMap.get(s.created_by) || 0) + 1);
      }

      const result: Record<string, DealerInfo> = {};
      for (const p of profiles) {
        const isVerified = verifiedMap.has(p.id);
        const dealerData = verifiedMap.get(p.id);
        result[p.id] = {
          name: isVerified && dealerData ? dealerData.name : p.full_name,
          isVerified,
          salesCount: salesCountMap.get(p.id) || 0,
          manualTier: dealerData?.manualTier || null,
          accountStatus: dealerData?.accountStatus || "active",
          avatarUrl: (p as any).avatar_url || null,
          city: (p as any).city || null,
          state: (p as any).state || null,
        };
      }

      setDealers(result);
      setLoading(false);
    };

    fetchDealers();
  }, [stableKey]);

  return { dealers, loading };
}

/**
 * Fetches dealer info for a single user ID.
 */
export function useVerifiedDealer(userId: string | undefined) {
  const ids = useMemo(() => (userId ? [userId] : []), [userId]);
  const { dealers } = useVerifiedDealers(ids);
  return userId ? dealers[userId] || null : null;
}
