INSERT INTO public.site_settings (setting_key, setting_value, setting_type, category, label) 
VALUES ('ticker_speed', '50', 'text', 'BARRA DE ANUNCIOS SUPERIOR', 'Velocidad de Movimiento (10=Rápido, 100=Lento)') 
ON CONFLICT (setting_key) DO NOTHING;

-- Mover el texto del anuncio a la nueva categoría para agruparlos
UPDATE public.site_settings 
SET category = 'BARRA DE ANUNCIOS SUPERIOR' 
WHERE setting_key = 'announcement_bar';
