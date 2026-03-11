-- ═══════════════════════════════════════════
-- EMAIL LOGS TABLE
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email text NOT NULL,
  recipient_name text,
  recipient_id uuid REFERENCES auth.users(id),
  email_type text NOT NULL,         -- 'auction_won', 'outbid', 'payment_approved', 'payment_received', 'shipment', 'welcome', 'new_auction'
  subject text NOT NULL,
  auction_id uuid REFERENCES public.auctions(id) ON DELETE SET NULL,
  auction_title text,
  status text NOT NULL DEFAULT 'sent',  -- 'sent', 'failed'
  resend_id text,                    -- Resend email ID for tracking
  error_message text,
  metadata jsonb DEFAULT '{}',       -- Extra info (amount, image_url, etc)
  created_at timestamptz DEFAULT now()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_auction ON public.email_logs(auction_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient_id);

-- RLS: Only service_role can insert (from edge functions), admins can read
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email logs" ON public.email_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);
