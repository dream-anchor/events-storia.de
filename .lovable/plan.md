

# Maestro Admin: Vollständige Mobile-Tauglichkeit (Smartphone-First)

## Ziel

Maestro fühlt sich auf dem Smartphone genauso komfortabel an wie auf dem Desktop. Kein abgeschnittener Inhalt, kein verdeckter Button, keine horizontale Scroll-Falle, jede Aktion mit Daumen erreichbar, sichere Bereiche (Notch/Home-Indicator) berücksichtigt.

## Befund (heute, mobile 375 px)

| Bereich | Problem | Auswirkung |
|---|---|---|
| **DataTable** (`Events`, `Orders`, `Bookings`, `Quotations`, `Invoices`) | `<Table>` mit `min-w-[120-240px]`-Spalten ohne Wrapper → erzwingt Seiten-Scroll horizontal | Spalten verschwinden rechts, Klick-Targets unklar |
| **Sticky Header InquiryEditor** | `-mx-6 px-6` + `flex justify-between` → bricht auf 375 px, Avatar+Name+Badge+Aktionen kollidieren | Header scrollt seitlich, „Zurück"-Pfeil knapp |
| **Wizard** (`WizardConfigurator`) | `lg:grid-cols-12` greift erst ab 1024 px; `LiveCalculation` als 4-col-Spalte wird unter 1024 px ans Ende geschoben → Admin verliert Preisübersicht | Preis nicht sichtbar während Konfiguration |
| **MultiOfferComposer** | `grid-cols-1 lg:grid-cols-5` mit `min-h-[calc(100vh-280px)]` → mobil eine sehr lange Säule, Kalkulationspanel weit unten | Send-Button + Kalkulation außer Sicht |
| **Fixed-Cols ohne Breakpoint** | `grid-cols-2/3/4` in Dashboard, EventDNACard, LocationBlock, MenuItemSelector, ModeSelector, CateringModules | Tabs/Karten brechen oder werden gestaucht (Text-Overflow, Icon-only ohne Label) |
| **AdminLayout-Header** | „Neue Anfrage"-Button und Test-Toggle `hidden sm:flex` → mobile Hauptaktion fehlt | Admin kann mobil keine neue Anfrage anlegen |
| **OptionCard, InlineDrinkEditor** | `SelectTrigger min-w-[200px]` in flex-row → erzwingt Overflow | Dropdowns ragen über Card hinaus |
| **PageContent Padding** | `main p-4 lg:p-6`, aber FloatingPillNav fix bottom 16 → letzte Karte unter Nav verdeckt | Cut-off der untersten Zeile |

## Lösungs-Architektur (5 Schichten, additiv, ohne Logik-Bruch)

### Schicht 1 — Mobile-Grundlagen (App-weit, in `index.css` + `AdminLayout`)

- **Safe-Area-Insets** überall: `pb-[env(safe-area-inset-bottom)]` für jeden fixierten Bottom-Container, `pt-[env(safe-area-inset-top)]` für Sticky Header. Verhindert Überlappung mit Home-Indicator/Notch.
- **Body-Scroll-Lock-Patch** in Sheets/Dialogs: `overflow-anchor: none` + iOS-touch-fix.
- **Globaler Schutz**: `body { -webkit-text-size-adjust: 100%; overflow-x: hidden; }` und `.admin-layout main { padding-bottom: calc(5rem + env(safe-area-inset-bottom)); }` damit FloatingPillNav nichts verdeckt.
- **Touch-Targets**: alle Icon-Buttons im Admin-Theme min. 44 × 44 px (`size-11` statt `size-10` auf `< sm`).

### Schicht 2 — `AdminLayout` mobil-optimieren

- Header bekommt **2 Reihen** auf `< sm`: Reihe 1 = Burger + Title + Notifications + Avatar. Reihe 2 = Suchfeld als Voll-Breite (heute komplett ausgeblendet).
- **„Neue Anfrage" als FAB** mobil: `fixed bottom-20 right-4 lg:hidden` (über FloatingPillNav, mit Safe-Area). Desktop bleibt unverändert.
- **Test-Toggle** wandert auf mobil in den Burger-Sidebar-Footer (statt versteckt).
- Page-Padding: `px-3 sm:px-4 lg:px-6 pb-24 lg:pb-6`.

### Schicht 3 — `DataTable` Mobile-Card-Mode

- Neue Prop `mobileCardRender?: (row) => ReactNode` an `DataTable`. Wenn gesetzt UND `useIsMobile() === true` → render statt `<Table>` ein vertikales Stack mit Cards (rounded-2xl, alle wichtigen Felder als Key-Value-Liste, `onClick={onRowClick}`).
- Filter-Pills: `flex flex-wrap` + horizontaler Scroll-Container bei Overflow (`scrollbar-hide overflow-x-auto`).
- **Fallback** ohne `mobileCardRender`: Tabelle bekommt automatisch `<div className="overflow-x-auto -mx-3 px-3">…</div>` Wrapper, damit horizontaler Scroll wenigstens sauber gekapselt ist (kein Layout-Bruch der Page).
- **`EventsList`, `OrdersList`, `EventBookingsList`, `LexOfficeInvoicesList`** bekommen jeweils einen kompakten `mobileCardRender` (Name, Datum, Status-Badge, Betrag, Chevron). Sortier-Pills bleiben oben sichtbar.

### Schicht 4 — Inquiry-Editor + Wizard mobil

- **Sticky Header `SmartInquiryEditor`** wird kompakter mobil:
  - Reihe 1 (immer): Zurück + Avatar + Name (truncate) + Status-Badge.
  - Reihe 2 (immer mobil, hidden sm): Meta (Firma · Datum · Gäste) als kleine Chips, scrollbar.
  - „PDF herunterladen" als Icon-Button mobil (`sm:hidden` zeigt nur Icon).
- **WizardConfigurator** Layout-Switch:
  - `lg:grid-cols-12` → `md:grid-cols-12` (greift bereits ab 768 px).
  - Mobil (`< md`): `LiveCalculation` als **sticky bottom-bar** (zusammenklappbar, zeigt Total + „Details" Toggle, der ein Bottom-Sheet öffnet mit voller Kalkulation). So bleibt der Preis immer sichtbar während der Admin Pakete/Gäste konfiguriert.
  - Wizard-Step-Pills: `overflow-x-auto` mit Snap-Scroll, aktiver Step zentriert sich automatisch (`scrollIntoView({inline: 'center'})`).
- **MultiOfferComposer**:
  - Tab-Navigation zwischen „Optionen" und „Vorschau/Kalkulation" mobil (statt 5-col-Grid). Zwei Tabs: **Optionen** | **Kalkulation & Vorschau**. Desktop-Verhalten unverändert via `lg:grid-cols-5`.
  - Send-Bar wird `fixed bottom-0` mobil mit „Versenden"-Primary-Button immer erreichbar.
- **OfferBuilder / OptionCard**:
  - `min-w-[200px]` an Selects entfernen → `w-full sm:min-w-[200px]`.
  - Mode-Tile-Grid `grid-cols-2 gap-2` → bleibt, ist mobil OK.
  - `OptionCard`-Footer (Add-Course, Trash, Mode-Select) gestapelt mobil: `flex-col sm:flex-row`.

### Schicht 5 — Komponenten-Hotspots gefixt

- `EventDNACard`, `LocationBlock`, `InquiryDetailsPanel`: `grid-cols-2/3` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- `Dashboard` Stat-Cards: `grid-cols-3` → `grid-cols-2 sm:grid-cols-3`.
- `MenuItemSelector`, `CateringModules`, `PackageMenuItemsEditor`: `TabsList grid-cols-4` → `flex overflow-x-auto` mit Snap-Pills (Standard-Pattern, das wir schon im Wizard nutzen).
- `InlineDrinkEditor`, `InlineCourseEditor`: Selects auf `w-full sm:w-auto`.
- `OfferArchivePreview`: 3 iframe-Blöcke mobil als `Tabs` (E-Mail | Kunden-Ansicht | PDF), Desktop bleibt 3-Spalten-Stack.
- `OfferSendPreview`: identische Behandlung wie Archive (gleiche Tab-Lösung mobil).
- `Timeline`, `ConversationThread`: `max-w-` Klassen prüfen, Bubbles auf `max-w-[85%] sm:max-w-md`.

### Schicht 6 — Globale Patterns (neu, wiederverwendbar)

Drei neue Helper unter `src/components/admin/shared/responsive/`:

1. **`MobileBottomBar.tsx`** — fixed bottom Container mit Safe-Area, max 64 px, optional kollabierbar. Wird in Wizard und MultiOfferComposer eingesetzt.
2. **`ScrollableTabs.tsx`** — Tab-List die mobil horizontal scrollt + aktiven Tab zentriert. Ersetzt alle `TabsList grid-cols-4` Vorkommen schrittweise.
3. **`MobileCardList.tsx`** — Standard-Card für DataTable-Mobile-Mode. Konsistente Optik (Avatar/Icon links, Titel + Subline, Badge rechts, Chevron).

## Risiko-Management

- **Kein Logik-Bruch**: Jede Änderung ist rein CSS/Layout. Keine Hooks, keine Datenflüsse, keine Edge Functions, keine Schema-Änderung.
- **Desktop unverändert**: Alle Anpassungen via Mobile-First-Breakpoints (`sm:`, `md:`, `lg:`). Bestehende Desktop-Klassen bleiben oder werden als `lg:`-Variante erhalten.
- **Schritt-für-Schritt-Rollout**: Reihenfolge so, dass nach jedem Schritt alles funktional bleibt.
- **Regression-Check** nach jeder Schicht: per Browser-Tool an 375 px (iPhone SE), 390 px (iPhone 14), 414 px (Plus), 768 px (iPad), 1024 px (Desktop) screenshoten und prüfen.

## Geänderte Dateien (Übersicht)

**App-weit:**
- `src/index.css` — Safe-Area-Variablen, body overflow-x, touch-targets
- `src/components/admin/refine/AdminLayout.tsx` — 2-row mobile header, mobile FAB, Test-Toggle in Sidebar-Footer

**DataTable-Schicht:**
- `src/components/admin/refine/DataTable.tsx` — `mobileCardRender` Prop, Overflow-Wrapper Fallback
- `src/components/admin/refine/EventsList.tsx`
- `src/components/admin/refine/OrdersList.tsx`
- `src/components/admin/refine/EventBookingsList.tsx`
- `src/components/admin/refine/LexOfficeInvoicesList.tsx`
- `src/components/admin/refine/PackagesList.tsx`
- `src/components/admin/refine/MenuItemsList.tsx`

**Editor / Wizard:**
- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` — kompakter Sticky-Header mobil
- `src/components/admin/refine/InquiryEditor/MultiOffer/WizardConfigurator.tsx` — `md:grid-cols-12`, sticky Calculation-Bar
- `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` — mobile Tabs, fixed Send-Bar
- `src/components/admin/refine/InquiryEditor/MultiOffer/LiveCalculation.tsx` — kollabierbare Mobile-Variante
- `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx` — Footer stapelt, Selects full-width
- `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineDrinkEditor.tsx`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx`
- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` — 3-Block→Tabs mobil
- `src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx` — gleich

**Form-Cards mit fixen Grids:**
- `src/components/admin/refine/InquiryEditor/EventDNACard.tsx`
- `src/components/admin/refine/InquiryEditor/LocationBlock.tsx`
- `src/components/admin/refine/InquiryEditor/InquiryDetailsPanel.tsx`
- `src/components/admin/refine/InquiryEditor/CateringModules.tsx`
- `src/components/admin/refine/InquiryEditor/MenuItemSelector.tsx`
- `src/components/admin/refine/InquiryEditor/OfferBuilder/ModeSelector.tsx`
- `src/components/admin/refine/Dashboard.tsx`
- `src/components/admin/refine/PackageMenuItemsEditor.tsx`
- `src/components/admin/refine/CateringOrderEditor.tsx`
- `src/components/admin/refine/EventBookingEditor.tsx`
- `src/components/admin/refine/CreateManualInvoiceDialog.tsx`

**Neue Helper:**
- `src/components/admin/shared/responsive/MobileBottomBar.tsx`
- `src/components/admin/shared/responsive/ScrollableTabs.tsx`
- `src/components/admin/shared/responsive/MobileCardList.tsx`

Keine DB-Migration, keine Edge-Function-Änderung. Etwa 25 Dateien, ausschließlich Layout/CSS, additive Patterns.

## Verifikation (nach Implementierung)

Per Browser-Tool an Viewports **375 / 390 / 414 / 768 / 1024 / 1366** screenshoten und prüfen:

1. **AdminLayout**: Burger öffnet Sidebar, Suche erreichbar, FAB sichtbar, kein horizontaler Scroll auf der Seite.
2. **EventsList mobil**: Card-Liste statt Tabelle, alle Felder lesbar, Klick öffnet Editor.
3. **SmartInquiryEditor mobil**: Header zweireihig, „Zurück" + Avatar + Name + Status, kein Overflow.
4. **Wizard mobil (Step 2 Konfigurator)**: Pakete als 1-col-Stack, Step-Pills horizontal scrollbar, Preis-Bar fixed unten.
5. **MultiOfferComposer mobil**: Tab-Switch zwischen Optionen und Kalkulation, Send-Button immer sichtbar fixed-bottom über FloatingPillNav.
6. **OfferSendPreview mobil**: 3 Blöcke als Tabs, jeder iframe füllt Viewport-Breite.
7. **CommandPalette mobil**: füllt Viewport, Suche fokussiert, ESC schließt.
8. **CateringModules / MenuItemSelector mobil**: Tab-Pills horizontal scrollbar, kein Text-Truncate.
9. **Dialoge** (CreateManualInvoice, ResponsiveDialog): nutzt bereits Drawer auf mobil — verifizieren, dass Inhalt scrollt und Submit-Button nicht verdeckt ist (`pb-[env(safe-area-inset-bottom)]`).
10. **PublicOffer** (Kunden-Seite, falls auch Admin sie nutzt): unverändert, da bereits responsive — nur kontrollieren, kein Regress.

