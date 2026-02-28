
-- Reviews table for the reputation system
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  reviewed_id UUID NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('buyer_to_dealer', 'dealer_to_buyer')),
  
  -- Overall rating 1-5
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Dealer review aspects (1-5, null if dealer_to_buyer)
  product_accuracy INTEGER CHECK (product_accuracy IS NULL OR (product_accuracy >= 1 AND product_accuracy <= 5)),
  attention_quality INTEGER CHECK (attention_quality IS NULL OR (attention_quality >= 1 AND attention_quality <= 5)),
  shipping_speed INTEGER CHECK (shipping_speed IS NULL OR (shipping_speed >= 1 AND shipping_speed <= 5)),
  
  -- Buyer review aspects (1-5, null if buyer_to_dealer)
  payment_compliance INTEGER CHECK (payment_compliance IS NULL OR (payment_compliance >= 1 AND payment_compliance <= 5)),
  communication_quality INTEGER CHECK (communication_quality IS NULL OR (communication_quality >= 1 AND communication_quality <= 5)),
  
  -- Quick tags
  tags TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- One review per auction per direction
  UNIQUE(auction_id, reviewer_id, review_type)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews (public reputation)
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
USING (true);

-- Authenticated users can create reviews for auctions they participated in
CREATE POLICY "Users can create reviews"
ON public.reviews
FOR INSERT
WITH CHECK (reviewer_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
ON public.reviews
FOR UPDATE
USING (reviewer_id = auth.uid());

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
