-- Audit log for all shipping/tracking modifications
CREATE TABLE public.shipping_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL,
  change_type text NOT NULL, -- 'shipping_info_updated', 'tracking_submitted', 'tracking_updated', 'delivery_status_changed', 'payment_status_changed'
  field_name text, -- which field changed
  old_value text,
  new_value text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_audit_log ENABLE ROW LEVEL SECURITY;

-- Dealers can insert logs for their own auctions
CREATE POLICY "Dealers can insert audit logs"
ON public.shipping_audit_log FOR INSERT
WITH CHECK (
  changed_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_audit_log.auction_id
    AND (auctions.created_by = auth.uid() OR auctions.winner_id = auth.uid())
  )
);

-- Admins can insert audit logs (for admin-driven changes)
CREATE POLICY "Admins can insert audit logs"
ON public.shipping_audit_log FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Dealers can view logs for their auctions
CREATE POLICY "Dealers can view own auction logs"
ON public.shipping_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_audit_log.auction_id
    AND auctions.created_by = auth.uid()
  )
);

-- Buyers can view logs for auctions they won
CREATE POLICY "Buyers can view won auction logs"
ON public.shipping_audit_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_audit_log.auction_id
    AND auctions.winner_id = auth.uid()
  )
);

-- Admins can view all logs
CREATE POLICY "Admins can view all audit logs"
ON public.shipping_audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookups
CREATE INDEX idx_shipping_audit_auction ON public.shipping_audit_log(auction_id);
CREATE INDEX idx_shipping_audit_created ON public.shipping_audit_log(created_at DESC);
