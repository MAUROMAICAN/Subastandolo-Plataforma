
-- Add reply_text column for the reviewed person to respond
ALTER TABLE public.reviews ADD COLUMN reply_text TEXT DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN replied_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
