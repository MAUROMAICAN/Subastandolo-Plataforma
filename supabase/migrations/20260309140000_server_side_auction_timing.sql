-- ============================================
-- SERVER-SIDE AUCTION TIMING FIX
-- Calculate end_time using DB server clock (NOW())
-- instead of client browser Date.now()
-- ============================================

-- 1. RPC: approve_auction — admin approves a pending auction
CREATE OR REPLACE FUNCTION public.approve_auction(
  p_auction_id UUID,
  p_duration_hours INTEGER,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_new_end TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_status FROM auctions WHERE id = p_auction_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('error', 'Subasta no encontrada');
  END IF;

  IF v_status NOT IN ('pending', 'in_review') THEN
    RETURN json_build_object('error', 'Solo se pueden aprobar subastas pendientes o en revisión');
  END IF;

  v_new_end := NOW() + (p_duration_hours || ' hours')::INTERVAL;

  UPDATE auctions SET
    status = 'active',
    start_time = NOW(),
    end_time = v_new_end,
    requested_duration_hours = p_duration_hours,
    admin_notes = COALESCE(p_admin_notes, admin_notes)
  WHERE id = p_auction_id;

  RETURN json_build_object(
    'ok', true,
    'end_time', v_new_end,
    'start_time', NOW()
  );
END;
$function$;

-- 2. RPC: set_auction_end_time — admin changes end time of active auction
CREATE OR REPLACE FUNCTION public.set_auction_end_time(
  p_auction_id UUID,
  p_duration_hours NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_new_end TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_status FROM auctions WHERE id = p_auction_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('error', 'Subasta no encontrada');
  END IF;

  IF v_status NOT IN ('active', 'paused') THEN
    RETURN json_build_object('error', 'Solo se puede cambiar el tiempo de subastas activas o pausadas');
  END IF;

  v_new_end := NOW() + (p_duration_hours || ' hours')::INTERVAL;

  UPDATE auctions SET end_time = v_new_end WHERE id = p_auction_id;

  RETURN json_build_object('ok', true, 'end_time', v_new_end);
END;
$function$;

-- 3. RPC: activate_scheduled_auction — activates a "Próximamente" auction
CREATE OR REPLACE FUNCTION public.activate_scheduled_auction(
  p_auction_id UUID,
  p_duration_hours INTEGER,
  p_schedule_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_status FROM auctions WHERE id = p_auction_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('error', 'Subasta no encontrada');
  END IF;

  IF v_status != 'scheduled' THEN
    RETURN json_build_object('error', 'Solo se pueden activar subastas programadas');
  END IF;

  IF p_schedule_start IS NOT NULL THEN
    v_start := p_schedule_start;
    v_end := p_schedule_start + (p_duration_hours || ' hours')::INTERVAL;
  ELSE
    v_start := NOW();
    v_end := NOW() + (p_duration_hours || ' hours')::INTERVAL;
  END IF;

  UPDATE auctions SET
    status = 'active',
    start_time = v_start,
    end_time = v_end,
    requested_duration_hours = p_duration_hours
  WHERE id = p_auction_id;

  RETURN json_build_object('ok', true, 'start_time', v_start, 'end_time', v_end);
END;
$function$;

-- 4. RPC: auto_approve_auction — for gold+ dealers who self-publish
CREATE OR REPLACE FUNCTION public.auto_approve_auction(
  p_auction_id UUID,
  p_duration_hours INTEGER,
  p_scheduled_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_base TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT status INTO v_status FROM auctions WHERE id = p_auction_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('error', 'Subasta no encontrada');
  END IF;

  -- Base time: scheduled start if in the future, otherwise NOW()
  IF p_scheduled_start IS NOT NULL AND p_scheduled_start > NOW() THEN
    v_base := p_scheduled_start;
  ELSE
    v_base := NOW();
  END IF;

  v_end := v_base + (p_duration_hours || ' hours')::INTERVAL;

  UPDATE auctions SET
    status = 'active',
    start_time = v_base,
    end_time = v_end
  WHERE id = p_auction_id;

  RETURN json_build_object('ok', true, 'start_time', v_base, 'end_time', v_end);
END;
$function$;
