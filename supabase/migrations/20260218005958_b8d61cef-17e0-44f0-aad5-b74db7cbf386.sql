
-- Withdrawal requests table
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers can view own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (dealer_id = auth.uid());

CREATE POLICY "Dealers can request withdrawals"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (dealer_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update withdrawals"
  ON public.withdrawal_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
