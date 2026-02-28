-- Add manual paid tracking column to platform_earnings
ALTER TABLE public.platform_earnings ADD COLUMN is_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.platform_earnings ADD COLUMN paid_at timestamp with time zone;
ALTER TABLE public.platform_earnings ADD COLUMN paid_by uuid;