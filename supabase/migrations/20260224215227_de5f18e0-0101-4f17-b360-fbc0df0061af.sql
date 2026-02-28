-- Allow admins to see all dismissals so they can delete them
CREATE POLICY "Admins can view all campaign dismissals"
ON public.campaign_dismissals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));