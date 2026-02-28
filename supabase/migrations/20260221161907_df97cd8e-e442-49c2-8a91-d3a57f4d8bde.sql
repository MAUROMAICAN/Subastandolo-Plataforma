-- Add start_time column to auctions (nullable = immediate start for backward compat)
ALTER TABLE public.auctions 
ADD COLUMN start_time timestamp with time zone DEFAULT NULL;

-- Set existing auctions' start_time to their created_at
UPDATE public.auctions SET start_time = created_at WHERE start_time IS NULL;