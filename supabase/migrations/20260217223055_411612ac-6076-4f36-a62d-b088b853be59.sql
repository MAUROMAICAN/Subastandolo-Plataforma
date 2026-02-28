
-- Add escrow/payment tracking columns to auctions
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS funds_released_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS funds_frozen boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.auctions.payment_status IS 'pending | escrow | released | refunded';
COMMENT ON COLUMN public.auctions.delivery_status IS 'pending | shipped | delivered';
COMMENT ON COLUMN public.auctions.funds_frozen IS 'true when a dispute is open, blocks release';

-- Create a function to auto-freeze funds when a dispute is created
CREATE OR REPLACE FUNCTION public.freeze_funds_on_dispute()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.auctions
  SET funds_frozen = true,
      payment_status = CASE WHEN payment_status = 'escrow' THEN 'escrow' ELSE payment_status END
  WHERE id = NEW.auction_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_dispute_created_freeze_funds
  AFTER INSERT ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_funds_on_dispute();

-- Unfreeze and update on dispute resolution
CREATE OR REPLACE FUNCTION public.handle_dispute_resolution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('resolved', 'refunded') AND OLD.status NOT IN ('resolved', 'refunded') THEN
    IF NEW.status = 'refunded' THEN
      UPDATE public.auctions
      SET funds_frozen = false,
          payment_status = 'refunded'
      WHERE id = NEW.auction_id;
    ELSE
      UPDATE public.auctions
      SET funds_frozen = false
      WHERE id = NEW.auction_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_dispute_resolved
  AFTER UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dispute_resolution();
