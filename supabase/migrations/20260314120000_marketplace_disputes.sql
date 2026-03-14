-- =============================================================
-- MARKETPLACE DISPUTES TABLE + RLS
-- Run this in Supabase SQL Editor (Production)
-- =============================================================

-- 1. Create disputes table
CREATE TABLE IF NOT EXISTS marketplace_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL,
  product_id UUID REFERENCES marketplace_products(id),
  buyer_id UUID REFERENCES auth.users(id) NOT NULL,
  seller_id UUID REFERENCES auth.users(id) NOT NULL,

  -- Dispute details
  reason TEXT NOT NULL CHECK (reason IN (
    'not_received',
    'not_as_described',
    'damaged',
    'incomplete',
    'other'
  )),
  description TEXT,
  evidence_urls TEXT[] DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'seller_responded',
    'in_mediation',
    'resolved_buyer',
    'resolved_seller',
    'cancelled'
  )),

  -- Resolution
  resolution TEXT,
  resolution_type TEXT CHECK (resolution_type IN (
    'full_refund',
    'partial_refund',
    'replacement',
    'return_and_refund',
    'no_action'
  )),
  refund_amount DECIMAL(12,2),

  -- Seller response
  seller_response TEXT,
  seller_evidence_urls TEXT[] DEFAULT '{}',
  seller_responded_at TIMESTAMPTZ,

  -- Admin mediation
  admin_notes TEXT,
  mediated_by UUID REFERENCES auth.users(id),

  -- Deadlines
  seller_deadline TIMESTAMPTZ, -- 3 days from creation
  auto_resolve_at TIMESTAMPTZ, -- auto-resolve if seller doesn't respond

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_buyer ON marketplace_disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_seller ON marketplace_disputes(seller_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON marketplace_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON marketplace_disputes(order_id);

-- 3. RLS
ALTER TABLE marketplace_disputes ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own disputes
DROP POLICY IF EXISTS "disputes_buyer_read" ON marketplace_disputes;
CREATE POLICY "disputes_buyer_read" ON marketplace_disputes
  FOR SELECT USING (auth.uid() = buyer_id);

-- Sellers can read disputes about them
DROP POLICY IF EXISTS "disputes_seller_read" ON marketplace_disputes;
CREATE POLICY "disputes_seller_read" ON marketplace_disputes
  FOR SELECT USING (auth.uid() = seller_id);

-- Admins can read all disputes
DROP POLICY IF EXISTS "disputes_admin_read" ON marketplace_disputes;
CREATE POLICY "disputes_admin_read" ON marketplace_disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Buyers can create disputes
DROP POLICY IF EXISTS "disputes_buyer_create" ON marketplace_disputes;
CREATE POLICY "disputes_buyer_create" ON marketplace_disputes
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- Sellers can update their response
DROP POLICY IF EXISTS "disputes_seller_update" ON marketplace_disputes;
CREATE POLICY "disputes_seller_update" ON marketplace_disputes
  FOR UPDATE USING (auth.uid() = seller_id);

-- Admins can update all disputes (mediation)
DROP POLICY IF EXISTS "disputes_admin_update" ON marketplace_disputes;
CREATE POLICY "disputes_admin_update" ON marketplace_disputes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_disputes_updated_at ON marketplace_disputes;
CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON marketplace_disputes
  FOR EACH ROW EXECUTE FUNCTION update_disputes_updated_at();
