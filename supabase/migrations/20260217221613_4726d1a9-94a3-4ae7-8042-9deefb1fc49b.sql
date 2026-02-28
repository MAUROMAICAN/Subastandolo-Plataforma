
-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create disputes table
CREATE TABLE public.disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  buyer_id UUID NOT NULL,
  dealer_id UUID NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  evidence_urls TEXT[] DEFAULT '{}',
  resolution TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  dealer_deadline TIMESTAMP WITH TIME ZONE,
  admin_requested BOOLEAN DEFAULT false,
  admin_requested_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create dispute messages table
CREATE TABLE public.dispute_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER update_disputes_updated_at
BEFORE UPDATE ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

-- Disputes policies
CREATE POLICY "Buyers can create disputes for won auctions"
ON public.disputes FOR INSERT
WITH CHECK (buyer_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.auctions WHERE id = disputes.auction_id AND winner_id = auth.uid() AND status = 'finalized'
));

CREATE POLICY "Participants and admins can view disputes"
ON public.disputes FOR SELECT
USING (buyer_id = auth.uid() OR dealer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update disputes"
ON public.disputes FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants can update own disputes"
ON public.disputes FOR UPDATE
USING (buyer_id = auth.uid() OR dealer_id = auth.uid());

-- Dispute messages policies
CREATE POLICY "Participants and admins can view dispute messages"
ON public.dispute_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.disputes d WHERE d.id = dispute_messages.dispute_id
  AND (d.buyer_id = auth.uid() OR d.dealer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Participants and admins can send dispute messages"
ON public.dispute_messages FOR INSERT
WITH CHECK (sender_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.disputes d WHERE d.id = dispute_messages.dispute_id
  AND (d.buyer_id = auth.uid() OR d.dealer_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
));

-- Enable realtime for dispute messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispute_messages;

-- Create storage bucket for dispute evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('dispute-evidence', 'dispute-evidence', false);

-- Storage policies for dispute evidence
CREATE POLICY "Dispute participants can upload evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dispute-evidence' AND auth.uid() IS NOT NULL);

CREATE POLICY "Dispute participants and admins can view evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'dispute-evidence' AND auth.uid() IS NOT NULL);
