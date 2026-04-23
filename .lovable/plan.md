

# Letzte 2 Schritte: OfferHistoryList einbinden + PublicOffer Archiv-Modus absichern

## Schritt 1 — `OfferHistoryList` in `SmartInquiryEditor` einbinden

Im Angebot-Tab (`OfferBuilder`-Bereich), direkt **nach** dem OfferBuilder-Block:

```tsx
import { OfferHistoryList } from "./OfferHistoryList";
// …
<OfferBuilder … />
<OfferHistoryList inquiryId={id!} />
```

- Wird nur gerendert wenn `id` vorhanden.
- Component zeigt automatisch leeren State („Es wurde noch kein Angebot versendet"), solange noch keine History existiert — kein zusätzliches Conditional-Rendering nötig.

## Schritt 2 — `PublicOffer` Archiv-Modus: interaktive Elemente disablen

In `src/pages/PublicOffer.tsx`:

1. **Archiv-Modus erkennen**: `const isArchiveMode = searchParams.get('archive_version') !== null;`
2. **Top-Banner** (nur wenn `isArchiveMode`): orangenes Sticky-Banner oben:
   > „Archiv-Ansicht (v{N}) · Diese Version wurde am {sentAt} versendet. Interaktive Aktionen sind deaktiviert."
3. **Aktionen disablen**:
   - Wrapper um den „Auswahl absenden / Jetzt zahlen"-Bereich: `<div className={isArchiveMode ? "pointer-events-none opacity-60 select-none" : ""}>`
   - Zusätzlich Button-Props: `disabled={isArchiveMode || existingDisabled}` als Defense-in-Depth.
   - Stripe-Payment-Links sind im Snapshot bewusst leer geklont, also greift dort nichts ungewolltes.
4. **Response-Form** (E-Mail-Copy-Request) ebenfalls in den disabled-Wrapper.
5. **Server-Side-Schutz** bleibt: bestehende Check `isArchiveAdminAuthorized` lädt Snapshot nur für Admin/Staff — kein Endkunde sieht den Archiv-Link.

## Live-Test (nach Implementierung)

An echter Inquiry mit ≥1 versendetem Angebot:

1. **SmartInquiryEditor** öffnen → Angebot-Tab → unter OfferBuilder erscheint Versions-Liste mit „v1 · Aktuell".
2. „Ansehen" → öffnet `/admin/events/:id/archive/1` → 3 Blöcke (Email + Public-Offer-Iframe + LexOffice-PDF) sichtbar, Banner „Schreibgeschützt".
3. Im iframe Block 2: Public-Offer-Seite zeigt Archiv-Banner oben, „Auswahl absenden" ist disabled (visuell ausgegraut, klick-blockiert).
4. „Als neues kopieren" → Bestätigungsdialog → bestätigen → zurück im Editor sind die Snapshot-Optionen als neuer Draft sichtbar, alte Live-Options deaktiviert, History v1 unverändert.
5. Edge-Function-Logs: keine Errors auf `download-public-offer-pdf` oder ähnliches im Archiv-Aufruf.

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` — Import + `<OfferHistoryList inquiryId={id!} />` nach OfferBuilder.
- `src/pages/PublicOffer.tsx` — `isArchiveMode`-Flag, Banner, disabled-Wrapper um Aktionsblock + Response-Form.

Keine DB-, Schema-, Edge-Function- oder Type-Änderung. ~30 Zeilen Diff.

