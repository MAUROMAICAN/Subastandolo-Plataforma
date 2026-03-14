-- Add live_authorized column to profiles for admin override
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS live_authorized boolean DEFAULT false;

-- Add moderation tables for live safety
CREATE TABLE IF NOT EXISTS live_chat_bans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES live_events(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    banned_by uuid NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES live_events(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
    admin_notes text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS live_moderation_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES live_events(id) ON DELETE CASCADE,
    detection_type text NOT NULL,
    confidence numeric,
    action_taken text,
    thumbnail_url text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- Add is_hidden to live_chat for moderated messages
ALTER TABLE live_chat ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- RLS for new tables
ALTER TABLE live_chat_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_moderation_log ENABLE ROW LEVEL SECURITY;

-- Chat bans: dealer can manage, everyone can read
CREATE POLICY "Anyone can view chat bans" ON live_chat_bans FOR SELECT USING (true);
CREATE POLICY "Dealers can ban users in their events" ON live_chat_bans FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM live_events WHERE id = event_id AND dealer_id = auth.uid())
);

-- Reports: authenticated users can create, admins can view
CREATE POLICY "Auth users can report" ON live_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view reports" ON live_reports FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_permissions WHERE user_id = auth.uid())
);

-- Moderation log: admins only
CREATE POLICY "Admins can view moderation log" ON live_moderation_log FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_permissions WHERE user_id = auth.uid())
);
CREATE POLICY "Service role can insert moderation log" ON live_moderation_log FOR INSERT WITH CHECK (true);
