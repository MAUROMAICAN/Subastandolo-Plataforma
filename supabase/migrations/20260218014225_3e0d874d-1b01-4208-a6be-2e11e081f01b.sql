
-- Create blacklisted_records table for banned users
CREATE TABLE public.blacklisted_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  cedula TEXT,
  reason TEXT NOT NULL DEFAULT 'Cuenta suspendida',
  banned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blacklisted_records ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blacklisted records
CREATE POLICY "Admins can manage blacklisted records"
  ON public.blacklisted_records
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow the edge function (via service role) to read blacklisted records
-- We also need anon/authenticated to call the validation edge function,
-- but the edge function will use service_role key to query this table.
