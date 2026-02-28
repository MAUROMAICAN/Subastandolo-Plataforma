
-- Fix shipping_info INSERT: allow when auction has ended (regardless of status)
DROP POLICY "Buyers can submit shipping info" ON public.shipping_info;
CREATE POLICY "Buyers can submit shipping info"
ON public.shipping_info
FOR INSERT
WITH CHECK (
  (buyer_id = auth.uid())
  AND (disclaimer_accepted = true)
  AND (EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
      AND auctions.winner_id = auth.uid()
      AND auctions.end_time <= now()
  ))
);

-- Fix payment_proofs INSERT: allow when auction has ended (regardless of status)
DROP POLICY "Buyers can submit payment proof" ON public.payment_proofs;
CREATE POLICY "Buyers can submit payment proof"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  (buyer_id = auth.uid())
  AND (EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = payment_proofs.auction_id
      AND auctions.winner_id = auth.uid()
      AND auctions.end_time <= now()
  ))
);

-- Fix disputes INSERT: allow when auction has ended (regardless of status)
DROP POLICY "Buyers can create disputes for won auctions" ON public.disputes;
CREATE POLICY "Buyers can create disputes for won auctions"
ON public.disputes
FOR INSERT
WITH CHECK (
  (buyer_id = auth.uid())
  AND (EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = disputes.auction_id
      AND auctions.winner_id = auth.uid()
      AND auctions.end_time <= now()
  ))
);
