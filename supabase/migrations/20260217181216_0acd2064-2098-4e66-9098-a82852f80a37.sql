
-- Add status and admin_notes to auctions
ALTER TABLE public.auctions 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Update existing auctions to 'active' status
UPDATE public.auctions SET status = 'active' WHERE status IS NULL OR status = '';

-- Create auction_images table for multiple photos per auction
CREATE TABLE public.auction_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on auction_images
ALTER TABLE public.auction_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view images of visible auctions
CREATE POLICY "Anyone can view auction images"
ON public.auction_images
FOR SELECT
USING (true);

-- Dealers/admins can insert images for their own auctions
CREATE POLICY "Dealers and admins can insert auction images"
ON public.auction_images
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.auctions 
    WHERE id = auction_id 
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Dealers/admins can delete images for their own auctions
CREATE POLICY "Dealers and admins can delete auction images"
ON public.auction_images
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.auctions 
    WHERE id = auction_id 
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Update the auctions SELECT policy to show only approved/active to public, all to owners/admins
DROP POLICY IF EXISTS "Anyone can view auctions" ON public.auctions;
CREATE POLICY "Public can view approved auctions"
ON public.auctions
FOR SELECT
USING (
  status IN ('active', 'finalized')
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Enable realtime for auction_images
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_images;
