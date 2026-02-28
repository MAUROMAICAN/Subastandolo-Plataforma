-- Fix 1: Allow admins to SELECT push_subscriptions (needed to send to "all" subscribers)
CREATE POLICY "Admins can view push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Allow SECURITY DEFINER functions (system triggers) to insert notifications for any user
-- The existing "Admins can insert notifications" policy covers auth.uid() = admin
-- But DB trigger functions (SECURITY DEFINER) run as the definer user, which bypasses RLS
-- We need an additional policy to allow service_role / postgres role inserts
-- This is done via a permissive check (the SECURITY DEFINER functions already bypass RLS)

-- Fix 3: Add a policy to allow the system (postgres role / service_role) to insert notifications
-- This ensures the trigger-based notifications (outbid, won, etc.) always work
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop and recreate more permissive INSERT policy for notifications
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- Allow admins AND the postgres/service role to insert
CREATE POLICY "System and admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    -- Admins can insert
    public.has_role(auth.uid(), 'admin'::app_role)
    -- SECURITY DEFINER functions run without auth.uid() so this covers triggers
    OR auth.uid() IS NULL
  );
