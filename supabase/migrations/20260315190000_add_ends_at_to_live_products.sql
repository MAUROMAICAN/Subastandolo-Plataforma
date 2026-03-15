-- Add ends_at column for anti-sniping timer
ALTER TABLE live_event_products ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
