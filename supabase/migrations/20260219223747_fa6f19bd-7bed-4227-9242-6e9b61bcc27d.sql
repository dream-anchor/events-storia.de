-- Bestehenden CHECK entfernen (falls vorhanden)
ALTER TABLE inquiry_offer_options
  DROP CONSTRAINT IF EXISTS inquiry_offer_options_offer_mode_check;

-- Neuen CHECK mit allen Werten (alt + neu)
ALTER TABLE inquiry_offer_options
  ADD CONSTRAINT inquiry_offer_options_offer_mode_check
  CHECK (offer_mode IN (
    'alacarte', 'partial_menu', 'full_menu',
    'a_la_carte', 'teil_menu', 'fest_menu',
    'menu', 'paket', 'email'
  ));

-- Default für neue Optionen auf 'menu'
ALTER TABLE inquiry_offer_options
  ALTER COLUMN offer_mode SET DEFAULT 'menu';