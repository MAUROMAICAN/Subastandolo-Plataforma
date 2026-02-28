-- Drop notification-related triggers
DROP TRIGGER IF EXISTS on_auction_finalized_notify_winner ON auctions;
DROP TRIGGER IF EXISTS on_new_bid_notify_dealer ON bids;
DROP TRIGGER IF EXISTS on_new_bid_notify_outbid ON bids;
DROP TRIGGER IF EXISTS on_payment_approved_notify_buyer ON payment_proofs;
DROP TRIGGER IF EXISTS trigger_push_on_notification ON notifications;

-- Drop notification-related functions
DROP FUNCTION IF EXISTS notify_auction_winner();
DROP FUNCTION IF EXISTS notify_dealer_new_bid();
DROP FUNCTION IF EXISTS notify_outbid();
DROP FUNCTION IF EXISTS notify_payment_approved();
DROP FUNCTION IF EXISTS send_push_on_notification();
DROP FUNCTION IF EXISTS send_auction_countdown_notifications();

-- Clean data from tables (keep tables for rebuild later)
DELETE FROM push_subscriptions;
DELETE FROM notifications;