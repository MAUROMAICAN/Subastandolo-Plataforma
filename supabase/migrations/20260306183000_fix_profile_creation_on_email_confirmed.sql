-- Fix: Solo crear perfil en profiles cuando el email esté VERIFICADO
-- El trigger INSERT original se ejecuta para TODOS los signups (incluso no verificados)
-- Solución: el trigger INSERT solo registra si ya está confirmado (caso raro: SSO),
--           y un trigger UPDATE crea el perfil cuando email_confirmed_at se setea por primera vez.

-- 1. Modificar el trigger INSERT para NO crear perfil si email no está confirmado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo crear perfil inmediatamente si el email ya viene confirmado (OAuth/SSO)
  -- Para registro normal con OTP, email_confirmed_at es NULL hasta que el usuario verifique
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Evitar duplicados (por si el trigger UPDATE ya lo creó)
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Nuevo trigger en UPDATE: se dispara cuando email_confirmed_at cambia de NULL a un valor
--    (es decir, cuando el usuario verifica su correo / OTP)
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo actuar cuando email_confirmed_at pasa de NULL a un valor
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Crear perfil si no existe
    INSERT INTO public.profiles (id, full_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO NOTHING;

    -- Asignar rol de usuario si no tiene
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Crear el trigger de UPDATE si no existe
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();
