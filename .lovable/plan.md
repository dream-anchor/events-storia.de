
## Ziel

In jedem Angebot — egal ob Paket, Menü oder E-Mail — sollen **Preise, Mengen und Rabatte** frei editierbar sein. Aktuell ist das nur im Menü-Modus vollständig möglich; im Paket-Modus fehlen mehrere Stellschrauben.

## Status-Analyse (was es schon gibt)

| Funktion | Menü-Modus | Paket-Modus | E-Mail-Modus |
|---|---|---|---|
| Anzahl Personen | ✅ | ✅ | ✅ |
| Einzelpreis pro Gang | ✅ override | ❌ fix aus Paket-DB | — |
| Menge pro Gang | ✅ | ⚠️ teils | — |
| Paketpreis manuell | — | ❌ nur Katalog | — |
| Rabatt-Feld (%) | ✅ | ❌ fehlt | ❌ fehlt |
| Equipment/Personal-Preise | ✅ | ✅ | ✅ |
| Finaler Angebotspreis (Override) | ✅ | ✅ | ✅ |

Die `discountPercent`-Logik existiert bereits im Datenmodell (`types.ts` + `useOfferBuilder.ts` Zeile 191/442/862) und wird beim Versand mitgespeichert. Sie ist aber UI-seitig nur im Menü-Modus erreichbar.

## Was umgesetzt wird

### 1. Rabatt-Feld in allen Modi
- Rabatt-Eingabe (0–100 %) zusätzlich im **Paket-Modus** und **E-Mail-Modus** anzeigen.
- Verhalten identisch zum Menü-Modus: erscheint mit „+ Rabatt"-Button, wenn 0; Eingabe inline, grün dargestellt; Abzug erscheint in der Preisaufstellung sowie beim errechneten Gesamtpreis.
- Wert wandert wie gehabt nach `menu_selection.discountPercent` → Versionierung bleibt erhalten.

### 2. Paketpreis manuell anpassen
Im `PriceBreakdown` (Paket-Modus) wird die heute fixe Zeile „{Paket} ({Gäste} × X €)" zu einer editierbaren Zeile:
- Inline-Input für **Preis pro Person** (oder Gesamt, je nach `pricing_type` des Pakets).
- Override wird in `option.budgetPerPerson` / `option.totalAmount` gespeichert (bestehende Felder, kein Migrationsbedarf).
- Katalogpreis bleibt sichtbar als Placeholder/Hint.
- Reset-Button („auf Katalogpreis zurücksetzen") wenn Override gesetzt ist.

### 3. Paket-Inhalte (enthaltene Menü-Items) editierbar
Im Paket-Modus werden enthaltene Speisen aus `package_menu_items` gerendert. Diese werden auf den **gleichen `InlineCourseEditor`** umgestellt, der im Menü-Modus läuft:
- Einzelpreis pro Item editierbar (override, kein DB-Schreibvorgang am Paket selbst).
- Menge pro Item editierbar.
- Item entfernen / hinzufügen wie im Menü-Modus.
- Originalpaket bleibt unangetastet — Overrides liegen pro Option in `menu_selection`.

### 4. Konsistenz & Anzeige
- Preisaufstellung im Paket-Modus erweitert um Zeilen: Zwischensumme, Rabatt, Netto (analog Menü-Modus).
- Versandte Angebote bleiben **immutable** (bestehende Versionierung greift unverändert).
- AI-Cover-Letter-Prompts müssen Rabatt-Hinweis im Paket-Modus aufnehmen, sonst entsteht Inkonsistenz im Anschreiben → kleiner Patch in `useOfferBuilder.ts` Cover-Letter-Generierung.

### 5. Speichern / Laden
- Hydration in `useOfferBuilder.ts` Zeile ~442: `discountPercent` wird bereits aus `menu_selection` gelesen → keine Änderung nötig.
- Neue Override-Felder für Paket-Items: in `menu_selection.packageItemOverrides` (jsonb-Map `item_id → { price?, quantity? }`) speichern.

## Was NICHT geändert wird

- Paket-Stammdaten (`packages`, `package_menu_items`) bleiben unverändert — Overrides sind angebotsspezifisch.
- Bestehende Angebote (versendet) werden nicht migriert; alte Versionen bleiben sichtbar wie gespeichert.
- Keine DB-Migration nötig — alles passt in `menu_selection` (jsonb).

## Technische Details (für später)

**Dateien, die angefasst werden:**
- `OfferBuilder/PriceBreakdown.tsx` — Rabatt-UI in beiden Branches; editierbare Paketpreis-Zeile
- `OfferBuilder/OptionCard.tsx` — `discountPercent` & `onDiscountChange` an Paket-Branch durchreichen (bereits vorhanden, nur Bedingung erweitern)
- `OfferBuilder/types.ts` — `packageItemOverrides`-Map ergänzen
- `OfferBuilder/useOfferBuilder.ts` — Persistenz der neuen Overrides; AI-Prompt-Hinweis
- `OfferBuilder/InlineCourseEditor.tsx` — auch im Paket-Modus mit Paket-Items rendern (bereits parametrisiert, nur Wiring)

**Risiko:** sehr gering. Keine Edge-Function-Änderung, keine DB-Migration, keine Mail-Triggers — rein UI/State.

## Smoke-Test (nach Implementierung)

1. Paket-Angebot anlegen → Paketpreis manuell überschreiben → speichern → neu laden → Override bleibt.
2. Paket-Angebot → Rabatt 10 % eingeben → Preisaufstellung zeigt Rabatt-Zeile, Netto, korrekten Gesamtpreis.
3. Paket-Item-Preis editieren → Versand → Kunde sieht editierten Preis im PublicOffer.
4. Bestehendes versendetes Angebot öffnen → unverändert (immutable).
