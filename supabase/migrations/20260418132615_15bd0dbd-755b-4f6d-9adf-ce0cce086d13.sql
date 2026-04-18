-- Add structured location fields to event_inquiries
-- Replaces unstructured `venue` text field with 3-mode location system:
--   storia   = read-only (resolved live from site_settings.business_data)
--   company  = read-only (resolved live from company_* fields)
--   custom   = editable (uses location_* fields)
-- Plus separate company address (for offer/invoice) and optional billing address.
-- The legacy `venue` column is preserved until the migration is verified.

ALTER TABLE public.event_inquiries
  -- Location type + custom location fields
  ADD COLUMN IF NOT EXISTS location_type text DEFAULT 'storia'
    CHECK (location_type IN ('storia', 'company', 'custom')),
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS location_street text,
  ADD COLUMN IF NOT EXISTS location_postal_code text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_country text DEFAULT 'Deutschland',

  -- Company address (for offer recipient & invoice)
  ADD COLUMN IF NOT EXISTS company_street text,
  ADD COLUMN IF NOT EXISTS company_postal_code text,
  ADD COLUMN IF NOT EXISTS company_city text,
  ADD COLUMN IF NOT EXISTS company_country text DEFAULT 'Deutschland',

  -- Optional separate billing address
  ADD COLUMN IF NOT EXISTS billing_address_different boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_company_name text,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'Deutschland';

-- Backfill existing rows from legacy `venue` field
-- Match "Karl.?str" (Karlstr, Karlstrasse, Karlstraße) → storia
-- Match "Storia" / "Ristorante" → storia
-- Everything else with a venue → custom (street stored, rest null for user to fill)
-- Empty venue → default 'storia' (already applied via column default)
UPDATE public.event_inquiries
SET location_type = 'storia'
WHERE location_type IS NULL
  AND (
    venue ~* 'karl.?str'
    OR venue ~* 'storia'
    OR venue ~* 'ristorante'
  );

UPDATE public.event_inquiries
SET location_type = 'custom',
    location_street = venue
WHERE location_type IS NULL
  AND venue IS NOT NULL
  AND venue <> '';

-- Anything still null → storia (default)
UPDATE public.event_inquiries
SET location_type = 'storia'
WHERE location_type IS NULL;