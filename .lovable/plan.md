## Antwort auf deine Fragen

**1. Rechnung groß anzeigen per Klick?**
Aktuell gibt es nur kleine Icon-Buttons (Auge = Vorschau im neuen Tab, Pfeil = Download) im neuen "Belege"-Bereich unter der Anfrage. Die ganze Zeile ist nicht klickbar, und es gibt keine Inline-Großvorschau.

**2. Wo sehe ich, ob es mehrere Rechnungen gibt?**
Im selben "Belege"-Bereich (`LexofficeDocumentsCard`) unterhalb der Zahlungs-Karte im Inquiry-Editor. Dort werden ALLE LexOffice-Dokumente zum Auftrag chronologisch aufgelistet (Angebot, Anzahlungsrechnung, Schlussrechnung, Storno) mit Nummer, Datum, Betrag, Status-Badge und einer Anzahl-Badge im Header (z.B. "Belege 3"). Auf deinem Screenshot ist diese Karte nicht sichtbar, weil der "Rechnung senden"-Dialog offen ist — sie liegt rechts/unten im Editor selbst.

---

## Plan: UX-Verbesserung

### A) Ganze Zeile klickbar → große PDF-Vorschau
- Klick auf die Beleg-Zeile (außer auf die Action-Buttons) öffnet einen **großen Vorschau-Dialog** (statt nur neuer Browser-Tab)
- Neuer Dialog `LexofficeDocumentPreviewDialog`:
  - Vollbild-Modal (max-w-5xl, h-[90vh])
  - Eingebettete PDF-Vorschau via `<iframe src={blobUrl}>` (Browser-PDF-Viewer mit Zoom/Scroll)
  - Header: Beleg-Typ, Nummer, Status-Badge
  - Footer: Buttons "Download", "Stornieren" (falls erlaubt), "Schließen"
  - Bei Klick auf Auge-Icon ebenfalls dieser Dialog (kein neuer Tab mehr)

### B) Multi-Beleg-Sichtbarkeit verstärken
- Im Header der Karte: bei `docs.length > 1` kleiner Hinweis "X Belege" + Tooltip "Mehrere LexOffice-Dokumente vorhanden"
- Bei `kind='final'` mit gleichzeitig vorhandener `deposit` zusätzliche kleine Info-Zeile "Schlussrechnung + N Anzahlung(en)" zur schnellen Übersicht
- Sortierung bleibt: Angebot → Anzahlungen → Schlussrechnung → Stornos

### C) Visuelle Hierarchie in der Liste
- Aktive (nicht stornierte) Belege fett, Stornos ausgegraut + Badge "Storniert"
- Schlussrechnung mit Akzent-Rand links (subtile Hervorhebung)

### Dateien
- **Neu**: `src/components/admin/refine/InquiryEditor/LexofficeDocumentPreviewDialog.tsx`
- **Edit**: `src/components/admin/refine/InquiryEditor/LexofficeDocumentsCard.tsx` (Zeile klickbar, Preview-Dialog statt window.open, Multi-Beleg-Hinweis)

Keine Backend-/Edge-Function-Änderungen nötig — die Daten sind bereits da.
