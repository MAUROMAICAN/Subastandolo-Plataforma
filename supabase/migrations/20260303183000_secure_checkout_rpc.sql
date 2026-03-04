-- ==========================================
-- MARKETPLACE SECURITY ENHANCEMENTS & RPCs
-- ==========================================

-- 1. Helper function to decrement stock safely
CREATE OR REPLACE FUNCTION public.decrement_marketplace_stock(p_product_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.marketplace_products
  SET stock = stock - p_amount
  WHERE id = p_product_id AND stock >= p_amount;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough stock available for product %', p_product_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Secure Order Creation (Server-Side Price Validation)
-- This function receives the IDs and calculates the final price inside the database, 
-- ignoring any price sent from the client to prevent manipulation.
CREATE OR REPLACE FUNCTION public.create_secure_marketplace_order(
    p_buyer_id UUID,
    p_product_id UUID,
    p_attr_id UUID,
    p_quantity INTEGER,
    p_shipping_address TEXT,
    p_shipping_city TEXT,
    p_shipping_state TEXT,
    p_phone_number TEXT,
    p_payment_reference TEXT,
    p_payment_receipt_url TEXT
) RETURNS UUID AS $$
DECLARE
    v_dealer_id UUID;
    v_base_price NUMERIC;
    v_stock INTEGER;
    v_status TEXT;
    v_attr_price NUMERIC := 0;
    v_attr_name TEXT;
    v_attr_value TEXT;
    v_total_price NUMERIC;
    v_order_id UUID;
    v_bcv_rate NUMERIC;
    v_total_bs NUMERIC;
    v_selected_attrs JSONB := NULL;
BEGIN
    -- 1. Get Product Details & Validate Stock
    SELECT dealer_id, price_usd, stock, status 
    INTO v_dealer_id, v_base_price, v_stock, v_status
    FROM public.marketplace_products 
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_status != 'active' THEN
        RAISE EXCEPTION 'Product is not active';
    END IF;

    IF v_stock < p_quantity THEN
        RAISE EXCEPTION 'Not enough stock available';
    END IF;

    -- 2. Get Attribute Details (if provided)
    IF p_attr_id IS NOT NULL THEN
        SELECT attr_name, attr_value, additional_price_usd 
        INTO v_attr_name, v_attr_value, v_attr_price
        FROM public.marketplace_product_attributes
        WHERE id = p_attr_id AND product_id = p_product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid product attribute';
        END IF;

        v_selected_attrs := jsonb_build_object(v_attr_name, v_attr_value);
    END IF;

    -- 3. Calculate Final Price (Server-Side)
    v_total_price := (v_base_price + v_attr_price) * p_quantity;

    -- 4. Get Current BCV Rate
    SELECT rate INTO v_bcv_rate FROM public.bcv_rates ORDER BY date DESC LIMIT 1;
    IF v_bcv_rate IS NULL THEN
        v_bcv_rate := 1; -- Fallback
    END IF;

    v_total_bs := v_total_price * v_bcv_rate;

    -- 5. Insert Order
    INSERT INTO public.marketplace_orders (
        buyer_id,
        dealer_id,
        product_id,
        quantity,
        total_price_usd,
        total_price_bs,
        bcv_rate,
        shipping_address,
        shipping_city,
        shipping_state,
        phone_number,
        payment_status,
        payment_reference,
        payment_proof_url,
        selected_attributes
    ) VALUES (
        p_buyer_id,
        v_dealer_id,
        p_product_id,
        p_quantity,
        v_total_price,
        v_total_bs,
        v_bcv_rate,
        p_shipping_address,
        p_shipping_city,
        p_shipping_state,
        p_phone_number,
        'under_review',
        p_payment_reference,
        p_payment_receipt_url,
        v_selected_attrs
    ) RETURNING id INTO v_order_id;

    -- 6. Decrement Stock safely
    UPDATE public.marketplace_products
    SET stock = stock - p_quantity
    WHERE id = p_product_id;

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
