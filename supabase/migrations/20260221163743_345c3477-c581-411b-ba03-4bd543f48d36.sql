
-- Fix dispute-evidence storage: restrict to participants and admins only
DROP POLICY IF EXISTS "Dispute participants and admins can view evidence" ON storage.objects;

CREATE POLICY "Dispute participants and admins can view evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'dispute-evidence' AND (
    has_role(auth.uid(), 'admin'::app_role) OR
    EXISTS (
      SELECT 1 FROM public.disputes 
      WHERE (disputes.buyer_id = auth.uid() OR disputes.dealer_id = auth.uid())
      AND disputes.evidence_urls IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM unnest(disputes.evidence_urls) AS url
        WHERE url LIKE '%' || storage.filename(objects.name) || '%'
      )
    )
  )
);
