
-- Add requested duration (in hours) that the dealer wants
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS requested_duration_hours integer DEFAULT 24;

-- Add archived_at to track when finalized auctions should be hidden from public
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Update the SELECT policy to exclude archived auctions from public view
-- but keep them visible to the dealer (creator) and admins
DROP POLICY IF EXISTS "Public can view approved auctions" ON public.auctions;
CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  (
    (status = ANY (ARRAY['active'::text, 'finalized'::text]))
    AND (archived_at IS NULL)
  )
  OR (created_by = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
