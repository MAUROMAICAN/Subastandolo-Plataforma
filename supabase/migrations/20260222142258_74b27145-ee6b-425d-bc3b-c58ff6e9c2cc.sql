
-- Update RLS policy to allow public viewing of "scheduled" auctions
DROP POLICY IF EXISTS "Public can view approved auctions" ON public.auctions;

CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  ((status = ANY (ARRAY['active'::text, 'finalized'::text, 'scheduled'::text])) AND (archived_at IS NULL))
  OR (created_by = auth.uid())
  OR (winner_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
