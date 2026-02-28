
-- 1. Computed function: get reputation stats for a user in real-time
CREATE OR REPLACE FUNCTION public.get_user_reputation_stats(p_user_id uuid, p_review_type text)
RETURNS TABLE (
  total_reviews bigint,
  avg_rating numeric,
  positive_percentage numeric,
  avg_product_accuracy numeric,
  avg_attention_quality numeric,
  avg_shipping_speed numeric,
  avg_payment_compliance numeric,
  avg_communication_quality numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_reviews,
    COALESCE(AVG(rating), 0) AS avg_rating,
    CASE WHEN COUNT(*) > 0
      THEN (COUNT(*) FILTER (WHERE rating >= 4))::numeric / COUNT(*)::numeric * 100
      ELSE 0
    END AS positive_percentage,
    COALESCE(AVG(product_accuracy), 0) AS avg_product_accuracy,
    COALESCE(AVG(attention_quality), 0) AS avg_attention_quality,
    COALESCE(AVG(shipping_speed), 0) AS avg_shipping_speed,
    COALESCE(AVG(payment_compliance), 0) AS avg_payment_compliance,
    COALESCE(AVG(communication_quality), 0) AS avg_communication_quality
  FROM public.reviews
  WHERE reviewed_id = p_user_id
    AND review_type = p_review_type;
$$;

-- 2. Drop old INSERT policy and create restrictive one: only auction winner can review dealer
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;

CREATE POLICY "Only auction winner can review"
  ON public.reviews
  FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND (
      -- buyer_to_dealer: reviewer must be the winner of that auction
      (review_type = 'buyer_to_dealer' AND EXISTS (
        SELECT 1 FROM public.auctions
        WHERE auctions.id = reviews.auction_id
          AND auctions.winner_id = auth.uid()
          AND auctions.status = 'finalized'
      ))
      OR
      -- dealer_to_buyer: reviewer must be the auction creator (dealer)
      (review_type = 'dealer_to_buyer' AND EXISTS (
        SELECT 1 FROM public.auctions
        WHERE auctions.id = reviews.auction_id
          AND auctions.created_by = auth.uid()
          AND auctions.status = 'finalized'
      ))
    )
  );
