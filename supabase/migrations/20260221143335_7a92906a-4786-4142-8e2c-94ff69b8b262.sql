
-- Allow admins to delete payment_proofs
CREATE POLICY "Admins can delete payment proofs"
ON public.payment_proofs FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete shipping_info
CREATE POLICY "Admins can delete shipping info"
ON public.shipping_info FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete shipping_audit_log
CREATE POLICY "Admins can delete audit logs"
ON public.shipping_audit_log FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete bids
CREATE POLICY "Admins can delete bids"
ON public.bids FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete reviews
CREATE POLICY "Admins can delete reviews"
ON public.reviews FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete disputes
CREATE POLICY "Admins can delete disputes"
ON public.disputes FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete auction_reports
CREATE POLICY "Admins can delete auction reports"
ON public.auction_reports FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete dispute_messages
CREATE POLICY "Admins can delete dispute messages"
ON public.dispute_messages FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
