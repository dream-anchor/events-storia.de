## Ziel

Reisegruppen-Angebote (und alle künftigen Pakete mit übersetzten Items) sollen im PublicOffer auch in **IT** und **FR** angezeigt werden — mit Fallback auf DE.

## Umfang

### 1. Snapshot erweitern (`useOfferBuilder.ts`)
Beim Auto-Befüllen von `menu_selection` zusätzlich zu `_en` auch `_it` und `_fr` Felder mitschreiben:
- `course_label_it`, `course_label_fr`
- `custom_item_name_it`, `custom_item_name_fr`
- `custom_item_description_it/_fr`
- `drink_label_it/_fr`, `quantity_label_it/_fr`
- Drink-Options: `options_translations` (JSONB) komplett mitnehmen

→ Damit liegen IT/FR persistent im Offer-Snapshot, ohne bei Render erneut die Package-Tabelle zu joinen (analog bisheriger DE/EN-Logik).

### 2. Sprachumschalter im PublicOffer
- Neuer Switcher (DE / EN / IT / FR) oben in `src/pages/PublicOffer.tsx`
- State `lang: 'de' | 'en' | 'it' | 'fr'`, default `de`
- Optional: initial aus `?lang=` Query-Param oder Browser-Locale ableiten
- Wird an `FinalOfferView` und `ProposalView` durchgereicht

### 3. Lokalisierte Anzeige
Helper `t(item, field, lang)` mit Fallback-Kette `lang → en → de`:
- Course-Labels und Custom-Item-Namen/Descriptions
- Drink-Labels, Quantity-Labels, Drink-Options (aus `options_translations[lang]`)
- Standard-MenuItems: `name_en` existiert; für IT/FR Fallback auf DE (out-of-scope, da `menu_items` keine IT/FR-Spalten hat)
- Statische UI-Strings (Buttons, Headlines, Datumsformate via `date-fns/locale` de/enUS/it/fr) ebenfalls lokalisieren

### 4. Datumsformatierung
`date-fns/locale` `de`, `enUS`, `it`, `fr` je nach `lang` wählen (`format(..., { locale })`).

## Außerhalb des Umfangs
- Übersetzung von freien Textfeldern (Cover-Letter, Notizen) — bleiben DE
- Übersetzung der Standard-`menu_items` (eigener Workflow nötig)
- Email-Versand in IT/FR

## Technische Details
- Files: `useOfferBuilder.ts` (Snapshot), `PublicOffer.tsx` (Switcher + Locale), `FinalOfferView.tsx` + `ProposalView.tsx` (Helper-Aufrufe), neuer Helper `src/lib/offerLang.ts`
- Keine DB-Migration nötig (Spalten existieren bereits)
- Keine Backend-Änderungen
