

# LexOffice-PDF: erst auf Knopfdruck laden (statt Auto-Fetch)

## Befund

In `OfferSendPreview.tsx` (Block 3 „LexOffice-Angebot (PDF)") läuft der PDF-Effekt **automatisch beim Laden der Vorschau-Seite**:

- Zeile 174–233: `useEffect` triggert direkt, sobald `inquiry` geladen ist.
- Wenn keine `lexoffice_quotation_id` existiert → ruft `create-event-quotation` auf → **erzeugt eine LexOffice-Quotation** (kostenpflichtige API-Action, erscheint in LexOffice).
- Danach `get-lexoffice-document` → lädt PDF als Blob.

**Problem aus CX-Sicht:** Jeder Aufruf der Vorschau-Seite — auch ein versehentlicher Klick, ein Reload, oder ein Vorschau-Aufruf bevor die Menüauswahl wirklich finalisiert ist — erzeugt einen LexOffice-Beleg. Der Admin verliert die Kontrolle. Der Wunsch des Users ist genau richtig: PDF erst dann generieren, wenn er explizit „los" sagt.

## Lösung — Block 3 wird explizit Button-getriggert

**Eine Datei:** `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx`

### 1. Auto-Fetch entfernen, manuelle Trigger-Funktion

- Den Auto-`useEffect` für PDF-Load (Zeile 174–233) **streichen**.
- Logik in eine separate `loadLexofficePdf()`-Funktion umziehen — identischer Inhalt (Lazy-Create + get-lexoffice-document), nur jetzt manuell aufrufbar.
- Cleanup (URL.revokeObjectURL) bleibt im Component-Unmount-Effect für `pdfBlobUrl`.

### 2. Block-3-UI: drei Zustände

| Zustand | Anzeige |
|---|---|
| **Initial** (kein `pdfBlobUrl`, nicht gerade ladend, kein Fehler) | Großer Button **„PDF generieren"** (`FileText`-Icon), darunter Erklärtext: „Erstellt das LexOffice-Angebot und lädt das PDF zur Vorschau. Aktion erst nach finaler Menü-Auswahl ausführen." |
| **Laden** | Spinner + „PDF wird erstellt und geladen…" (unverändert, plus expliziter Hinweis dass eine Quotation in LexOffice angelegt wird falls noch keine existiert) |
| **Erfolg** | Iframe wie bisher, **plus „PDF neu laden"-Link** im Header (für den Fall dass die Quotation extern aktualisiert wurde) |
| **Fehler** | Fehlertext + **„Erneut versuchen"-Button** |

### 3. „PDF bereits vorhanden" — Smart-Default

Wenn `inquiry.lexoffice_quotation_id` **bereits gesetzt** ist (Quotation existiert schon, z. B. weil zuvor schon ein Angebot versendet oder die Vorschau schon einmal generiert wurde), zeigen wir initial trotzdem den Button — aber mit Label **„Vorhandenes LexOffice-PDF laden"** statt „PDF generieren". Auf diese Weise:

- Kein automatischer Netzwerk-Roundtrip.
- Kein Risiko einer unbeabsichtigten neuen Quotation.
- Admin entscheidet pro Vorschau-Besuch ob er das PDF sehen will.

### 4. Action-Bar unten unverändert

Die sticky Send-Buttons („Zurück", „Test senden", „Endgültig senden") werden **nicht** vom PDF-Status abhängig gemacht. Senden bleibt unabhängig möglich, weil:

- Der eigentliche Versand in `send-offer-email` läuft, die holt sich das PDF intern selbst (`fetchLexofficeQuotationPdf`-Pfad).
- Der Admin könnte legitim ohne PDF-Vorschau senden wollen (z. B. wenn er es bereits in LexOffice geprüft hat).

Falls gewünscht später optional: Senden-Buttons disablen bis `pdfBlobUrl` einmal geladen wurde — aber das ist eine andere CX-Diskussion.

### 5. Kein Touch an

- `LivePDFPreview.tsx` — der React-PDF-Live-Preview im Wizard (rein client-seitig, keine LexOffice-Kosten) bleibt wie er ist.
- `OfferArchivePreview.tsx` — Archiv-Ansicht zeigt bereits archivierte URLs, keine Live-Generierung. Keine Änderung nötig.
- Edge Functions (`create-event-quotation`, `get-lexoffice-document`, `download-public-offer-pdf`) — unangetastet.
- Public-Offer-Seite (Kunden-Download) — unangetastet, ist anderer Pfad.

## Geänderte Datei

- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx`
  - Zeile 174–233: Auto-PDF-`useEffect` entfernen.
  - Neuer `loadLexofficePdf` Handler (gleiche Logik, jetzt Funktion).
  - Block 3 UI: Initial-State mit Button, Loading/Error-States, Iframe wie bisher.
  - Cleanup-Effect für Blob-URL bleibt erhalten (separater kleiner useEffect mit `[pdfBlobUrl]` deps).

Keine DB-, Schema-, Edge-Function- oder Type-Änderung. ~30 Zeilen Diff in einer Datei.

## Verifikation

1. **Vorschau ohne vorhandene Quotation öffnen:** Block 3 zeigt Button „PDF generieren" + Erklärtext. Kein Netzwerk-Call zu LexOffice.
2. **Klick auf „PDF generieren":** Spinner, `create-event-quotation` läuft, danach `get-lexoffice-document`, Iframe mit PDF erscheint.
3. **Vorschau mit vorhandener Quotation öffnen:** Button-Label „Vorhandenes LexOffice-PDF laden". Klick → nur `get-lexoffice-document`, keine neue Quotation.
4. **Fehlerfall (z. B. LexOffice down):** Fehlermeldung + „Erneut versuchen"-Button. Status bleibt sauber.
5. **Senden-Buttons** funktionieren unverändert mit oder ohne sichtbares PDF.
6. **Reload der Seite:** keine automatische Quotation-Erstellung mehr.

