
-- Tabla para campañas publicitarias (modales emergentes)
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver campañas activas
CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns FOR SELECT
USING (is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

-- Solo admins pueden gestionar campañas
CREATE POLICY "Admins can manage campaigns"
ON public.campaigns FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabla para trackear qué usuarios ya cerraron qué campaña
CREATE TABLE public.campaign_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.campaign_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals"
ON public.campaign_dismissals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss campaigns"
ON public.campaign_dismissals FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Storage bucket para flyers de campañas
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-flyers', 'campaign-flyers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view campaign flyers"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaign-flyers');

CREATE POLICY "Admins can upload campaign flyers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'campaign-flyers');

CREATE POLICY "Admins can delete campaign flyers"
ON storage.objects FOR DELETE
USING (bucket_id = 'campaign-flyers');
