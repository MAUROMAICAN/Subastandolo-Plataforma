
-- Function to handle reputation impact when a dispute is resolved against the dealer
CREATE OR REPLACE FUNCTION public.handle_dispute_reputation_impact()
RETURNS TRIGGER AS $$
DECLARE
  lost_count INTEGER;
BEGIN
  -- Only trigger when dispute changes to 'refunded' (buyer wins)
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' THEN
    
    -- Insert an automatic negative review (1 star) against the dealer
    -- Use the resolved_by (admin) as reviewer to avoid RLS conflicts
    -- We mark it with a special tag so it's identifiable
    INSERT INTO public.reviews (
      auction_id,
      reviewer_id,
      reviewed_id,
      rating,
      review_type,
      comment,
      product_accuracy,
      attention_quality,
      shipping_speed,
      tags
    ) VALUES (
      NEW.auction_id,
      NEW.buyer_id,
      NEW.dealer_id,
      1,
      'buyer_to_dealer',
      'Disputa resuelta a favor del comprador: ' || COALESCE(NEW.resolution, 'Producto no conforme'),
      1,
      1,
      1,
      ARRAY['disputa_perdida', 'automatica']
    )
    ON CONFLICT DO NOTHING; -- Avoid duplicate if buyer already reviewed

    -- Count disputes lost by this dealer in the last 30 days
    SELECT COUNT(*) INTO lost_count
    FROM public.disputes
    WHERE dealer_id = NEW.dealer_id
      AND status = 'refunded'
      AND resolved_at >= NOW() - INTERVAL '30 days';

    -- If 3+ lost disputes in a month, suspend the dealer
    IF lost_count >= 3 THEN
      UPDATE public.dealer_verification
      SET account_status = 'suspended',
          status_reason = 'Suspendido automáticamente: ' || lost_count || ' disputas perdidas en los últimos 30 días',
          status_changed_at = NOW()
      WHERE user_id = NEW.dealer_id
        AND account_status = 'active';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on disputes table
DROP TRIGGER IF EXISTS on_dispute_reputation_impact ON public.disputes;
CREATE TRIGGER on_dispute_reputation_impact
  AFTER UPDATE ON public.disputes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dispute_reputation_impact();
