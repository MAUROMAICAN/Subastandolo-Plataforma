-- Add warranty fields to marketplace_products
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS has_warranty BOOLEAN DEFAULT false;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS warranty_duration TEXT DEFAULT NULL;

COMMENT ON COLUMN marketplace_products.has_warranty IS 'Whether the product includes warranty from the seller';
COMMENT ON COLUMN marketplace_products.warranty_duration IS 'Warranty duration: 30_days, 90_days, 6_months, 1_year';
