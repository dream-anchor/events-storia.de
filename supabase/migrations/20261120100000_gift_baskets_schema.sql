-- ═══════════════════════════════════════════════════════════════════════════
-- Geschenkkorb-Shop, Teil 1/3: Schema (expand-only, nichts Bestehendes wird angefasst)
-- Bauplan: docs/KONZEPT-geschenkkoerbe-shop.md (§ 3.1, Entscheidungen Antoine 20.11.2026)
-- Reihenfolge: 1 Schema -> 2 RPCs -> 3 Seed. Einspielen durch Lovable.
--
-- Zugriff: Öffentlich (anon) KEIN direkter Tabellenzugriff, nur über die RPCs
-- gift_public_catalog() / gift_public_settings() (Migration 2). Schreiben tun
-- die Edge Functions mit Service-Role, das Admin-Panel mit Rolle admin/staff.
-- Beträge immer in Cent (integer, brutto).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Körbe ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_baskets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  size_key text NOT NULL,                       -- klein | mittel | gross (Deep-Link ?korb=)
  name_de text NOT NULL,
  name_en text NOT NULL,
  description_de text,
  description_en text,
  packaging_de text,                            -- z. B. "Weidenkorb mit Geschenkfolie und Schleife"
  packaging_en text,
  image_url text,
  price_cents integer NOT NULL CHECK (price_cents > 0),   -- brutto, inkl. Wein
  -- Aufteilung Steuersätze, legt der Steuerberater fest (Entscheidung 5 im Bauplan).
  -- Form: [{"rate":7,"share_bp":6000},{"rate":19,"share_bp":4000}], Summe share_bp = 10000.
  -- NULL = noch nicht festgelegt -> Rechnung darf nicht automatisch erzeugt werden.
  vat_split jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT false,        -- Livegang erst nach LMIV + Rechtstexten
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Weinvarianten (Bestand je Korb + Wein) + LMIV des Weins ────────────────
CREATE TABLE IF NOT EXISTS public.gift_basket_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.gift_baskets(id) ON DELETE CASCADE,
  key text NOT NULL,                            -- Deep-Link ?wein=
  label_de text NOT NULL,
  label_en text NOT NULL,
  image_url text,                               -- optional abweichendes Foto je Wein
  stock_qty integer NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  price_delta_cents integer NOT NULL DEFAULT 0 CHECK (price_delta_cents = 0),  -- derzeit kein Aufpreis
  -- LMIV (Art. 14 LMIV, Fernabsatz); leer bis Etikettenfotos abgetippt sind
  net_content text,                             -- "0,75 l"
  abv_percent numeric(4,1),                     -- Vol.-%
  bottler text,                                 -- Abfüller / Lebensmittelunternehmer
  origin text,
  contains_sulfites boolean NOT NULL DEFAULT true,
  lmiv_verified_at timestamptz,                 -- gesetzt, wenn gegen Etikett gegengelesen
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basket_id, key)
);
CREATE INDEX IF NOT EXISTS gift_basket_variants_basket_idx ON public.gift_basket_variants (basket_id);

-- ── Bestandteile je Korb (LMIV je Bestandteil) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_basket_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id uuid NOT NULL REFERENCES public.gift_baskets(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name_de text NOT NULL,
  name_en text NOT NULL,
  quantity text,
  ingredients_de text,
  ingredients_en text,
  allergens text[] NOT NULL DEFAULT '{}',       -- die 14 LMIV-Allergene, Schlüssel englisch (gluten, milk, ...)
  net_content text,
  food_business_operator text,
  origin text,
  label_photo_ref text,                         -- Verweis auf Etikettenfoto (intern)
  lmiv_verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gift_basket_components_basket_idx ON public.gift_basket_components (basket_id);

-- ── Einstellungen (genau 1 Zeile) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  origin_label text NOT NULL DEFAULT 'Karlstraße 47a, 80333 München',
  origin_lat numeric(9,6) NOT NULL DEFAULT 48.1431,
  origin_lng numeric(9,6) NOT NULL DEFAULT 11.5606,
  -- Taxitarif, einfache Strecke, anteilig je Staffel (Entscheidung 6):
  -- erste 7 km 2,70 EUR/km, nur Mehr-km 2,50 EUR/km
  tariff_tiers jsonb NOT NULL DEFAULT '[{"from_km":0,"per_km_cents":270},{"from_km":7,"per_km_cents":250}]'::jsonb,
  min_fee_cents integer NOT NULL DEFAULT 590,
  round_up_to_cents integer NOT NULL DEFAULT 100,
  delivery_vat_rate numeric(4,1) NOT NULL DEFAULT 19,   -- Steuerberater bestätigen
  pickup_lead_minutes integer NOT NULL DEFAULT 30,      -- Packzeit bei Abholung "sofort"
  delivery_lead_days integer NOT NULL DEFAULT 1,
  -- Abholzeiten je Wochentag (0 = Sonntag ... 6 = Samstag); Beispiel {"1":{"open":"11:30","close":"22:00"}}
  -- Fehlt ein Wochentag, ist an diesem Tag keine Abholung möglich.
  pickup_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_windows jsonb NOT NULL DEFAULT '[{"key":"vormittag","label_de":"Vormittag (9-13 Uhr)","label_en":"Morning (9am-1pm)"},{"key":"nachmittag","label_de":"Nachmittag (13-18 Uhr)","label_en":"Afternoon (1pm-6pm)"}]'::jsonb,
  hold_minutes integer NOT NULL DEFAULT 35,             -- Stripe-Session 30 Min + Puffer
  order_notify_email text NOT NULL DEFAULT 'info@events-storia.de',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.gift_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Sperrtage ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  handover text NOT NULL DEFAULT 'both' CHECK (handover IN ('pickup','delivery','both')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, handover)
);

-- ── Bestellungen ───────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.gift_order_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.gift_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE
    DEFAULT ('GK-' || to_char(now() AT TIME ZONE 'Europe/Berlin', 'YY') || '-' || lpad(nextval('public.gift_order_number_seq')::text, 5, '0')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reserved','paid','ready','handed_over','cancelled','expired')),
  payment_method text NOT NULL DEFAULT 'online' CHECK (payment_method IN ('online','on_site')),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  handover text NOT NULL CHECK (handover IN ('pickup','delivery')),
  handover_date date NOT NULL,
  handover_time text,                           -- Abholzeit "HH:MM" bzw. Lieferfenster-Key
  delivery_street text,
  delivery_zip text,
  delivery_city text,
  delivery_note text,
  distance_km numeric(6,2),
  delivery_fee_cents integer NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  delivery_vat_rate numeric(4,1),
  items_total_cents integer NOT NULL CHECK (items_total_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  vat_breakdown jsonb,
  gift_message text,
  age_confirmed_at timestamptz,
  agb_accepted_at timestamptz,
  agb_version text,
  language text NOT NULL DEFAULT 'de' CHECK (language IN ('de','en')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  handed_over_at timestamptz,
  cancelled_at timestamptz,
  confirmation_sent_at timestamptz,
  expiry_mail_sent_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  lexoffice_invoice_id text,
  internal_note text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (handover <> 'delivery' OR (delivery_street IS NOT NULL AND delivery_zip IS NOT NULL AND delivery_city IS NOT NULL)),
  CHECK (gift_message IS NULL OR char_length(gift_message) <= 500)
);
CREATE UNIQUE INDEX IF NOT EXISTS gift_orders_stripe_session_uidx ON public.gift_orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gift_orders_status_date_idx ON public.gift_orders (status, handover_date);

CREATE TABLE IF NOT EXISTS public.gift_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.gift_orders(id) ON DELETE CASCADE,
  basket_id uuid NOT NULL REFERENCES public.gift_baskets(id),
  variant_id uuid NOT NULL REFERENCES public.gift_basket_variants(id),
  qty integer NOT NULL CHECK (qty BETWEEN 1 AND 20),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  vat_split jsonb,
  basket_name text NOT NULL,                    -- Snapshots
  variant_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gift_order_items_order_idx ON public.gift_order_items (order_id);

-- ── Bestand-Reservierungen ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_stock_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.gift_orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.gift_basket_variants(id),
  qty integer NOT NULL CHECK (qty > 0),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gift_stock_holds_variant_idx ON public.gift_stock_holds (variant_id, status);
CREATE INDEX IF NOT EXISTS gift_stock_holds_order_idx ON public.gift_stock_holds (order_id);

-- ── Bestands-Protokoll (Audit) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_stock_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.gift_basket_variants(id),
  delta integer NOT NULL,
  reason text NOT NULL,                         -- consume | manual | restock_after_cancel
  order_id uuid REFERENCES public.gift_orders(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── updated_at-Trigger ─────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gift_baskets','gift_basket_variants','gift_basket_components','gift_settings','gift_orders','gift_stock_holds']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t || '_updated_at', t);
  END LOOP;
END $$;

-- ── RLS + GRANTs ───────────────────────────────────────────────────────────
-- anon: nichts. authenticated: nur über Policies (admin/staff). service_role: alles.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gift_baskets','gift_basket_variants','gift_basket_components','gift_settings',
                           'gift_blackout_dates','gift_orders','gift_order_items','gift_stock_holds','gift_stock_log']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.gift_order_number_seq TO service_role;

-- Katalog + Sperrtage: Admin und Staff dürfen alles
CREATE POLICY "gift_baskets admin staff" ON public.gift_baskets FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_basket_variants admin staff" ON public.gift_basket_variants FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_basket_components admin staff" ON public.gift_basket_components FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_blackout_dates admin staff" ON public.gift_blackout_dates FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
-- Einstellungen: Staff lesen, nur Admin schreibt
CREATE POLICY "gift_settings read" ON public.gift_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_settings admin write" ON public.gift_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Bestellungen: Admin/Staff lesen und ändern (Status, Notiz); Anlegen/Löschen nur Service-Role
CREATE POLICY "gift_orders read" ON public.gift_orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_orders update" ON public.gift_orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_order_items read" ON public.gift_order_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_stock_holds read" ON public.gift_stock_holds FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "gift_stock_log read" ON public.gift_stock_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- Schreibrechte einschränken (Grants oben sind großzügig, Policies sind die Sperre):
REVOKE INSERT, DELETE ON public.gift_orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gift_order_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gift_stock_holds FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gift_stock_log FROM authenticated;
REVOKE INSERT, DELETE ON public.gift_settings FROM authenticated;
-- Bestand wird im Admin nur über gift_adjust_stock() geändert (Protokoll), nicht per UPDATE/INSERT auf stock_qty.
-- Spaltenrechte wirken nur, wenn das Tabellenrecht entfernt ist:
REVOKE INSERT, UPDATE ON public.gift_basket_variants FROM authenticated;
GRANT INSERT (id, basket_id, key, label_de, label_en, image_url, price_delta_cents, net_content, abv_percent,
              bottler, origin, contains_sulfites, lmiv_verified_at, sort_order, active, deleted_at)
  ON public.gift_basket_variants TO authenticated;
GRANT UPDATE (basket_id, key, label_de, label_en, image_url, price_delta_cents, net_content, abv_percent,
              bottler, origin, contains_sulfites, lmiv_verified_at, sort_order, active, deleted_at)
  ON public.gift_basket_variants TO authenticated;
