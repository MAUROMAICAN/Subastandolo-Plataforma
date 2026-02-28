
CREATE OR REPLACE FUNCTION public.mask_bidder_name(name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  parts text[];
  masked text;
  p text;
  i int;
BEGIN
  IF name IS NULL OR length(trim(name)) = 0 THEN
    RETURN 'Usuario';
  END IF;
  parts := string_to_array(trim(name), ' ');
  masked := '';
  FOR i IN 1..array_length(parts, 1) LOOP
    p := parts[i];
    IF length(p) <= 2 THEN
      masked := masked || p;
    ELSE
      masked := masked || left(p, 2) || repeat('*', length(p) - 2);
    END IF;
    IF i < array_length(parts, 1) THEN
      masked := masked || ' ';
    END IF;
  END LOOP;
  RETURN masked;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_outbid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prev_winner_id UUID;
  v_auction_title TEXT;
BEGIN
  SELECT winner_id, title INTO v_prev_winner_id, v_auction_title
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_prev_winner_id IS NOT NULL AND v_prev_winner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      v_prev_winner_id,
      '¡Te han superado! 🔥',
      mask_bidder_name(NEW.bidder_name) || ' ha pujado $' || NEW.amount || ' en "' || v_auction_title || '". ¡Puja de nuevo!',
      'outbid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_dealer_new_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      mask_bidder_name(NEW.bidder_name) || ' ha pujado $' || NEW.amount || ' en "' || v_auction_title || '".',
      'new_bid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;
