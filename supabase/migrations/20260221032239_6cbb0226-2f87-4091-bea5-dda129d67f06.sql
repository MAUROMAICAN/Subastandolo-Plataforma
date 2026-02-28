
-- Add desired_resolution and signature columns to disputes
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS desired_resolution text;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS signature_data text;
