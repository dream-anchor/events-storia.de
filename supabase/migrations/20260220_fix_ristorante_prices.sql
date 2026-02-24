-- ============================================================
-- FIX: Ristorante menu_items — price_display → price
-- ============================================================
-- Dieses SQL im RISTORANTE Supabase SQL Editor ausführen
-- (NICHT in events-storia!)
--
-- Schritt 1: Vorschau (DRY RUN)
-- Schritt 2: Update (auskommentiert, manuell aktivieren)
-- ============================================================

-- SCHRITT 1: Betroffene Zeilen anzeigen
SELECT
  id,
  name,
  price,
  price_display,
  -- Parsing-Logik: "14,50 €" → 14.50
  CASE
    WHEN price_display IS NOT NULL THEN
      NULLIF(
        TRIM(REPLACE(REPLACE(REPLACE(price_display, '€', ''), ' ', ''), ',', '.'))::numeric,
        0
      )
    ELSE NULL
  END AS parsed_price
FROM menu_items
WHERE price IS NULL
  AND price_display IS NOT NULL
ORDER BY name;

-- ============================================================
-- SCHRITT 2: Update durchführen (Kommentar entfernen zum Ausführen)
-- ============================================================
/*
UPDATE menu_items
SET price = NULLIF(
  TRIM(REPLACE(REPLACE(REPLACE(price_display, '€', ''), ' ', ''), ',', '.'))::numeric,
  0
)
WHERE price IS NULL
  AND price_display IS NOT NULL
  AND TRIM(REPLACE(REPLACE(REPLACE(price_display, '€', ''), ' ', ''), ',', '.')) ~ '^\d+\.?\d*$';
*/

-- SCHRITT 3: Verifizierung — verbleibende Items ohne Preis
-- SELECT id, name, price, price_display
-- FROM menu_items
-- WHERE price IS NULL
-- ORDER BY name;
