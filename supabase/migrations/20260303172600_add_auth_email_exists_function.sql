-- Function to check if an email exists in auth.users
-- Used by the check-email-exists Edge Function to determine
-- if a user should be directed to login or registration flow.
-- SECURITY DEFINER ensures it runs with owner privileges to access auth schema.
CREATE OR REPLACE FUNCTION public.auth_email_exists(lookup_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE email = lower(trim(lookup_email))
  );
END;
$$;

-- Allow any authenticated or anonymous caller to execute this function
-- (the Edge Function calls it using the service_role key, so this is safe)
GRANT EXECUTE ON FUNCTION public.auth_email_exists(TEXT) TO anon, authenticated, service_role;
