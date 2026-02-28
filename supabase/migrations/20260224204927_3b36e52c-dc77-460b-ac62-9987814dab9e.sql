CREATE POLICY "Admins can delete campaign dismissals"
ON public.campaign_dismissals
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));