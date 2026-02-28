-- Add extended_time flag to auctions for admin labeling
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS is_extended boolean NOT NULL DEFAULT false;