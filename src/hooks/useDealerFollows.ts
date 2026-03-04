import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface FollowedDealer {
    dealer_id: string;
    created_at: string;
    profile: {
        full_name: string | null;
        avatar_url: string | null;
        city: string | null;
        state: string | null;
    } | null;
    is_verified: boolean;
    sales_count: number;
    live_auctions: number;
}

export function useDealerFollows(targetDealerId?: string) {
    const { user } = useAuth();
    const { toast } = useToast();

    // Is the current user following `targetDealerId`?
    const [isFollowing, setIsFollowing] = useState(false);
    const [loadingFollow, setLoadingFollow] = useState(false);

    // Full list of dealers the logged-in user follows
    const [followedDealers, setFollowedDealers] = useState<FollowedDealer[]>([]);
    const [loadingList, setLoadingList] = useState(false);

    // ── Check single-dealer follow status ──────────────────────────
    useEffect(() => {
        if (!user || !targetDealerId) return;
        supabase
            .from("dealer_follows" as any)
            .select("id")
            .eq("follower_id", user.id)
            .eq("dealer_id", targetDealerId)
            .maybeSingle()
            .then(({ data }) => setIsFollowing(!!data));
    }, [user, targetDealerId]);

    // ── Toggle follow / unfollow ────────────────────────────────────
    const toggleFollow = useCallback(async (dealerId: string) => {
        if (!user) {
            toast({ title: "Inicia sesión para seguir dealers", variant: "destructive" });
            return;
        }
        setLoadingFollow(true);
        if (isFollowing) {
            const { error } = await (supabase as any)
                .from("dealer_follows")
                .delete()
                .eq("follower_id", user.id)
                .eq("dealer_id", dealerId);
            if (!error) {
                setIsFollowing(false);
                setFollowedDealers(prev => prev.filter(d => d.dealer_id !== dealerId));
                toast({ title: "Dejaste de seguir a este dealer" });
            }
        } else {
            const { error } = await (supabase as any)
                .from("dealer_follows")
                .insert({ follower_id: user.id, dealer_id: dealerId });
            if (!error) {
                setIsFollowing(true);
                toast({ title: "✅ Ahora sigues a este dealer" });
                fetchFollowedDealers();
            }
        }
        setLoadingFollow(false);
    }, [user, isFollowing]);

    // ── Fetch full list of followed dealers ─────────────────────────
    const fetchFollowedDealers = useCallback(async () => {
        if (!user) return;
        setLoadingList(true);

        const { data: follows } = await (supabase as any)
            .from("dealer_follows")
            .select("dealer_id, created_at")
            .eq("follower_id", user.id)
            .order("created_at", { ascending: false });

        if (!follows || follows.length === 0) {
            setFollowedDealers([]);
            setLoadingList(false);
            return;
        }

        const dealerIds: string[] = follows.map((f: any) => f.dealer_id);

        // Batch-fetch profiles
        const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, city, state")
            .in("id", dealerIds);

        // Batch-fetch verified info
        const { data: verifiedList } = await (supabase as any)
            .from("verified_dealers")
            .select("user_id, sales_count, is_verified")
            .in("user_id", dealerIds);

        // Count live auctions per dealer
        const { data: liveAuctions } = await supabase
            .from("auctions")
            .select("created_by")
            .in("created_by", dealerIds)
            .eq("status", "active");

        const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
        const verifiedMap = Object.fromEntries((verifiedList || []).map((v: any) => [v.user_id, v]));
        const liveCountMap: Record<string, number> = {};
        (liveAuctions || []).forEach((a: any) => {
            liveCountMap[a.created_by] = (liveCountMap[a.created_by] || 0) + 1;
        });

        const result: FollowedDealer[] = follows.map((f: any) => ({
            dealer_id: f.dealer_id,
            created_at: f.created_at,
            profile: profileMap[f.dealer_id] ?? null,
            is_verified: verifiedMap[f.dealer_id]?.is_verified ?? false,
            sales_count: verifiedMap[f.dealer_id]?.sales_count ?? 0,
            live_auctions: liveCountMap[f.dealer_id] ?? 0,
        }));

        setFollowedDealers(result);
        setLoadingList(false);
    }, [user]);

    useEffect(() => {
        if (user && !targetDealerId) fetchFollowedDealers();
    }, [user, targetDealerId, fetchFollowedDealers]);

    return {
        isFollowing,
        loadingFollow,
        toggleFollow,
        followedDealers,
        loadingList,
        refetch: fetchFollowedDealers,
    };
}
