ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_banner_url TEXT;
COMMENT ON COLUMN public.profiles.store_banner_url IS 'Custom banner image URL for dealer store page';
