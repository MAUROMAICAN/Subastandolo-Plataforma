-- Add description column to banner_images to support a 3-line hero text design
ALTER TABLE public.banner_images ADD COLUMN IF NOT EXISTS description TEXT;
