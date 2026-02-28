
-- Create payment_proofs table
CREATE TABLE public.payment_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  buyer_id UUID NOT NULL,
  amount_usd NUMERIC NOT NULL,
  amount_bs NUMERIC NOT NULL,
  bcv_rate NUMERIC NOT NULL,
  reference_number TEXT NOT NULL,
  proof_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Buyers can insert their own payment proofs
CREATE POLICY "Buyers can submit payment proof"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  buyer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = payment_proofs.auction_id
    AND auctions.winner_id = auth.uid()
    AND auctions.status = 'finalized'
  )
);

-- Buyers can view their own proofs, dealers can view proofs for their auctions, admins see all
CREATE POLICY "Users can view relevant payment proofs"
ON public.payment_proofs
FOR SELECT
USING (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = payment_proofs.auction_id
    AND auctions.created_by = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins can update payment proofs (approve/reject)
CREATE POLICY "Admins can update payment proofs"
ON public.payment_proofs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_payment_proofs_updated_at
BEFORE UPDATE ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);

-- Storage policies: buyers can upload proofs
CREATE POLICY "Buyers can upload payment proofs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Buyers and admins can view payment proofs
CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role)));

-- Enable realtime for payment_proofs
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_proofs;
