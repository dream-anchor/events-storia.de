## Problem

Der Freitext-Import scheitert beim „Per-Person + Stundensätze"-Angebot von Domenico, weil der Parser ein starres Schema benutzt:

- Mahlzeit kennt nur `flatPriceNet` (Pauschale). „ab 99 € pro Person" fällt durchs Raster → 0.
- Es gibt kein Feld für Stundensätze (Service 59 €/h, Auf-/Abbau 46 €/h) oder pauschale Logistik (Anfahrt/Abfahrt 50 €).
- `totalsFromText.net/gross`, `taxBreakdown.foodNet/servicesNet` werden auf 0 gesetzt, wenn der Text keine Gesamtsumme nennt — das Red-Team liest 0 als Behauptung „Summe = 0" und meldet 4 Pricing-Findings.
- `guestCount` wird 0 gesetzt, wenn der Text keine nennt → 2 weitere Findings.

Ergebnis im Screenshot: 8 Abweichungen, Operator muss alles manuell nachbauen.

## Ziel

Per-Person-Angebote mit Stunden-/Pauschal-Zusatzleistungen sauber importieren, ohne dass das Red-Team falsche „0"-Behauptungen anmeckert. Bestehende Pauschalpreis-Programme bleiben unverändert.

## Änderungen

### 1. Schema erweitern (`types.ts`)
- `FreeformProgramMeal`:
  - neu `pricePerPersonNet?: number | null` (Preis pro Person, netto)
  - neu `pricePerPersonPrefix?: string | null` ("ab", "ca." …, wörtlich aus Text)
  - `flatPriceNet` bleibt — wird `null`, wenn nur Per-Person vorliegt
- neu `FreeformAdditionalService { id; label; unitPriceNet; unit: 'hour'|'flat'|'piece'; quantity?: number|null; vatRate: number }`
- `FreeformProgram.additionalServices?: FreeformAdditionalService[]`
- `taxBreakdown.*` und `totalsFromText.*` werden `number | null` — `null` = im Text nicht genannt.

### 2. Parser (`parse-freeform-offer/index.ts`)
- Tool-Schema um die neuen Felder ergänzen (`pricePerPersonNet`, `pricePerPersonPrefix`, `additionalServices[]`, nullable totals).
- Prompt-Regeln:
  - Bei „ab X € pro Person" → `pricePerPersonNet=X`, `pricePerPersonPrefix="ab"`, `flatPriceNet=null`.
  - Stundensätze / Pauschal-Logistik → `additionalServices[]` mit `unit='hour'|'flat'`, `vatRate=19`.
  - Wenn ein Wert im Text **fehlt**, das Feld auf `null` setzen — niemals 0. (0 nur, wenn der Text explizit „0" sagt.)
  - `guestCount=null`, wenn im Text keine Personenzahl steht.

### 3. Red-Team (`validate-freeform-offer/index.ts`)
- Prompt: `null` = „im Text nicht genannt" → nie als Finding melden. Nur Mismatch zwischen konkreter Textzahl und konkretem JSON-Wert flaggen.
- Zusätzlich Pricing-Regel: Wenn `pricePerPersonNet` gesetzt ist, darf `flatPriceNet` `null` sein, ohne Finding.
- `additionalServices` mit in den Vollständigkeitscheck aufnehmen (jede „•⁠ ⁠… €/h"-Zeile muss erscheinen).

### 4. Editor (`FreeformProgramEditor.tsx`)
- Pro Mahlzeit zwei Preisfelder: „Pauschal netto" **oder** „Pro Person netto" + optionaler Prefix.
- Neue Sektion „Zusätzliche Leistungen" mit Liste (Label, Einheit Dropdown h/Pauschal/Stück, Preis, MwSt).
- `null` wird als leeres Feld dargestellt, nicht als „0,00".

### 5. Import-Panel (`FreeformImportPanel.tsx`)
- `syntheticSingleDay`-Fallback so anpassen, dass Preise/Gäste `null` bleiben (nicht 0).
- Erfolgs-Toast bei 0 Findings unverändert.

## Nicht angepackt

- Bestehende Kalkulations-Summen-Anzeige unten (Speisen netto / Personal netto) — kommt automatisch aus den neuen Feldern, sobald `pricePerPersonNet * guestCount` + Summe `additionalServices` aufsummiert werden. Falls Operator Gäste später setzt, rechnet das UI live mit. Keine separate Pflicht-Anpassung der Kalkulationsbox in diesem Schritt; nur sicherstellen, dass die neuen Werte einfließen.

## Technische Punkte (für später)

- Datenbank: `freeformProgram` liegt als JSON in `menu_selection` — keine Migration nötig, neue Felder sind additiv.
- Validator-Schwellen (`hasCritical || warnings>=3`) bleiben.
- Models: weiterhin Gemini 2.5 Pro für Parser, GPT-5 für Validator.
