-- =============================================
-- MARKETPLACE MODULE — SUBASTANDOLO
-- Compra directa a precio fijo (separado de subastas)
-- =============================================

-- Clean up old partial tables from previous migration attempt
DROP TABLE IF EXISTS auction_attributes CASCADE;
DROP TABLE IF EXISTS marketplace_orders CASCADE;
DROP TABLE IF EXISTS marketplace_favorites CASCADE;
DROP TABLE IF EXISTS product_questions CASCADE;
DROP TABLE IF EXISTS marketplace_product_images CASCADE;
DROP TABLE IF EXISTS marketplace_products CASCADE;
DROP TABLE IF EXISTS category_attributes CASCADE;
DROP TABLE IF EXISTS marketplace_categories CASCADE;
DROP FUNCTION IF EXISTS update_mkt_product_timestamp() CASCADE;

-- =============================================
-- 1. CATEGORIES (jerárquicas, simplificadas)
-- =============================================

CREATE TABLE IF NOT EXISTS marketplace_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES marketplace_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT '📦',
  level INT NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mkt_categories_parent ON marketplace_categories(parent_id);
CREATE INDEX idx_mkt_categories_slug ON marketplace_categories(slug);

-- =============================================
-- 2. CATEGORY ATTRIBUTES (dynamic form fields)
-- =============================================

CREATE TABLE IF NOT EXISTS category_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES marketplace_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'select', 'multiselect', 'boolean')),
  options JSONB DEFAULT '[]',
  required BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  placeholder TEXT,
  group_name TEXT DEFAULT 'Características',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cat_attrs_category ON category_attributes(category_id);

-- =============================================
-- 3. MARKETPLACE PRODUCTS (compra directa)
-- =============================================

CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES marketplace_categories(id),
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL CHECK (price > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  stock INT NOT NULL DEFAULT 1 CHECK (stock >= 0),
  condition TEXT NOT NULL DEFAULT 'nuevo' CHECK (condition IN ('nuevo', 'usado_buen_estado', 'usado_regular', 'para_reparar')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'sold', 'removed')),
  attributes JSONB DEFAULT '{}',
  views_count INT NOT NULL DEFAULT 0,
  favorites_count INT NOT NULL DEFAULT 0,
  questions_count INT NOT NULL DEFAULT 0,
  sales_count INT NOT NULL DEFAULT 0,
  image_url TEXT,
  slug TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mkt_products_seller ON marketplace_products(seller_id);
CREATE INDEX idx_mkt_products_category ON marketplace_products(category_id);
CREATE INDEX idx_mkt_products_status ON marketplace_products(status);
CREATE INDEX idx_mkt_products_price ON marketplace_products(price);
CREATE INDEX idx_mkt_products_created ON marketplace_products(created_at DESC);
CREATE INDEX idx_mkt_products_slug ON marketplace_products(slug);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_mkt_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mkt_product_updated
  BEFORE UPDATE ON marketplace_products
  FOR EACH ROW EXECUTE FUNCTION update_mkt_product_timestamp();

-- =============================================
-- 4. PRODUCT IMAGES (multiple, ordered)
-- =============================================

CREATE TABLE IF NOT EXISTS marketplace_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mkt_images_product ON marketplace_product_images(product_id);

-- =============================================
-- 5. PRODUCT QUESTIONS (Q&A público)
-- =============================================

CREATE TABLE IF NOT EXISTS product_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  asker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'flagged', 'removed')),
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pq_product ON product_questions(product_id);
CREATE INDEX idx_pq_asker ON product_questions(asker_id);
CREATE INDEX idx_pq_status ON product_questions(status);

-- =============================================
-- 6. PRODUCT FAVORITES
-- =============================================

CREATE TABLE IF NOT EXISTS marketplace_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_mkt_favs_user ON marketplace_favorites(user_id);
CREATE INDEX idx_mkt_favs_product ON marketplace_favorites(product_id);

-- =============================================
-- 7. MARKETPLACE ORDERS (compras)
-- =============================================

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID NOT NULL REFERENCES marketplace_products(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'confirmed', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'
  )),
  shipping_address JSONB,
  payment_method TEXT,
  payment_proof_url TEXT,
  tracking_number TEXT,
  notes TEXT,
  buyer_rated BOOLEAN NOT NULL DEFAULT false,
  seller_rated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mkt_orders_buyer ON marketplace_orders(buyer_id);
CREATE INDEX idx_mkt_orders_seller ON marketplace_orders(seller_id);
CREATE INDEX idx_mkt_orders_product ON marketplace_orders(product_id);
CREATE INDEX idx_mkt_orders_status ON marketplace_orders(status);

CREATE TRIGGER trg_mkt_order_updated
  BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_mkt_product_timestamp();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Categories & attributes: public read
CREATE POLICY "mkt_cat_read" ON marketplace_categories FOR SELECT USING (true);
CREATE POLICY "mkt_cat_attrs_read" ON category_attributes FOR SELECT USING (true);

-- Products: public read active, sellers manage own
CREATE POLICY "mkt_prod_read" ON marketplace_products FOR SELECT USING (true);
CREATE POLICY "mkt_prod_insert" ON marketplace_products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "mkt_prod_update" ON marketplace_products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "mkt_prod_delete" ON marketplace_products FOR DELETE USING (auth.uid() = seller_id);

-- Product images: public read, sellers manage own
CREATE POLICY "mkt_img_read" ON marketplace_product_images FOR SELECT USING (true);
CREATE POLICY "mkt_img_insert" ON marketplace_product_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);
CREATE POLICY "mkt_img_update" ON marketplace_product_images FOR UPDATE USING (
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);
CREATE POLICY "mkt_img_delete" ON marketplace_product_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);

-- Questions: public read, auth users ask, sellers answer own products
CREATE POLICY "pq_read" ON product_questions FOR SELECT USING (true);
CREATE POLICY "pq_insert" ON product_questions FOR INSERT WITH CHECK (auth.uid() = asker_id);
CREATE POLICY "pq_update" ON product_questions FOR UPDATE USING (
  auth.uid() = asker_id OR
  EXISTS (SELECT 1 FROM marketplace_products WHERE id = product_id AND seller_id = auth.uid())
);

-- Favorites: users manage own
CREATE POLICY "mkt_fav_read" ON marketplace_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mkt_fav_insert" ON marketplace_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mkt_fav_delete" ON marketplace_favorites FOR DELETE USING (auth.uid() = user_id);

-- Orders: buyer and seller can see own
CREATE POLICY "mkt_ord_read" ON marketplace_orders FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);
CREATE POLICY "mkt_ord_insert" ON marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "mkt_ord_update" ON marketplace_orders FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

-- =============================================
-- SEED: ROOT CATEGORIES
-- =============================================

INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position, description) VALUES
  ('c0000001-0000-0000-0000-000000000001', NULL, 'Celulares y Telefonía', 'celulares-y-telefonia', '📱', 0, 1, 'Smartphones, accesorios y telefonía'),
  ('c0000002-0000-0000-0000-000000000002', NULL, 'Computación', 'computacion', '💻', 0, 2, 'Laptops, PC y componentes'),
  ('c0000003-0000-0000-0000-000000000003', NULL, 'Electrónica', 'electronica', '📺', 0, 3, 'TV, audio, cámaras y video'),
  ('c0000004-0000-0000-0000-000000000004', NULL, 'Electrodomésticos', 'electrodomesticos', '🏠', 0, 4, 'Cocción, lavado, refrigeración'),
  ('c0000005-0000-0000-0000-000000000005', NULL, 'Ropa y Moda', 'ropa-y-moda', '👗', 0, 5, 'Prendas de vestir y accesorios'),
  ('c0000006-0000-0000-0000-000000000006', NULL, 'Calzado', 'calzado', '👟', 0, 6, 'Zapatos, tenis, sandalias'),
  ('c0000007-0000-0000-0000-000000000007', NULL, 'Relojes y Joyería', 'relojes-y-joyeria', '⌚', 0, 7, 'Relojes, pulseras, collares'),
  ('c0000008-0000-0000-0000-000000000008', NULL, 'Perfumes y Belleza', 'perfumes-y-belleza', '🌺', 0, 8, 'Fragancias, maquillaje, cuidado personal'),
  ('c0000009-0000-0000-0000-000000000009', NULL, 'Vehículos y Accesorios', 'vehiculos-y-accesorios', '🚗', 0, 9, 'Repuestos, accesorios, motos'),
  ('c0000010-0000-0000-0000-000000000010', NULL, 'Deportes', 'deportes', '🏋️', 0, 10, 'Equipamiento, ropa y calzado deportivo'),
  ('c0000011-0000-0000-0000-000000000011', NULL, 'Gaming y Consolas', 'gaming-y-consolas', '🎮', 0, 11, 'Consolas, videojuegos, accesorios'),
  ('c0000012-0000-0000-0000-000000000012', NULL, 'Hogar y Muebles', 'hogar-y-muebles', '🛋️', 0, 12, 'Muebles, decoración, cocina, jardín'),
  ('c0000013-0000-0000-0000-000000000013', NULL, 'Herramientas', 'herramientas', '🔧', 0, 13, 'Manuales, eléctricas, medición'),
  ('c0000014-0000-0000-0000-000000000014', NULL, 'Bebés y Juguetes', 'bebes-y-juguetes', '🧸', 0, 14, 'Ropa bebé, juguetes, accesorios'),
  ('c0000015-0000-0000-0000-000000000015', NULL, 'Otros', 'otros', '📦', 0, 15, 'Productos varios');

-- =============================================
-- SEED: SUBCATEGORIES
-- =============================================

-- Celulares y Telefonía
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c1010000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Smartphones', 'smartphones', '📱', 1, 1),
  ('c1020000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Accesorios para Celulares', 'accesorios-celulares', '🔌', 1, 2),
  ('c1030000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Repuestos para Celulares', 'repuestos-celulares', '🔧', 1, 3),
  ('c1040000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Smartwatches', 'smartwatches', '⌚', 1, 4),
  ('c1050000-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'Telefonía Fija', 'telefonia-fija', '☎️', 1, 5);

-- Computación
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c2010000-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'Laptops', 'laptops', '💻', 1, 1),
  ('c2020000-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'PC de Escritorio', 'pc-escritorio', '🖥️', 1, 2),
  ('c2030000-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'Componentes de PC', 'componentes-pc', '🔧', 1, 3),
  ('c2040000-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'Periféricos', 'perifericos', '⌨️', 1, 4),
  ('c2050000-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'Tablets y Accesorios', 'tablets-y-accesorios', '📲', 1, 5),
  ('c2060000-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002', 'Impresoras', 'impresoras', '🖨️', 1, 6);

-- Electrónica
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c3010000-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', 'Televisores', 'televisores', '📺', 1, 1),
  ('c3020000-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', 'Audio', 'audio', '🔊', 1, 2),
  ('c3030000-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', 'Cámaras y Fotografía', 'camaras-fotografia', '📷', 1, 3),
  ('c3040000-0000-0000-0000-000000000003', 'c0000003-0000-0000-0000-000000000003', 'Drones', 'drones', '🚁', 1, 4);

-- Electrodomésticos
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c4010000-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', 'Cocción', 'coccion', '🍳', 1, 1),
  ('c4020000-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', 'Lavado', 'lavado', '🫧', 1, 2),
  ('c4030000-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', 'Refrigeración', 'refrigeracion', '❄️', 1, 3),
  ('c4040000-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', 'Climatización', 'climatizacion', '🌬️', 1, 4),
  ('c4050000-0000-0000-0000-000000000004', 'c0000004-0000-0000-0000-000000000004', 'Pequeños Electrodomésticos', 'pequenos-electrodomesticos', '🔌', 1, 5);

-- Ropa y Moda
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c5010000-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', 'Ropa de Hombre', 'ropa-hombre', '👔', 1, 1),
  ('c5020000-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', 'Ropa de Mujer', 'ropa-mujer', '👚', 1, 2),
  ('c5030000-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', 'Ropa de Niños', 'ropa-ninos', '👶', 1, 3),
  ('c5040000-0000-0000-0000-000000000005', 'c0000005-0000-0000-0000-000000000005', 'Accesorios de Moda', 'accesorios-moda', '🧣', 1, 4);

-- Calzado
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c6010000-0000-0000-0000-000000000006', 'c0000006-0000-0000-0000-000000000006', 'Calzado Deportivo', 'calzado-deportivo', '🏃', 1, 1),
  ('c6020000-0000-0000-0000-000000000006', 'c0000006-0000-0000-0000-000000000006', 'Calzado Casual', 'calzado-casual', '🥿', 1, 2),
  ('c6030000-0000-0000-0000-000000000006', 'c0000006-0000-0000-0000-000000000006', 'Calzado Formal', 'calzado-formal', '👞', 1, 3);

-- Relojes y Joyería
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c7010000-0000-0000-0000-000000000007', 'c0000007-0000-0000-0000-000000000007', 'Relojes', 'relojes', '⌚', 1, 1),
  ('c7020000-0000-0000-0000-000000000007', 'c0000007-0000-0000-0000-000000000007', 'Pulseras y Brazaletes', 'pulseras-brazaletes', '📿', 1, 2),
  ('c7030000-0000-0000-0000-000000000007', 'c0000007-0000-0000-0000-000000000007', 'Collares', 'collares', '💎', 1, 3),
  ('c7040000-0000-0000-0000-000000000007', 'c0000007-0000-0000-0000-000000000007', 'Anillos', 'anillos', '💍', 1, 4);

-- Perfumes y Belleza
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c8010000-0000-0000-0000-000000000008', 'c0000008-0000-0000-0000-000000000008', 'Perfumes', 'perfumes', '🧴', 1, 1),
  ('c8020000-0000-0000-0000-000000000008', 'c0000008-0000-0000-0000-000000000008', 'Maquillaje', 'maquillaje', '💄', 1, 2),
  ('c8030000-0000-0000-0000-000000000008', 'c0000008-0000-0000-0000-000000000008', 'Cuidado Personal', 'cuidado-personal', '🧼', 1, 3),
  ('c8040000-0000-0000-0000-000000000008', 'c0000008-0000-0000-0000-000000000008', 'Cuidado del Cabello', 'cuidado-cabello', '💇', 1, 4);

-- Vehículos
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('c9010000-0000-0000-0000-000000000009', 'c0000009-0000-0000-0000-000000000009', 'Repuestos de Autos', 'repuestos-autos', '⚙️', 1, 1),
  ('c9020000-0000-0000-0000-000000000009', 'c0000009-0000-0000-0000-000000000009', 'Accesorios de Autos', 'accesorios-autos', '🔧', 1, 2),
  ('c9030000-0000-0000-0000-000000000009', 'c0000009-0000-0000-0000-000000000009', 'Motos y Accesorios', 'motos-accesorios', '🏍️', 1, 3);

-- Deportes
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('ca010000-0000-0000-0000-000000000010', 'c0000010-0000-0000-0000-000000000010', 'Equipamiento Deportivo', 'equipamiento-deportivo', '🏋️', 1, 1),
  ('ca020000-0000-0000-0000-000000000010', 'c0000010-0000-0000-0000-000000000010', 'Ropa Deportiva', 'ropa-deportiva', '🏃', 1, 2),
  ('ca030000-0000-0000-0000-000000000010', 'c0000010-0000-0000-0000-000000000010', 'Calzado Deportivo', 'calzado-deportivo-sport', '👟', 1, 3);

-- Gaming
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('cb010000-0000-0000-0000-000000000011', 'c0000011-0000-0000-0000-000000000011', 'Consolas', 'consolas', '🎮', 1, 1),
  ('cb020000-0000-0000-0000-000000000011', 'c0000011-0000-0000-0000-000000000011', 'Videojuegos', 'videojuegos', '💿', 1, 2),
  ('cb030000-0000-0000-0000-000000000011', 'c0000011-0000-0000-0000-000000000011', 'Accesorios Gaming', 'accesorios-gaming', '🎧', 1, 3);

-- Hogar
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('cc010000-0000-0000-0000-000000000012', 'c0000012-0000-0000-0000-000000000012', 'Muebles', 'muebles', '🛋️', 1, 1),
  ('cc020000-0000-0000-0000-000000000012', 'c0000012-0000-0000-0000-000000000012', 'Decoración', 'decoracion', '🖼️', 1, 2),
  ('cc030000-0000-0000-0000-000000000012', 'c0000012-0000-0000-0000-000000000012', 'Cocina', 'cocina', '🍳', 1, 3),
  ('cc040000-0000-0000-0000-000000000012', 'c0000012-0000-0000-0000-000000000012', 'Jardín', 'jardin', '🌿', 1, 4);

-- Herramientas
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('cd010000-0000-0000-0000-000000000013', 'c0000013-0000-0000-0000-000000000013', 'Herramientas Manuales', 'herramientas-manuales', '🔨', 1, 1),
  ('cd020000-0000-0000-0000-000000000013', 'c0000013-0000-0000-0000-000000000013', 'Herramientas Eléctricas', 'herramientas-electricas', '⚡', 1, 2),
  ('cd030000-0000-0000-0000-000000000013', 'c0000013-0000-0000-0000-000000000013', 'Medición', 'medicion', '📏', 1, 3);

-- Bebés y Juguetes
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('ce010000-0000-0000-0000-000000000014', 'c0000014-0000-0000-0000-000000000014', 'Ropa de Bebé', 'ropa-bebe', '👶', 1, 1),
  ('ce020000-0000-0000-0000-000000000014', 'c0000014-0000-0000-0000-000000000014', 'Juguetes', 'juguetes', '🧸', 1, 2),
  ('ce030000-0000-0000-0000-000000000014', 'c0000014-0000-0000-0000-000000000014', 'Accesorios de Bebé', 'accesorios-bebe', '🍼', 1, 3);

-- =============================================
-- SEED: CATEGORY ATTRIBUTES (per subcategory)
-- =============================================

-- Smartphones
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c1010000-0000-0000-0000-000000000001', 'marca', 'Marca', 'select', '[{"value":"apple","label":"Apple"},{"value":"samsung","label":"Samsung"},{"value":"xiaomi","label":"Xiaomi"},{"value":"huawei","label":"Huawei"},{"value":"motorola","label":"Motorola"},{"value":"oppo","label":"OPPO"},{"value":"realme","label":"Realme"},{"value":"otra","label":"Otra"}]', true, 1, '', 'Información'),
  ('c1010000-0000-0000-0000-000000000001', 'modelo', 'Modelo', 'text', '[]', true, 2, 'Ej: iPhone 15 Pro, Galaxy S24', 'Información'),
  ('c1010000-0000-0000-0000-000000000001', 'almacenamiento', 'Almacenamiento', 'select', '[{"value":"32","label":"32 GB"},{"value":"64","label":"64 GB"},{"value":"128","label":"128 GB"},{"value":"256","label":"256 GB"},{"value":"512","label":"512 GB"},{"value":"1024","label":"1 TB"}]', true, 3, '', 'Especificaciones'),
  ('c1010000-0000-0000-0000-000000000001', 'ram', 'RAM', 'select', '[{"value":"2","label":"2 GB"},{"value":"3","label":"3 GB"},{"value":"4","label":"4 GB"},{"value":"6","label":"6 GB"},{"value":"8","label":"8 GB"},{"value":"12","label":"12 GB"}]', false, 4, '', 'Especificaciones'),
  ('c1010000-0000-0000-0000-000000000001', 'color', 'Color', 'text', '[]', true, 5, 'Ej: Negro, Blanco', 'Apariencia');

-- Laptops
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c2010000-0000-0000-0000-000000000002', 'marca', 'Marca', 'select', '[{"value":"apple","label":"Apple"},{"value":"dell","label":"Dell"},{"value":"hp","label":"HP"},{"value":"lenovo","label":"Lenovo"},{"value":"asus","label":"ASUS"},{"value":"acer","label":"Acer"},{"value":"otra","label":"Otra"}]', true, 1, '', 'Información'),
  ('c2010000-0000-0000-0000-000000000002', 'modelo', 'Modelo', 'text', '[]', true, 2, 'Ej: MacBook Pro, ThinkPad', 'Información'),
  ('c2010000-0000-0000-0000-000000000002', 'procesador', 'Procesador', 'text', '[]', true, 3, 'Ej: Intel i7, Apple M3', 'Especificaciones'),
  ('c2010000-0000-0000-0000-000000000002', 'ram', 'RAM', 'select', '[{"value":"4","label":"4 GB"},{"value":"8","label":"8 GB"},{"value":"16","label":"16 GB"},{"value":"32","label":"32 GB"}]', true, 4, '', 'Especificaciones'),
  ('c2010000-0000-0000-0000-000000000002', 'almacenamiento', 'Almacenamiento', 'text', '[]', true, 5, 'Ej: 512 GB SSD', 'Especificaciones'),
  ('c2010000-0000-0000-0000-000000000002', 'pantalla', 'Pantalla', 'text', '[]', false, 6, 'Ej: 15.6 pulgadas Full HD', 'Especificaciones');

-- Relojes
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c7010000-0000-0000-0000-000000000007', 'marca', 'Marca', 'text', '[]', true, 1, 'Ej: Casio, Rolex, Fossil', 'Información'),
  ('c7010000-0000-0000-0000-000000000007', 'tipo_movimiento', 'Tipo de movimiento', 'select', '[{"value":"cuarzo","label":"Cuarzo"},{"value":"automatico","label":"Automático"},{"value":"digital","label":"Digital"},{"value":"smart","label":"Smartwatch"}]', true, 2, '', 'Especificaciones'),
  ('c7010000-0000-0000-0000-000000000007', 'material_caja', 'Material de caja', 'select', '[{"value":"acero","label":"Acero inoxidable"},{"value":"oro","label":"Oro"},{"value":"titanio","label":"Titanio"},{"value":"plastico","label":"Plástico/Resina"},{"value":"otro","label":"Otro"}]', false, 3, '', 'Especificaciones'),
  ('c7010000-0000-0000-0000-000000000007', 'genero', 'Género', 'select', '[{"value":"hombre","label":"Hombre"},{"value":"mujer","label":"Mujer"},{"value":"unisex","label":"Unisex"}]', true, 4, '', 'Información');

-- Perfumes
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c8010000-0000-0000-0000-000000000008', 'marca', 'Marca/Casa', 'text', '[]', true, 1, 'Ej: Dior, Chanel, Lattafa', 'Información'),
  ('c8010000-0000-0000-0000-000000000008', 'nombre_fragancia', 'Nombre de la fragancia', 'text', '[]', true, 2, 'Ej: Sauvage, Bleu de Chanel', 'Información'),
  ('c8010000-0000-0000-0000-000000000008', 'volumen_ml', 'Volumen (ml)', 'select', '[{"value":"30","label":"30 ml"},{"value":"50","label":"50 ml"},{"value":"75","label":"75 ml"},{"value":"100","label":"100 ml"},{"value":"125","label":"125 ml"},{"value":"200","label":"200 ml"}]', true, 3, '', 'Especificaciones'),
  ('c8010000-0000-0000-0000-000000000008', 'concentracion', 'Concentración', 'select', '[{"value":"parfum","label":"Parfum"},{"value":"edp","label":"Eau de Parfum"},{"value":"edt","label":"Eau de Toilette"},{"value":"edc","label":"Eau de Cologne"}]', true, 4, '', 'Especificaciones'),
  ('c8010000-0000-0000-0000-000000000008', 'genero', 'Para', 'select', '[{"value":"hombre","label":"Hombre"},{"value":"mujer","label":"Mujer"},{"value":"unisex","label":"Unisex"}]', true, 5, '', 'Información'),
  ('c8010000-0000-0000-0000-000000000008', 'tipo', 'Tipo', 'select', '[{"value":"original","label":"Original"},{"value":"tester","label":"Tester"},{"value":"miniatura","label":"Miniatura"},{"value":"set","label":"Set/Kit"}]', true, 6, '', 'Información');

-- Ropa Hombre
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c5010000-0000-0000-0000-000000000005', 'marca', 'Marca', 'text', '[]', true, 1, 'Ej: Zara, Nike, Tommy', 'Información'),
  ('c5010000-0000-0000-0000-000000000005', 'tipo_prenda', 'Tipo de prenda', 'select', '[{"value":"camisa","label":"Camisa"},{"value":"pantalon","label":"Pantalón"},{"value":"chaqueta","label":"Chaqueta"},{"value":"camiseta","label":"Camiseta/Franela"},{"value":"bermuda","label":"Bermuda/Short"},{"value":"otro","label":"Otro"}]', true, 2, '', 'Información'),
  ('c5010000-0000-0000-0000-000000000005', 'talla', 'Talla', 'select', '[{"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"},{"value":"XXL","label":"XXL"}]', true, 3, '', 'Medidas'),
  ('c5010000-0000-0000-0000-000000000005', 'color', 'Color', 'text', '[]', true, 4, 'Ej: Negro, Azul', 'Medidas');

-- Ropa Mujer
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c5020000-0000-0000-0000-000000000005', 'marca', 'Marca', 'text', '[]', true, 1, 'Ej: Zara, H&M', 'Información'),
  ('c5020000-0000-0000-0000-000000000005', 'tipo_prenda', 'Tipo de prenda', 'select', '[{"value":"vestido","label":"Vestido"},{"value":"blusa","label":"Blusa"},{"value":"pantalon","label":"Pantalón"},{"value":"falda","label":"Falda"},{"value":"conjunto","label":"Conjunto"},{"value":"otro","label":"Otro"}]', true, 2, '', 'Información'),
  ('c5020000-0000-0000-0000-000000000005', 'talla', 'Talla', 'select', '[{"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"},{"value":"unica","label":"Talla única"}]', true, 3, '', 'Medidas'),
  ('c5020000-0000-0000-0000-000000000005', 'color', 'Color', 'text', '[]', true, 4, 'Ej: Rojo, Blanco', 'Medidas');

-- Calzado Deportivo
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c6010000-0000-0000-0000-000000000006', 'marca', 'Marca', 'select', '[{"value":"nike","label":"Nike"},{"value":"adidas","label":"Adidas"},{"value":"puma","label":"Puma"},{"value":"new_balance","label":"New Balance"},{"value":"converse","label":"Converse"},{"value":"jordan","label":"Jordan"},{"value":"otra","label":"Otra"}]', true, 1, '', 'Información'),
  ('c6010000-0000-0000-0000-000000000006', 'talla', 'Talla', 'select', '[{"value":"35","label":"35"},{"value":"36","label":"36"},{"value":"37","label":"37"},{"value":"38","label":"38"},{"value":"39","label":"39"},{"value":"40","label":"40"},{"value":"41","label":"41"},{"value":"42","label":"42"},{"value":"43","label":"43"},{"value":"44","label":"44"},{"value":"45","label":"45"}]', true, 2, '', 'Medidas'),
  ('c6010000-0000-0000-0000-000000000006', 'color', 'Color', 'text', '[]', true, 3, 'Ej: Blanco/Negro', 'Medidas'),
  ('c6010000-0000-0000-0000-000000000006', 'genero', 'Género', 'select', '[{"value":"hombre","label":"Hombre"},{"value":"mujer","label":"Mujer"},{"value":"unisex","label":"Unisex"}]', true, 4, '', 'Información');

-- Televisores
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('c3010000-0000-0000-0000-000000000003', 'marca', 'Marca', 'select', '[{"value":"samsung","label":"Samsung"},{"value":"lg","label":"LG"},{"value":"sony","label":"Sony"},{"value":"tcl","label":"TCL"},{"value":"hisense","label":"Hisense"},{"value":"otra","label":"Otra"}]', true, 1, '', 'Información'),
  ('c3010000-0000-0000-0000-000000000003', 'tamano', 'Tamaño (pulgadas)', 'select', '[{"value":"32","label":"32\""},{"value":"43","label":"43\""},{"value":"50","label":"50\""},{"value":"55","label":"55\""},{"value":"65","label":"65\""},{"value":"75","label":"75\""}]', true, 2, '', 'Especificaciones'),
  ('c3010000-0000-0000-0000-000000000003', 'resolucion', 'Resolución', 'select', '[{"value":"hd","label":"HD"},{"value":"fullhd","label":"Full HD"},{"value":"4k","label":"4K UHD"}]', true, 3, '', 'Especificaciones'),
  ('c3010000-0000-0000-0000-000000000003', 'smart_tv', 'Smart TV', 'boolean', '[]', false, 4, '', 'Especificaciones');

-- Consolas Gaming
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('cb010000-0000-0000-0000-000000000011', 'marca', 'Marca', 'select', '[{"value":"sony","label":"PlayStation"},{"value":"microsoft","label":"Xbox"},{"value":"nintendo","label":"Nintendo"},{"value":"otra","label":"Otra"}]', true, 1, '', 'Información'),
  ('cb010000-0000-0000-0000-000000000011', 'modelo', 'Modelo', 'text', '[]', true, 2, 'Ej: PS5, Xbox Series X', 'Información'),
  ('cb010000-0000-0000-0000-000000000011', 'almacenamiento', 'Almacenamiento', 'text', '[]', false, 3, 'Ej: 1 TB', 'Especificaciones');

-- =============================================
-- FEATURE FLAG: Marketplace disabled by default
-- =============================================

INSERT INTO site_settings (setting_key, setting_value, label, category)
VALUES ('marketplace_enabled', 'false', 'Marketplace habilitado', 'general')
ON CONFLICT (setting_key) DO NOTHING;
