
# Mobile Selektions- und Bulk-Action-Konzept

## Problem

Auf dem Handy rendert die `DataTable` eine vereinfachte `mobileCardRender`-Ansicht, die die Checkbox-Spalte komplett überspringt. Dadurch fehlt jede Möglichkeit, Anfragen auszuwählen und Bulk-Aktionen (Archivieren, Zuweisen, Priorität etc.) auszuführen. Die `BulkActionBar` ist ebenfalls nur für Desktop optimiert (horizontale Button-Reihe).

## Konzept: Native App-Feeling

### 1. Selektionsmodus per Long-Press (wie iOS/Android)

- **Aktivierung**: Long-Press (600ms) auf eine Karte aktiviert den Selektionsmodus
- **Im Selektionsmodus**: Jede Karte zeigt links eine animierte Checkbox. Tap auf eine Karte selektiert/deselektiert (statt Navigation)
- **Header**: "X ausgewahlt" mit "Alle auswahlen" und "Abbrechen" Buttons
- **Deaktivierung**: "Abbrechen" oder wenn Selektion auf 0 fallt

### 2. Mobile-optimierte Bulk-Action-Bar

- Statt der breiten Desktop-Leiste: ein kompaktes Bottom-Sheet mit Icon-Grid
- Icons fur: Kontaktiert, Zuweisen, Prioritat, Archivieren, Test-Toggle
- Responsive Layout: 2x3 Grid statt horizontaler Button-Reihe
- Nutzt `MobileBottomBar` fur safe-area und z-index

### 3. Alternative: Einfacher Checkbox-Modus (empfohlen)

Da Long-Press technisch aufwendiger ist und Accessibility-Probleme hat, empfehle ich die einfachere Variante:

- **Toggle-Button** oben neben der Suche: "Auswahlen" Icon-Button
- Aktiviert Selektionsmodus: Checkboxen erscheinen links in jeder Karte
- Tap auf Karte = Toggle Checkbox (nicht Navigation)
- Bottom-Bar zeigt Bulk-Aktionen als scrollbare Pill-Reihe

---

## Technische Umsetzung

### Datei: `src/components/admin/refine/DataTable.tsx`

1. Neuer State `mobileSelectionMode` (boolean)
2. Im Mobile-Bereich (Zeile 246-261): Toggle-Button "Auswahlen" in der Toolbar
3. Wenn `mobileSelectionMode` aktiv: Jede Karte wird in einen Wrapper gerendert mit Checkbox links
4. Tap auf Karte im Selektionsmodus togglet `row.toggleSelected()` statt `onRowClick`

### Datei: `src/components/admin/shared/BulkActionBar.tsx`

1. `useIsMobile()` Hook einbauen
2. Auf Mobile: statt horizontaler Buttons ein kompaktes Bottom-Sheet-Layout
3. Scrollbare Icon-Pill-Reihe: Kontaktiert | Zuweisen | Prioritat | Archivieren | Test
4. Safe-area padding via `pb-[calc(...env(safe-area-inset-bottom))]`

### Datei: `src/components/admin/shared/responsive/MobileCardList.tsx`

1. Neue Prop `selectable` + `selected` + `onToggleSelect` fur `MobileCardItem`
2. Wenn `selectable`: Checkbox-Circle links, kein Chevron, onClick togglet Selektion

### Datei: `src/components/admin/refine/EventsList.tsx`

1. `mobileCardRender` muss keine Anderungen brauchen -- die Selektionslogik wird im DataTable-Wrapper gehandhabt

---

## UX-Flow (Mobile)

```text
[Normal]                    [Selektionsmodus]
+--------------------+      +--------------------+
| [Suche] [Auswahlen]|      | 3 ausgewahlt  [X]  |
+--------------------+      +--------------------+
| Eingang | Alle |...|      | Eingang | Alle |...|
+--------------------+      +--------------------+
| > Mueller, 20.05   |      | [x] Mueller, 20.05 |
| > Schmidt, 25.05   |      | [ ] Schmidt, 25.05  |
| > Weber, 01.06     |      | [x] Weber, 01.06    |
+--------------------+      +--------------------+
                             | Kontaktiert|Zuweisen|
                             | Archiv|Prio|Test    |
                             +--------------------+
```

## Ergebnis

- Alle Desktop-Funktionen auch auf Mobile verfugbar
- App-artiges Erlebnis mit klarem Selektionsmodus
- Bulk-Aktionen (Archivieren, Zuweisen, Prioritat etc.) mobil nutzbar
- Kein "verstecktes" Feature -- sichtbarer "Auswahlen"-Button
