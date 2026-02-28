
-- Create a sequence for operation numbers
CREATE SEQUENCE IF NOT EXISTS public.auction_operation_seq START WITH 1 INCREMENT BY 1;

-- Add operation_number column
ALTER TABLE public.auctions
ADD COLUMN operation_number text UNIQUE;

-- Function to auto-generate operation number on insert
CREATE OR REPLACE FUNCTION public.generate_operation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.operation_number := 'OP-' || LPAD(nextval('public.auction_operation_seq')::text, 5, '0');
  RETURN NEW;
END;
$function$;

-- Trigger to auto-assign on insert
CREATE TRIGGER set_operation_number
BEFORE INSERT ON public.auctions
FOR EACH ROW
WHEN (NEW.operation_number IS NULL)
EXECUTE FUNCTION public.generate_operation_number();

-- Backfill existing auctions with operation numbers ordered by creation date
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.auctions
  WHERE operation_number IS NULL
)
UPDATE public.auctions a
SET operation_number = 'OP-' || LPAD(n.rn::text, 5, '0')
FROM numbered n
WHERE a.id = n.id;

-- Update the sequence to continue after the last assigned number
SELECT setval('public.auction_operation_seq', COALESCE(
  (SELECT MAX(REPLACE(operation_number, 'OP-', '')::int) FROM public.auctions WHERE operation_number IS NOT NULL),
  1
));
