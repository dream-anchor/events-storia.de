# Druck- & Export-System für Anfragen

## Ziel
Vier Druckdokumente und ein Excel-Export — sauber für Küche, Service, Buchhaltung und Tagesplanung. Jeweils als PDF-Download **und** Browser-Druck verfügbar.

## Die fünf Outputs

### 1. Küchenzettel (`KitchenSheet`)
**Zweck:** Kochcrew. Eine Anfrage = eine Seite.

Inhalt:
- Kopf: Auftrags-Nr., Datum, Uhrzeit, „IN HAUS" / „AUSSER HAUS"
- Kunde: Name, Firma, Gästeanzahl
- **Allergene/Unverträglichkeiten** (fett, oben, eigener Block)
- Menü (Gänge, Items, Mengen) — **ohne Preise**
- Getränke
- Sonderwünsche (aus `internal_notes`/Quote-Notes)
- Bei Außer Haus: Liefer-/Abholzeit, Adresse

### 2. Service-Laufzettel (`ServiceSheet`)
**Zweck:** Service- und Eventcrew vor Ort.

Inhalt:
- Kopf: Auftrags-Nr., Datum, Aufbau-/Start-/Endzeit
- Location-Block: In-Haus-Raum **oder** vollständige Außer-Haus-Adresse mit Stockwerk/Aufzug
- Gästeanzahl, Sitzordnung, Anrede VIP-Gäste
- Kontakt vor Ort (Telefon Kunde)
- Equipment-Liste (aus `equipment_catalog`-Auswahl)
- Sonderwünsche
- **Keine Preise**, **kein Detail-Menü** (nur Eckdaten)

### 3. Komplettauftrag (`FullOrderSheet`)
**Zweck:** Buchhaltung, interne Abwicklung.

Inhalt:
- Kopf: Auftrags-Nr., Status, Datum
- Kunde + Rechnungsadresse
- Komplett-Menü mit Einzel- und Gesamtpreisen, Gästeanzahl × Pers.-Preis
- Equipment + Preise
- Zahlungsplan: Anzahlung, Restzahlung, Zahlungsstatus, LexOffice-Rechnungs-Nr.
- Versionshistorie (welche Angebotsversion wurde angenommen)

### 4. Tagesplan (`DayPlanSheet`)
**Zweck:** Schichtplanung, Wochenübersicht.

Inhalt:
- Pro Tag eine Sektion (gruppiert nach `preferred_date`)
- Tabelle: Zeit · Kunde · Gäste · Location · Menü-Kurz · Verantwortlich
- Footer: Gesamt-Gäste/Tag, Anzahl Events/Tag

### 5. Event-Liste (`EventListExport`) — PDF + Excel
**Zweck:** Buchhaltung, GF, Übersicht.

Spalten (PDF kompakt, Excel vollständig):
| Datum | Zeit | Kunde | Firma | Gäste | Typ | Adresse | Status | Gesamt | Anzahlung | Rest offen | Verantwortlich | Notizen |

Filter (vor Generierung):
- Zeitraum: Diese Woche / Nächste Woche / Aktueller Monat / Frei wählbar
- Status: Multi-Select (Gebucht / Angebot verschickt / In Bearbeitung)
- Typ: In Haus / Außer Haus / beide
- Verantwortlich: alle / einzelner Mitarbeiter

## UI-Integration

### A) Detailseite einer Anfrage (`SmartInquiryEditor`)
Neuer **Drucken**-Button in der Toolbar oben rechts → Dropdown:
- 🍳 Küchenzettel
- 🛎 Service-Laufzettel
- 📋 Komplettauftrag

Jeder Eintrag öffnet eine Vorschau-Modal mit zwei Aktionen:
- **PDF herunterladen**
- **Drucken** (Browser-Dialog)

### B) Listenansicht (`EventsList` unter `/admin/inquiries`)
Zwei neue Bereiche:

**Massenaktionen** (sichtbar, sobald ≥1 Anfrage angehakt):
- Bulk-Druck Küchenzettel (gewählte → ein PDF, je 1 Seite)
- Bulk-Druck Service-Laufzettel
- Bulk-Druck Komplettauftrag

**Filterleiste-Ergänzung** „Listen & Exporte":
- 📅 Tagesplan drucken (mit Zeitraum-Auswahl)
- 📊 Event-Liste drucken (PDF mit Filtern)
- 📈 Event-Liste exportieren (Excel mit Filtern)

## Technische Umsetzung

### Stack
- **PDF-Generierung:** `@react-pdf/renderer` (komponentenbasiert, sauber paginiert, läuft im Browser — kein Edge-Function-Roundtrip nötig). Liefert sowohl Download als auch Inline-Render für Druckvorschau.
- **Excel-Export:** `xlsx` (SheetJS) — bereits etabliert; eine `.xlsx`-Datei mit Header-Styling.
- **Browser-Druck:** Print-CSS (`@media print`) + `window.print()` auf der gleichen React-PDF-Vorschau.

### Neue Dateien (Komponenten)
```
src/components/admin/refine/print/
  KitchenSheet.tsx           ← React-PDF Document
  ServiceSheet.tsx
  FullOrderSheet.tsx
  DayPlanSheet.tsx
  EventListPdf.tsx
  PrintMenu.tsx              ← Dropdown im Editor
  PrintPreviewDialog.tsx     ← Modal mit Vorschau + DL/Druck
  ExportFilters.tsx          ← Zeitraum + Status + Typ
  exportEventsXlsx.ts        ← XLSX-Generator
  fetchPrintData.ts          ← gemeinsame Datenholung (1 Query je Anfrage)
```

### Neue Hooks
```
src/hooks/usePrintInquiry.ts   ← lädt vollständige Daten für 1 Inquiry
src/hooks/usePrintInquiries.ts ← lädt Daten für N Inquiries (Bulk)
```

### Daten
Alle nötigen Felder existieren bereits in:
- `event_inquiries` (Kunde, Datum, Adresse, Status, Zahlung)
- `inquiry_offer_options` (Menü-Auswahl, Preis, Pakete)
- `inquiry_offer_history` (welche Version angenommen)
- `equipment_catalog` (für Service-Sheet)
- `menu_items` / `menu_categories` (für Item-Namen + Allergene)

Kein Schema-Change nötig.

### Print-Layout-Standards
- A4 hoch, 20mm Ränder
- Helvetica (mitgeliefert in @react-pdf, kein Font-Loading)
- Schwarz/weiß-tauglich, Logo SW oben links
- Footer: Druckdatum, Seite X von Y, „events-storia.de"
- Versionsnummer der Anfrage im Footer (Audit-Trail)

## Reihenfolge der Implementierung
1. `@react-pdf/renderer` + `xlsx` als Dependencies hinzufügen
2. Gemeinsame Datenholung (`fetchPrintData`)
3. Drei Detail-Sheets (Kitchen, Service, FullOrder) + Vorschau-Dialog
4. Druck-Dropdown im `SmartInquiryEditor`
5. Bulk-Aktionen + Massenauswahl in `EventsList`
6. Tagesplan + Event-Liste-PDF
7. Excel-Export

## Was bewusst NICHT mit reinkommt
- Edge-Function-PDF-Generierung (Browser reicht, schneller, kein Cold-Start)
- E-Mail-Versand der Sheets (Folge-Feature; PDFs können manuell angehängt werden)
- Templates/Branding-Editor (Layout fix, kann später konfigurierbar werden)

## Verifikation
- Drei Inquiry-Typen testen: In-Haus-Menü, Außer-Haus-Catering, Reisegruppe
- Bulk: 5 Anfragen → 1 PDF mit 5 Seiten
- Excel: Spalten korrekt, Zahlen als Zahlen (nicht Strings), Filter wirken
- Druck-CSS: Im Browser-Druckdialog erscheint nur das Sheet, keine Admin-Chrome
