
-- Add validation constraints for payment_proofs
ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_amount_usd_positive CHECK (amount_usd > 0 AND amount_usd <= 1000000),
  ADD CONSTRAINT payment_proofs_amount_bs_positive CHECK (amount_bs > 0),
  ADD CONSTRAINT payment_proofs_bcv_rate_positive CHECK (bcv_rate > 0 AND bcv_rate <= 1000),
  ADD CONSTRAINT payment_proofs_reference_number_format CHECK (length(trim(reference_number)) >= 4 AND length(trim(reference_number)) <= 50);

-- Create a validation trigger to verify amount matches auction price
CREATE OR REPLACE FUNCTION public.validate_payment_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction_price NUMERIC;
BEGIN
  -- Get the auction's current price
  SELECT current_price INTO v_auction_price
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_auction_price IS NULL THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  -- Verify the USD amount matches the auction price (allow small rounding tolerance)
  IF ABS(NEW.amount_usd - v_auction_price) > 0.01 THEN
    RAISE EXCEPTION 'Payment amount does not match auction price';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_payment_proof_before_insert
  BEFORE INSERT ON public.payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_proof();
