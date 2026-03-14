import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserReviews, useReviewReply } from "@/hooks/useReviews";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, Reply, Send, Loader2, Store } from "lucide-react";

const DealerReviewsTab = () => {
  const { user } = useAuth();
  const { dealerStats } = useUserReviews(user?.id);
  const { replyToReview } = useReviewReply();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    if (!user) return;
    setLoading(true);
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

  useEffect(() => {
    fetchReviews();
  }, [user]);

  const handleReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    const success = await replyToReview(reviewId, replyText);
    if (success) {
      setReplyingTo(null);
      setReplyText("");
      fetchReviews(); // Refresh to show the reply
    }
    setSubmitting(false);
  };

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
              const hasReply = !!(review as any).reply_text;
              const isReplying = replyingTo === review.id;
              return (
                <Card key={review.id} className="border rounded-xl hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    {/* Buyer review */}
                    <div className="flex items-start gap-3">
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

                    {/* Seller reply (if exists) */}
                    {hasReply && (
                      <div className="mt-3 ml-12 pl-3 border-l-2 border-primary/20 bg-primary/5 rounded-r-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Store className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-bold text-primary">Tu respuesta</span>
                          {(review as any).replied_at && (
                            <span className="text-[9px] text-muted-foreground ml-auto">
                              {new Date((review as any).replied_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{(review as any).reply_text}</p>
                      </div>
                    )}

                    {/* Reply actions */}
                    {!hasReply && !isReplying && (
                      <button
                        onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                        className="mt-2 ml-12 flex items-center gap-1 text-[11px] text-primary hover:underline transition-colors"
                      >
                        <Reply className="h-3 w-3" /> Responder
                      </button>
                    )}

                    {/* Reply form */}
                    {isReplying && (
                      <div className="mt-3 ml-12 space-y-2 animate-fade-in">
                        <Textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Escribe tu respuesta a esta reseña... (visible para todos)"
                          rows={2}
                          className="rounded-lg text-xs"
                          maxLength={1000}
                          autoFocus
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-muted-foreground">{replyText.length}/1000</span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setReplyingTo(null); setReplyText(""); }}
                              className="h-7 text-xs"
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReply(review.id)}
                              disabled={!replyText.trim() || submitting}
                              className="h-7 text-xs rounded-lg"
                            >
                              {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                              Publicar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
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

