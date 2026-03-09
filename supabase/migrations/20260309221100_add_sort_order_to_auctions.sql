-- Add sort_order column to auctions for admin-controlled display positioning
-- Higher values appear first on the main page
ALTER TABLE public.auctions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
