
-- Table to record each platform commission earned
CREATE TABLE public.platform_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID NOT NULL REFERENCES public.auctions(id),
  dealer_id UUID NOT NULL,
  sale_amount NUMERIC NOT NULL,
  commission_percentage NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  dealer_net NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all earnings"
  ON public.platform_earnings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage earnings"
  ON public.platform_earnings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Dealers can view own earnings"
  ON public.platform_earnings FOR SELECT
  USING (dealer_id = auth.uid());

-- Add dealer_balance to dealer_verification
ALTER TABLE public.dealer_verification
  ADD COLUMN IF NOT EXISTS dealer_balance NUMERIC NOT NULL DEFAULT 0;

-- Function to split funds when auction funds are released
CREATE OR REPLACE FUNCTION public.handle_funds_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_commission_pct NUMERIC;
  v_commission_amount NUMERIC;
  v_dealer_net NUMERIC;
  v_dealer_id UUID;
  v_sale_amount NUMERIC;
  v_already_exists BOOLEAN;
BEGIN
  -- Only trigger when funds_released_at is set for the first time
  IF NEW.funds_released_at IS NOT NULL AND OLD.funds_released_at IS NULL THEN
    
    v_sale_amount := NEW.current_price;
    v_dealer_id := NEW.created_by;
    
    -- Check if already processed
    SELECT EXISTS(
      SELECT 1 FROM public.platform_earnings WHERE auction_id = NEW.id
    ) INTO v_already_exists;
    
    IF v_already_exists THEN
      RETURN NEW;
    END IF;
    
    -- Get commission percentage from site_settings
    SELECT COALESCE(setting_value::numeric, 10)
    INTO v_commission_pct
    FROM public.site_settings
    WHERE setting_key = 'commission_percentage';
    
    IF v_commission_pct IS NULL THEN
      v_commission_pct := 10;
    END IF;
    
    v_commission_amount := ROUND(v_sale_amount * v_commission_pct / 100, 2);
    v_dealer_net := v_sale_amount - v_commission_amount;
    
    -- Record platform earning
    INSERT INTO public.platform_earnings (auction_id, dealer_id, sale_amount, commission_percentage, commission_amount, dealer_net)
    VALUES (NEW.id, v_dealer_id, v_sale_amount, v_commission_pct, v_commission_amount, v_dealer_net);
    
    -- Update dealer balance
    UPDATE public.dealer_verification
    SET dealer_balance = dealer_balance + v_dealer_net
    WHERE user_id = v_dealer_id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on auctions when funds are released
CREATE TRIGGER trigger_funds_release_split
  AFTER UPDATE ON public.auctions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_funds_release();
