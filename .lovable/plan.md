# KI-Übersetzung der Reisegruppen-Menüs (EN/IT/FR)

## Problem
Die 3 Reisegruppen-Pakete (Pizza e Pasta, Benvenuti, Tradizione) liefern beim Auswählen im Menu Builder Gänge (`custom_item_name`) und Getränke (`drink_label`, `quantity_label`) nur auf **DE + EN**. Reisegruppen-Gäste sind aber häufig international (IT/FR). Aktuell müsste der Betreiber jede Übersetzung manuell pflegen.

## Ziel
Beim Laden eines der 3 Reisegruppen-Pakete im Menu Builder sollen alle Item-Texte (Gänge + Getränke) bereits auf **EN / IT / FR** vorliegen — automatisch erzeugt von KI (Lovable AI Gateway, gemini-2.5-flash, identisch zum bestehenden `translate-menu-text`).

Operator muss nichts eintippen. Übersetzungen werden **persistent** gespeichert (nicht bei jedem Öffnen neu generiert), bleiben aber per Button neu übersetzbar.

## Umfang
- Nur für `package_course_config` + `package_drink_config` Inhalte (Custom-Items aus Paketen).
- Standard-MenuItems aus `catering_menu_items` / `ristorante_menu_items` haben bereits eigene `name_en` und sind nicht Teil dieses Plans.

## Schritte

### 1. Schema erweitern (Migration)
Neue Spalten in `package_course_config`:
- `course_label_it`, `course_label_fr`
- `custom_item_name_it`, `custom_item_name_fr`
- `custom_item_description_en`, `custom_item_description_it`, `custom_item_description_fr`

Neue Spalten in `package_drink_config`:
- `drink_label_it`, `drink_label_fr`
- `quantity_label_it`, `quantity_label_fr`
- `options_translations` (JSONB) — Map `{ en: [...], it: [...], fr: [...] }` für die `options`-Liste (Wein, Wasser, Espresso etc.)

Alle nullable, kein Default.

### 2. Edge-Function `translate-package-menu`
- Input: `{ package_id, target_langs?: ['en','it','fr'] }`
- Lädt alle Rows aus `package_course_config` + `package_drink_config` für das Package.
- Sammelt alle DE-Strings, schickt einen Batch-Request an Lovable AI (gemini-2.5-flash) mit Tool-Calling für strukturierte Ausgabe.
- System-Prompt analog `translate-menu-text` (gastronomische Begriffe beibehalten: Tagliatelle, Saltimbocca, Tiramisu …).
- Schreibt Ergebnisse via Service-Role-Client zurück in die jeweiligen `_en/_it/_fr`-Spalten und `options_translations`.
- Auth: Admin-only (JWT prüfen, `has_role(admin)`).
- Fehlerfälle 429/402 sauber durchreichen.

### 3. Seed: einmalige Übersetzung der 3 Reisegruppen-Pakete
Edge-Function deployen und einmalig für die 3 Package-IDs aufrufen (entweder via Admin-Button oder per `curl_edge_functions`-Tool nach Deploy).

### 4. UI-Button „Mit KI übersetzen"
In `src/components/admin/refine/PackageEdit.tsx` neuer Button neben den Sprachfeldern: ruft die Edge-Function auf, zeigt Spinner, refetched Package-Config. Nutzbar für jedes Package, nicht nur Reisegruppen.

### 5. Hook + Types erweitern
- `usePackageMenuConfig.ts`: zusätzliche Felder (`*_it`, `*_fr`, `options_translations`) durchreichen.
- `MenuComposer/types.ts` + `OfferBuilder/types.ts`: `CourseConfig` und `DrinkConfig` um IT/FR Felder ergänzen.

### 6. Persistenz im Angebot
Beim Auto-Befüllen von `menu_selection` (in `useOfferBuilder.ts`) die mehrsprachigen Namen mit übernehmen, so dass `PublicOffer` (DE/EN/IT/FR) den jeweiligen Text rendert ohne Re-Lookup.

### 7. PublicOffer-Rendering
`src/pages/public-offer/...` (FinalOfferView/ProposalView): beim Anzeigen der Course/Drink-Items je nach `lang` das passende Feld nutzen (Fallback DE → EN → DE).

## Nicht im Umfang
- Übersetzung von Standard-MenuItems (haben eigene `name_en` Workflows).
- Kein Live-On-Demand-Translate bei jedem Öffnen — nur einmalig + manueller Re-Trigger.
- Keine Änderung der UX im OfferBuilder selbst (außer dass Texte jetzt mehrsprachig im Hintergrund vorhanden sind).
