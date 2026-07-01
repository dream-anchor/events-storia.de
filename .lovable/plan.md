## Problem

Der Details-Tab (Event-DNA, Veranstaltungsort, Kontakt & Firma, Rechnungsadresse) ist bei Anfragen mit Status **Bestätigt** komplett gesperrt (`disabled`). Ebenso die Zahlungs-Konditionen im OfferBuilder werden vermutlich durch die gleiche Sperre blockiert.

Ursache in `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx:1025`:

```ts
const isReadOnlyLocked = inquiry.status === 'confirmed' || isSignatureLocked;
```

Sobald `status === 'confirmed'` gesetzt ist, wird `isReadOnly={true}` an `EventDNACard` (und Folgekomponenten) durchgereicht → alle Inputs `disabled`.

Das widerspricht der zuletzt beschlossenen Regel: **Angebote sind editierbar; erst beim Versand einer neuen Version wird ein Snapshot eingefroren.** Die Snapshot-Logik existiert bereits (vorige Runde: `inquiry_snapshot`, `address_snapshot`, `payment_terms_snapshot` in `v2_event_offer_history`).

## Änderung

### 1. Confirmed-Sperre entfernen — Signatur-Sperre bleibt

`SmartInquiryEditor.tsx`:

```ts
// vorher
const isReadOnlyLocked = inquiry.status === 'confirmed' || isSignatureLocked;

// nachher
// Nach unterschriebener Kostenübernahme bleiben signaturrelevante Felder gesperrt.
// "Bestätigt" alleine sperrt nichts mehr — Änderungen erzeugen beim nächsten
// Versand automatisch eine neue Version (Snapshot-Versionierung).
const isReadOnlyLocked = isSignatureLocked;
```

Keine weiteren Änderungen an EventDNACard, LocationBlock, OfferBuilder — die reichen `isReadOnly` bereits transparent durch.

### 2. Verifikation

- `tsgo` grün
- Manueller Test in Browser-Session:
  1. Bestätigte Anfrage öffnen → Details-Tab: Felder sind editierbar
  2. Kontakt/Adresse/Zahlungsart ändern
  3. Neue Angebotsversion senden → Archivseite v_n zeigt geänderte Werte, v_(n-1) zeigt alte Werte
  4. Anfrage mit unterschriebener Kostenübernahme: Felder bleiben gesperrt (Signatur-Lock)

## Nicht Teil dieser Änderung

- Keine neuen "Neue Version"-Buttons (bleibt automatisch beim Versand)
- Keine Änderung an der Snapshot-Logik (bereits letzte Runde implementiert)
- Keine Änderung am Signatur-Lock-Verhalten
