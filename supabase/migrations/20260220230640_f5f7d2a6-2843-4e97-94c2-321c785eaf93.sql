
-- Update the operation number format for auctions to be more corporate
-- Format: SUB-YYMMDD-XXXX (date + 4-char hex from uuid)
CREATE OR REPLACE FUNCTION public.generate_operation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.operation_number := 'SUB-' 
    || TO_CHAR(NOW(), 'YYMMDD') || '-' 
    || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  RETURN NEW;
END;
$function$;

-- Add public_id to profiles for users
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS public_id text UNIQUE;

-- Add public_id to dealer_verification for dealers
ALTER TABLE public.dealer_verification
ADD COLUMN IF NOT EXISTS public_id text UNIQUE;

-- Function to generate user public ID: USR-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_user_public_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.public_id := 'USR-' 
    || TO_CHAR(NOW(), 'YYMMDD') || '-' 
    || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  RETURN NEW;
END;
$function$;

-- Function to generate dealer public ID: DLR-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION public.generate_dealer_public_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.public_id := 'DLR-' 
    || TO_CHAR(NOW(), 'YYMMDD') || '-' 
    || UPPER(SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 4));
  RETURN NEW;
END;
$function$;

-- Triggers
CREATE TRIGGER set_user_public_id
BEFORE INSERT ON public.profiles
FOR EACH ROW
WHEN (NEW.public_id IS NULL)
EXECUTE FUNCTION public.generate_user_public_id();

CREATE TRIGGER set_dealer_public_id
BEFORE INSERT ON public.dealer_verification
FOR EACH ROW
WHEN (NEW.public_id IS NULL)
EXECUTE FUNCTION public.generate_dealer_public_id();

-- Backfill existing auctions with new format
UPDATE public.auctions
SET operation_number = 'SUB-' 
  || TO_CHAR(created_at, 'YYMMDD') || '-' 
  || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE operation_number IS NOT NULL;

-- Backfill existing profiles
UPDATE public.profiles
SET public_id = 'USR-' 
  || TO_CHAR(created_at, 'YYMMDD') || '-' 
  || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE public_id IS NULL;

-- Backfill existing dealers
UPDATE public.dealer_verification
SET public_id = 'DLR-' 
  || TO_CHAR(created_at, 'YYMMDD') || '-' 
  || UPPER(SUBSTR(REPLACE(id::text, '-', ''), 1, 4))
WHERE public_id IS NULL;
