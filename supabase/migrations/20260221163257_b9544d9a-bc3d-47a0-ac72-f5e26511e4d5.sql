
-- 1. Restringir perfiles: reemplazar política abierta con una más restrictiva
-- Los usuarios pueden ver: su propio perfil, perfiles de participantes en sus subastas, o admins ven todo
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;

-- Permitir ver perfil propio
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

-- Admins pueden ver todos los perfiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Dealers pueden ver perfiles de compradores de sus subastas
CREATE POLICY "Dealers can view auction participant profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE (auctions.created_by = auth.uid() AND auctions.winner_id = profiles.id)
    OR (auctions.winner_id = auth.uid() AND auctions.created_by = profiles.id)
  )
);

-- Usuarios pueden ver perfiles de dealers de subastas activas (para mostrar nombres en cards)
CREATE POLICY "Users can view dealer profiles from auctions"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auctions
    WHERE auctions.created_by = profiles.id
    AND auctions.status IN ('active', 'finalized')
  )
);

-- Usuarios pueden ver perfiles de otros participantes en subastas donde han pujado
CREATE POLICY "Bidders can view auction participant profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bids b1
    JOIN bids b2 ON b1.auction_id = b2.auction_id
    WHERE b1.user_id = auth.uid() AND b2.user_id = profiles.id
  )
);
