-- Fix RLS policies for marketplace_products
-- The table uses seller_id (not dealer_id)

DO $$
BEGIN
  -- Drop any existing policies
  DROP POLICY IF EXISTS "marketplace_products_select" ON marketplace_products;
  DROP POLICY IF EXISTS "marketplace_products_insert" ON marketplace_products;
  DROP POLICY IF EXISTS "marketplace_products_update" ON marketplace_products;
  DROP POLICY IF EXISTS "Products are viewable by everyone" ON marketplace_products;
  DROP POLICY IF EXISTS "Dealers can insert their own products" ON marketplace_products;
  DROP POLICY IF EXISTS "Dealers can update their own products" ON marketplace_products;
  DROP POLICY IF EXISTS "Products viewable by everyone" ON marketplace_products;
  DROP POLICY IF EXISTS "Sellers can insert products" ON marketplace_products;
  DROP POLICY IF EXISTS "Sellers can update products" ON marketplace_products;
END $$;

-- Create proper RLS policies using seller_id
CREATE POLICY "marketplace_products_select" ON marketplace_products FOR SELECT
  USING (status = 'active' OR auth.uid() = seller_id);

CREATE POLICY "marketplace_products_insert" ON marketplace_products FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "marketplace_products_update" ON marketplace_products FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);
