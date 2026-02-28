-- Allow admins to upload payment proofs (for dealer payment receipts)
CREATE POLICY "Admins can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete payment proofs
CREATE POLICY "Admins can delete payment proofs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'payment-proofs'
  AND has_role(auth.uid(), 'admin'::app_role)
);