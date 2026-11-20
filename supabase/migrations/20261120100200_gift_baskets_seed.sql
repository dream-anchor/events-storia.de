-- ═══════════════════════════════════════════════════════════════════════════
-- Geschenkkorb-Shop, Teil 3/3: Seed (3 Körbe, je 2 Weinvarianten)
-- Idempotent (ON CONFLICT DO NOTHING / WHERE NOT EXISTS). Bestand 0, Körbe INAKTIV:
-- Livegang erst, wenn LMIV-Angaben (Etikettenfotos), vat_split (Steuerberater), Abholzeiten
-- und Rechtstexte (AGB-Teil Geschenkkörbe, Widerruf) vorliegen -> dann im Admin aktivieren.
-- Bestandteile ohne LMIV-Felder (leer, lmiv_verified_at NULL).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.gift_baskets (slug, size_key, name_de, name_en, description_de, description_en, packaging_de, packaging_en, image_url, price_cents, sort_order, active)
VALUES
 ('dolce-vita', 'klein', 'STORIA Geschenkkorb „Dolce Vita“', 'STORIA gift basket “Dolce Vita”',
  'Der kleine Geschenkkorb mit Wein und italienischen Spezialitäten.', 'The small gift basket with wine and Italian specialities.',
  'Geschenkkorb mit Geschenkfolie und Schleife', 'Gift basket with gift wrap and bow',
  '/geschenkkoerbe/geschenkkorb-dolce-vita-bianco-toscana.webp', 9900, 1, false),
 ('sapori-d-italia', 'mittel', 'STORIA Geschenkkorb „Sapori d’Italia“', 'STORIA gift basket “Sapori d’Italia”',
  'Der mittlere Geschenkkorb mit Wein und italienischen Spezialitäten.', 'The medium gift basket with wine and Italian specialities.',
  'Weidenkorb mit Geschenkfolie und Schleife', 'Wicker basket with gift wrap and bow',
  '/geschenkkoerbe/geschenkkorb-sapori-d-italia.webp', 13900, 2, false),
 ('gran-selezione', 'gross', 'STORIA Geschenkkorb „Gran Selezione“', 'STORIA gift basket “Gran Selezione”',
  'Der große Geschenkkorb mit Crémant und italienischen Spezialitäten.', 'The large gift basket with crémant and Italian specialities.',
  'Dekorierter Weidenkorb mit Geschenkfolie und Schleife', 'Decorated wicker basket with gift wrap and bow',
  '/geschenkkoerbe/geschenkkorb-gran-selezione.webp', 24900, 3, false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.gift_basket_variants (basket_id, key, label_de, label_en, image_url, net_content, sort_order)
SELECT b.id, v.key, v.label_de, v.label_en, v.image_url, '0,75 l', v.sort_order
  FROM (VALUES
    ('dolce-vita', 'bianco-toscana', 'Bianco Toscana', 'Bianco Toscana', '/geschenkkoerbe/geschenkkorb-dolce-vita-bianco-toscana.webp', 1),
    ('dolce-vita', 'moscato-dasti', 'Moscato d’Asti', 'Moscato d’Asti', '/geschenkkoerbe/geschenkkorb-dolce-vita-moscato-dasti.webp', 2),
    ('sapori-d-italia', 'chianti-classico', 'Chianti Classico', 'Chianti Classico', NULL, 1),
    ('sapori-d-italia', 'barolo', 'Barolo', 'Barolo', NULL, 2),
    ('gran-selezione', 'cremant-rose', 'Crémant Rosé', 'Crémant Rosé', NULL, 1),
    ('gran-selezione', 'cremant-dry', 'Crémant Dry', 'Crémant Dry', NULL, 2)
  ) AS v(basket_slug, key, label_de, label_en, image_url, sort_order)
  JOIN public.gift_baskets b ON b.slug = v.basket_slug
ON CONFLICT (basket_id, key) DO NOTHING;

-- Bestandteile (ohne Wein: der steht je Variante). LMIV-Felder bewusst leer.
INSERT INTO public.gift_basket_components (basket_id, sort_order, name_de, name_en)
SELECT b.id, c.sort_order, c.name_de, c.name_en
  FROM (VALUES
    ('dolce-vita', 1, 'Mini-Panettone al Cioccolato', 'Mini panettone al cioccolato'),
    ('dolce-vita', 2, 'Salame 4 Gnometti', 'Salame 4 Gnometti'),
    ('dolce-vita', 3, 'Trüffelbutter', 'Truffle butter'),
    ('dolce-vita', 4, 'Trüffelöl', 'Truffle oil'),
    ('dolce-vita', 5, 'Strangozzi al Limone', 'Strangozzi al limone'),
    ('sapori-d-italia', 1, 'Panettone, 500 g', 'Panettone, 500 g'),
    ('sapori-d-italia', 2, 'Grana Padano Riserva, 20 Monate gereift', 'Grana Padano Riserva, aged 20 months'),
    ('sapori-d-italia', 3, 'Salamini Piccante', 'Salamini piccante'),
    ('sapori-d-italia', 4, 'Trüffelöl', 'Truffle oil'),
    ('sapori-d-italia', 5, 'Feigen-Senfsoße', 'Fig mustard sauce'),
    ('sapori-d-italia', 6, 'Grüne Oliven', 'Green olives'),
    ('sapori-d-italia', 7, 'Grissini', 'Grissini'),
    ('sapori-d-italia', 8, 'Pasta Tricolore', 'Pasta tricolore'),
    ('gran-selezione', 1, 'Natives Bio-Olivenöl extra', 'Organic extra virgin olive oil'),
    ('gran-selezione', 2, 'Italienisches Salami-Quartett', 'Italian salami quartet'),
    ('gran-selezione', 3, 'Filotea Fettuccine al Tartufo', 'Filotea fettuccine al tartufo'),
    ('gran-selezione', 4, 'Grüne Oliven', 'Green olives'),
    ('gran-selezione', 5, 'Aceto Balsamico di Modena', 'Aceto balsamico di Modena'),
    ('gran-selezione', 6, 'Feigen-Senfsoße', 'Fig mustard sauce'),
    ('gran-selezione', 7, 'Panettone al Cioccolato, 750 g', 'Panettone al cioccolato, 750 g'),
    ('gran-selezione', 8, 'Trüffelbutter', 'Truffle butter'),
    ('gran-selezione', 9, 'Bio-Kräuter-Ursalz', 'Organic herb sea salt'),
    ('gran-selezione', 10, 'Trüffelkäse', 'Truffle cheese'),
    ('gran-selezione', 11, 'Kleine Pralinen', 'Small pralines')
  ) AS c(basket_slug, sort_order, name_de, name_en)
  JOIN public.gift_baskets b ON b.slug = c.basket_slug
 WHERE NOT EXISTS (SELECT 1 FROM public.gift_basket_components x WHERE x.basket_id = b.id);

-- Abholzeiten: PLATZHALTER nach Öffnungszeiten laut Strukturdaten der Website (Mo-Fr ab 09:00, Sa/So ab 12:00);
-- das Ende (Ladenschluss des Abholtags = Ende der Reservierung "vor Ort zahlen") ist VOR LIVEGANG von Antoine zu bestätigen.
UPDATE public.gift_settings
   SET pickup_hours = '{"0":{"open":"12:00","close":"22:00"},"1":{"open":"09:00","close":"22:00"},"2":{"open":"09:00","close":"22:00"},"3":{"open":"09:00","close":"22:00"},"4":{"open":"09:00","close":"22:00"},"5":{"open":"09:00","close":"22:00"},"6":{"open":"12:00","close":"22:00"}}'::jsonb
 WHERE id = 1 AND pickup_hours = '{}'::jsonb;
