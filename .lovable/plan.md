## Hinweistext im Offer Builder korrigieren

**Problem:** In `OfferBuilder.tsx` (Zeile 290) steht „Erstelle bis zu drei Varianten…", obwohl tatsächlich bis zu **5 Optionen** (A–E) möglich sind. Das Limit ist in `types.ts` via `OPTION_LABELS = ['A','B','C','D','E']` definiert und wird konsistent in `useOfferBuilder.ts` (Toast „Maximale Anzahl an Optionen erreicht (5)") und `MenuImporter.tsx` (Max-Check via `OPTION_LABELS.length`) verwendet.

**Änderung (1 Datei, reine UI-Copy):**

`src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx` Zeile 290:

- Alt: „Erstelle bis zu drei Varianten für deinen Kunden. Jede Option kann unabhängig ein Restaurant-Menü, Eigenes Menü, Paket oder nur eine E-Mail sein."
- Neu: „Erstelle bis zu fünf Varianten (A–E) für deinen Kunden. Jede Option kann unabhängig ein Restaurant-Menü, Eigenes Menü, Paket oder nur eine E-Mail sein."

Keine Logik-Änderung, keine DB- oder Edge-Function-Änderung.

**Hinweis Lex-Office Multi-Variant:** Die zuvor implementierte Branch-Logik (`buildVariantLineItem` + `subItems[].alternative=true`) funktioniert auch mit 4 oder 5 Varianten — `options[0]` bleibt Parent, `options[1..N]` werden zu Alternative-SubItems. Kein zusätzlicher Anpassungsbedarf.
