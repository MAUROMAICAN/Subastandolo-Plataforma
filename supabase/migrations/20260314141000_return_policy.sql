-- Add return policy to marketplace products
ALTER TABLE marketplace_products
ADD COLUMN IF NOT EXISTS return_policy TEXT DEFAULT 'none'
CHECK (return_policy IN ('none', '7_days', '15_days', '30_days_free'));

COMMENT ON COLUMN marketplace_products.return_policy IS 'Return policy: none, 7_days, 15_days, 30_days_free';
