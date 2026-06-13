## Ziel

Nach dem KI-Parse (`parse-freeform-offer`, Gemini 2.5 Pro) läuft automatisch ein zweiter KI-Call gegen ein anderes Modell als "Red Team". Findings (fehlende Tage, falsche Preise, fehlende Mahlzeiten, fehlende Hinweise) lösen einen automatischen Korrektur-Retry aus. Erst wenn das Red Team grünes Licht gibt (oder max. 2 Retries durch sind), wird das Programm an den Editor übergeben.

## Architektur

```text
Admin pastet Text
  → parse-freeform-offer  (Gemini 2.5 Pro, Parser)
  → validate-freeform-offer  (GPT-5, Red Team)
      ├─ ok=true → ins UI übernehmen
      └─ ok=false + findings[]
          → Auto-Retry: parse-freeform-offer mit Korrektur-Hinweis
              (max. 2 Retries, dann übernehmen + Findings als Warnung im Editor)
```

Beide Edge Functions bleiben getrennt, damit das Red Team unabhängig prüft und nicht denselben Bias erbt.

## Red-Team Scope (alle 4)

Validator prüft das geparste JSON gegen den Original-Text:

1. **Vollständigkeit** — jeder Tag aus dem Text ist in `days[]`, jede Mahlzeit (Lunch/Dinner/Frühstück/BBQ etc.) ist in `meals[]`, keine Sektion/Speise fehlt.
2. **Preise & Totals exakt** — jeder `flatPriceNet` stimmt 1:1 mit dem Text überein, `taxBreakdown.foodNet/servicesNet` matcht "KALKULATION", `totalsFromText.net/gross` matcht "GESAMTANGEBOT". Keine Rundung, keine Berechnung.
3. **Gästezahlen & Datumsangaben** — `guestCount` pro Mahlzeit korrekt, `dateLabel` und `isoDate` korrekt zugeordnet.
4. **Hinweise & Leistungsumfang** — `notes[]` enthält alle HINWEISE-Punkte, `scopeOfServices` deckt LEISTUNGSUMFANG ab.

## Neue Edge Function: `validate-freeform-offer`

Datei: `supabase/functions/validate-freeform-offer/index.ts`

- Modell: `openai/gpt-5` (bewusst andere Familie als der Parser → echte Cross-Validation)
- Input: `{ rawText: string, program: FreeformProgram }`
- System-Prompt: "Du bist ein strenger QA-Validator. Vergleiche das JSON 1:1 mit dem Original-Text. Melde JEDE Abweichung als Finding."
- Tool-Call `report_findings` mit Schema:
  ```text
  {
    ok: boolean,
    findings: [{
      severity: "critical" | "warning",
      category: "completeness" | "pricing" | "guests_dates" | "notes",
      path: string,        // z.B. "days[1].meals[0].flatPriceNet"
      expected: string,    // wörtlich aus Text
      actual: string,      // aus JSON
      message: string      // kurze Beschreibung
    }],
    summary: string
  }
  ```
- `ok=false` wenn mind. 1 `critical` Finding (Preis/Total/fehlender Tag) ODER ≥3 `warning` Findings.
- Standard 429/402/500 Error-Handling, CORS, Logs.

## Parser-Erweiterung: `parse-freeform-offer`

Optionaler neuer Input `correctionHints?: string[]`. Wenn gesetzt, wird im System-Prompt ein Block angehängt:

```
KORREKTUR-HINWEISE AUS VORHERIGEM VERSUCH (BITTE BEHEBEN):
- {finding.message} (erwartet: {expected}, war: {actual})
- ...
```

Sonst keine Änderung am Parser-Verhalten.

## Frontend: `FreeformImportPanel.tsx`

Neuer Flow im `handleParse`:

1. Parse-Call (wie heute).
2. Validate-Call mit `{ rawText, program }`.
3. Wenn `ok=true` → `onParsed(program)`, Toast "Importiert + validiert ✓".
4. Wenn `ok=false`:
   - Loading-Text auf "Red Team korrigiert..." setzen.
   - Parser erneut aufrufen mit `correctionHints = findings.map(f => f.message)`.
   - Validator erneut aufrufen.
   - Max. 2 Retries. Danach: trotzdem übernehmen, Findings in `program.__validationFindings` mitgeben.
5. Findings (kritisch + warnings) werden als optionales Prop `validationFindings` an den Editor durchgereicht.

UI-Stages während Loading: "KI parst…" → "Red Team validiert…" → "Red Team korrigiert (Versuch 2)…".

## Editor: `FreeformProgramEditor.tsx`

Wenn `validationFindings.length > 0`, oben im Editor eine Warn-Card (Monochrome, kein Grün/Gelb — neutral grau mit `border-foreground/30 bg-muted/40`):

```
⚠ Red Team hat {n} mögliche Abweichungen gefunden
- [Preis] days[1].meals[0]: erwartet "1.200 €", erkannt "1.250 €"
- [Vollständigkeit] HINWEISE: Punkt "Allergene auf Anfrage" fehlt
...
[Trotzdem übernehmen]  [Erneut parsen]
```

Kein blockierender Dialog — User sieht und entscheidet inline.

## Datentyp-Erweiterungen

`OfferBuilder/types.ts`:
```text
ValidationFinding {
  severity: "critical" | "warning"
  category: "completeness" | "pricing" | "guests_dates" | "notes"
  path: string
  expected: string
  actual: string
  message: string
}
```

Wird nur im Editor-State gehalten, nicht in `freeformProgram` persistiert (transient).

## Out of Scope

- Deterministische Regex-Checks (Phase 2, falls KI-Validator zu langsam/teuer wird).
- Validator-Findings in DB loggen (Phase 2, evtl. für QA-Statistik).
- Englische Übersetzung (separates Thema).

## Verifikation

1. Beispieltext mit absichtlich falschem Preis → Validator meldet `critical pricing`, Auto-Retry korrigiert.
2. Beispieltext mit fehlender HINWEIS-Zeile in der JSON-Antwort → `warning notes`.
3. Beispieltext sauber → `ok=true` beim ersten Versuch, keine Warn-Card.
4. Edge Case: 2 Retries laufen voll → Warn-Card im Editor zeigt verbleibende Findings.
5. 429/402 vom Validator → Toast, Programm wird trotzdem übernommen (Validator ist optional, nicht blockierend).
