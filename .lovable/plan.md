## Ziel
Den großen blauen „Kunden-Rückmeldung eingegangen"-Banner im Angebot-Tab entfernen. Stattdessen die vom Kunden gewählte Option-Karte (A–E) selbst dezent markieren.

## Änderungen

### 1. `OfferBuilder.tsx`
- Import + Render-Block von `CustomerFeedbackBanner` (Zeilen 10, 294–300) entfernen.
- Stattdessen `customerResponse` an `OptionCardGrid` weiterreichen.

### 2. `OptionCardGrid.tsx`
- Neues optionales Prop `customerResponse?: CustomerResponse`.
- Pro Option vergleichen: `option.id === customerResponse?.selectedOptionId` → Flag `isCustomerChoice` + `customerNotes` + `respondedAt` an `OptionCard` durchreichen.

### 3. `OptionCard.tsx`
- Neue optionale Props: `isCustomerChoice?: boolean`, `customerNotes?: string | null`, `respondedAt?: string | null`.
- Im Header (neben dem Buchstaben-Avatar A/B/…): wenn `isCustomerChoice`, ein **monochromer Badge** „Kundenwahl · vor 2 h" (relative Zeit via `formatDistanceToNow`, Locale `de`). Verwendet `bg-foreground text-background` oder `ring-2 ring-foreground` — keine blauen/farbigen Töne (Memory: monochrom).
- Karten-Rahmen bei `isCustomerChoice` zusätzlich verstärken: `ring-2 ring-foreground/80` statt der dezenten `border-border/40`, damit die gewählte Option visuell heraussticht — passt zum Light-Mode-Premium-Look.
- Falls `customerNotes` vorhanden: kleiner aufklappbarer Bereich unter dem Header („Notiz anzeigen"-Toggle, `<Collapsible>`/lokaler `useState`), Text in `text-sm whitespace-pre-wrap text-muted-foreground` auf `bg-muted/40`-Fläche. Standard-State: eingeklappt, damit die Karte schlank bleibt.

### 4. `CustomerFeedbackBanner.tsx`
- Datei löschen. Keine weiteren Imports vorhanden (nur in `OfferBuilder.tsx`).

## Out of scope
- Kommunikation-Tab (Mailclient) zeigt die Rückmeldung weiterhin chronologisch — unverändert.
- Banner für Status `draft`/`sent` ohne Antwort — keine Änderung.

## Geänderte Dateien
| Datei | Änderung |
|---|---|
| `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx` | Banner entfernen, `customerResponse` weiterreichen |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCardGrid.tsx` | Prop annehmen + per-Option durchreichen |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx` | Header-Badge + Ring + optionale Notiz-Ausklappung (monochrom) |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/CustomerFeedbackBanner.tsx` | Datei löschen |
