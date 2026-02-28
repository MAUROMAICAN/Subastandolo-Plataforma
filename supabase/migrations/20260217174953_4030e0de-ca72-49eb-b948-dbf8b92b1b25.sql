
-- Create dealer applications table
CREATE TABLE public.dealer_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  business_description TEXT,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dealer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
ON public.dealer_applications
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create applications"
ON public.dealer_applications
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update applications"
ON public.dealer_applications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete applications"
ON public.dealer_applications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update auction policies for dealers
DROP POLICY IF EXISTS "Admins can create auctions" ON public.auctions;
DROP POLICY IF EXISTS "Admins can update auctions" ON public.auctions;
DROP POLICY IF EXISTS "Admins can delete auctions" ON public.auctions;

CREATE POLICY "Admins and dealers can create auctions"
ON public.auctions
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'dealer'::app_role) AND created_by = auth.uid())
);

CREATE POLICY "Admins and dealers can update auctions"
ON public.auctions
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'dealer'::app_role) AND created_by = auth.uid())
);

CREATE POLICY "Admins and dealers can delete auctions"
ON public.auctions
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (public.has_role(auth.uid(), 'dealer'::app_role) AND created_by = auth.uid())
);
