
-- ============================================
-- SECURITY HARDENING MIGRATION
-- ============================================

-- 1. CRITICAL: Restrict bids to authenticated users only (was public)
DROP POLICY IF EXISTS "Anyone can view bids" ON public.bids;
CREATE POLICY "Authenticated users can view bids"
ON public.bids FOR SELECT TO authenticated
USING (true);

-- 2. CRITICAL: Restrict reviews to authenticated users only (was public)  
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Authenticated users can view reviews"
ON public.reviews FOR SELECT TO authenticated
USING (true);

-- 3. Prevent users from self-assigning roles (additional safety)
CREATE POLICY "Prevent self-role-assignment"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (false);

-- 4. Add rate limiting for payment proof submissions (max 3 per hour per user)
CREATE OR REPLACE FUNCTION public.check_payment_proof_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.payment_proofs
  WHERE buyer_id = NEW.buyer_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Demasiados comprobantes de pago enviados. Espera antes de intentar nuevamente.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_payment_proof_rate
BEFORE INSERT ON public.payment_proofs
FOR EACH ROW
EXECUTE FUNCTION public.check_payment_proof_rate_limit();

-- 5. Add rate limiting for dispute creation (max 2 per day per user)
CREATE OR REPLACE FUNCTION public.check_dispute_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.disputes
  WHERE buyer_id = NEW.buyer_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 2 THEN
    RAISE EXCEPTION 'Has alcanzado el límite de disputas diarias. Intenta mañana.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_dispute_rate
BEFORE INSERT ON public.disputes
FOR EACH ROW
EXECUTE FUNCTION public.check_dispute_rate_limit();

-- 6. Add rate limiting for auction reports (max 5 per day per user)
CREATE OR REPLACE FUNCTION public.check_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.auction_reports
  WHERE reporter_id = NEW.reporter_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Has alcanzado el límite de reportes diarios. Intenta mañana.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER check_report_rate
BEFORE INSERT ON public.auction_reports
FOR EACH ROW
EXECUTE FUNCTION public.check_report_rate_limit();

-- 7. Prevent dealers from bidding on their own auctions (server-side enforcement)
CREATE OR REPLACE FUNCTION public.prevent_self_bidding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_created_by UUID;
BEGIN
  SELECT created_by INTO v_created_by
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_created_by = NEW.user_id THEN
    RAISE EXCEPTION 'No puedes pujar en tu propia subasta.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER prevent_self_bid
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_bidding();

-- 8. Prevent negative or zero bids
CREATE OR REPLACE FUNCTION public.validate_bid_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_price NUMERIC;
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'El monto de la puja debe ser mayor a cero.';
  END IF;

  SELECT current_price INTO v_current_price
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF NEW.amount <= v_current_price THEN
    RAISE EXCEPTION 'La puja debe ser mayor al precio actual ($%)', v_current_price;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_bid_amount
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.validate_bid_amount();

-- 9. Prevent bidding on non-active or ended auctions (server-side)
CREATE OR REPLACE FUNCTION public.validate_auction_status_for_bid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_end_time TIMESTAMPTZ;
BEGIN
  SELECT status, end_time INTO v_status, v_end_time
  FROM public.auctions
  WHERE id = NEW.auction_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Subasta no encontrada.';
  END IF;

  IF v_status != 'active' THEN
    RAISE EXCEPTION 'Esta subasta no está activa.';
  END IF;

  IF v_end_time <= NOW() THEN
    RAISE EXCEPTION 'Esta subasta ya ha finalizado.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_auction_status_bid
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.validate_auction_status_for_bid();

-- 10. Add index for faster rate limit checks
CREATE INDEX IF NOT EXISTS idx_bids_rate_limit ON public.bids (user_id, auction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_rate_limit ON public.payment_proofs (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_rate_limit ON public.disputes (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_rate_limit ON public.auction_reports (reporter_id, created_at DESC);

-- 11. Ensure dealer_balance cannot go negative
CREATE OR REPLACE FUNCTION public.validate_dealer_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.dealer_balance < 0 THEN
    RAISE EXCEPTION 'El balance del dealer no puede ser negativo.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_dealer_balance_trigger
BEFORE UPDATE ON public.dealer_verification
FOR EACH ROW
WHEN (NEW.dealer_balance IS DISTINCT FROM OLD.dealer_balance)
EXECUTE FUNCTION public.validate_dealer_balance();

-- 12. Prevent withdrawal amount exceeding balance
CREATE OR REPLACE FUNCTION public.validate_withdrawal_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT dealer_balance INTO v_balance
  FROM public.dealer_verification
  WHERE user_id = NEW.dealer_id;

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'El monto de retiro debe ser mayor a cero.';
  END IF;

  IF NEW.amount > COALESCE(v_balance, 0) THEN
    RAISE EXCEPTION 'Fondos insuficientes. Balance disponible: $%', COALESCE(v_balance, 0);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_withdrawal
BEFORE INSERT ON public.withdrawal_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_withdrawal_amount();
