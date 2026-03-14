-- Phase 3 Feature 2: User Reports (user → user)

CREATE TABLE IF NOT EXISTS user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  reported_user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (reason IN ('harassment', 'fraud', 'fake_identity', 'manipulation', 'other')),
  details TEXT DEFAULT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE (reporter_id, reported_user_id)
);

-- RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Users can create reports
CREATE POLICY "Users can create user reports"
ON user_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- Admins can view all
CREATE POLICY "Admins can view user reports"
ON user_reports FOR SELECT
USING (
  EXISTS (SELECT 1 FROM admin_permissions WHERE user_id = auth.uid())
  OR auth.uid() = reporter_id
);

-- Admins can update (review)
CREATE POLICY "Admins can update user reports"
ON user_reports FOR UPDATE
USING (EXISTS (SELECT 1 FROM admin_permissions WHERE user_id = auth.uid()));

COMMENT ON TABLE user_reports IS 'User-to-user reports for harassment, fraud, etc.';
