
-- Add the anon key to vault so the trigger can use it
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpYXdmZnF4cXRva21odWtzZm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzQ3ODIsImV4cCI6MjA4NjkxMDc4Mn0.pH-O7EP61-43IL_hnJqwfXtnMZLtOoyQ26tECHlahKQ',
  'SUPABASE_ANON_KEY'
);

-- Update trigger function to use anon key instead of service role key
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RAISE WARNING 'Push notification skipped: secrets not available';
    RETURN NEW;
  END IF;

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
      'Authorization', 'Bearer ' || v_anon_key
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Push notification trigger error: %', SQLERRM;
    RETURN NEW;
END;
$function$;
