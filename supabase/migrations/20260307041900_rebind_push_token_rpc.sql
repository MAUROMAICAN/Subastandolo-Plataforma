-- RPC function to rebind a push subscription token to the current user.
-- Uses SECURITY DEFINER to bypass RLS so it can delete any old subscription
-- for the same endpoint (device token) regardless of which user_id it had.
CREATE OR REPLACE FUNCTION public.rebind_push_token(
  p_endpoint TEXT,
  p_platform TEXT DEFAULT 'android'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete ALL subscriptions with this endpoint (any user)
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;

  -- Insert fresh subscription for current user
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, platform)
  VALUES (v_user_id, p_endpoint, '', '', p_platform);
END;
$$;
