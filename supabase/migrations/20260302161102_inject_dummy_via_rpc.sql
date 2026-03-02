-- Bypass RLS using an anonymous DO block
DO $$
BEGIN
  -- Drop the constraint temporarily since the local database might have 0 users
  ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_created_by_fkey;
  
  -- Insert the test product with the mock UUID
  INSERT INTO public.auctions (
    title, description, starting_price, current_price, end_time, status, image_url, created_by
  ) VALUES (
    'Vehículo de Prueba (Maqueta)', 
    'Este es un vehículo de prueba insertado automáticamente para pruebas de diseño.',
    15000, 15000, NOW() + INTERVAL '7 days', 'active', 
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
    '00000000-0000-0000-0000-000000000000'
  );
  
  -- Re-add the constraint so we don't break production logic forever
  -- Note: We use NOT VALID so it doesn't fail on the row we just inserted
  ALTER TABLE public.auctions 
    ADD CONSTRAINT auctions_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) NOT VALID;
END;
$$;
