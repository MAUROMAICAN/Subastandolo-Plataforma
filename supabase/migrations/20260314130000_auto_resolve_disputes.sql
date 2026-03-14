-- Auto-resolve marketplace disputes where seller didn't respond within deadline
-- This function should be called periodically (e.g., via pg_cron every hour)

CREATE OR REPLACE FUNCTION auto_resolve_expired_disputes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resolved_count int := 0;
BEGIN
  -- Auto-resolve disputes where:
  -- 1. Status is still 'open' (seller hasn't responded)
  -- 2. The auto_resolve_at deadline has passed
  UPDATE marketplace_disputes
  SET
    status = 'resolved_buyer',
    resolution = 'Resolución automática: el vendedor no respondió dentro del plazo de 3 días.',
    resolution_type = 'auto_refund',
    updated_at = now()
  WHERE
    status = 'open'
    AND auto_resolve_at IS NOT NULL
    AND auto_resolve_at < now();

  GET DIAGNOSTICS resolved_count = ROW_COUNT;

  RETURN resolved_count;
END;
$$;

-- Schedule auto-resolution to run every hour (Supabase pg_cron)
-- NOTE: Run this in the Supabase SQL editor manually since pg_cron extension
-- needs to be enabled first via the Supabase dashboard.
--
-- SELECT cron.schedule(
--   'auto-resolve-disputes',
--   '0 * * * *',  -- every hour
--   $$SELECT auto_resolve_expired_disputes()$$
-- );
