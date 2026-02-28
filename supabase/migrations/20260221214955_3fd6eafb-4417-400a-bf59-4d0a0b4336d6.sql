
-- Drop and recreate the SELECT policy to include winners
DROP POLICY "Public can view approved auctions" ON public.auctions;

CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  ((status = ANY (ARRAY['active'::text, 'finalized'::text])) AND (archived_at IS NULL))
  OR (created_by = auth.uid())
  OR (winner_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
