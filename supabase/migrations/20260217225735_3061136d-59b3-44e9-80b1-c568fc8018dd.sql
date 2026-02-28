
-- Create shipping_info table
CREATE TABLE public.shipping_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  buyer_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  cedula TEXT NOT NULL,
  shipping_company TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  office_name TEXT NOT NULL,
  disclaimer_accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(auction_id, buyer_id)
);

-- Enable RLS
ALTER TABLE public.shipping_info ENABLE ROW LEVEL SECURITY;

-- Buyers can insert their own shipping info
CREATE POLICY "Buyers can submit shipping info"
ON public.shipping_info
FOR INSERT
WITH CHECK (
  buyer_id = auth.uid()
  AND disclaimer_accepted = true
  AND EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
    AND auctions.winner_id = auth.uid()
    AND auctions.status = 'finalized'
  )
);

-- Buyers can view their own, dealers can view for their auctions, admins see all
CREATE POLICY "Users can view relevant shipping info"
ON public.shipping_info
FOR SELECT
USING (
  buyer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.id = shipping_info.auction_id
    AND auctions.created_by = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Buyers can update their own shipping info
CREATE POLICY "Buyers can update own shipping info"
ON public.shipping_info
FOR UPDATE
USING (buyer_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_shipping_info_updated_at
BEFORE UPDATE ON public.shipping_info
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
