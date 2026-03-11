-- Ensure all payment_proofs constraints are correct for multipago.
-- This is idempotent — safe to run even if already applied.

-- 1. reference_number: allow empty (optional)
ALTER TABLE public.payment_proofs DROP CONSTRAINT IF EXISTS payment_proofs_reference_number_format;
ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_reference_number_format
  CHECK (length(trim(reference_number)) = 0 OR (length(trim(reference_number)) >= 4 AND length(trim(reference_number)) <= 50));

-- 2. amount_bs: allow >= 0
ALTER TABLE public.payment_proofs DROP CONSTRAINT IF EXISTS payment_proofs_amount_bs_positive;
ALTER TABLE public.payment_proofs DROP CONSTRAINT IF EXISTS payment_proofs_amount_bs_nonnegative;
ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_amount_bs_nonnegative CHECK (amount_bs >= 0);

-- 3. bcv_rate: allow >= 0
ALTER TABLE public.payment_proofs DROP CONSTRAINT IF EXISTS payment_proofs_bcv_rate_positive;
ALTER TABLE public.payment_proofs DROP CONSTRAINT IF EXISTS payment_proofs_bcv_rate_nonnegative;
ALTER TABLE public.payment_proofs
  ADD CONSTRAINT payment_proofs_bcv_rate_nonnegative CHECK (bcv_rate >= 0 AND bcv_rate <= 1000);

-- 4. Rate limit trigger: skip for batch
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
  IF NEW.batch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_submissions
  FROM (
    SELECT DISTINCT COALESCE(batch_id, id::text) AS submission_key
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
