
-- Create banner_images table for admin-managed hero banners
CREATE TABLE public.banner_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.banner_images ENABLE ROW LEVEL SECURITY;

-- Everyone can view active banners
CREATE POLICY "Anyone can view active banners"
ON public.banner_images
FOR SELECT
USING (is_active = true);

-- Admins can manage banners
CREATE POLICY "Admins can insert banners"
ON public.banner_images
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update banners"
ON public.banner_images
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete banners"
ON public.banner_images
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for banner images
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner-images', 'banner-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for banner images
CREATE POLICY "Anyone can view banner images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'banner-images');

CREATE POLICY "Admins can upload banner images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'banner-images');

CREATE POLICY "Admins can delete banner images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'banner-images');
