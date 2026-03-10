-- Add column to track review reminder notifications sent
ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS review_reminder_sent_at TIMESTAMPTZ DEFAULT NULL;
