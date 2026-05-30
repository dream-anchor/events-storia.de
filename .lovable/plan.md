## Ziel

Bereits hinzugefügte Getränke (Modus „Positionen") sollen — wie Speisen — inline editierbar sein. Aktuell ist die Bezeichnung nur ein statischer `<span>`, nur Preis/Menge/Pricing-Modus sind änderbar.

## Änderung

**Datei:** `src/components/admin/refine/InquiryEditor/OfferBuilder/DrinkSection.tsx`

Bezeichnung der einzelnen Getränke-Zeile editierbar machen, analog zu `InlineCourseEditor.tsx`:

- Lokaler State `editingIdx` + `tempName` (per Zeile via Map oder pro Zeile-Component).
- Statt `<span>{item.name}</span>` ein Container mit:
  - Default: Name + kleines `Pencil`-Icon (sichtbar bei Hover wie bei Speisen)
  - Edit-Modus: `<Input>` mit `autoFocus`, speichern bei Blur/Enter, abbrechen bei Escape
- Beim Speichern: `handleUpdateEinzeln(idx, { name: tempName.trim() })` (nur wenn nicht leer).

Optional, wenn klein: das Pencil-Icon nur anzeigen wenn `!disabled`.

## Out of scope

- Keine Änderungen an Pauschale/Weinbegleitung (haben keine Liste).
- Keine Änderung an Preis-/Mengen-/PriceMode-Logik (funktioniert bereits).
- Keine Schema-/Type-Änderungen (`DrinkEinzelnItem.name` existiert bereits).
- Keine Mobile-Sheet-Anpassung (Drinks haben keine eigene Sheet-Komponente; Inline-Edit funktioniert touch-tauglich).
