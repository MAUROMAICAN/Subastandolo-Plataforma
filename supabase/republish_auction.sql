-- RPC: republish_auction
-- Atomically deletes all old bids and resets the auction as a fresh listing.
-- Uses server-side NOW() for authoritative timing (consistent with approve_auction pattern).
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.republish_auction(
  p_auction_id UUID,
  p_duration_hours INTEGER
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Delete all old bids for this auction
  DELETE FROM bids WHERE auction_id = p_auction_id;

  -- 2. Reset the auction as a completely fresh listing
  UPDATE auctions SET
    status = 'active',
    current_price = 0,
    winner_id = NULL,
    winner_name = NULL,
    start_time = NOW(),
    end_time = NOW() + (p_duration_hours || ' hours')::INTERVAL,
    payment_status = 'pending',
    delivery_status = 'pending',
    tracking_number = NULL,
    tracking_photo_url = NULL,
    archived_at = NULL,
    funds_released_at = NULL,
    paid_at = NULL,
    delivered_at = NULL,
    dealer_ship_deadline = NULL,
    is_extended = false
  WHERE id = p_auction_id;

  RETURN json_build_object('ok', true);
END;
$$;
