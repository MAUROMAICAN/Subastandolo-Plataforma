-- Fix brand settings: update site name and correct brand green color
-- #A6E300 in HSL = 76 100% 44%

UPDATE public.site_settings
SET setting_value = 'Subastandolo'
WHERE setting_key = 'site_name';

UPDATE public.site_settings
SET setting_value = '© 2025 Subastandolo. Todos los derechos reservados.'
WHERE setting_key = 'footer_text';

-- Primary color: dark navy #1e293b = HSL 215 28% 17%
UPDATE public.site_settings
SET setting_value = '215 28% 17%'
WHERE setting_key = 'primary_color';

-- Accent color: brand green #A6E300 = HSL 76 100% 44%
UPDATE public.site_settings
SET setting_value = '76 100% 44%'
WHERE setting_key = 'accent_color';
