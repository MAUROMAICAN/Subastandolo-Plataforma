-- Add platform column to push_subscriptions to differentiate FCM tokens from Web Push
ALTER TABLE public.push_subscriptions 
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'android', 'ios'));

-- Index for efficient queries by platform
CREATE INDEX IF NOT EXISTS push_subscriptions_platform_idx 
  ON public.push_subscriptions(platform);
