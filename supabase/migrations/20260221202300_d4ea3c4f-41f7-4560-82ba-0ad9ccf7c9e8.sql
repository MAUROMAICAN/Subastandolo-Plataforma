
-- Update process_auto_bids to notify user when their auto-bid is deactivated (reached max)
CREATE OR REPLACE FUNCTION public.process_auto_bids()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auto_bid RECORD;
  v_current_price NUMERIC;
  v_new_bid_amount NUMERIC;
  v_auction_status TEXT;
  v_auction_end TIMESTAMPTZ;
  v_auction_title TEXT;
  v_bidder_name TEXT;
BEGIN
  -- Get auction info
  SELECT status, current_price, end_time, title INTO v_auction_status, v_current_price, v_auction_end, v_auction_title
  FROM public.auctions WHERE id = NEW.auction_id;

  -- Only process if auction is active and not ended
  IF v_auction_status != 'active' OR v_auction_end <= NOW() THEN
    RETURN NEW;
  END IF;

  -- Find the highest active auto-bid for this auction that is NOT from the current bidder
  SELECT ab.*, p.full_name as bidder_full_name
  INTO v_auto_bid
  FROM public.auto_bids ab
  JOIN public.profiles p ON p.id = ab.user_id
  WHERE ab.auction_id = NEW.auction_id
    AND ab.is_active = true
    AND ab.user_id != NEW.user_id
    AND ab.max_amount > NEW.amount
  ORDER BY ab.max_amount DESC, ab.created_at ASC
  LIMIT 1;

  IF v_auto_bid IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_bid_amount := LEAST(NEW.amount + 1, v_auto_bid.max_amount);

  IF v_new_bid_amount <= NEW.amount THEN
    RETURN NEW;
  END IF;

  v_bidder_name := v_auto_bid.bidder_full_name;

  -- Insert the counter-bid
  INSERT INTO public.bids (auction_id, user_id, amount, bidder_name)
  VALUES (NEW.auction_id, v_auto_bid.user_id, v_new_bid_amount, v_bidder_name);

  -- If the auto-bid reached its max, deactivate it and notify the user
  IF v_new_bid_amount >= v_auto_bid.max_amount THEN
    UPDATE public.auto_bids SET is_active = false WHERE id = v_auto_bid.id;
    
    -- Notify user that their auto-bid has been exhausted
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_auto_bid.user_id,
      '⚠️ Auto-puja agotada',
      'Tu auto-puja en "' || COALESCE(v_auction_title, 'subasta') || '" alcanzó su monto máximo de $' || v_auto_bid.max_amount || '. Configura una nueva si deseas seguir pujando.',
      'autobid_exhausted',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Create function to send countdown notifications to all bidders of an auction
-- This avoids duplicates by checking existing notifications
CREATE OR REPLACE FUNCTION public.send_auction_countdown_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auction RECORD;
  v_bidder RECORD;
  v_minutes INT;
  v_notif_type TEXT;
  v_notif_title TEXT;
  v_notif_message TEXT;
  v_already_sent BOOLEAN;
BEGIN
  -- Check active auctions ending within 30 minutes
  FOR v_auction IN
    SELECT DISTINCT a.id, a.title, a.end_time,
           EXTRACT(EPOCH FROM (a.end_time - NOW())) / 60 AS minutes_left
    FROM public.auctions a
    WHERE a.status = 'active'
      AND a.end_time > NOW()
      AND a.end_time <= NOW() + INTERVAL '31 minutes'
  LOOP
    v_minutes := FLOOR(v_auction.minutes_left);

    -- Determine which thresholds to notify
    -- We check windows: 28-31 min = 30min alert, 8-11 min = 10min alert, 3-6 min = 5min alert
    IF v_minutes >= 28 AND v_minutes <= 31 THEN
      v_notif_type := 'auction_ending_30m';
      v_notif_title := '⏰ ¡30 minutos restantes!';
      v_notif_message := 'La subasta "' || v_auction.title || '" finaliza en 30 minutos. ¡No te la pierdas!';
    ELSIF v_minutes >= 8 AND v_minutes <= 11 THEN
      v_notif_type := 'auction_ending_10m';
      v_notif_title := '🔥 ¡10 minutos restantes!';
      v_notif_message := 'La subasta "' || v_auction.title || '" está por terminar en 10 minutos. ¡Última oportunidad!';
    ELSIF v_minutes >= 3 AND v_minutes <= 6 THEN
      v_notif_type := 'auction_ending_5m';
      v_notif_title := '🚨 ¡5 minutos restantes!';
      v_notif_message := 'La subasta "' || v_auction.title || '" finaliza en 5 minutos. ¡Haz tu puja ahora!';
    ELSE
      CONTINUE;
    END IF;

    -- Get all unique bidders + users with favorites for this auction
    FOR v_bidder IN
      SELECT DISTINCT user_id FROM (
        SELECT user_id FROM public.bids WHERE auction_id = v_auction.id
        UNION
        SELECT user_id FROM public.favorites WHERE auction_id = v_auction.id
      ) AS interested_users
    LOOP
      -- Check if this notification was already sent
      SELECT EXISTS(
        SELECT 1 FROM public.notifications
        WHERE user_id = v_bidder.user_id
          AND type = v_notif_type
          AND link = '/auction/' || v_auction.id
      ) INTO v_already_sent;

      IF NOT v_already_sent THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
          v_bidder.user_id,
          v_notif_title,
          v_notif_message,
          v_notif_type,
          '/auction/' || v_auction.id
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;
