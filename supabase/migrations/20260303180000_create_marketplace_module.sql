-- ==========================================
-- MARKETPLACE SCHEMA MIGRATION
-- ==========================================

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.marketplace_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES public.marketplace_categories(id),
    description TEXT,
    icon_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS public.marketplace_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.marketplace_categories(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price_usd NUMERIC(10, 2) NOT NULL CHECK (price_usd > 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    condition TEXT DEFAULT 'new' CHECK (condition IN ('new', 'used', 'refurbished')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'out_of_stock')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Product Images Table
CREATE TABLE IF NOT EXISTS public.marketplace_product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Product Attributes Table (Variations like Size, Color, Model)
CREATE TABLE IF NOT EXISTS public.marketplace_product_attributes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
    attr_name TEXT NOT NULL, -- e.g., 'Size', 'Color'
    attr_value TEXT NOT NULL, -- e.g., 'M', 'Red'
    additional_price_usd NUMERIC(10, 2) DEFAULT 0, -- If this variation costs more
    stock INTEGER, -- Optional specific stock for this variant. If null, use main product stock.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, attr_name, attr_value)
);

-- 5. Orders Table (Direct Purchases)
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id),
    dealer_id UUID NOT NULL REFERENCES public.profiles(id),
    product_id UUID NOT NULL REFERENCES public.marketplace_products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price_usd NUMERIC(10, 2) NOT NULL,
    total_price_bs NUMERIC(10, 2),
    bcv_rate NUMERIC(10, 2),
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'under_review', 'verified', 'rejected')),
    payment_proof_url TEXT,
    payment_reference TEXT,
    shipping_status TEXT DEFAULT 'pending' CHECK (shipping_status IN ('pending', 'shipped', 'delivered')),
    tracking_number TEXT,
    shipping_company TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

-- 1. Categories
-- Anyone can read categories
CREATE POLICY "Categories are viewable by everyone" ON public.marketplace_categories FOR SELECT USING (true);
-- Only admins can modify categories (assuming admin check via function or separate table, keeping simple for now)

-- 2. Products
-- Anyone can read active products
CREATE POLICY "Products are viewable by everyone" ON public.marketplace_products FOR SELECT
  USING (status = 'active' OR auth.uid() = dealer_id);
-- Dealers can insert their own products
CREATE POLICY "Dealers can insert their own products" ON public.marketplace_products FOR INSERT
  WITH CHECK (auth.uid() = dealer_id);
-- Dealers can update their own products
CREATE POLICY "Dealers can update their own products" ON public.marketplace_products FOR UPDATE
  USING (auth.uid() = dealer_id)
  WITH CHECK (auth.uid() = dealer_id);

-- 3. Product Images
-- Anyone can read images
CREATE POLICY "Product images are viewable by everyone" ON public.marketplace_product_images FOR SELECT USING (true);
-- Only the dealer owning the product can modify images (requires a complex join in policy, simplifying by allowing insert/update and validating on the client/edge function for now, or using a subquery)
CREATE POLICY "Dealers can manage product images" ON public.marketplace_product_images FOR ALL
  USING (EXISTS (SELECT 1 FROM public.marketplace_products WHERE id = marketplace_product_images.product_id AND dealer_id = auth.uid()));

-- 4. Product Attributes
-- Anyone can read attributes
CREATE POLICY "Product attributes are viewable by everyone" ON public.marketplace_product_attributes FOR SELECT USING (true);
-- Only the dealer owning the product can modify attributes
CREATE POLICY "Dealers can manage product attributes" ON public.marketplace_product_attributes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.marketplace_products WHERE id = marketplace_product_attributes.product_id AND dealer_id = auth.uid()));

-- 5. Orders
-- Buyers can see their own orders. Dealers can see orders placed to them.
CREATE POLICY "Users can view relevant orders" ON public.marketplace_orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = dealer_id);
-- Buyers can insert orders
CREATE POLICY "Buyers can create orders" ON public.marketplace_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);
-- Dealers can update shipping details, buyers can update payment proof (Simplified for now, precise column locks should be enforced via Edge Functions)
CREATE POLICY "Related users can update orders" ON public.marketplace_orders FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = dealer_id);
