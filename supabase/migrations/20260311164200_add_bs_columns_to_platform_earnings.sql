-- =====================================================
-- SINGLE SOURCE OF TRUTH: Add Bs columns to platform_earnings
-- All financial amounts in Bs are computed ONCE at insertion time
-- using the BCV rate from payment_proofs (at auction close)
-- =====================================================

-- 1. Add Bs columns to platform_earnings (IF NOT EXISTS handles re-runs)
ALTER TABLE public.platform_earnings 
  ADD COLUMN IF NOT EXISTS bcv_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS sale_amount_bs NUMERIC,
  ADD COLUMN IF NOT EXISTS commission_bs NUMERIC,
  ADD COLUMN IF NOT EXISTS dealer_net_bs NUMERIC;

-- 2. Backfill existing records using payment_proofs BCV rates
UPDATE public.platform_earnings pe
SET 
  bcv_rate = pp.bcv_rate,
  sale_amount_bs = pe.sale_amount * pp.bcv_rate,
  commission_bs = pe.commission_amount * pp.bcv_rate,
  dealer_net_bs = pe.dealer_net * pp.bcv_rate
FROM public.payment_proofs pp
WHERE pp.auction_id = pe.auction_id
  AND pp.status = 'approved'
  AND pe.bcv_rate IS NULL;

-- For any earnings without a payment_proof, use the current BCV rate from site_settings
UPDATE public.platform_earnings pe
SET 
  bcv_rate = COALESCE((SELECT NULLIF(setting_value,'')::numeric FROM public.site_settings WHERE setting_key = 'bcv_rate'), 0),
  sale_amount_bs = pe.sale_amount * COALESCE((SELECT NULLIF(setting_value,'')::numeric FROM public.site_settings WHERE setting_key = 'bcv_rate'), 0),
  commission_bs = pe.commission_amount * COALESCE((SELECT NULLIF(setting_value,'')::numeric FROM public.site_settings WHERE setting_key = 'bcv_rate'), 0),
  dealer_net_bs = pe.dealer_net * COALESCE((SELECT NULLIF(setting_value,'')::numeric FROM public.site_settings WHERE setting_key = 'bcv_rate'), 0)
WHERE pe.bcv_rate IS NULL;

-- 3. Create or replace the dealer_earnings view
-- This allows dealers to see their own earnings via RLS
DROP VIEW IF EXISTS public.dealer_earnings;
CREATE VIEW public.dealer_earnings AS
  SELECT * FROM public.platform_earnings;

-- Grant access
GRANT SELECT ON public.dealer_earnings TO authenticated;

-- 4. Update the handle_funds_release trigger to include Bs calculations
CREATE OR REPLACE FUNCTION public.handle_funds_release()
RETURNS TRIGGER AS $$
DECLARE
  v_dealer_id UUID;
  v_sale_amount NUMERIC;
  v_commission_pct NUMERIC := 10;
  v_commission_amount NUMERIC;
  v_dealer_net NUMERIC;
  v_bcv_rate NUMERIC;
  v_sale_bs NUMERIC;
  v_commission_bs NUMERIC;
  v_dealer_net_bs NUMERIC;
BEGIN
  -- Only process when funds_released_at changes from NULL to a value
  IF OLD.funds_released_at IS NOT NULL OR NEW.funds_released_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if earning already exists for this auction
  IF EXISTS (
    SELECT 1 FROM public.platform_earnings WHERE auction_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Get dealer (auction creator)
  v_dealer_id := NEW.created_by;
  v_sale_amount := NEW.current_price;

  -- Calculate commission and net
  v_commission_amount := ROUND(v_sale_amount * v_commission_pct / 100, 2);
  v_dealer_net := v_sale_amount - v_commission_amount;

  -- Get BCV rate from the approved payment proof for this auction
  SELECT pp.bcv_rate INTO v_bcv_rate
  FROM public.payment_proofs pp
  WHERE pp.auction_id = NEW.id AND pp.status = 'approved'
  LIMIT 1;

  -- Fallback to current BCV rate from site_settings
  IF v_bcv_rate IS NULL THEN
    SELECT NULLIF(setting_value,'')::numeric INTO v_bcv_rate
    FROM public.site_settings
    WHERE setting_key = 'bcv_rate';
  END IF;

  v_bcv_rate := COALESCE(v_bcv_rate, 0);

  -- Compute Bs amounts
  v_sale_bs := ROUND(v_sale_amount * v_bcv_rate, 2);
  v_commission_bs := ROUND(v_commission_amount * v_bcv_rate, 2);
  v_dealer_net_bs := ROUND(v_dealer_net * v_bcv_rate, 2);

  -- Insert earnings with both USD and Bs
  INSERT INTO public.platform_earnings (
    auction_id, dealer_id, sale_amount, commission_percentage, 
    commission_amount, dealer_net, bcv_rate, sale_amount_bs, 
    commission_bs, dealer_net_bs
  ) VALUES (
    NEW.id, v_dealer_id, v_sale_amount, v_commission_pct, 
    v_commission_amount, v_dealer_net, v_bcv_rate, v_sale_bs, 
    v_commission_bs, v_dealer_net_bs
  );

  -- Update dealer balance
  UPDATE public.dealer_verification
  SET dealer_balance = dealer_balance + v_dealer_net
  WHERE user_id = v_dealer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
