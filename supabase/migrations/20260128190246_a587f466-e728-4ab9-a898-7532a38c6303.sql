-- Add Desserts menu (5th category)
INSERT INTO menus (id, menu_type, title, title_en, subtitle, subtitle_en, slug, is_published, sort_order)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'catering',
  'Desserts',
  'Desserts',
  'Süße Verführungen',
  'Sweet Temptations',
  'desserts',
  true,
  5
);

-- Add Desserts category
INSERT INTO menu_categories (id, menu_id, name, name_en, description, description_en, sort_order)
VALUES (
  '44444444-4444-4444-4444-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'Desserts',
  'Desserts',
  'Süße Verführungen im Glas – perfekt für Ihr Catering-Event',
  'Sweet temptations in a glass – perfect for your catering event',
  1
);

-- Add Dessert items
INSERT INTO menu_items (category_id, name, name_en, description, description_en, price, min_order, min_order_en, serving_info, serving_info_en, image_url, sort_order)
VALUES 
  ('44444444-4444-4444-4444-555555555555', 'Tiramisù STORIA', 'Tiramisù STORIA', 'Hausgemachtes Tiramisù mit Espresso, Schokoladenboden und Mascarpone.', 'Homemade tiramisù with espresso, chocolate base and mascarpone.', 4.50, 'Ab 4 Personen bestellbar', 'Minimum order for 4 people', 'Ein Fingerfood-Glas pro Person', 'One fingerfood glass per person', '/assets/catering/fingerfood/tiramisu.webp', 1),
  ('44444444-4444-4444-4444-555555555555', 'Pistazien-Törtchen', 'Pistachio Tartlet', 'Pistazientörtchen mit Vanillecreme – elegant und aromatisch.', 'Pistachio tartlet with vanilla cream – elegant and aromatic.', 5.80, 'Ab 4 Personen bestellbar', 'Minimum order for 4 people', 'Ein Fingerfood-Glas pro Person', 'One fingerfood glass per person', '/assets/catering/fingerfood/pistazien.webp', 2);