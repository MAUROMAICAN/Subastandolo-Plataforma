
-- Trigger: Notify previous winner when outbid
CREATE OR REPLACE FUNCTION public.notify_outbid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prev_winner_id UUID;
  v_auction_title TEXT;
BEGIN
  -- Get the previous winner before this bid updated the auction
  SELECT winner_id, title INTO v_prev_winner_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  -- Only notify if there was a previous winner and it's a different user
  IF v_prev_winner_id IS NOT NULL AND v_prev_winner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_prev_winner_id,
      '¡Te han superado! 🔥',
      'Alguien ha pujado $' || NEW.amount || ' en "' || v_auction_title || '". ¡Puja de nuevo!',
      'outbid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid_notify_outbid
  BEFORE INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_outbid();

-- Trigger: Notify winner when auction finalizes
CREATE OR REPLACE FUNCTION public.notify_auction_winner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when status changes to finalized and there's a winner
  IF NEW.status = 'finalized' AND OLD.status != 'finalized' AND NEW.winner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.winner_id,
      '🎉 ¡Ganaste la subasta!',
      'Has ganado "' || NEW.title || '" por $' || NEW.current_price || '. Procede con el pago.',
      'auction_won',
      '/auction/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auction_finalized_notify_winner
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_auction_winner();

-- Trigger: Notify buyer when payment is approved
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
      '✅ Pago aprobado',
      'Tu pago para "' || COALESCE(v_auction_title, 'subasta') || '" ha sido verificado. El dealer preparará tu envío.',
      'payment_approved',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_approved_notify_buyer
  AFTER UPDATE ON public.payment_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_approved();

-- Trigger: Notify dealer when they receive a new bid
CREATE OR REPLACE FUNCTION public.notify_dealer_new_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dealer_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT created_by, title INTO v_dealer_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_dealer_id IS NOT NULL AND v_dealer_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_dealer_id,
      '💰 Nueva puja recibida',
      NEW.bidder_name || ' ha pujado $' || NEW.amount || ' en "' || v_auction_title || '".',
      'new_bid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_bid_notify_dealer
  AFTER INSERT ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dealer_new_bid();
