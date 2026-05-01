
# Mobile Feature-Parität: Vollständiges Konzept

Systematisches Audit aller 12 Admin-Seiten auf einem 390px Viewport. Jede fehlende Funktionalität ist dokumentiert mit konkreter Lösung.

---

## Seiten-Status im Überblick

| Seite | Status | Probleme |
|-------|--------|----------|
| Dashboard | OK | -- |
| EventsList | OK | Header-Buttons overflow, FAB vs. BulkActionBar Collision |
| SmartInquiryEditor | OK | Kleinere Label-Probleme |
| WizardConfigurator | KRITISCH | LiveCalculation komplett unsichtbar |
| EventBookingsList | PROBLEM | Layout bricht auf 390px |
| LexOffice-Listen | PROBLEM | Kein mobileCardRender, Tabelle scrollt horizontal |
| OrdersList | OK | (hat mobileCardRender, keine Selection — aber Desktop auch nicht) |
| CateringOrderEditor | OK | Responsives Grid vorhanden |
| EventBookingEditor | OK | Responsives Grid vorhanden |
| OfferSendPreview | OK | Sticky-Footer funktioniert mit flex-col auf Mobile |
| PackagesList | OK | Grid-Layout passt sich an |
| MenuItemsList | OK | Englischer Name hidden auf Mobile — gewollt |
| Settings | OK | Einfaches Layout |

---

## Priorität 1 — Kritische Lücken

### A) WizardConfigurator: LiveCalculation fehlt auf Mobile
**Datei**: `src/components/admin/refine/InquiryEditor/MultiOffer/WizardConfigurator.tsx`

Die gesamte rechte Sidebar (Preis-Kalkulation, Gänge-Zusammenfassung, „Weiter"-Button) ist `hidden lg:block` und damit auf Mobile komplett unsichtbar. Ohne den „Weiter"-Button kann der User den Wizard nicht durchklicken.

**Lösung**: Mobile Sticky-Footer-Bar unter dem Wizard-Content:
- Zeile 1: Kompakte Preis-Anzeige (z.B. „€ 2.450 · 50 Gäste")
- Zeile 2: CTA-Button (gleicher `onNextStep`/`nextStepLabel` wie LiveCalculation)
- Nur auf `lg:hidden` sichtbar, damit Desktop unverändert bleibt
- Verwendet `MobileBottomBar` für Safe-Area und z-index
- Optional: Tap auf Preis expandiert ein Sheet mit voller Kalkulation

### B) EventBookingsList: Responsives Card-Layout
**Datei**: `src/components/admin/refine/EventBookingsList.tsx`

Aktuell `flex items-center justify-between` mit 48px Status-Icons und `text-lg`/`text-base` Schrift. Auf 390px bricht das Layout — die rechte Spalte (Datum, Gäste, Betrag, „Menü festlegen"-Button) wird gequetscht.

**Lösung**:
- Status-Icons: 48px → 36px auf Mobile (per `size-9 sm:size-12`)
- Schrift: `text-lg` → `text-base sm:text-lg`, `text-base` → `text-sm sm:text-base`
- Layout: `flex-col sm:flex-row` statt `justify-between` — rechte Infos unterhalb auf Mobile
- „Menü festlegen"-Button: volle Breite auf Mobile

---

## Priorität 2 — Wichtige UX-Verbesserungen

### C) LexOffice-Listen: Mobile Cards statt Tabelle
**Datei**: `src/components/admin/refine/LexOfficeInvoicesList.tsx`

Die `DataTable` hat keinen `mobileCardRender` — auf 390px zeigt sie die volle Tabelle mit horizontalem Scroll. Spalten werden abgeschnitten, Interaktion ist schwierig.

**Lösung**: `mobileCardRender` mit `MobileCardItem` ergänzen:
- Title: Dokumentnummer (z.B. „AG-2024-0045")
- Subtitle: Kundenname
- Meta: Datum
- Trailing: Betrag + Status-Badge (Entwurf/Offen/Bezahlt/Überfällig)

### D) FAB vs. BulkActionBar Collision
**Datei**: `src/components/admin/refine/AdminLayout.tsx`

Der FAB „Neue Anfrage" (`fixed right-4 bottom-[1rem]`) überlappt mit der BulkActionBar wenn Selektion aktiv ist. Beide sind fixed am unteren Bildschirmrand.

**Lösung**: FAB erhalt eine optionale Prop `hideFab` oder wird per CSS/State ausgeblendet wenn BulkActionBar sichtbar ist. Konkret: `EventsList` leitet `selectedIds.length > 0` als `showCreateButton={selectedIds.length === 0}` weiter.

### E) EventsList Header: View-Toggle compact
**Datei**: `src/components/admin/refine/EventsList.tsx`

Das View-Toggle (Tabelle/Kanban) mit Text-Labels + „Neue Anfrage"-Button nimmt auf 390px die gesamte Header-Breite ein und erzwingt Zeilenumbruch.

**Lösung**:
- Toggle: Text-Labels `hidden sm:inline` — nur Icons auf Mobile
- „Neue Anfrage"-Button: bereits `hidden sm:flex` + FAB vorhanden — kein Handlungsbedarf
- Gesamten Header-Bereich `flex-wrap` auf Mobile

---

## Priorität 3 — Polish

### F) SmartInquiryEditor: Button-Labels auf Mobile
**Datei**: `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`

„Kunden-Ansicht" und „LexOffice PDF" zeigen auf Mobile nur Icons ohne Text — nicht sofort erkennbar.

**Lösung**: Bereits `title`-Attribute vorhanden. Keine Anderung notwendig — das ist akzeptabler Mobile-Kompromiss. Optional: kurze Labels als zweite Zeile unter dem Icon.

### G) OfferSendPreview: Button-Text Overflow
**Datei**: `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx`

„Vorschau-Mail an mich & Ristorante" ist ein langer Button-Text. Auf Mobile werden die 3 Buttons vertikal gestapelt (`flex-col`), was funktioniert, aber viel vertikalen Platz braucht.

**Lösung**: Button-Text kürzen auf Mobile: `<span class="sm:hidden">Vorschau</span><span class="hidden sm:inline">Vorschau-Mail an mich & Ristorante</span>`

---

## Umsetzungsreihenfolge

1. **A** — WizardConfigurator Mobile-Footer (kritisch, blockiert Workflow)
2. **B** — EventBookingsList responsive Layout
3. **D** — FAB-Collision Fix (1 Zeile)
4. **E** — EventsList Header compact
5. **C** — LexOffice Mobile Cards
6. **G** — OfferSendPreview Button-Text
