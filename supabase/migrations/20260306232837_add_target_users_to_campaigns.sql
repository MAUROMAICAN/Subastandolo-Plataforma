-- Add target_user_ids to campaigns for user-specific campaign targeting
-- When NULL → campaign shows to ALL users (current behavior)
-- When populated → campaign only shows to specified users
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_user_ids jsonb DEFAULT NULL;

-- Add comment for documentation  
COMMENT ON COLUMN campaigns.target_user_ids IS 'JSON array of user UUIDs. NULL means all users.';
