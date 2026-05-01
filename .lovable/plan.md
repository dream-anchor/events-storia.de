
## Problem-Analyse

Ich habe die App auf 390px (iPhone) überprüft und folgende Probleme gefunden:

### 1. "KI generieren" Button nicht sichtbar auf Mobile
Der Button existiert im DOM, ist aber im Header des "Anschreiben"-Bereichs (`EmailComposer.tsx`) zusammen mit "Vorlage"-Dropdown, Copy-Button und dem Badge in einer Zeile — bei 390px Breite wird er abgeschnitten/überlappt.

### 2. "Angebot bearbeiten" Button fehlt komplett
Die Änderung wurde in `MultiOfferComposer.tsx` gemacht — aber die App verwendet `OfferBuilder.tsx` für die Angebotsbearbeitung. Der OfferBuilder hat `isLocked={false}` hardcoded (Zeile 307) und zeigt keinen "Angebot bearbeiten" CTA. Das alte Lock-System greift hier nicht.

Die gute Nachricht: Das Angebot IST editierbar (nicht gesperrt). Der Benutzer kann Optionen, Preise und Menüs direkt ändern. Es fehlt nur die klare visuelle Kommunikation.

### 3. Tab "Details" ist auf Mobile abgeschnitten
Die Tab-Leiste zeigt nur 3 von 4 Tabs ("Angebot", "Kommunikation", "Aufgaben") — "Details" ist nicht sichtbar ohne horizontales Scrollen, und es gibt keinen visuellen Hinweis dafür.

---

## Geplante Änderungen

### A. EmailComposer.tsx — Mobile-Layout für Buttons
- Header auf Mobile in 2 Zeilen aufteilen: Titel+Badge oben, Buttons unten
- "KI generieren" als prominenten Button darstellen (nicht `ghost`, sondern `default` mit Sparkles-Icon)
- Auf Mobile volle Breite oder zumindest gut sichtbar

### B. OfferBuilder.tsx — Versioning-Banner verbessern  
- Der grüne "Version X gesendet — Synchron mit Kunde" Banner wird ergänzt um einen klaren Hinweis: "Zum Bearbeiten einfach Optionen, Preise oder Menü anpassen. Änderungen werden automatisch als neue Version gespeichert."
- Der amber "Entwurf für Version X" Banner bleibt und zeigt klar an, dass der Kunde die Änderungen noch nicht sieht

### C. EmailComposer.tsx — "KI generieren" Button größer und prominenter auf Mobile
- Auf Mobile: separater, volle-Breite CTA-Button unter dem Textarea wenn noch kein Email-Draft vorhanden
- Amber/Primary Gradient wie die anderen CTAs

### D. Tab-Liste mobile Scroll-Hinweis
- Gradient-Fade am rechten Rand der Tab-Leiste hinzufügen, um anzuzeigen dass mehr Tabs vorhanden sind

---

## Technische Details

| Datei | Änderung |
|-------|----------|
| `src/components/admin/refine/InquiryEditor/OfferBuilder/EmailComposer.tsx` | Mobile-responsive Header, prominenter KI-Button |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx` | Versioning-Banner mit Bearbeitungshinweis |
| `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` | Tab-Scroll-Indikator |

Keine Datenbankänderungen erforderlich.
