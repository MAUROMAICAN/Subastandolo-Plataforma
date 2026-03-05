-- Fix: Relax payment_proofs INSERT policy to allow buyers to submit proofs
-- for auctions that have ended by time (end_time <= NOW()) even if status is still 'active'.
-- Previously only auctions with status = 'finalized' were allowed, causing silent RLS failures.

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Buyers can submit payment proof" ON public.payment_proofs;

-- Create improved policy: accepts auctions that are finalized OR active-but-expired
CREATE POLICY "Buyers can submit payment proof"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  buyer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.auctions
    WHERE auctions.id = payment_proofs.auction_id
      AND auctions.winner_id = auth.uid()
      AND (
        auctions.status = 'finalized'
        OR (auctions.status = 'active' AND auctions.end_time <= NOW())
      )
  )
);
