
-- Allow the reviewed person to update reply_text on their reviews
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;

CREATE POLICY "Users can update own reviews"
ON public.reviews
FOR UPDATE
USING (reviewer_id = auth.uid() OR reviewed_id = auth.uid());
