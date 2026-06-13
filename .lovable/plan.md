
## Ziel

Im Wizard einen neuen Modus „Freitext-Import" ergänzen, in den der Admin ein vorformuliertes Angebot (z.B. mehrtägige Catering-Programme) einfügt. Eine KI parst den Text in eine strukturierte Option mit mehreren Tages-Blöcken, Mahlzeit-Sektionen, Pauschalpreisen netto und Steuersätzen. Im Public Offer wird das Programm tagestrukturiert mit Pauschalpreis pro Block und Gesamtsumme angezeigt.

## Datenmodell (additive Erweiterung)

In `MultiOffer/types.ts` neuer optionaler Block auf `OfferOption`:

```text
OfferOption {
  ...bestehend
  freeformProgram?: {
    title: string
    location?: string
    dateRangeLabel?: string           // "29.06.2026 – 02.07.2026"
    days: ProgramDay[]
    taxBreakdown: {
      foodNet: number; foodVatRate: number      // 7
      servicesNet: number; servicesVatRate: number // 19
    }
    totalsFromText: { net: number; gross: number }
    notes: string[]                   // "Hinweise"-Block
    rawText: string                   // Original für Audit/Re-Parse
  }
}

ProgramDay {
  id: string
  dateLabel: string                   // "MONTAG, 29.06.2026"
  isoDate?: string
  meals: ProgramMeal[]
}

ProgramMeal {
  id: string
  label: string                       // "Lunch", "Dinner Live Cooking"
  guestCount: number
  sections: { heading?: string; items: string[] }[]
  flatPriceNet: number                // Pauschal netto
  vatRate: number                     // 7
}
```

Neuer `offerMode = "freeform"` neben `menu | paket | email`.

DB-Migration: neue Spalte `freeform_program JSONB NULL` auf der Tabelle, die `OfferOption` persistiert (Name beim Build per `code--view` verifizieren, vermutlich `offer_options`). Kein Schema-Bruch, alle bestehenden Optionen bleiben.

## UI-Änderungen

1. **`ModeSelector.tsx`** — vierte Kachel „Freitext-Import" (Icon `Sparkles` + `FileText`), Beschreibung „Vollständiges Angebot aus Text generieren".
2. **Neue Komponente `FreeformImportPanel.tsx`** unter `OfferBuilder/`:
   - Großes Textarea (min 20 Zeilen)
   - Button „Mit KI in Angebot umwandeln" → ruft Edge Function
   - Loading-State, Fehler-Toast (429/402/Parse-Fehler)
   - Nach Erfolg: Preview des geparsten Programms mit Inline-Editor (Tag-Label, Mahlzeit-Label, Gäste, Preis, Sektionen) bevor übernommen wird.
3. **Neue Komponente `FreeformProgramEditor.tsx`** — Liste der Tage als Cards, jede Mahlzeit als Sub-Card mit editierbaren Feldern.
4. **`WizardConfigurator.tsx`** — wenn `option.freeformProgram` gesetzt ist, Steps 2+3 (Gänge/Getränke) überspringen und direkt `FreeformProgramEditor` rendern; Step 4 Zusammenfassung zeigt totals aus `freeformProgram.totalsFromText`.
5. **`LiveCalculation.tsx`** — wenn freeform-Modus, Summe aus `flatPriceNet`-Aggregat + Service-Netto + MwSt-Aufschläge anzeigen.

## Public Offer Rendering

Neue Komponente `src/pages/public-offer/FreeformProgramView.tsx`:
- Titel + Location + Datums-Range
- Pro Tag: Datums-Header, dann pro Mahlzeit eine Card mit Gästezahl-Badge, Sektionen als Listen, Pauschalpreis rechts unten
- Kalkulations-Box am Ende: Speisen netto + MwSt 7%, Personal/Equipment netto + MwSt 19%, Gesamt netto/brutto
- „Hinweise"-Block
- Einbindung in `ProposalView`/`FinalOfferView` wenn `option.freeformProgram` vorhanden ist (alternativ zur bestehenden Menü-Darstellung)

Bilingual: Erste Iteration nur DE (Programm meist hochgradig kulinarisch-italienisch); EN-Rendering in einer Folge-Iteration. Der Container für Customer-Mails bleibt bilingual wie bisher.

## KI-Edge-Function

Neue Function `supabase/functions/parse-freeform-offer/index.ts`:
- Input: `{ text: string, inquiryId: string }`
- Modell: `google/gemini-2.5-pro` (komplexe Strukturextraktion, lange Texte)
- Strukturiertes Output via Tool-Calling mit JSON-Schema, das exakt dem `freeformProgram`-Shape entspricht
- System-Prompt:
  - Übernimm Pauschalpreise **netto** 1:1 wie im Text
  - Speisen → 7% MwSt; Personal/Equipment/Logistik → 19% MwSt
  - Tagesüberschriften und Mahlzeit-Labels exakt übernehmen
  - Sektionen mit Heading (z.B. „Antipasti-Auswahl", „Live Pasta Station") strukturieren
  - Gästezahlen pro Mahlzeit erkennen („| 25 Personen")
  - „KALKULATION" und „GESAMTANGEBOT" Block extrahieren → `taxBreakdown` + `totalsFromText`
  - „HINWEISE"-Aufzählung als `notes[]`
  - **Niemals Preise neu rechnen** — folgt der Maestro-Single-Source-Regel
- Response: geparstes Objekt + raw text; Frontend übernimmt nach Bestätigung in `option.freeformProgram` und schreibt `totalAmount = totalsFromText.gross`.

## Send-/Email-Pfad

- `EmailComposer`/`SendControls`: wenn freeform-Option, Email-Body verwendet Programm-Zusammenfassung statt Menü-Liste; bestehende bilinguale Struktur bleibt.
- PDF-Preview (`LivePDFPreview`): zusätzlicher Renderer-Branch für `freeformProgram`.

## Out of Scope (separat)

- Katalog-Matching der Items (Phase 2)
- Englische Übersetzung des Programms (Phase 2, via bestehender Translation-Function)
- Stripe-Payment-Link-Auto-Erstellung für freeform — funktioniert automatisch, da `totalAmount` gesetzt wird

## Verifikation

1. Beispieltext aus User-Message in das neue Panel einfügen → KI liefert 4 Tage mit korrekten Mahlzeiten und Preisen
2. Totals: 22.762 € Speisen netto + 1.593,34 € MwSt + 3.450 € Services netto + 655,50 € MwSt = 28.460,84 € brutto, exakt übernommen
3. Public Offer Vorschau zeigt strukturiertes 4-Tages-Programm
4. Option in DB persistiert, nach Reload identisch
5. Sent Offer ist immutable, „Angebot bearbeiten" erzeugt neue Version mit kopiertem `freeformProgram`
