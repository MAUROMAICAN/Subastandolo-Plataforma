
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
      'Alguien ha pujado $' || NEW.amount || ' en "' || v_auction_title || '".',
      'new_bid',
      '/auction/' || NEW.auction_id
    );
  END IF;

  RETURN NEW;
END;
$function$;
