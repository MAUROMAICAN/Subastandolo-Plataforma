import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useVerifiedDealer } from "@/hooks/useVerifiedDealers";
import { useUserReviews } from "@/hooks/useReviews";
import VerifiedBadge, { getDealerTier } from "@/components/VerifiedBadge";
import ReputationThermometer from "@/components/ReputationThermometer";
import { Store, User, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VendorStoreCardProps {
    dealerId: string;
    dealerName: string;
}

export default function VendorStoreCard({ dealerId, dealerName }: VendorStoreCardProps) {
    const dealer = useVerifiedDealer(dealerId);
    const { dealerStats } = useUserReviews(dealerId);
    const [followersCount, setFollowersCount] = useState(0);
    const [productsCount, setProductsCount] = useState(0);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!dealerId) return;

        const fetchDealerData = async () => {
            // Count active products from this dealer
            const { count: pCount } = await supabase
                .from("marketplace_products")
                .select("*", { count: "exact", head: true })
                .eq("dealer_id", dealerId)
                .eq("status", "active");

            setProductsCount(pCount || 0);

            // Fetch avatar from profiles
            const { data: profile } = await supabase
                .from("profiles")
                .select("avatar_url")
                .eq("id", dealerId)
                .single();

            if (profile?.avatar_url) {
                setAvatarUrl(profile.avatar_url);
            }

            // In a real scenario, we'd fetch followers from a `dealer_followers` table here
            // Mocking followers for the UI as per request
            setFollowersCount(Math.floor(Math.random() * 500) + 50);
        };

        fetchDealerData();
    }, [dealerId]);

    const isVerified = dealer && dealer.isVerified;
    const tier = isVerified ? getDealerTier((dealer as any).salesCount) : null;
    const salesCount = dealer ? (dealer as any).salesCount : 0;

    return (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mt-6">
            <p className="text-base font-bold mb-4">Información sobre el vendedor</p>

            {/* Header: Avatar, Name, basic stats and Follow btn */}
            <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3 w-full border-b border-border/50 pb-3">
                    <div className="h-16 w-16 rounded-full border border-border overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={dealerName} className="object-cover w-full h-full" />
                        ) : (
                            <Store className="h-8 w-8 text-muted-foreground/30" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5 mb-1">
                                <p className="font-heading font-bold text-lg leading-none truncate">{dealerName}</p>
                                {isVerified && <VerifiedBadge size="sm" salesCount={salesCount} />}
                            </div>
                            <Button variant="secondary" size="sm" className="h-8 px-4 text-xs font-bold text-primary dark:text-[#A6E300] bg-primary/10 hover:bg-primary/20 transition-colors shrink-0">
                                Seguir
                            </Button>
                        </div>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                            <strong className="text-foreground">+{followersCount}</strong> Seguidores <span className="mx-1 text-border">•</span> <strong className="text-foreground">+{productsCount}</strong> Productos
                        </p>
                    </div>
                </div>
            </div>

            {/* MercadoLider / Verified section */}
            {isVerified && tier && (
                <div className="mb-4">
                    <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className={`h-4 w-4 ${tier.colors.text}`} />
                        <span className={`text-sm font-bold ${tier.colors.text}`}>
                            {tier.label}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">¡Uno de los mejores del sitio!</p>
                </div>
            )}

            {/* Reputation Termometer */}
            <div className="mb-5">
                {/* Visual bar imitating ML */}
                <div className="flex h-2 w-full gap-1 mb-3">
                    <div className="flex-1 bg-red-100 rounded-l-full"></div>
                    <div className="flex-1 bg-orange-100"></div>
                    <div className="flex-1 bg-yellow-100"></div>
                    <div className="flex-1 bg-lime-100"></div>
                    <div className="flex-1 bg-green-500 rounded-r-full"></div>
                </div>

                {/* Substats */}
                <div className="flex justify-between divide-x divide-border mt-3 text-center">
                    <div className="flex flex-col flex-1 px-1">
                        <span className="text-lg font-black leading-tight text-foreground">{salesCount > 0 ? `+${salesCount}` : '0'}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight mt-1">Ventas<br />concretadas</span>
                    </div>
                    <div className="flex flex-col flex-1 px-1">
                        <span className="text-lg font-black leading-tight text-foreground">{dealerStats.positivePercentage}%</span>
                        <span className="text-[10px] text-muted-foreground leading-tight mt-1">Lo<br />recomiendan</span>
                    </div>
                    <div className="flex flex-col flex-1 px-1">
                        <span className="text-lg font-black leading-tight text-foreground">{dealerStats.totalReviews}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight mt-1">Reseñas<br />recibidas</span>
                    </div>
                </div>
            </div>

            {/* Action Link */}
            <Link
                to={`/tienda-vendedor/${dealerId}`}
                className="block w-full text-center py-2.5 bg-secondary/30 hover:bg-secondary/60 text-primary dark:text-[#A6E300] font-bold text-sm rounded-lg transition-colors"
            >
                Ir a la tienda del vendedor
            </Link>
        </div>
    );
}
