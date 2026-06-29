## Problem
Kategorien lassen sich nicht mehr per Drag & Drop verschieben. Das Grip-Icon ist sichtbar, aber dnd-kit erhält den PointerDown nicht zuverlässig, weil der Handle-Button **innerhalb** von `<CollapsibleTrigger asChild>` sitzt. Radix Slot legt eigene Pointer-Handler auf das Trigger-Element, und der verschachtelte Button stört die Sensor-Aktivierung (auch trotz `stopPropagation`).

Speisen innerhalb einer Kategorie funktionieren weiterhin, weil dort kein CollapsibleTrigger drumherum liegt.

## Lösung
Den Drag-Handle aus dem `CollapsibleTrigger` herausziehen und als Schwester-Element neben den Collapsible-Header rendern.

### Änderung in `src/components/admin/refine/MenuItemsList.tsx` – Komponente `CategorySection`

Neue Header-Struktur:

```text
<Card>
  <div className="flex items-stretch">           ← neuer äußerer Flex-Container
    {dragHandle}                                 ← Handle SEPARAT, nicht im Trigger
    <Collapsible className="flex-1">
      <CollapsibleTrigger asChild>
        <div className="...header...">           ← ohne {dragHandle}
          {chevron}
          {title/badge/desc}
          {action buttons (Edit/Archive/Trash)}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>... items ...</CollapsibleContent>
    </Collapsible>
  </div>
</Card>
```

- Handle bekommt einen kleinen vertikalen Padding-Wrapper, damit er optisch auf Header-Höhe sitzt (`flex items-center px-2 bg-muted/20`).
- `{dragHandle}` wird aus dem inneren Header-`<div>` (Zeile ~520) entfernt.
- Die existierende `SortableItem` / `SortableList`-Struktur bleibt unverändert.
- Keine Änderungen an `SortableList.tsx`, an Persistenz, oder an der Speisen-Sortierung.

### Was unverändert bleibt
- Speisen-Sortierung innerhalb Kategorien.
- Pakete- und Locations-Sortierung.
- `sortingDisabled` während aktiver Suche.
- Kategorie-Edit-Dialog inkl. Bild-Upload und Homepage-Slug.

## Verifikation
1. `/admin/menu` öffnen, Catering-Tab.
2. Eine Kategorie am Grip-Icon greifen und nach unten/oben verschieben → Reihenfolge ändert sich sofort, Toast „Reihenfolge gespeichert", Reload bewahrt neue Reihenfolge.
3. Klick auf Header (nicht Handle) klappt Kategorie weiterhin auf/zu.
4. Edit/Archiv/Delete-Buttons im Header funktionieren weiterhin.
5. Speisen-Sortierung innerhalb Kategorie unverändert funktionsfähig.
