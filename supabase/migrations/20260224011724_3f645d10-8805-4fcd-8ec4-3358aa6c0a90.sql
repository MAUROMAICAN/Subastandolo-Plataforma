
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification via edge function when a notification is inserted
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get Supabase URL and service role key from vault or env
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  -- Fallback: skip if secrets not accessible
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'Push notification skipped: secrets not available';
    RETURN NEW;
  END IF;

  -- Call the send-push-to-users edge function asynchronously
  SELECT extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-push-to-users',
    body := jsonb_build_object(
      'userIds', jsonb_build_array(NEW.user_id),
      'title', NEW.title,
      'body', NEW.message,
      'url', COALESCE(NEW.link, '/'),
      'tag', COALESCE(NEW.type, 'general')
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't block notification insert if push fails
    RAISE WARNING 'Push notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trigger_push_on_notification ON public.notifications;
CREATE TRIGGER trigger_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_notification();
