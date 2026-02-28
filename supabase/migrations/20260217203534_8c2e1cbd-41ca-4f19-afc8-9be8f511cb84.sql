
-- Add dealer management fields
ALTER TABLE public.dealer_verification
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS manual_tier text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status_changed_by uuid DEFAULT NULL;

-- account_status: 'active', 'paused', 'under_review', 'banned'
-- manual_tier: null means automatic, or 'nuevo','bronce','plata','oro','platinum','ruby' for manual override
