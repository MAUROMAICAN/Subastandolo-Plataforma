-- Disable RLS to allow inserting without an active session
ALTER TABLE public.auctions DISABLE ROW LEVEL SECURITY;

-- We need a valid user ID for the foreign key, let's grab the first one
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  -- If there are NO users at all, we can't create an auction without dropping the constraint
  IF v_user_id IS NULL THEN
    ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_created_by_fkey;
    v_user_id := '00000000-0000-0000-0000-000000000000';
  END IF;

  INSERT INTO public.auctions (
    title, description, starting_price, current_price, end_time, status, image_url, created_by
  ) VALUES (
    'Vehículo de Prueba (Maqueta)', 
    'Este es un vehículo de prueba insertado automáticamente para pruebas de diseño.',
    15000, 15000, NOW() + INTERVAL '7 days', 'active', 
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
    v_user_id
  );
END $$;

-- Re-enable RLS
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
