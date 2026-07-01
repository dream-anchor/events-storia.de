## Ziel

Wenn ein Angebot versendet wird (egal ob aus dem OfferBuilder oder aus dem AdminOfferCreate-Wizard heraus), soll die **komplette Angebots-Substanz** unveränderlich pro Version festgehalten werden – nicht nur das Menü. Bearbeitbar im Editor bleibt alles wie bisher; die Versionierung greift erst beim nächsten Versand.

## Was aktuell fehlt

`inquiry_offer_history` speichert heute nur `options_snapshot` (Menü/Positionen/Preise) und `email_content`. Adressen, Zahlungsbedingungen, Kontakt- und Event-Basics leben ausschließlich in `event_inquiries` und werden bei jeder Bearbeitung überschrieben – ältere Versionen im Archiv zeigen deshalb potenziell falsche Adresse / Zahlungsart / Gästezahl.

## Umfang der Änderung

### 1. Datenbank – neue Snapshot-Spalten in `inquiry_offer_history`

Neue `jsonb`-Spalten (nullable, damit alte History-Einträge weiterhin funktionieren):

- `inquiry_snapshot` – Kontakt & Event-Basics: `contact_name, company_name, email, phone, guest_count, event_type, preferred_date, event_end_date, time_slot, customer_language`
- `address_snapshot` – Adressen: `location_type, location_*, company_*, billing_address_different, billing_*`
- `payment_terms_snapshot` – Zahlungsbedingungen: `deposit_percent, deposit_amount, deposit_due_days, offer_validity_days, payment_method, invoice_due_days`

Migration: `ALTER TABLE _legacy_inquiry_offer_history ADD COLUMN ...` + View `inquiry_offer_history` samt `INSTEAD OF INSERT`-Trigger neu erstellen, damit die neuen Spalten in das View-Insert durchgeschleift werden.

### 2. Snapshot beim Versand befüllen

`useOfferBuilder.ts → createNewVersion()`:
Vor dem `insert` in `inquiry_offer_history` einmal die aktuelle Inquiry laden (`select ...` mit den oben genannten Feldern) und die drei Snapshot-Objekte mitschreiben. Damit ist der Snapshot exakt der Zustand im Moment des „Angebot senden“-Klicks.

Gilt genauso für den ersten Versand aus dem AdminOfferCreate-Wizard – dort läuft der Send-Pfad bereits über `createNewVersion`, also erbt er die Erweiterung automatisch.

### 3. Archiv-Ansicht & öffentliche Snapshot-Seite

- `OfferArchivePreview` selbst muss nichts ändern (rendert nur iframes).
- Die öffentliche Angebots-Seite / RPC hinter `?archive_version=N` (siehe Migrationen `add_payment_method_to_public_offer_rpc.sql` u. a.) liest heute Adressen/Zahlungsbedingungen aus `event_inquiries`. Diese RPC wird so angepasst, dass sie – wenn `archive_version` gesetzt ist – die Snapshot-Spalten aus `inquiry_offer_history` bevorzugt und nur bei `NULL` (Alt-Daten) auf die Live-Inquiry zurückfällt.
- `useOfferHistoryVersion` gibt die neuen Snapshot-Felder mit zurück, damit UI-Chips (z. B. „Version v2 · Anzahlung 30 %“) sie nutzen können.

### 4. Editor bleibt voll editierbar

Keine UI-Sperren zusätzlich zur bestehenden Lock-Logik (`offer_sent_at`). Alle Felder – Menü/Preise (OfferBuilder), Zahlungsbedingungen (`PaymentTermsBlock`), Adressen (`LocationBlock`, Firmen-/Rechnungsadresse), Kontakt & Event-Basics (`InquiryDetailsPanel`) – bleiben wie heute editierbar. Der Versand friert den dann aktuellen Stand ein.

### 5. Klonen aus Archiv

`useCloneOfferVersion` erweitern: Beim „Als neues Angebot kopieren“ werden die Snapshot-Felder ebenfalls zurück in `event_inquiries` geschrieben, damit der geklonte Draft mit dem archivierten Adress-/Zahlungs-Stand startet.

### 6. Verifikation

- `tsgo` grün.
- Migration + Trigger im Preview ausführen.
- Manueller Test: Anfrage anlegen → v1 senden → Adresse & Anzahlung ändern → v2 senden → `/admin/inquiries/:id/archive/1` zeigt Alt-Adresse & Alt-Anzahlung, `/archive/2` die neuen Werte.

## Nicht Teil dieses Plans

- Keine neuen „Neue Version erstellen“-Buttons (Versionierung bleibt an den Versand gekoppelt – so vom User gewünscht).
- Kein Umbau des OfferBuilder-Editors selbst (Menü/Preise sind bereits editierbar).
- Keine Änderungen an `_legacy_inquiry_offer_options` – Menü läuft weiter über `options_snapshot`.

## Betroffene Dateien (Vorschau)

- Neue Migration `supabase/migrations/<ts>_offer_history_full_snapshot.sql`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts` (`createNewVersion`)
- `src/hooks/useOfferHistory.ts` / `useCloneOfferVersion.ts`
- Public-Offer-RPC-Migration (Snapshot-Fallback)
- Ggf. `src/pages/public-offer/*` für Anzeige der Snapshot-Werte
