-- Fix: Allow batch payment submissions without hitting rate limit
-- The old trigger counted individual rows (1 per auction in batch).
-- New trigger counts distinct transactions (by batch_id) so a batch of 10
-- auctions counts as 1 submission, not 10.

-- Drop old trigger
DROP TRIGGER IF EXISTS check_payment_proof_rate ON public.payment_proofs;
DROP FUNCTION IF EXISTS public.check_payment_proof_rate_limit();

-- Create improved rate limit function that is batch-aware
CREATE OR REPLACE FUNCTION public.check_payment_proof_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_submissions integer;
BEGIN
  -- Count distinct submissions in the last hour.
  -- A batch (same batch_id) counts as 1 submission.
  -- Individual payments (null batch_id) each count as 1.
  SELECT COUNT(*) INTO recent_submissions
  FROM (
    SELECT DISTINCT COALESCE(batch_id, id::text) AS submission_key
    FROM public.payment_proofs
    WHERE buyer_id = NEW.buyer_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) AS distinct_submissions;

  -- Allow up to 5 distinct submissions per hour (generous for legitimate use)
  IF recent_submissions >= 5 THEN
    RAISE EXCEPTION 'Demasiados comprobantes de pago enviados. Espera antes de intentar nuevamente.';
  END IF;

  RETURN NEW;
END;
$function$;

-- Recreate trigger
CREATE TRIGGER check_payment_proof_rate
BEFORE INSERT ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.check_payment_proof_rate_limit();
