## Problem
Klick auf eine Reisegruppen-Zeile in „Anfragen" navigiert zu `/admin/reisegruppen?id=…`. Das öffnet die alte Reisegruppen-Seite mit Sheet-Overlay – sichtbar als drittes Fenster über der alten Liste.

## Ziel
Reisegruppen-Anfragen sollen sich – wie alle anderen Anfragen – direkt im Anfragen-Tab öffnen, ohne Wechsel zur alten Seite.

## Umsetzung

1. **`GroupInquiriesList.tsx`**
   - Die interne Komponente `GroupInquiryDetail` exportieren (Named Export), damit sie wiederverwendet werden kann. Datei selbst bleibt vorerst bestehen (alte Route `/admin/reisegruppen` ist ohnehin nicht mehr im Menü).

2. **`UnifiedInquiriesList.tsx`**
   - State `selectedGroupId: string | null` hinzufügen.
   - `handleRowClick`: bei `serviceType === "group"` nicht mehr navigieren, sondern `setSelectedGroupId(r.id)`.
   - Am Komponentenende `<GroupInquiryDetail>` rendern, wenn `selectedGroupId` gesetzt ist; `inquiry` aus `records` (oder direkt aus dem `group_inquiries`-Query) auflösen, `onClose` setzt State zurück, `onUpdate` ruft `refetch()`.

3. **`UnifiedKanbanView.tsx`**
   - Row-Click-Handler analog: für `serviceType === "group"` einen Callback nach oben geben (`onOpenGroup(id)`), statt zu navigieren. `UnifiedInquiriesList` reicht dafür Setter durch.

## Nicht im Scope
- Alte Route `/admin/reisegruppen` bleibt funktional erreichbar (URL-Eingabe), wird aber nicht mehr verlinkt.
- Keine Backend-/Datenmodell-Änderungen.
