
-- Make web push fields nullable and add FCM/platform support
ALTER TABLE public.push_subscriptions 
  ALTER COLUMN endpoint DROP NOT NULL,
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth DROP NOT NULL;

ALTER TABLE public.push_subscriptions 
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS fcm_token text;

-- Add unique constraint on fcm_token to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token 
  ON public.push_subscriptions(fcm_token) WHERE fcm_token IS NOT NULL;

-- Add unique constraint on endpoint to avoid duplicates  
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
  ON public.push_subscriptions(endpoint) WHERE endpoint IS NOT NULL;

-- Update RLS: admins should also be able to read subscriptions (for sending push)
CREATE POLICY "Admins can read all subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 1. When someone is outbid
CREATE OR REPLACE FUNCTION public.notify_outbid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_previous_bidder_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT b.user_id INTO v_previous_bidder_id
  FROM public.bids b
  WHERE b.auction_id = NEW.auction_id
    AND b.user_id != NEW.user_id
    AND b.id != NEW.id
  ORDER BY b.amount DESC
  LIMIT 1;

  IF v_previous_bidder_id IS NOT NULL THEN
    SELECT title INTO v_auction_title FROM public.auctions WHERE id = NEW.auction_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_previous_bidder_id,
      '⚡ ¡Te han sobrepujado!',
      'Alguien ha superado tu puja en "' || COALESCE(v_auction_title, 'subasta') || '" con $' || NEW.amount || '. ¡Puja de nuevo!',
      'outbid',
      '/auction/' || NEW.auction_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid_notify_outbid
AFTER INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.notify_outbid();

-- 2. When auction finalizes and there's a winner
CREATE OR REPLACE FUNCTION public.notify_auction_winner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'finalized' AND OLD.status != 'finalized' AND NEW.winner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.winner_id,
      '🏆 ¡Ganaste la subasta!',
      '¡Felicitaciones! Ganaste "' || NEW.title || '" por $' || NEW.current_price || '. Procede al pago.',
      'auction_won',
      '/auction/' || NEW.id
    );
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      '🎉 Subasta finalizada',
      'Tu subasta "' || NEW.title || '" finalizó con un precio de $' || NEW.current_price || '.',
      'auction_finalized',
      '/auction/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auction_finalized_notify
AFTER UPDATE ON public.auctions
FOR EACH ROW
EXECUTE FUNCTION public.notify_auction_winner();

-- 3. When payment is approved, notify buyer
CREATE OR REPLACE FUNCTION public.notify_payment_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auction_title TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    SELECT title INTO v_auction_title FROM public.auctions WHERE id = NEW.auction_id;
    
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.buyer_id,
      '✅ Pago verificado',
      'Tu pago para "' || COALESCE(v_auction_title, 'subasta') || '" ha sido verificado. El dealer procederá con el envío.',
      'payment_verified',
      '/auction/' || NEW.auction_id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_approved_notify
AFTER UPDATE ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.notify_payment_approved();

-- 4. Trigger to send push when notification is inserted
CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'tag', NEW.type
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_push_on_notification_insert
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_on_notification();
