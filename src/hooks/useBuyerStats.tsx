import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Returns the number of finalized auctions won by a user */
export function useBuyerWins(userId: string | undefined) {
  const [winsCount, setWinsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetch = async () => {
      const { count } = await supabase
        .from("auctions")
        .select("id", { count: "exact", head: true })
        .eq("winner_id", userId)
        .eq("status", "finalized");
      setWinsCount(count || 0);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  return { winsCount, loading };
}
