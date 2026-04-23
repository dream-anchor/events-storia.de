

# „Angebot PDF" + „Kunden-Ansicht" erst nach Versand sichtbar

## Befund

Im Inquiry-Header (`SmartInquiryEditor.tsx`) erscheinen aktuell:

1. **„Angebot PDF"** (Zeile 787) — sichtbar sobald `lexoffice_invoice_id` ODER `lexoffice_quotation_id` gesetzt ist. Bei Multi-Option-Anfragen wird die Quotation aber bewusst **erst nach Kundenauswahl** erzeugt (siehe letzter Fix). Bei einer brandneuen Anfrage „Antoine Monot · Neu" existiert weder PDF noch Auswahl — Button ist (korrekt) verborgen, der Screenshot zeigt allerdings, dass er bei Single-Option-Drafts sichtbar wäre, ohne dass je etwas versendet wurde.
2. **„Kunden-Ansicht"** (Zeile 819-828) — **immer** sichtbar, unabhängig vom Status. Öffnet `/offer/{id}` auch wenn noch nichts existiert → Kunde sähe leere/unfertige Seite, falls der Link versehentlich geteilt wird. Konzeptionell falsch: die Kunden-Ansicht ist ein Vorschau-Tool für **versendete** Angebote.

Beide Aktionen ergeben nur Sinn, sobald das Angebot **mindestens einmal versendet** wurde (`offer_phase ≠ 'draft'`).

## Lösung

### Sichtbarkeitsregel — basierend auf `offer_phase`

`offer_phase`-Werte (aus Memory `business/offer-lifecycle-management`): `draft` → `proposal_sent` → `selection_made` → `paid` → `confirmed`.

**Neue Regel:** Beide Buttons werden ausgeblendet, solange `offer_phase === 'draft'` oder `null/undefined`.

### Konkrete Änderungen in `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`

**a) Helper am Anfang der Render-Phase:**
```ts
const isOfferSent = inquiry?.offer_phase && inquiry.offer_phase !== 'draft';
```

**b) „Angebot PDF" (Zeile 787) — zusätzliche Bedingung:**
```tsx
{isOfferSent && lexofficeDocId && (
  <Button … >Angebot PDF</Button>
)}
```
- Bei Single-Option-Versand: `offer_phase = 'proposal_sent'` + Quotation existiert → Button sichtbar.
- Bei Multi-Option vor Auswahl: `offer_phase = 'proposal_sent'`, aber `lexofficeDocId` noch leer → Button bleibt verborgen (PDF wird erst nach Kundenauswahl erzeugt). Kein Hinweistext nötig — die Abwesenheit des Buttons ist selbsterklärend, parallel zum bereits umgesetzten Verhalten in `PublicOffer.tsx`.

**c) „Kunden-Ansicht" (Zeile 819-828) — durch `isOfferSent` gaten:**
```tsx
{isOfferSent && (
  <Button … onClick={() => window.open(`/offer/${id}`, '_blank')}>
    Kunden-Ansicht
  </Button>
)}
```
- Im Draft-Zustand komplett verborgen — Admin kann die Kunden-Sicht nicht versehentlich vor dem Versand öffnen oder den Link kopieren.

**d) `OfferSendPreview.tsx`** (interner Vorschau-Dialog, nicht im Header) bleibt unverändert: dort ist die PDF-Vorschau Teil des Send-Workflows und nutzt bereits Lazy-Create.

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` — Helper `isOfferSent` einführen, beide Buttons damit gaten (~6 Zeilen Diff)

Keine DB-Migration. Keine Edge-Function-Änderung. Keine Breaking Changes für bereits versendete Anfragen.

## Verifikation

1. **Neue Anfrage „Antoine Monot · Neu"** (`offer_phase = 'draft'`) → weder „Angebot PDF" noch „Kunden-Ansicht" sichtbar.
2. **Single-Option versendet** (`proposal_sent`, `lexoffice_quotation_id` gesetzt) → beide Buttons sichtbar, PDF lädt korrekt.
3. **Multi-Option versendet, noch keine Kundenauswahl** → „Kunden-Ansicht" sichtbar (Admin kann prüfen, was der Kunde sieht), „Angebot PDF" verborgen, weil noch keine Quotation erzeugt wurde.
4. **Multi-Option nach Kundenauswahl + Zahlung** → beide Buttons sichtbar, PDF zeigt finale Mengen.

