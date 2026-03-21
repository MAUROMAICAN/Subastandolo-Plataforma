-- Add 'abandoned' as a valid payment_status value
-- Also ensure 'escrow' and 'released' are included (existing in production data)

DO $$
BEGIN
  ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_payment_status_check;
  ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS payment_status_check;
  
  PERFORM 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'auctions' 
    AND column_name = 'payment_status' 
    AND constraint_name LIKE '%check%';
    
  IF FOUND THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.auctions DROP CONSTRAINT ' || constraint_name
      FROM information_schema.constraint_column_usage 
      WHERE table_name = 'auctions' 
      AND column_name = 'payment_status' 
      AND constraint_name LIKE '%check%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.auctions 
  ADD CONSTRAINT auctions_payment_status_check 
  CHECK (payment_status IN ('pending', 'under_review', 'verified', 'rejected', 'abandoned', 'escrow', 'released'));
