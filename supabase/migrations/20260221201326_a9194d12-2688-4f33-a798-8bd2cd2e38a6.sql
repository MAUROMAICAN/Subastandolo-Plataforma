
-- Table to store proxy/auto bids
CREATE TABLE public.auto_bids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  max_amount NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one active auto-bid per user per auction
CREATE UNIQUE INDEX idx_auto_bids_unique_active ON public.auto_bids (auction_id, user_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.auto_bids ENABLE ROW LEVEL SECURITY;

-- Users can view their own auto-bids
CREATE POLICY "Users can view own auto-bids"
  ON public.auto_bids FOR SELECT
  USING (user_id = auth.uid());

-- Users can create auto-bids
CREATE POLICY "Users can create auto-bids"
  ON public.auto_bids FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update own auto-bids
CREATE POLICY "Users can update own auto-bids"
  ON public.auto_bids FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete own auto-bids
CREATE POLICY "Users can delete own auto-bids"
  ON public.auto_bids FOR DELETE
  USING (user_id = auth.uid());

-- Admins can manage all auto-bids
CREATE POLICY "Admins can manage auto-bids"
  ON public.auto_bids FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_auto_bids_updated_at
  BEFORE UPDATE ON public.auto_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to process auto-bids after a new bid is placed
CREATE OR REPLACE FUNCTION public.process_auto_bids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auto_bid RECORD;
  v_current_price NUMERIC;
  v_new_bid_amount NUMERIC;
  v_auction_status TEXT;
  v_auction_end TIMESTAMPTZ;
  v_bidder_name TEXT;
BEGIN
  -- Get auction info
  SELECT status, current_price, end_time INTO v_auction_status, v_current_price, v_auction_end
  FROM public.auctions WHERE id = NEW.auction_id;

  -- Only process if auction is active and not ended
  IF v_auction_status != 'active' OR v_auction_end <= NOW() THEN
    RETURN NEW;
  END IF;

  -- Find the highest active auto-bid for this auction that is NOT from the current bidder
  -- and whose max_amount is higher than the new bid
  SELECT ab.*, p.full_name as bidder_full_name
  INTO v_auto_bid
  FROM public.auto_bids ab
  JOIN public.profiles p ON p.id = ab.user_id
  WHERE ab.auction_id = NEW.auction_id
    AND ab.is_active = true
    AND ab.user_id != NEW.user_id
    AND ab.max_amount > NEW.amount
  ORDER BY ab.max_amount DESC, ab.created_at ASC
  LIMIT 1;

  -- If no auto-bid can counter, nothing to do
  IF v_auto_bid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate the counter-bid: current bid + $1, capped at the auto-bidder's max
  v_new_bid_amount := LEAST(NEW.amount + 1, v_auto_bid.max_amount);

  -- Make sure the auto-bid amount is actually higher than the current bid
  IF v_new_bid_amount <= NEW.amount THEN
    RETURN NEW;
  END IF;

  v_bidder_name := v_auto_bid.bidder_full_name;

  -- Insert the counter-bid
  INSERT INTO public.bids (auction_id, user_id, amount, bidder_name)
  VALUES (NEW.auction_id, v_auto_bid.user_id, v_new_bid_amount, v_bidder_name);

  -- If the auto-bid reached its max, deactivate it
  IF v_new_bid_amount >= v_auto_bid.max_amount THEN
    UPDATE public.auto_bids SET is_active = false WHERE id = v_auto_bid.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: after a new bid, process auto-bids
CREATE TRIGGER trigger_process_auto_bids
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.process_auto_bids();
