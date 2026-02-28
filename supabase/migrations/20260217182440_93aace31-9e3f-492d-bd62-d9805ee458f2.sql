
-- Site settings table for CMS (key-value pairs for site configuration)
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  setting_type text NOT NULL DEFAULT 'text', -- text, color, image, json
  category text NOT NULL DEFAULT 'general', -- general, appearance, footer, nav, seo
  label text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default settings
INSERT INTO public.site_settings (setting_key, setting_value, setting_type, category, label) VALUES
  ('site_name', 'SubastaYa', 'text', 'general', 'Nombre del Sitio'),
  ('site_description', 'La plataforma #1 de subastas en línea', 'text', 'general', 'Descripción del Sitio'),
  ('footer_text', '© 2025 SubastaYa. Todos los derechos reservados.', 'text', 'footer', 'Texto del Footer'),
  ('contact_email', '', 'text', 'general', 'Email de Contacto'),
  ('contact_phone', '', 'text', 'general', 'Teléfono de Contacto'),
  ('whatsapp_number', '', 'text', 'general', 'Número de WhatsApp'),
  ('hero_cta_text', 'Regístrate para Pujar', 'text', 'general', 'Texto del Botón Hero'),
  ('announcement_bar', '', 'text', 'general', 'Barra de Anuncio (vacío = oculta)'),
  ('primary_color', '213 94% 30%', 'color', 'appearance', 'Color Primario (HSL)'),
  ('accent_color', '45 100% 51%', 'color', 'appearance', 'Color Acento (HSL)');

-- Dynamic sections for the homepage
CREATE TABLE public.site_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text,
  content text,
  is_visible boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  section_type text NOT NULL DEFAULT 'content', -- content, faq, features, cta
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible sections" ON public.site_sections FOR SELECT USING (is_visible = true OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage sections" ON public.site_sections FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default sections
INSERT INTO public.site_sections (section_key, title, content, is_visible, display_order, section_type) VALUES
  ('how_it_works', 'Cómo Funciona', 'Regístrate, encuentra productos increíbles y puja para ganar.', true, 1, 'features'),
  ('faq', 'Preguntas Frecuentes', '', true, 2, 'faq'),
  ('cta_bottom', '¿Listo para empezar?', 'Únete a miles de usuarios que ya están ganando subastas increíbles.', true, 3, 'cta');

-- Internal messaging between admin and dealers
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  auction_id uuid REFERENCES public.auctions(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can mark messages read" ON public.messages FOR UPDATE USING (receiver_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
