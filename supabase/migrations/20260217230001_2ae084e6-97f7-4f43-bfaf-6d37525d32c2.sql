
-- Add tracking fields to auctions
ALTER TABLE public.auctions
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_photo_url TEXT,
ADD COLUMN IF NOT EXISTS dealer_ship_deadline TIMESTAMP WITH TIME ZONE;

-- Create trigger: when payment_proof is inserted, update auction payment_status to 'under_review'
CREATE OR REPLACE FUNCTION public.handle_payment_proof_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.auctions
  SET payment_status = 'under_review'
  WHERE id = NEW.auction_id
  AND payment_status = 'pending';
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_proof_submitted
AFTER INSERT ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_proof_submitted();

-- Create trigger: when admin approves payment, set delivery_status to ready_to_ship and dealer_ship_deadline
CREATE OR REPLACE FUNCTION public.handle_payment_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE public.auctions
    SET payment_status = 'verified',
        delivery_status = 'ready_to_ship',
        dealer_ship_deadline = NOW() + INTERVAL '48 hours'
    WHERE id = NEW.auction_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_proof_approved
AFTER UPDATE ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_verified();
