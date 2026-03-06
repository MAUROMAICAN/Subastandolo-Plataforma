-- Prevent duplicate phone numbers in profiles (NULL is allowed, NULLs are not considered duplicates)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_unique;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_unique UNIQUE NULLS NOT DISTINCT (phone);

-- Prevent duplicate usernames in profiles (NULL is allowed)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_unique;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE NULLS NOT DISTINCT (username);
