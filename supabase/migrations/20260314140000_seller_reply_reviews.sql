-- Add seller reply capability to reviews
-- Using reply_text / replied_at to match existing ReviewCard component
ALTER TABLE reviews
ADD COLUMN IF NOT EXISTS reply_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ DEFAULT NULL;

-- RLS: allow the reviewed user to update ONLY their own reply
CREATE POLICY "Users can reply to reviews about them"
ON reviews FOR UPDATE
USING (auth.uid() = reviewed_id)
WITH CHECK (auth.uid() = reviewed_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_reviews_replied ON reviews (reviewed_id) WHERE reply_text IS NOT NULL;
