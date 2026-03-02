-- Drop the overly restrictive SELECT policy
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banner_images;

-- Create a policy for public to view ONLY active banners
CREATE POLICY "Public can view active banners"
ON public.banner_images
FOR SELECT
USING (is_active = true);

-- Create a policy for admins to view ALL banners (active and inactive)
CREATE POLICY "Admins can view all banners"
ON public.banner_images
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
