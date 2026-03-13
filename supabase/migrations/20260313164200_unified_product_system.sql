-- =============================================
-- UNIFIED PRODUCT SYSTEM — Phase 1
-- Add listing types, auction columns, and offers table
-- =============================================

-- 1. Add listing_type to marketplace_products
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'fixed_price';

-- Allow 'deleted' status (used by delete button)
ALTER TABLE marketplace_products DROP CONSTRAINT IF EXISTS marketplace_products_status_check;
ALTER TABLE marketplace_products ADD CONSTRAINT marketplace_products_status_check
  CHECK (status IN ('pending', 'active', 'paused', 'sold', 'removed', 'deleted', 'out_of_stock'));

-- Add listing type constraint
ALTER TABLE marketplace_products ADD CONSTRAINT marketplace_products_listing_type_check
  CHECK (listing_type IN ('fixed_price', 'auction', 'accepts_offers'));

-- 2. Add auction-specific columns  
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS starting_price DECIMAL(12,2);
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS current_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES auth.users(id);
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS allow_auto_extend BOOLEAN DEFAULT true;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS auction_duration_hours INT;
ALTER TABLE marketplace_products ADD COLUMN IF NOT EXISTS accepts_offers BOOLEAN DEFAULT false;

-- 3. Product Bids (for unified auction mode)
CREATE TABLE IF NOT EXISTS product_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  bidder_name TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_bids_product ON product_bids(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bids_user ON product_bids(user_id);

-- 4. Product Offers (for "accepts offers" mode)
CREATE TABLE IF NOT EXISTS product_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  amount DECIMAL(12,2) NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','countered')),
  counter_amount DECIMAL(12,2),
  counter_message TEXT,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT now() + interval '48 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_offers_product ON product_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_buyer ON product_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_status ON product_offers(status);

-- 5. RLS Policies

-- Product bids
ALTER TABLE product_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_bids_read" ON product_bids FOR SELECT USING (true);
CREATE POLICY "product_bids_insert" ON product_bids FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Product offers
ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_offers_read" ON product_offers FOR SELECT USING (
  auth.uid() = buyer_id OR
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);
CREATE POLICY "product_offers_insert" ON product_offers FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "product_offers_update" ON product_offers FOR UPDATE USING (
  auth.uid() = buyer_id OR
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);

-- 6. Trigger: update current_price and winner on new bid
CREATE OR REPLACE FUNCTION handle_product_bid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_products
  SET current_price = NEW.amount,
      winner_id = NEW.user_id
  WHERE id = NEW.product_id
    AND listing_type = 'auction';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_product_bid ON product_bids;
CREATE TRIGGER trg_product_bid
  AFTER INSERT ON product_bids
  FOR EACH ROW EXECUTE FUNCTION handle_product_bid();

-- 7. Enable realtime for bids and offers
ALTER PUBLICATION supabase_realtime ADD TABLE product_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE product_offers;
