# Plan: KI-Menüvorschlag mit 3 Varianten (Low / Medium / High)

## Was sich ändert (gegenüber dem aktuellen Stand)

Der bereits gebaute Button "Menü mit KI vorschlagen" generiert aktuell **eine** Variante. Er wird umgebaut auf **drei Varianten in einem Durchgang**, die in die drei nächsten freien Optionen geschrieben werden.

## Verhalten

1. Klick auf "Menü mit KI vorschlagen" im `RequestContextBanner`.
2. Edge Function liest die Anfrage (event_type, message, guest_count, location, source, evtl. selected_packages, evtl. genanntes Budget) sowie alle aktiven `packages` und `menu_items`.
3. KI (Gemini 2.5 Pro) "spürt" aus dem Kontext eine sinnvolle Basis-Preislage (Ort, Anlass, Tonfall, Branche) und legt **drei Varianten** darum herum:
   - **Low** – schlanker, pragmatisch, untere Spanne
   - **Medium** – Empfehlung, mittig
   - **High** – gehoben, obere Spanne
   Jede Variante darf eigenständig entweder ein **Paket** oder ein **Mehrgang-/Buffet-Menü aus menu_items** sein – die KI wählt pro Variante das Passendste.
4. Die drei Varianten landen in den **drei nächsten freien Optionen** (z. B. ist A belegt → B, C, D). Sind weniger als 3 frei, werden fehlende Optionen via `builder.addOption()` ergänzt (bis Maximum E; was darüber hinaus ginge, wird verworfen mit Toast-Hinweis).
5. Jede Option bekommt im Titel/Notiz-Feld ein Label `KI · Low`, `KI · Medium`, `KI · High` plus die kurze Begründung der KI, damit der Betreiber sofort sieht, was wo ist.
6. Erfolgs-Toast zeigt die übergeordnete KI-Begründung (Wahrnehmung der Anfrage).

## Preis-Logik (kontextuell, keine fixen Bänder)

Die KI bekommt im System-Prompt nur Leitplanken, keine festen Prozentsätze:
- Lies Ort, Anlass, Sprache/Tonfall, Branche, evtl. Budget aus der Anfrage.
- Bilde innerlich ein Bauchgefühl für die "Mitte" (Medium).
- Low/High = bewusst niedriger / gehobener als Medium, aber im Rahmen dessen, was bei diesem Kunden glaubwürdig wirkt – nicht mechanisch ±X %.
- Wenn der Kunde ein Budget nennt, ankert Medium dort; Low/High passen sich an.

## Technische Umsetzung

**Edge Function** `generate-menu-suggestion` (bereits vorhanden, wird angepasst):
- Response-Schema neu: `{ overallReasoning: string, variants: [{ tier: "low" | "medium" | "high", reasoning: string, mode: "paket" | "menu", packageId?: string, courses?: [{ courseName, itemIds }], estimatedPricePerPerson: number }] }`
- System-Prompt um Variantenlogik + Kontext-Sensitivität erweitert (keine Hardcode-Bänder, keine Hardcode-Ortsnamen).
- Validiert: genau 3 Varianten, Tiers eindeutig, IDs existieren.

**`OfferBuilder.tsx`**:
- `handleGenerateMenuSuggestion` iteriert über die 3 Varianten, sucht je nächste freie Option oder ruft `builder.addOption()`, schreibt Paket oder `menuSelection` analog zum bestehenden Mapping.
- Bei jeder Variante: `optionName`/Notiz mit Tier-Label + Kurzbegründung.
- Ein gesammelter Toast am Ende mit `overallReasoning` und Liste der befüllten Optionen.

**`RequestContextBanner.tsx`**:
- Button-Label bleibt "Menü mit KI vorschlagen", Tooltip wird zu „Erzeugt 3 Varianten (Low/Medium/High) in den nächsten freien Optionen".
- Disabled-Logik: deaktiviert, wenn weniger als 1 Option frei **und** Maximum E erreicht ist.

**Nicht angefasst**: `useOfferBuilder`, Schemata in der DB, `EmailComposer`, `generate-inquiry-email`, Paket-Transfer-Button, `config.toml` (keine neue Function, kein verify_jwt-Eintrag nötig).
