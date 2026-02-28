import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }
    const fetch = async () => {
      const { data } = await supabase
        .from("favorites")
        .select("auction_id")
        .eq("user_id", user.id);
      setFavoriteIds(new Set((data || []).map((f: any) => f.auction_id)));
      setLoading(false);
    };
    fetch();
  }, [user]);

  const toggleFavorite = useCallback(async (auctionId: string) => {
    if (!user) return;
    const isFav = favoriteIds.has(auctionId);
    if (isFav) {
      setFavoriteIds(prev => { const n = new Set(prev); n.delete(auctionId); return n; });
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("auction_id", auctionId);
    } else {
      setFavoriteIds(prev => new Set(prev).add(auctionId));
      await supabase.from("favorites").insert({ user_id: user.id, auction_id: auctionId });
    }
  }, [user, favoriteIds]);

  const isFavorite = useCallback((auctionId: string) => favoriteIds.has(auctionId), [favoriteIds]);

  return { favoriteIds, toggleFavorite, isFavorite, loading };
}
