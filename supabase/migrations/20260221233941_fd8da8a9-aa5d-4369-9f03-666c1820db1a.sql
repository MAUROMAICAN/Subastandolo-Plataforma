-- Payments made TO dealers by admin
CREATE TABLE public.dealer_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id uuid NOT NULL,
  total_amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'transfer',
  bank_name text,
  reference_number text,
  proof_url text,
  notes text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Line items: which earnings are covered by this payment
CREATE TABLE public.dealer_payment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.dealer_payments(id) ON DELETE CASCADE,
  earning_id uuid NOT NULL REFERENCES public.platform_earnings(id),
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dealer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_payment_items ENABLE ROW LEVEL SECURITY;

-- Policies: admins full access, dealers can view their own
CREATE POLICY "Admins can manage dealer payments" ON public.dealer_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Dealers can view own payments" ON public.dealer_payments FOR SELECT USING (dealer_id = auth.uid());

CREATE POLICY "Admins can manage payment items" ON public.dealer_payment_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Dealers can view own payment items" ON public.dealer_payment_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dealer_payments dp WHERE dp.id = dealer_payment_items.payment_id AND dp.dealer_id = auth.uid()));

-- Index for performance
CREATE INDEX idx_dealer_payments_dealer ON public.dealer_payments(dealer_id);
CREATE INDEX idx_dealer_payment_items_payment ON public.dealer_payment_items(payment_id);
CREATE INDEX idx_dealer_payment_items_earning ON public.dealer_payment_items(earning_id);