-- Add batch_id to payment_proofs for unified/grouped payments
-- When a buyer pays for multiple auctions from the same dealer with a single transfer,
-- all payment_proofs rows share the same batch_id.
ALTER TABLE public.payment_proofs
  ADD COLUMN IF NOT EXISTS batch_id UUID DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_proofs_batch_id
  ON public.payment_proofs(batch_id)
  WHERE batch_id IS NOT NULL;
