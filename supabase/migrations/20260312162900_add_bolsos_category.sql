-- =============================================
-- Add missing category: Bolsos, Mochilas y Equipaje
-- =============================================

INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position, description) VALUES
  ('c0000016-0000-0000-0000-000000000016', NULL, 'Bolsos, Mochilas y Equipaje', 'bolsos-mochilas-equipaje', '👜', 0, 16, 'Morrales, mochilas, maletines, carteras, bolsos de mano');

-- Subcategories
INSERT INTO marketplace_categories (id, parent_id, name, slug, icon, level, position) VALUES
  ('cf010000-0000-0000-0000-000000000016', 'c0000016-0000-0000-0000-000000000016', 'Mochilas y Morrales', 'mochilas-morrales', '🎒', 1, 1),
  ('cf020000-0000-0000-0000-000000000016', 'c0000016-0000-0000-0000-000000000016', 'Bolsos de Mano', 'bolsos-de-mano', '👜', 1, 2),
  ('cf030000-0000-0000-0000-000000000016', 'c0000016-0000-0000-0000-000000000016', 'Maletines y Portafolios', 'maletines-portafolios', '💼', 1, 3),
  ('cf040000-0000-0000-0000-000000000016', 'c0000016-0000-0000-0000-000000000016', 'Carteras y Billeteras', 'carteras-billeteras', '👛', 1, 4),
  ('cf050000-0000-0000-0000-000000000016', 'c0000016-0000-0000-0000-000000000016', 'Maletas de Viaje', 'maletas-viaje', '🧳', 1, 5),
  ('cf060000-0000-0000-0000-000000000016', 'c0000016-0000-0000-0000-000000000016', 'Riñoneras y Bananos', 'rinoneras-bananos', '👝', 1, 6);

-- Attributes for Mochilas y Morrales
INSERT INTO category_attributes (category_id, name, label, type, options, required, position, placeholder, group_name) VALUES
  ('cf010000-0000-0000-0000-000000000016', 'marca', 'Marca', 'text', '[]', true, 1, 'Ej: Under Armour, Nike, Totto', 'Información'),
  ('cf010000-0000-0000-0000-000000000016', 'material', 'Material', 'select', '[{"value":"cuero","label":"Cuero"},{"value":"sintetico","label":"Cuero Sintético"},{"value":"nylon","label":"Nylon"},{"value":"poliester","label":"Poliéster"},{"value":"lona","label":"Lona"},{"value":"otro","label":"Otro"}]', false, 2, '', 'Especificaciones'),
  ('cf010000-0000-0000-0000-000000000016', 'color', 'Color', 'text', '[]', true, 3, 'Ej: Negro, Gris', 'Información'),
  ('cf010000-0000-0000-0000-000000000016', 'capacidad', 'Capacidad (litros)', 'text', '[]', false, 4, 'Ej: 25L, 30L', 'Especificaciones'),
  ('cf010000-0000-0000-0000-000000000016', 'genero', 'Género', 'select', '[{"value":"hombre","label":"Hombre"},{"value":"mujer","label":"Mujer"},{"value":"unisex","label":"Unisex"}]', false, 5, '', 'Información');
