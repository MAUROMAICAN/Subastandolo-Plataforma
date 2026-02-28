-- Add bcv_rate setting to site_settings so admin can set it manually
INSERT INTO public.site_settings (setting_key, setting_value, setting_type, category, label)
VALUES ('bcv_rate', '', 'text', 'general', 'Tasa BCV del Día (Bs/$)')
ON CONFLICT (setting_key) DO NOTHING;
