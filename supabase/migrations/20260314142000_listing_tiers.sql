-- Phase 3 Feature 1: Listing Tiers
-- Gratuita (0%) | Estándar (8%) | Premium (12%)

ALTER TABLE marketplace_products
ADD COLUMN IF NOT EXISTS listing_tier TEXT DEFAULT 'free'
CHECK (listing_tier IN ('free', 'standard', 'premium'));

COMMENT ON COLUMN marketplace_products.listing_tier IS 'Publication tier: free (0%, max 5), standard (8%), premium (12% + highlight)';

-- Index for ordering: premium first
CREATE INDEX IF NOT EXISTS idx_marketplace_products_listing_tier
ON marketplace_products (listing_tier, created_at DESC);
