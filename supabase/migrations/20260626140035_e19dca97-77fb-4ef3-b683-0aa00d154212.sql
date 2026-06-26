-- =====================================================================
-- Multi-Tenant Umbau — Phase 4: tenants.email_from_name
-- =====================================================================
-- Der kundenseitige Absender-Anzeigename (z.B. "STORIA Events") ist NICHT
-- identisch mit brand_name (Admin-/Produktmarke "StoriaMaestro"). Eigene
-- Spalte, damit ausgehende Mails pro Mandant den richtigen From-Namen tragen.
--
-- NON-BREAKING: additive Spalte (NULLABLE). Storia-Wert = bisheriger
-- Hardcode "STORIA Events" → From-Anzeige bleibt byte-identisch.
-- Einspielen über Lovable.
-- =====================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS email_from_name text;

UPDATE public.tenants
  SET email_from_name = 'STORIA Events'
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND email_from_name IS NULL;