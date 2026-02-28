
-- Create auction_reports table
CREATE TABLE public.auction_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auction_reports ENABLE ROW LEVEL SECURITY;

-- Users can report auctions
CREATE POLICY "Authenticated users can report auctions"
ON public.auction_reports FOR INSERT
WITH CHECK (reporter_id = auth.uid());

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
ON public.auction_reports FOR SELECT
USING (reporter_id = auth.uid());

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
ON public.auction_reports FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update reports
CREATE POLICY "Admins can update reports"
ON public.auction_reports FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Prevent duplicate reports from same user on same auction
CREATE UNIQUE INDEX idx_unique_report_per_user ON public.auction_reports (auction_id, reporter_id);
