-- Add missing UPDATE policy on auction_images
-- This was preventing dealers and admins from reordering images (changing display_order)
CREATE POLICY "Dealers and admins can update auction images"
ON public.auction_images
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.auctions 
    WHERE id = auction_id 
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.auctions 
    WHERE id = auction_id 
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);
