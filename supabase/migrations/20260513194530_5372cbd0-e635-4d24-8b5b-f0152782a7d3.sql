
-- 1. Update prices + descriptions for the 3 reisegruppen packages
UPDATE public.packages SET 
  price = 25, 
  name_en = 'Pizza & Pasta',
  description = 'Der schnelle Stopp – ideal für Busgruppen mit engem Zeitplan (45–60 Min.)',
  description_en = 'The quick stop – ideal for bus groups on a tight schedule (45–60 min.)',
  duration_minutes = 60,
  includes = '["Pizza nach Wahl ODER Pasta nach Wahl","Gemischter Blattsalat","Espresso oder Gelato (1 Kugel)","Wasser (0,5 l) und ein Softgetränk pro Person"]'::jsonb
WHERE id = '80b98b7b-0b3a-4002-afb2-cf416f06fcfb';

UPDATE public.packages SET 
  price = 45, 
  name_en = 'Benvenuti',
  description = 'Das klassische Gruppenmenü mit Vorspeise, Hauptgang und Dessert (75–90 Min.)',
  description_en = 'The classic group menu with starter, main and dessert (75–90 min.)',
  duration_minutes = 90,
  includes = '["Vorspeise zum Teilen am Tisch","Hauptgang nach Wahl","Kleines Tiramisu oder kleine Panna Cotta","1× 0,1 l Hauswein, Helles oder Softdrink + Wasser + Espresso"]'::jsonb
WHERE id = 'd8cfcf08-9997-4f0a-8a3c-cc598dd11ce3';

UPDATE public.packages SET 
  price = 67, 
  name_en = 'Tradizione',
  description = 'Das italienische 4-Gänge-Menü für Gruppen, die sich Zeit nehmen (90–120 Min.)',
  description_en = 'The Italian 4-course menu for groups taking their time (90–120 min.)',
  duration_minutes = 120,
  includes = '["Antipasto misto","Primo nach Wahl","Secondo nach Wahl","Dessert-Auswahl","½ l Wein p.P., Wasser, Espresso"]'::jsonb
WHERE id = 'dea69975-21ee-4957-956c-fbe2fd300803';

-- 2. Clear old course/drink configs (idempotent)
DELETE FROM public.package_course_config WHERE package_id IN (
  '80b98b7b-0b3a-4002-afb2-cf416f06fcfb',
  'd8cfcf08-9997-4f0a-8a3c-cc598dd11ce3',
  'dea69975-21ee-4957-956c-fbe2fd300803'
);
DELETE FROM public.package_drink_config WHERE package_id IN (
  '80b98b7b-0b3a-4002-afb2-cf416f06fcfb',
  'd8cfcf08-9997-4f0a-8a3c-cc598dd11ce3',
  'dea69975-21ee-4957-956c-fbe2fd300803'
);

-- 3. PIZZA E PASTA – courses
INSERT INTO public.package_course_config (package_id, course_type, course_label, course_label_en, is_required, is_custom_item, custom_item_name, custom_item_name_en, custom_item_description, sort_order) VALUES
('80b98b7b-0b3a-4002-afb2-cf416f06fcfb', 'starter', 'Salat', 'Salad', false, true, 'Gemischter Blattsalat', 'Mixed leaf salad', NULL, 1),
('80b98b7b-0b3a-4002-afb2-cf416f06fcfb', 'main',    'Hauptgang (Pizza ODER Pasta)', 'Main (Pizza OR Pasta)', true, true, 'Pizza nach Wahl (Margherita, Diavola, Quattro Formaggi, Prosciutto e Funghi) oder Pasta nach Wahl (Spaghetti Pomodoro, Penne all''Arrabbiata, Spaghetti Carbonara)', 'Pizza of choice (Margherita, Diavola, Quattro Formaggi, Prosciutto e Funghi) or pasta of choice (Spaghetti Pomodoro, Penne all''Arrabbiata, Spaghetti Carbonara)', NULL, 2),
('80b98b7b-0b3a-4002-afb2-cf416f06fcfb', 'dessert', 'Dessert', 'Dessert', true, true, 'Espresso oder Gelato (1 Kugel)', 'Espresso or gelato (1 scoop)', NULL, 3);

-- 4. PIZZA E PASTA – drinks
INSERT INTO public.package_drink_config (package_id, drink_group, drink_label, drink_label_en, options, quantity_per_person, quantity_label, quantity_label_en, is_choice, is_included, sort_order) VALUES
('80b98b7b-0b3a-4002-afb2-cf416f06fcfb', 'water',   'Wasser', 'Water', '[]'::jsonb, '0.5l', '0,5 l p.P.', '0.5 l p.p.', false, true, 1),
('80b98b7b-0b3a-4002-afb2-cf416f06fcfb', 'custom',  'Softgetränk', 'Soft drink', '[]'::jsonb, '1', '1 p.P.', '1 p.p.', false, true, 2);

-- 5. BENVENUTI – courses
INSERT INTO public.package_course_config (package_id, course_type, course_label, course_label_en, is_required, is_custom_item, custom_item_name, custom_item_name_en, custom_item_description, sort_order) VALUES
('d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3', 'starter', 'Vorspeise zum Teilen', 'Shared starter', true, true,
  'Caprese mit Büffel-Mozzarellina, Vitello Tonnato, Parmigiana-Auflauf und frisches selbstgemachtes Steinofenbrot',
  'Caprese with buffalo mozzarellina, Vitello Tonnato, parmigiana bake and freshly baked stone-oven bread', NULL, 1),
('d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3', 'main',    'Hauptgang (Wahl)', 'Main course (choice)', true, true,
  'Pizza Margherita / Salame Piccante, Penne all''Arrabbiata / Tagliatelle al Ragù oder Risotto mit Edelpilzen (glutenfrei)',
  'Pizza Margherita / Salame Piccante, Penne all''Arrabbiata / Tagliatelle al Ragù or risotto with mushrooms (gluten-free)', NULL, 2),
('d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3', 'dessert', 'Dessert', 'Dessert', true, true,
  'Kleines Tiramisu (Hausrezept) oder kleine Panna Cotta',
  'Small tiramisu (house recipe) or small panna cotta', NULL, 3);

-- 6. BENVENUTI – drinks
INSERT INTO public.package_drink_config (package_id, drink_group, drink_label, drink_label_en, options, quantity_per_person, quantity_label, quantity_label_en, is_choice, is_included, sort_order) VALUES
('d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3', 'main_drink', 'Hauptgetränk (Wahl)', 'Main drink (choice)',
  '[{"type":"wine","label":"Hauswein 0,1 l","quantity":"0.1l"},{"type":"beer","label":"Helles","quantity":"0.3l"},{"type":"soft","label":"Softdrink","quantity":"1"}]'::jsonb,
  '1', '1 Getränk p.P.', '1 drink p.p.', true, true, 1),
('d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3', 'water',  'Wasser', 'Water', '[]'::jsonb, NULL, 'inkl.', 'incl.', false, true, 2),
('d8cfcf08-9997-4f0a-8a3c-cc598dd11ce3', 'coffee', 'Espresso', 'Espresso', '[]'::jsonb, '1', '1 p.P.', '1 p.p.', false, true, 3);

-- 7. TRADIZIONE – courses
INSERT INTO public.package_course_config (package_id, course_type, course_label, course_label_en, is_required, is_custom_item, custom_item_name, custom_item_name_en, custom_item_description, sort_order) VALUES
('dea69975-21ee-4957-956c-fbe2fd300803', 'starter', 'Antipasto misto', 'Antipasto misto', true, true,
  'Vitello Tonnato oder Burrata auf Tomatenspiegel mit Babyspinat und selbstgemachtes Steinofenbrot',
  'Vitello Tonnato or burrata on tomato with baby spinach and homemade stone-oven bread', NULL, 1),
('dea69975-21ee-4957-956c-fbe2fd300803', 'pasta',   'Primo (Wahl)', 'Primo (choice)', true, true,
  'Tagliatelle al Ragù oder Ravioli Ricotta & Steinpilze oder Risotto mit Edelpilzen',
  'Tagliatelle al Ragù or ravioli ricotta & porcini or risotto with mushrooms', NULL, 2),
('dea69975-21ee-4957-956c-fbe2fd300803', 'main',    'Secondo (Wahl)', 'Secondo (choice)', true, true,
  'Dorade Royal vom Grill mit Thymian-Lime-Sauce und Ratatouille, Saltimbocca alla Romana mit Ofenkartoffeln oder Parmigiana di Melanzane (vegetarisch)',
  'Grilled dorade royal with thyme-lime sauce and ratatouille, saltimbocca alla romana with oven potatoes or parmigiana di melanzane (vegetarian)', NULL, 3),
('dea69975-21ee-4957-956c-fbe2fd300803', 'dessert', 'Dessert (Wahl)', 'Dessert (choice)', true, true,
  'Tiramisu, Panna Cotta oder Cannoli Siciliani',
  'Tiramisu, panna cotta or cannoli siciliani', NULL, 4);

-- 8. TRADIZIONE – drinks
INSERT INTO public.package_drink_config (package_id, drink_group, drink_label, drink_label_en, options, quantity_per_person, quantity_label, quantity_label_en, is_choice, is_included, sort_order) VALUES
('dea69975-21ee-4957-956c-fbe2fd300803', 'main_drink', 'Wein', 'Wine', '[]'::jsonb, '0.5l', '½ l p.P.', '½ l p.p.', false, true, 1),
('dea69975-21ee-4957-956c-fbe2fd300803', 'water',  'Wasser', 'Water', '[]'::jsonb, NULL, 'inkl.', 'incl.', false, true, 2),
('dea69975-21ee-4957-956c-fbe2fd300803', 'coffee', 'Espresso', 'Espresso', '[]'::jsonb, '1', '1 p.P.', '1 p.p.', false, true, 3);
