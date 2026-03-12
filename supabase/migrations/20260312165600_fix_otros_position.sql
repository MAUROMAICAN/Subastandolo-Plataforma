-- Fix: "Otros" must always be last category
UPDATE marketplace_categories
SET position = 99
WHERE slug = 'otros' AND parent_id IS NULL;
