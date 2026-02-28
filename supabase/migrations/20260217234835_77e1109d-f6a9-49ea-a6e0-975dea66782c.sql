-- Allow dealers (auction creators) to update shipping info for their auctions
CREATE POLICY "Dealers can update shipping info for their auctions"
ON public.shipping_info FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
    AND auctions.created_by = auth.uid()
  )
);
