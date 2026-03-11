-- Prevent duplicate phone numbers in profiles (NULL is allowed, multiple NULLs are OK)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_unique;
-- Use a unique index that ignores NULLs instead of UNIQUE constraint
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique ON public.profiles (phone) WHERE phone IS NOT NULL;

-- Prevent duplicate usernames in profiles (NULL is allowed, multiple NULLs are OK)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_unique;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username) WHERE username IS NOT NULL;
