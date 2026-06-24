
## Ziel
Unter dem RequestContextBanner einen Button **„Menü mit KI vorschlagen"** ergänzen, der aus Anfrage-Kontext (Anlass, Nachricht, Budget-Hinweise, Ortsbezug wie „Harlaching") + Storia-Pool (Menu-Items + Pakete) einen passenden Vorschlag generiert und in die **nächste freie Option (A–E)** schreibt.

## Was wird gebaut

### 1. Neue Edge Function `generate-menu-suggestion`
`supabase/functions/generate-menu-suggestion/index.ts`, `verify_jwt = false` (gleicher Pattern wie `generate-inquiry-email`).

**Input:** `{ inquiryId }`

**Server lädt:**
- `v2_events` (event_type, message, guest_count, source, selected_packages, budget-Felder falls vorhanden, location/Adresse aus Nachricht)
- Alle aktiven `packages` (+ Beschreibung, Preis, Personen)
- Alle aktiven `menu_items` (id, name, category_name, description, price)

**Prompt-Strategie (Gemini 2.5 Pro):**
System-Prompt erklärt der KI:
- Sie ist Maître des Storia (italienisches Restaurant in München).
- **Preis-Fingerspitzengefühl:** Falls Kunde explizites Budget nennt → einhalten. Sonst aus Anlass + Ortsbezug + Sprachstil der Nachricht ableiten (z. B. „Harlaching/Bogenhausen/Grünwald" = gehoben; „Studenten-WG/locker" = einfach; Firmenfeier ohne Hinweis = mittel; Hochzeit = gehoben).
- **Modus-Entscheidung:** Hochzeit/Geburtstag/Jubiläum → Mehrgang-Menü. Firmenfeier/Empfang/Casual → Buffet/Fingerfood. Fallback: Mehrgang.
- **Quelle:** Entweder ein passendes Paket als Basis vorschlagen ODER Items aus `menu_items` zu Courses kombinieren.

**Output (structured via AI SDK `Output.object`):**
```ts
{
  mode: "paket" | "menu",
  reasoning: string,        // 1-2 Sätze für Toast
  packageId?: string,       // wenn mode=paket
  courses?: Array<{         // wenn mode=menu
    courseName: string,     // "Antipasti", "Primo", "Secondo", "Dolce"
    itemIds: string[]
  }>,
  estimatedPricePerPerson: number
}
```

### 2. RequestContextBanner erweitern
Neuer Button **„Menü mit KI vorschlagen"** (Sparkles-Icon, `secondaryElevated`) unter der bestehenden Action-Zeile. Disabled wenn `isSignatureLocked` oder keine freie Option mehr (A–E voll).

Neue Prop: `onGenerateMenuSuggestion?: () => Promise<void>` + `isGenerating: boolean`.

### 3. OfferBuilder-Verdrahtung
In `OfferBuilder.tsx`:
- Neuer State `isGeneratingMenu`.
- Handler ruft Edge Function, findet **erste leere Option** (`!packageId && offerMode !== "paket" && courses.length === 0`).
- Falls keine leere vorhanden → `builder.addOption()` und dann füllen.
- Mappt Response:
  - `mode=paket` → `updateOption({ offerMode: "paket", packageId, packageName })`
  - `mode=menu` → `updateOption({ offerMode: "menu", menuSelection: { courses: [...] } })` (gleiches Schema wie Menü-Wizard)
- Toast zeigt `reasoning` der KI als Begründung.

### 4. config.toml
`[functions.generate-menu-suggestion] verify_jwt = false`

## Was NICHT angefasst wird
- Keine DB-Migration.
- `useOfferBuilder`, `OptionCardGrid`, `EmailComposer` bleiben unverändert (nur `updateOption`/`addOption` werden genutzt).
- `generate-inquiry-email` bleibt unverändert.
- Bestehender Paket-Übernahme-Button bleibt.

## Akzeptanzkriterien
- Klick auf Button bei Maximilian Walter (Harlaching, Anlass X) → erzeugt Vorschlag im gehobenen Segment.
- Vorschlag landet in nächster freier Option, andere Optionen unberührt.
- Toast zeigt KI-Begründung („Gewähltes Premium-Menü passend zu Harlaching/Hochzeit").
- Bei vollen Optionen A–E: neue Option F? Nein — Toast „Keine freie Option, bitte erst eine leeren".
