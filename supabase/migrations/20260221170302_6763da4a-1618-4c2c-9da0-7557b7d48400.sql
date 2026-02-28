
-- =============================================
-- 1. FAVORITES / WATCHLIST TABLE
-- =============================================
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, auction_id)
);

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.favorites FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove favorites"
  ON public.favorites FOR DELETE
  USING (user_id = auth.uid());

-- =============================================
-- 2. IN-APP NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- Admins and system can insert notifications for any user
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =============================================
-- 3. BID RATE LIMITING TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.check_bid_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.bids
  WHERE user_id = NEW.user_id
    AND auction_id = NEW.auction_id
    AND created_at > NOW() - INTERVAL '10 seconds';

  IF recent_count >= 3 THEN
    RAISE EXCEPTION 'Demasiadas pujas en poco tiempo. Espera unos segundos.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_bid_rate_limit_trigger
BEFORE INSERT ON public.bids
FOR EACH ROW
EXECUTE FUNCTION public.check_bid_rate_limit();
