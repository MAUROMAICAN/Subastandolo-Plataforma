-- Add city and state columns to profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text;

-- Add comment to explain
COMMENT ON COLUMN public.profiles.city IS 'City of residence/operation for the user/dealer';
COMMENT ON COLUMN public.profiles.state IS 'State of residence/operation for the user/dealer';
