## Ziel

Jede Änderung an Bestellungen, Anfragen und Buchungen (Adresse, Datum, Uhrzeit, Gäste, Zahlung, Lieferung, Status, Beträge, Notizen …) erscheint **sofort und in Klartext** im Tab „Aktivitäten" der Timeline – chronologisch, mit Name + Initialen des bearbeitenden Mitarbeiters, ohne technische JSON-Diffs.

Heute schreibt nur ein kleiner Teil der Edge Functions in `activity_logs`. Direkte Feldänderungen im Editor (z. B. Adresse anpassen, Datum verschieben, Zahlungsmethode umstellen) werden **nicht** geloggt – genau das wird behoben.

---

## Lösung in 3 Bausteinen

### 1. DB-Trigger als Single Source of Truth (Backend)

Eine neue Postgres-Funktion `log_entity_changes()` läuft als `AFTER UPDATE`-Trigger auf den drei Kerntabellen:

- `event_inquiries` (Entity-Typ `inquiry`)
- `event_bookings`  (Entity-Typ `booking`)
- `catering_orders` (Entity-Typ `order`)

Pro relevanter Feldänderung wird **eine** Zeile in `activity_logs` geschrieben mit:

- `action = 'field_changed'`
- `metadata.field` = technischer Feldname
- `metadata.label` = deutsches Klartext-Label („Veranstaltungsdatum", „Lieferadresse", „Gäste", „Zahlungsmethode" …)
- `metadata.old_display` / `metadata.new_display` = bereits formatierter, lesbarer Wert (Datum als `15.05.2026`, Betrag als `1.250,00 €`, Adresse als Einzeiler, Bool als „Ja/Nein")
- `metadata.group` = Sammel-Kategorie (`address`, `schedule`, `payment`, `delivery`, `guests`, `contact`, `notes`, `status`, `amount`)
- `actor_id` / `actor_email` aus `auth.uid()` bzw. JWT-Claim (Fallback: „System")

Adress- und Mehrfeld-Änderungen (Straße + PLZ + Stadt) werden **zusammengefasst** zu einem Log-Eintrag „Lieferadresse geändert" mit Vorher/Nachher als einzeilige Adresse – nicht 3 separate Zeilen.

Felder-Whitelist (alles andere wird ignoriert, damit kein Rauschen entsteht):

```text
schedule : event_date, event_end_date, event_time, time_slot, desired_date, desired_time
guests   : guest_count
address  : delivery_street/zip/city/floor/has_elevator  → "Lieferadresse"
           billing_street/zip/city/country/name/company → "Rechnungsadresse"
           location_name/street/postal_code/city        → "Veranstaltungsort"
contact  : customer_name, customer_email, customer_phone, contact_name, company_name
payment  : payment_method, payment_status, payment_type, deposit_percent,
           paid_amount, remaining_amount
delivery : is_pickup, delivery_time_slot, delivery_cost
amount   : total_amount
status   : status, offer_phase, menu_confirmed
notes    : internal_notes, notes, cancellation_reason
```

### 2. Edge-Function-Logs vereinheitlichen

Die bestehenden manuellen `activity_logs`-Inserts (Storno, Stripe-Webhook, LexOffice, Invite, Balance-Link …) bleiben unverändert – sie liefern bereits sprechende Actions. Wir ergänzen lediglich konsistente `metadata.label`-Felder, wo sie noch fehlen, damit die Timeline einheitlich rendert.

### 3. Timeline-Renderer aufpolieren (Frontend)

`src/hooks/useActivityLog.ts` + `src/components/admin/shared/Timeline.tsx`:

- Neuer Formatter für `action = 'field_changed'`:  
  `„{label} geändert: {old_display} → {new_display}"` (z. B. „Veranstaltungsdatum geändert: 15.05.2026 → 22.05.2026").
- Eigene Icons + Farben pro `metadata.group` (Adresse = MapPin/blau, Zahlung = CreditCard/grün, Termin = Calendar/amber, Gäste = Users, Lieferung = Truck, Status = ArrowRightLeft, Notiz = StickyNote).
- **Smart Grouping im UI**: Mehrere `field_changed`-Events desselben Bearbeiters innerhalb von 60 Sekunden werden visuell zu einem Block zusammengefasst („Antoine Monot (AM) hat 3 Felder geändert · vor 2 Min.") – aufklappbar mit Detail-Liste. Datenbank-Einträge bleiben einzeln.
- Avatar/Initialen über bestehendes `getAdminInitials()` aus `adminDisplayNames.ts`.
- Kein JSON, kein `old_value`/`new_value`-Dump mehr sichtbar – nur die `*_display`-Strings.

---

## Verifikation

1. Adresse einer Bestellung im `CateringOrderEditor` ändern → genau ein Eintrag „Lieferadresse geändert: alte Adresse → neue Adresse" erscheint in der Timeline.
2. Datum + Gäste + Zahlungsmethode in einer Anfrage in einem Save ändern → drei einzelne Klartext-Einträge, im UI als ein Block des aktuellen Admins zusammengefasst.
3. Bestehende Edge-Function-Events (Stornierung, Stripe-Zahlung, Angebot v2) erscheinen unverändert mit ihren bisherigen Icons und Texten.
4. Keine Logs bei reinen Auto-Updates wie `updated_at`, `last_edited_at`, `current_offer_version` u. ä. (sind nicht in der Whitelist).

---

## Technische Details (für später)

- Migration: `create or replace function public.log_entity_changes()` + 3 Trigger `AFTER UPDATE ON ...` + Hilfsfunktion `public.format_address(...)` für einzeilige Adress-Strings.
- Funktion `SECURITY DEFINER`, `search_path = public`, Actor aus `auth.uid()` + `auth.jwt() ->> 'email'`, Fallback `'system@events-storia.de'`.
- Mehrfeld-Address-Diff: pro Gruppe (`delivery_*`, `billing_*`, `location_*`) ein Eintrag, wenn mindestens ein Feld der Gruppe sich geändert hat.
- Anschließend `useActivityLog.ts` um `field_changed`-Formatter, neue Icons in `Timeline.tsx`, und Group-by-Author-Window (60 s) in der `useMemo`-Aggregation der Timeline ergänzen.
- `ActivityLog`-Type in `src/components/admin/shared/types.ts` um optionale `metadata.label / old_display / new_display / group / field` erweitern.
