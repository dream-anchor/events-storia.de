## Bestandsaufnahme (read-only, keine Änderungen)

### 1. Edge Function `receive-group-inquiry` — **OK**
- **Existiert & deployed:** `supabase/functions/receive-group-inquiry/index.ts` (plus separate Variante `receive-group-inquiry-webhook` mit `x-webhook-secret` für M2M-Aufrufe).
- **CORS:** Whitelist enthält `ristorantestoria.de` (+ www) und `events-storia.de` (+ www) → Anfrage-Payload von ristorantestoria.de wird akzeptiert.
- **Validierung:** Pflichtfelder `contactName`, `email`, `groupSize`; E-Mail-Regex; Rate-Limit 5 Anfragen / 60 min pro E-Mail.
- **Wohin landen die Daten:**
  - **DB:** `v2_customers` (find-or-create per E-Mail) und `v2_events` (`service_type='group'`, `source='reisegruppen'`, `status='inquiry'`, Felder: `guest_count`, `date`, `arrival_time`, `preferred_menu`, `customer_notes`, `language`, `preferred_date_flexible`, optional `travel_plan_url`).
  - **E-Mails:** Bestätigung an Kundin + Benachrichtigung an `info@events-storia.de` (Resend primary, IONOS-SMTP Fallback); jeder Versand in `email_delivery_logs` protokolliert.
  - **WhatsApp:** fire-and-forget Aufruf von `send-whatsapp-alert`.
  - **Anhänge (Webhook-Variante):** Base64-PDF → Storage-Bucket `group-inquiry-uploads`.

### 2. Supabase-Region — **OK (EU)**
- Pooler-Host: `aws-1-eu-west-1.pooler.supabase.com` → **AWS eu-west-1 (Irland)**. DSGVO-konformer Standort.

### 3. RLS auf Anfrage-/Buchungstabellen — **OK**
Curl-Test mit anon-Key gegen REST-API:
| Tabelle | HTTP | Ergebnis |
|---|---|---|
| `v2_events` | 200 | `[]` (RLS filtert alle Zeilen weg) |
| `v2_customers` | 200 | `[]` (dito) |
| `v2_payments` | 401 | kein anon-Grant |
| `balance_payment_links` | 401 | kein anon-Grant |
| `_legacy_event_bookings` | 401 | kein anon-Grant |
| `_legacy_event_payments` | 401 | kein anon-Grant |
| `_legacy_group_inquiries` | 401 | kein anon-Grant |

- **Keine** `USING (true)`-Policies mehr; alle SELECT/UPDATE/DELETE laufen über `has_role(auth.uid(),'admin'|'staff')`.
- **anon** darf ausschließlich `INSERT` (Formulare): `_legacy_event_inquiries`, `_legacy_group_inquiries`, `v2_events`.
- **Stripe-/Zahlungs-URLs** (`v2_payments.payment_url`, `balance_payment_links.slug`, `_legacy_event_payments.stripe_payment_url`) sind für anon nicht lesbar (401). Kundenzugriff auf Restzahlung läuft serverseitig über Security-Definer-Funktion (in der letzten Migration 24.06. eingeführt).

### 4. Legacy-Muster & Realtime — **OK / kontrolliert**
- `_legacy_*`-Tabellen existieren (Bookings, Payments, Inquiries, Group-Inquiries, Customer-Profiles, Email-Messages, Comments, Tasks, Offer-History/Options, Customer-Responses, Catering-Orders) — **alle mit RLS + Rollen-Policies**, kein offener SELECT.
- `v2_payments`: nur admin/staff (`authenticated`).
- **RLS überall aktiviert:** keine einzige `public.*`-Tabelle ohne RLS.
- **Realtime-Publication** (`supabase_realtime`) enthält: `activity_logs`, `admin_presence`, `daily_audits`, `email_delivery_logs`, `photo_album`, `system_errors`. Alle haben RLS — Realtime erzwingt Policies, anon-Subscriber bekommen nichts ausgeliefert. **Keine PII-Tabelle** (v2_events, v2_payments, balance_payment_links, _legacy_*) ist im Realtime-Publish. → kein „Realtime ohne RLS"-Muster.

### 5. Speicherdauer / Löschroutine eingehender Anfragen — **fehlt**
- **Keine** automatische Löschung / kein TTL-Job für `v2_events` (service_type='group'/Anfragen), `v2_customers`, `email_delivery_logs`, `inquiry_attachments`, Storage-Bucket `group-inquiry-uploads` gefunden.
- Vorhandene Lifecycle-Regeln betreffen nur:
  - Menüdaten: 60-Tage Soft-Delete-Purge (Memory `menu-data-lifecycle`).
  - Supabase-Logs: ~10 min Retention (Plattform-Default, nicht steuerbar ohne Pro-Plan).
- DSGVO-relevant: Löschkonzept / Aufbewahrungsfristen für Anfragedaten, E-Mail-Logs und Anhänge ist **nicht** im Code/Schema verankert. Praktisch werden Daten unbegrenzt vorgehalten, bis ein Mensch sie löscht.

---

### Zusammenfassung
| # | Punkt | Stand |
|---|---|---|
| 1 | Edge Function + Daten-Senke | OK |
| 2 | Region EU (eu-west-1) | OK |
| 3 | RLS Anfragen/Buchungen, Stripe-URLs | OK (anon 401 / leeres Array) |
| 4 | Legacy / Realtime Muster | OK (alles geschlossen) |
| 5 | Speicherdauer / Löschroutine | **fehlt** — Handlungsbedarf für DSGVO-Löschkonzept |

**Empfehlung (zur Diskussion, nicht umgesetzt):** Punkt 5 als Folgeauftrag — Aufbewahrungsfristen definieren (z. B. 24 Monate für nicht konvertierte Anfragen, X Jahre für Buchungen wg. § 147 AO / Art. 17 DSGVO) und einen scheduled Cron-Function-Purge plus Storage-Cleanup einrichten.