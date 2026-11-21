-- Geschenkkörbe: Mischbestellung (Konzept § 11, Einheit I0). EXPAND-ONLY, rückwärtskompatibel:
--  * gift_orders.catering_order_number: Verknüpfung Korb-Bestellung <-> Catering-Bestellung (nullable)
--  * gift_orders.handover darf zusätzlich 'with_catering' sein (Übergabe zusammen mit dem Catering)
-- Keine Vault-/Secret-Zugriffe, keine Datenänderung, keine Spalte wird entfernt oder umbenannt.
-- Geprüft: keine SQL-Funktion/RPC (gift_open_counts, gift_reserve_stock, Sweep, Ablauf) validiert gift_orders.handover;
-- die Prüfung 'delivery' => Adresse Pflicht bleibt unverändert und trifft 'with_catering' nicht.

ALTER TABLE public.gift_orders ADD COLUMN IF NOT EXISTS catering_order_number text;

COMMENT ON COLUMN public.gift_orders.catering_order_number IS
  'Bestellnummer der zugehörigen Catering-Bestellung (nur handover = with_catering); eine Zahlung, zwei Datensätze.';

CREATE INDEX IF NOT EXISTS gift_orders_catering_order_number_idx
  ON public.gift_orders (catering_order_number) WHERE catering_order_number IS NOT NULL;

-- handover-CHECK erweitern: bestehende (automatisch benannte) Check-Constraint(s) auf handover ersetzen.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.gift_orders'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%handover%IN%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%delivery_street%'
  LOOP
    EXECUTE format('ALTER TABLE public.gift_orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.gift_orders DROP CONSTRAINT IF EXISTS gift_orders_handover_check;
ALTER TABLE public.gift_orders
  ADD CONSTRAINT gift_orders_handover_check CHECK (handover IN ('pickup','delivery','with_catering'));

-- with_catering braucht die Catering-Bestellnummer (NOT VALID: bestehende Zeilen sind unberührt, neue werden geprüft)
ALTER TABLE public.gift_orders DROP CONSTRAINT IF EXISTS gift_orders_with_catering_ref_check;
ALTER TABLE public.gift_orders
  ADD CONSTRAINT gift_orders_with_catering_ref_check
  CHECK (handover <> 'with_catering' OR catering_order_number IS NOT NULL) NOT VALID;
