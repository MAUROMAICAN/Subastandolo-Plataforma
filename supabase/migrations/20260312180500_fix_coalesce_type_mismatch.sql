-- Fix: COALESCE types uuid and text cannot be matched
-- The rate limit trigger function used COALESCE(batch_id, id::text) where
-- batch_id is UUID and id::text is TEXT — incompatible types for COALESCE.
-- Fix: cast BOTH to text.

DROP TRIGGER IF EXISTS check_payment_proof_rate ON public.payment_proofs;
DROP FUNCTION IF EXISTS public.check_payment_proof_rate_limit();

CREATE OR REPLACE FUNCTION public.check_payment_proof_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_submissions integer;
BEGIN
  -- Batch rows (batch_id IS NOT NULL) are a single logical operation → skip rate check.
  IF NEW.batch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- For individual (non-batch) payments, count distinct submissions in the last hour.
  SELECT COUNT(*) INTO recent_submissions
  FROM (
    SELECT DISTINCT COALESCE(batch_id::text, id::text) AS submission_key
    FROM public.payment_proofs
    WHERE buyer_id = NEW.buyer_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) AS distinct_submissions;

  IF recent_submissions >= 5 THEN
    RAISE EXCEPTION 'Demasiados comprobantes de pago enviados. Espera antes de intentar nuevamente.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_payment_proof_rate
BEFORE INSERT ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.check_payment_proof_rate_limit();
