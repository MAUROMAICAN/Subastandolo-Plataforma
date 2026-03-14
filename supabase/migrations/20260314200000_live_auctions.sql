-- ═══════════════════════════════════════════════════════
-- Subastas Live: Tables for live streaming auctions
-- ═══════════════════════════════════════════════════════

-- 1) Live Events (the stream itself)
CREATE TABLE IF NOT EXISTS live_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  mux_stream_key TEXT,
  mux_playback_id TEXT,
  mux_live_stream_id TEXT,
  viewer_count INT DEFAULT 0,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) Product queue for a live event
CREATE TABLE IF NOT EXISTS live_event_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES live_events(id) ON DELETE CASCADE NOT NULL,
  product_title TEXT NOT NULL,
  product_description TEXT,
  product_images TEXT[] DEFAULT '{}',
  starting_price NUMERIC(12,2) NOT NULL,
  current_price NUMERIC(12,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','sold','unsold','skipped')),
  winner_id UUID REFERENCES auth.users(id),
  sort_order INT DEFAULT 0,
  countdown_seconds INT DEFAULT 60,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) Real-time bids on live products
CREATE TABLE IF NOT EXISTS live_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES live_event_products(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES live_events(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES auth.users(id) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Live chat messages
CREATE TABLE IF NOT EXISTS live_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES live_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ───
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_event_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat ENABLE ROW LEVEL SECURITY;

-- SELECT: Anyone can view
CREATE POLICY "Anyone can view live events"   ON live_events          FOR SELECT USING (true);
CREATE POLICY "Anyone can view live products" ON live_event_products  FOR SELECT USING (true);
CREATE POLICY "Anyone can view live bids"     ON live_bids            FOR SELECT USING (true);
CREATE POLICY "Anyone can view live chat"     ON live_chat            FOR SELECT USING (true);

-- INSERT: Dealers create events & products; auth users bid & chat
CREATE POLICY "Dealers can create events" ON live_events FOR INSERT
  WITH CHECK (auth.uid() = dealer_id);

CREATE POLICY "Dealers can add products" ON live_event_products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM live_events WHERE id = event_id AND dealer_id = auth.uid()));

CREATE POLICY "Auth users can bid" ON live_bids FOR INSERT
  WITH CHECK (auth.uid() = bidder_id);

CREATE POLICY "Auth users can chat" ON live_chat FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Dealers update own events & products
CREATE POLICY "Dealers can update own events" ON live_events FOR UPDATE
  USING (auth.uid() = dealer_id);

CREATE POLICY "Dealers can update own products" ON live_event_products FOR UPDATE
  USING (EXISTS (SELECT 1 FROM live_events WHERE id = event_id AND dealer_id = auth.uid()));

-- DELETE: Dealers can delete own pending events
CREATE POLICY "Dealers can delete own events" ON live_events FOR DELETE
  USING (auth.uid() = dealer_id AND status = 'scheduled');

CREATE POLICY "Dealers can delete own products" ON live_event_products FOR DELETE
  USING (EXISTS (SELECT 1 FROM live_events WHERE id = event_id AND dealer_id = auth.uid()));

-- ─── Enable Realtime ───
ALTER PUBLICATION supabase_realtime ADD TABLE live_bids;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE live_event_products;
ALTER PUBLICATION supabase_realtime ADD TABLE live_events;

-- ─── Indexes ───
CREATE INDEX idx_live_events_status ON live_events(status);
CREATE INDEX idx_live_events_dealer ON live_events(dealer_id);
CREATE INDEX idx_live_events_scheduled ON live_events(scheduled_at);
CREATE INDEX idx_live_products_event ON live_event_products(event_id, sort_order);
CREATE INDEX idx_live_bids_product ON live_bids(product_id, created_at DESC);
CREATE INDEX idx_live_chat_event ON live_chat(event_id, created_at);
