## Teil 1 — Service-Laufzettel: Außer-Haus-Adresse + Speisen

### Was wirklich vorhanden ist (DB `v2_events`)

Keine neuen Felder nötig — alles bereits da:
- `location_name`, `location_street`, `location_postal_code`, `location_city`, `location_country`
- `delivery_street`, `delivery_zip`, `delivery_city`, **`delivery_floor`**, **`has_elevator`**
- `location_details` (freier Zugangs-/Notiztext)
- `phone` (Kunden-Telefon)
- `time_slot` (Uhrzeit)

### Was im Service-Laufzettel fehlt

Aktuell zeigt `ServiceSheet.tsx` nur eine Zeile „Ort: …". Wir bauen daraus:

```
LIEFERADRESSE  (nur bei Außer Haus)
─────────────────────────
Hotel Bayerischer Hof
Promenadeplatz 2-6
80333 München, Deutschland
Etage: 3 · Aufzug: ja
Zugang: Hinterhof, Code 4711
Telefon vor Ort: +49 89 123456
maps.google.com/?q=…
```

Plus ein neuer **Speisen-Block**, der die Kurse aus `selectedOption.menuSelection.courses` (bzw. Paket-Kurse) auflistet — Gang, Bezeichnung, Menge — ohne Preise (für Crew relevant).

Wenn `location_type ≠ 'storia'` und keine Adress-Felder gefüllt sind: **rote Warnbox** „⚠ Lieferadresse fehlt — bitte in der Anfrage ergänzen", statt stillem `—`.

### Umsetzung Teil 1

- `PrintInquiry`-Type erweitern um bereits vorhandene Felder: `locationStreet`, `locationZip`, `locationCity`, `locationCountry`, `locationDetails`, `deliveryFloor`, `hasElevator`, `mapsUrl`. (Keine DB-Migration!)
- `fetchPrintData.ts` befüllt aus `v2_events` (Fallback `location_*` → `delivery_*`).
- Neue Komponente `DeliveryAddressBlock` in `sheetParts.tsx` (mehrzeilig, mit Etage/Aufzug-Zeile + Maps-URL).
- Neue Komponente `MenuBlock` in `sheetParts.tsx`: rendert `selectedOption.menuSelection.courses` (Menü-Modus) oder `package.includes_courses` (Paket-Modus) als Liste „Vorspeise — Bruschetta misti — 18 ×" ohne Preise.
- `ServiceSheet.tsx` einbinden: `DeliveryAddressBlock` (nur außer Haus) → `EventBlock` → `MenuBlock` → `EquipmentSection` → `AllergenBlock` (existiert schon, nur einbinden) → `NotesSection`.

## Teil 2 — Personal-Katalog (Equipment-Picker auch für Personal)

Equipment hat schon einen Katalog-Picker („Aus Katalog" → liest `equipment_catalog`). Personal hat keinen → du musst jedes Mal „Kellner / 35 €" frei tippen. Lösung:

- **Neue Tabelle `staff_catalog`** (analog zu `equipment_catalog`):
  - `id`, `name` (z.B. „Servicekraft", „Barkeeper", „Koch", „Spüler", „Fahrer")
  - `default_quantity` (Standardstunden), `price_per_unit` (Stundensatz €)
  - `sort_order`, `is_active`, Standard-Timestamps
  - RLS: nur Staff/Admin lesen+schreiben (gleiche Policies wie `equipment_catalog`)
  - **Seed**: Servicekraft (4 h, 35 €), Barkeeper (4 h, 40 €), Koch (4 h, 50 €), Spüler (4 h, 25 €), Fahrer (2 h, 30 €)
- `InlineServiceEditor.tsx`: den vorhandenen Catalog-Picker-Block nicht mehr nur bei `sectionType === 'equipment'` zeigen, sondern auch bei `staff` — und je nach `sectionType` aus `equipment_catalog` oder `staff_catalog` lesen.

Du kannst dann später Personal-Einträge direkt im Supabase-Editor pflegen (kein extra Settings-UI nötig — du sagtest, du verstehst die Frage nicht; ich gehe davon aus „nicht nötig").

## Geänderte / neue Dateien

- `supabase/migrations/...` — nur **`staff_catalog`** anlegen + seed (keine Spalten auf `v2_events`!)
- `src/integrations/supabase/types.ts` — Auto-Regen
- `src/lib/print/types.ts` — `PrintInquiry` um vorhandene Adress-/Etage-Felder erweitern
- `src/lib/print/fetchPrintData.ts` — neue Felder mappen, `mapsUrl` bauen
- `src/components/admin/refine/print/sheetParts.tsx` — `DeliveryAddressBlock` + `MenuBlock`
- `src/components/admin/refine/print/ServiceSheet.tsx` — neue Blöcke + Adress-Warnbanner einbinden
- `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineServiceEditor.tsx` — Catalog-Picker auch für `staff`

Keine Änderungen an Offer-Versionierung, RLS, Stripe-/Confirm-Flows oder dem Inquiry-Editor selbst.