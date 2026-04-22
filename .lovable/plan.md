

# Wizard-Reparatur: 3 Bugs nach Phase-2-Migration

## Befund (Forensik)

Die Phase-2-Migration hat `inquiry_offer_options` von einer Tabelle in eine **VIEW** auf `v2_offer_options` umgewandelt — mit INSTEAD-OF-Triggern für Insert/Update/Delete. Drei Stellen im Code wurden dabei nicht mitgezogen.

### Bug 1 — `42P10: no unique constraint matching ON CONFLICT`

`src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts:208-211`

```ts
await supabase.from('inquiry_offer_options')
  .upsert(rows, { onConflict: 'id' });   // ← scheitert
```

`onConflict` braucht eine echte UNIQUE/PK-Constraint. Auf einer VIEW gibt es die nicht — die Trigger feuern nur auf reinem INSERT bzw. reinem UPDATE. Der Upsert-Pfad muss aufgesplittet werden in „existierende IDs → UPDATE / neue IDs → INSERT".

### Bug 2 — Restaurant-Menü (Mittag/Abend) fehlt in Wizard-Auswahl

Die Restaurant-Daten kommen aus `useRistoranteMenus` und werden in `useCombinedMenuItems` geladen. **Sie sind da** — aber `CourseSelector` filtert in `recommended`-Mode nach `courseConfig.allowed_sources`. Wenn `package_course_config.allowed_sources = ['ristorante']` gesetzt ist, sind die Items vorhanden. Wenn der Admin früher per Toggle „Restaurant"-Tab wählen konnte, ging das. Heute schlägt das fehl, weil:

- `useCombinedMenuItems` prefixt IDs mit `ristorante_<uuid>`
- `MenuItem.source` ist korrekt `'ristorante'`
- ABER: in `WizardConfigurator.tsx:74-85` wird `menuItems` aus `allMenuItems` neu gebaut — die Items kommen durch
- Der eigentliche Verdacht: `package_course_config.allowed_sources` für die existierenden Pakete enthält nur `['catering']` (Default), so dass Restaurant-Items rausgefiltert werden. **Vor der Migration** wurden die Restaurant-Menüs evtl. über einen anderen Weg angezeigt (Tasting-Menüs aus `fetch-ristorante-complete-menus`).

→ Verifikation per DB-Query, dann zwei mögliche Fixes:
- (a) `allowed_sources` standardmäßig `['catering','ristorante']` setzen, oder
- (b) im `CourseSelector`-Tab „Restaurant" das `allowed_sources`-Filter überschreiben (Admin kann immer aus dem ganzen Pool wählen, Filter ist nur Voreinstellung).

Empfehlung: **(b)** — keine Datenmigration nötig, gleiches UX wie früher.

### Bug 3 — Preis im Public Offer nicht übernommen

Drei Ketten-Probleme:

1. **`useMultiOfferState.ts:81`** — beim Laden bestehender Optionen wird `packageName: ''` gesetzt (Kommentar „Will be populated from packages data") — passiert aber nirgends. Folge: `packageNameOverride` im Save ist leer, RPC fällt auf `packages.name` zurück, ok. Aber `totalAmount` wird **nicht** neu berechnet wenn der Admin Gästezahl ändert.
2. **`WizardConfigurator.tsx:202-219`** — `totalAmount` wird ausschließlich bei `handlePackageChange` neu kalkuliert. Wenn der Admin nur `guestCount` ändert oder eine Position in `option.guestCount` setzt, bleibt `totalAmount` auf dem alten Wert hängen → DB speichert alten Preis → Public Offer zeigt alten Preis.
3. **RPC `get_public_offer`** liest `ioo.total_amount` direkt. Was in der DB steht, wird angezeigt — also liegt die Wurzel beim Speichern (Bug 3.2).

Fix: Single Source of Truth einführen — eine `useMemo`/Effect-Kombination, die `totalAmount` aus `(packagePrice, guestCount, pricePerPerson)` ableitet und bei Änderungen aktualisiert.

---

## Plan: Reparatur in drei sauberen Schritten

### Schritt 1 — DB-Forensik (read-only, vorab)

```sql
-- a) allowed_sources der aktiven Pakete prüfen
SELECT p.name, pcc.course_label, pcc.allowed_sources
FROM packages p
JOIN package_course_config pcc ON pcc.package_id = p.id
WHERE p.is_active = true
ORDER BY p.name, pcc.sort_order;

-- b) Letzte 5 Optionen: stimmt total_amount mit guest_count × packages.price überein?
SELECT v.id, v.option_label, v.guest_count, v.amount_total,
       p.name, p.price, p.price_per_person,
       (CASE WHEN p.price_per_person THEN p.price * v.guest_count ELSE p.price END) AS expected
FROM v2_offer_options v
LEFT JOIN packages p ON p.id = v.package_id
ORDER BY v.created_at DESC LIMIT 5;
```

### Schritt 2 — Bug 1 fixen (`useOfferBuilder.ts`)

Den `upsert(...,{onConflict:'id'})`-Block (Zeilen ~207-212) ersetzen durch:

```ts
const existingForUpdate = rows.filter(r => existingIds.has(r.id));
const newForInsert = rows.filter(r => !existingIds.has(r.id));

for (const row of existingForUpdate) {
  const { error } = await supabase
    .from('inquiry_offer_options')
    .update(row).eq('id', row.id);
  if (error) throw error;
}
if (newForInsert.length > 0) {
  const { error } = await supabase
    .from('inquiry_offer_options')
    .insert(newForInsert);
  if (error) throw error;
}
```

Die existierenden View-Trigger machen den Rest (Mapping auf `v2_offer_options`).

### Schritt 3 — Bug 2 fixen (`CourseSelector.tsx`)

Im Source-Tab-Filter (Zeilen ~104-107): wenn der Admin explizit einen `activeSource`-Tab wählt (z.B. „Restaurant"), den `allowed_sources`-Filter aus Zeile 79-81 **überschreiben** — nicht zusätzlich filtern. Konkret: `allowed_sources`-Filter nur greifen lassen, wenn `activeSource === 'all'`.

Außerdem: alle drei Tabs („Alle", „Catering", „Restaurant") immer sichtbar machen, unabhängig von `allowed_sources.length`. `allowed_sources` ist dann nur noch die Default-Vor­auswahl, kein Hard-Filter.

### Schritt 4 — Bug 3 fixen (Preis-Synchronisation)

In `WizardConfigurator.tsx`: einen `useEffect` ergänzen, der bei Änderung von `option.packageId`, `option.guestCount` oder `selectedPackage.price` den `totalAmount` neu berechnet und `onUpdateOption({ totalAmount })` aufruft — aber nur, wenn der berechnete Wert vom aktuellen abweicht (kein Endlos-Loop).

Zusätzlich in `useMultiOfferState.ts` beim Initial-Load der bestehenden Optionen `packageName` aus dem `packages`-Array auflösen (wird via Prop reingereicht — aktuell nicht erreichbar, deshalb `packageName: ''`). Lösung: `packageName` einfach leer lassen (RPC bevorzugt sowieso `packages.name`), aber **eine Re-Sync-Routine** beim Mount: für jede Option ohne `totalAmount` oder mit `totalAmount === 0` den Preis aus dem zugehörigen Package neu berechnen.

### Schritt 5 — Verifikation

1. Build muss grün sein.
2. Im Wizard ein Paket wählen → Gäste hochstellen → Total ändert sich live → Speichern wirft keinen 42P10-Fehler.
3. „Restaurant"-Tab in CourseSelector zeigt Speisekarten-Items (Mittag/Abend) auch bei Paketen mit `allowed_sources=['catering']`.
4. Im PublicOffer (Slug-URL) erscheint der korrekte `total_amount` aus DB.
5. SQL-Stichprobe nach Save: `SELECT amount_total FROM v2_offer_options WHERE event_id = '<inquiryId>'` zeigt erwarteten Preis.

---

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts` (Bug 1, ~10 Zeilen)
- `src/components/admin/refine/InquiryEditor/MenuComposer/CourseSelector.tsx` (Bug 2, ~5 Zeilen Filter-Logik)
- `src/components/admin/refine/InquiryEditor/MultiOffer/WizardConfigurator.tsx` (Bug 3, +1 useEffect)
- `src/components/admin/refine/InquiryEditor/MultiOffer/useMultiOfferState.ts` (Bug 3, Re-Sync beim Load)

Keine DB-Migration, keine RLS-Änderung, keine RPC-Änderung. Reine Frontend-Reparatur, die die bereits korrekt arbeitenden View-Trigger nutzt.

