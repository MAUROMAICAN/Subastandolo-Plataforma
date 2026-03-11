import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserReviews } from "@/hooks/useReviews";
import { Card, CardContent } from "@/components/ui/card";
import { Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp } from "lucide-react";

const DealerReviewsTab = () => {
  const { user } = useAuth();
  const { dealerStats } = useUserReviews(user?.id);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchReviews = async () => {
      setLoading(true);
      // Fetch all reviews where this user is the dealer (auction creator)
      const { data: auctions } = await supabase
        .from("auctions")
        .select("id")
        .eq("created_by", user.id)
        .eq("status", "finalized");

      if (!auctions || auctions.length === 0) {
        setLoading(false);
        return;
      }

      const auctionIds = auctions.map(a => a.id);
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*, profiles:reviewer_id(full_name, avatar_url)")
        .in("auction_id", auctionIds)
        .order("created_at", { ascending: false });

      setReviews(reviewsData || []);
      setLoading(false);
    };
    fetchReviews();
  }, [user]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-5">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border rounded-xl">
          <CardContent className="p-4 text-center">
            <Star className="h-5 w-5 text-amber-500 mx-auto mb-1.5" />
            <p className="text-2xl font-heading font-black text-foreground">{avgRating}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Promedio</p>
          </CardContent>
        </Card>
        <Card className="border rounded-xl">
          <CardContent className="p-4 text-center">
            <MessageSquare className="h-5 w-5 text-primary dark:text-accent mx-auto mb-1.5" />
            <p className="text-2xl font-heading font-black text-foreground">{dealerStats.totalReviews}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Total Reseñas</p>
          </CardContent>
        </Card>
        <Card className="border rounded-xl">
          <CardContent className="p-4 text-center">
            <ThumbsUp className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-2xl font-heading font-black text-foreground">{dealerStats.positivePercentage}%</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Positivas</p>
          </CardContent>
        </Card>
        <Card className="border rounded-xl">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1.5" />
            <p className="text-2xl font-heading font-black text-foreground">{Math.round(dealerStats.totalReviews * dealerStats.positivePercentage / 100)}</p>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Positivas Tot.</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      <div className="space-y-2">
        <h3 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary dark:text-accent" /> Reseñas de Compradores
        </h3>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Cargando reseñas...</div>
        ) : reviews.length === 0 ? (
          <Card className="border rounded-xl">
            <CardContent className="p-8 text-center">
              <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Aún no tienes reseñas</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Las reseñas aparecerán aquí cuando los compradores califiquen sus compras</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reviews.map((review) => {
              const isPositive = (review.rating || 0) >= 4;
              const reviewer = (review as any).profiles;
              return (
                <Card key={review.id} className="border rounded-xl hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Rating Icon */}
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                        {isPositive ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{reviewer?.full_name || "Comprador"}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <Star key={i} className={`h-3 w-3 ${i <= (review.rating || 0) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/20"}`} />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(review.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">"{review.comment}"</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DealerReviewsTab;
