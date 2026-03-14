-- =============================================
-- FULL MARKETPLACE SETUP — Run on PRUEBAS Supabase SQL Editor
-- This consolidates all marketplace migrations into one script
-- =============================================

-- =============================================
-- 1. TABLES
-- =============================================

-- Categories (already exists from earlier, but just in case)
CREATE TABLE IF NOT EXISTS marketplace_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES marketplace_categories(id),
    description TEXT,
    icon TEXT,
    icon_url TEXT,
    is_active BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE IF NOT EXISTS marketplace_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES marketplace_categories(id),
    title TEXT NOT NULL,
    description TEXT,
    price_usd NUMERIC(10, 2),
    price DECIMAL(12,2),
    currency TEXT DEFAULT 'USD',
    stock INTEGER NOT NULL DEFAULT 0,
    condition TEXT DEFAULT 'nuevo',
    status TEXT DEFAULT 'active',
    listing_type TEXT DEFAULT 'fixed_price',
    image_url TEXT,
    slug TEXT,
    attributes JSONB DEFAULT '{}',
    views_count INT DEFAULT 0,
    favorites_count INT DEFAULT 0,
    questions_count INT DEFAULT 0,
    sales_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    -- Auction columns
    starting_price DECIMAL(12,2),
    current_price DECIMAL(12,2) DEFAULT 0,
    end_time TIMESTAMPTZ,
    winner_id UUID REFERENCES auth.users(id),
    allow_auto_extend BOOLEAN DEFAULT true,
    auction_duration_hours INT,
    accepts_offers BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product Images
CREATE TABLE IF NOT EXISTS marketplace_product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Product Attributes
CREATE TABLE IF NOT EXISTS marketplace_product_attributes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    attr_name TEXT NOT NULL,
    attr_value TEXT NOT NULL,
    additional_price_usd NUMERIC(10, 2) DEFAULT 0,
    stock INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, attr_name, attr_value)
);

-- Orders
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES profiles(id),
    dealer_id UUID NOT NULL REFERENCES profiles(id),
    product_id UUID NOT NULL REFERENCES marketplace_products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price_usd NUMERIC(10, 2) NOT NULL,
    total_price_bs NUMERIC(10, 2),
    bcv_rate NUMERIC(10, 2),
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    phone_number TEXT,
    payment_status TEXT DEFAULT 'pending',
    payment_proof_url TEXT,
    payment_reference TEXT,
    shipping_status TEXT DEFAULT 'pending',
    tracking_number TEXT,
    shipping_company TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Product Bids (auction mode)
CREATE TABLE IF NOT EXISTS product_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    bidder_name TEXT NOT NULL DEFAULT '',
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Offers (accepts_offers mode)
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

-- =============================================
-- 2. INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_mkt_products_seller ON marketplace_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_mkt_products_price ON marketplace_products(price);
CREATE INDEX IF NOT EXISTS idx_mkt_products_slug ON marketplace_products(slug);
CREATE INDEX IF NOT EXISTS idx_mkt_products_listing ON marketplace_products(listing_type);
CREATE INDEX IF NOT EXISTS idx_mkt_products_status ON marketplace_products(status);
CREATE INDEX IF NOT EXISTS idx_product_bids_product ON product_bids(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bids_user ON product_bids(user_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_product ON product_offers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_buyer ON product_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_offers_status ON product_offers(status);

-- =============================================
-- 3. RLS POLICIES
-- =============================================

-- Categories
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_read" ON marketplace_categories;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON marketplace_categories;
CREATE POLICY "categories_read" ON marketplace_categories FOR SELECT USING (true);

-- Products
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mkt_prod_read" ON marketplace_products;
DROP POLICY IF EXISTS "mkt_prod_insert" ON marketplace_products;
DROP POLICY IF EXISTS "mkt_prod_update" ON marketplace_products;
DROP POLICY IF EXISTS "mkt_prod_delete" ON marketplace_products;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON marketplace_products;
DROP POLICY IF EXISTS "Products viewable by everyone" ON marketplace_products;
DROP POLICY IF EXISTS "Dealers can insert their own products" ON marketplace_products;
DROP POLICY IF EXISTS "Dealers can update their own products" ON marketplace_products;
DROP POLICY IF EXISTS "Sellers can insert products" ON marketplace_products;
DROP POLICY IF EXISTS "Sellers can update products" ON marketplace_products;
DROP POLICY IF EXISTS "marketplace_products_select" ON marketplace_products;
DROP POLICY IF EXISTS "marketplace_products_insert" ON marketplace_products;
DROP POLICY IF EXISTS "marketplace_products_update" ON marketplace_products;

CREATE POLICY "mkt_prod_read" ON marketplace_products FOR SELECT USING (true);
CREATE POLICY "mkt_prod_insert" ON marketplace_products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "mkt_prod_update" ON marketplace_products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "mkt_prod_delete" ON marketplace_products FOR DELETE USING (auth.uid() = seller_id);

-- Product Images
ALTER TABLE marketplace_product_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mkt_img_read" ON marketplace_product_images;
DROP POLICY IF EXISTS "mkt_img_insert" ON marketplace_product_images;
DROP POLICY IF EXISTS "mkt_img_update" ON marketplace_product_images;
DROP POLICY IF EXISTS "mkt_img_delete" ON marketplace_product_images;
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON marketplace_product_images;
DROP POLICY IF EXISTS "Dealers can manage product images" ON marketplace_product_images;

CREATE POLICY "mkt_img_read" ON marketplace_product_images FOR SELECT USING (true);
CREATE POLICY "mkt_img_insert" ON marketplace_product_images FOR INSERT WITH CHECK (
  auth.uid() = (SELECT seller_id FROM marketplace_products WHERE id = product_id)
);
CREATE POLICY "mkt_img_update" ON marketplace_product_images FOR UPDATE USING (
  auth.uid() = (SELECT seller_id FROM marketplace_products WHERE id = product_id)
);
CREATE POLICY "mkt_img_delete" ON marketplace_product_images FOR DELETE USING (
  auth.uid() = (SELECT seller_id FROM marketplace_products WHERE id = product_id)
);

-- Product Attributes
ALTER TABLE marketplace_product_attributes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Product attributes are viewable by everyone" ON marketplace_product_attributes;
DROP POLICY IF EXISTS "Dealers can manage product attributes" ON marketplace_product_attributes;
CREATE POLICY "mkt_attr_read" ON marketplace_product_attributes FOR SELECT USING (true);
CREATE POLICY "mkt_attr_manage" ON marketplace_product_attributes FOR ALL USING (
  auth.uid() = (SELECT seller_id FROM marketplace_products WHERE id = product_id)
);

-- Orders
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view relevant orders" ON marketplace_orders;
DROP POLICY IF EXISTS "Buyers can create orders" ON marketplace_orders;
DROP POLICY IF EXISTS "Related users can update orders" ON marketplace_orders;
CREATE POLICY "orders_read" ON marketplace_orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = dealer_id);
CREATE POLICY "orders_insert" ON marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "orders_update" ON marketplace_orders FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = dealer_id);

-- Product Bids
ALTER TABLE product_bids ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_bids_read" ON product_bids;
DROP POLICY IF EXISTS "product_bids_insert" ON product_bids;
CREATE POLICY "product_bids_read" ON product_bids FOR SELECT USING (true);
CREATE POLICY "product_bids_insert" ON product_bids FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Product Offers
ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_offers_read" ON product_offers;
DROP POLICY IF EXISTS "product_offers_insert" ON product_offers;
DROP POLICY IF EXISTS "product_offers_update" ON product_offers;
CREATE POLICY "product_offers_read" ON product_offers FOR SELECT USING (
  auth.uid() = buyer_id OR
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);
CREATE POLICY "product_offers_insert" ON product_offers FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "product_offers_update" ON product_offers FOR UPDATE USING (
  auth.uid() = buyer_id OR
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);

-- =============================================
-- 4. TRIGGER: update current_price on bid
-- =============================================
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

-- =============================================
-- 5. RELOAD SCHEMA CACHE
-- =============================================
NOTIFY pgrst, 'reload schema';
