-- Allow dealers to upload tracking photos to auction-images bucket
CREATE POLICY "Dealers can upload tracking photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'auction-images'
  AND has_role(auth.uid(), 'dealer'::app_role)
);

-- Allow dealers to update their uploads
CREATE POLICY "Dealers can update own auction images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'auction-images'
  AND has_role(auth.uid(), 'dealer'::app_role)
);
