
-- Create branding_config table
CREATE TABLE IF NOT EXISTS public.branding_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Insert default branding values
INSERT INTO public.branding_config (key, value) VALUES
  ('primary_color', '262 80% 50%'),
  ('secondary_color', '220 14% 96%'),
  ('accent_color', '38 92% 50%'),
  ('logo_url', ''),
  ('site_name', 'Subastándolo')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.branding_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read branding
CREATE POLICY "Anyone can view branding" ON public.branding_config
  FOR SELECT USING (true);

-- Only admins can manage branding
CREATE POLICY "Admins can manage branding" ON public.branding_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
