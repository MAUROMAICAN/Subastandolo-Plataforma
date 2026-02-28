
-- Create storage bucket for campaign ads
INSERT INTO storage.buckets (id, name, public)
VALUES ('campanas_ads', 'campanas_ads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view campaign ad images
CREATE POLICY "Public can view campaign ads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'campanas_ads');

-- Allow admins to upload campaign ads
CREATE POLICY "Admins can upload campaign ads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'campanas_ads' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete campaign ads
CREATE POLICY "Admins can delete campaign ads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'campanas_ads' AND has_role(auth.uid(), 'admin'::app_role));
