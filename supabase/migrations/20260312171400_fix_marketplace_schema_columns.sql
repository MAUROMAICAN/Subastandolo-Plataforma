-- =============================================
-- Fix marketplace_products schema: add missing columns
-- from the new schema that were skipped due to IF NOT EXISTS
-- =============================================

-- Add new columns that the second migration expected
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}';
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS favorites_count INT DEFAULT 0;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS questions_count INT DEFAULT 0;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS sales_count INT DEFAULT 0;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Copy data from old columns to new columns for any existing records
UPDATE marketplace_products SET seller_id = dealer_id WHERE seller_id IS NULL AND dealer_id IS NOT NULL;
UPDATE marketplace_products SET price = price_usd WHERE price IS NULL AND price_usd IS NOT NULL;

-- If condition values are from old schema, update them
UPDATE marketplace_products SET condition = 'nuevo' WHERE condition = 'new';
UPDATE marketplace_products SET condition = 'usado_buen_estado' WHERE condition = 'used';
UPDATE marketplace_products SET condition = 'usado_buen_estado' WHERE condition = 'refurbished';

-- Make description optional (old schema had it as NOT NULL)
ALTER TABLE marketplace_products ALTER COLUMN description DROP NOT NULL;

-- Fix RLS policies to support both old and new column names
-- Drop old policies and recreate
DROP POLICY IF EXISTS "Products are viewable by everyone" ON marketplace_products;
DROP POLICY IF EXISTS "Dealers can insert their own products" ON marketplace_products;
DROP POLICY IF EXISTS "Dealers can update their own products" ON marketplace_products;

-- New policies that work with seller_id (which now contains the data)
CREATE POLICY "Products viewable by everyone" ON marketplace_products FOR SELECT
  USING (status = 'active' OR auth.uid() = seller_id OR auth.uid() = dealer_id);

CREATE POLICY "Sellers can insert products" ON marketplace_products FOR INSERT
  WITH CHECK (auth.uid() = seller_id OR auth.uid() = dealer_id);

CREATE POLICY "Sellers can update products" ON marketplace_products FOR UPDATE
  USING (auth.uid() = seller_id OR auth.uid() = dealer_id)
  WITH CHECK (auth.uid() = seller_id OR auth.uid() = dealer_id);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_mkt_products_seller ON marketplace_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_mkt_products_price ON marketplace_products(price);
CREATE INDEX IF NOT EXISTS idx_mkt_products_slug ON marketplace_products(slug);

-- Add allowed condition values
ALTER TABLE marketplace_products DROP CONSTRAINT IF EXISTS marketplace_products_condition_check;
ALTER TABLE marketplace_products ADD CONSTRAINT marketplace_products_condition_check 
  CHECK (condition IN ('nuevo', 'usado_buen_estado', 'usado_regular', 'para_reparar', 'new', 'used', 'refurbished'));

-- Add allowed status values  
ALTER TABLE marketplace_products DROP CONSTRAINT IF EXISTS marketplace_products_status_check;
ALTER TABLE marketplace_products ADD CONSTRAINT marketplace_products_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'sold', 'removed', 'out_of_stock'));
