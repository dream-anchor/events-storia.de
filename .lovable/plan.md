
# Angebot bearbeiten — Idiotensichere UX

## Was sich ändert

Das gesperrte Banner (Zeilen 425-446 in `MultiOfferComposer.tsx`) wird komplett überarbeitet, damit Nicht-Computer-Nutzer sofort verstehen, was zu tun ist.

### Vorher (aktuell)
- Kleines Lock-Icon, technischer Text: *"Angebot v3 versendet"*
- Kleiner Button rechts: *"Neues Angebot erstellen"*
- Erklärtext unten: *"Die gesendete Konfiguration ist schreibgeschützt..."*
- Problem: Nutzer versteht nicht, dass "Neues Angebot" = "einfach bearbeiten" bedeutet

### Nachher (neu)
- Grosser, auffälliger Banner mit klarer Botschaft
- **Haupttext**: *"Angebot wurde versendet"* mit Datum und Person
- **Grosser, prominenter Button**: *"✏️ Angebot bearbeiten"* (volle Breite auf Mobile)
- **Einfacher Hilfetext**: *"Änderungen werden automatisch als neue Version gespeichert"*
- Nach dem Klick: Dezentes Info-Banner oben: *"Version 3 — Entwurf (Änderungen noch nicht gesendet)"*

## Technische Umsetzung

### Datei: `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx`

1. **Locked Banner** (Zeilen 425-446) ersetzen:
   - Button-Text: `"Neues Angebot erstellen"` → `"Angebot bearbeiten"`
   - Icon: `Unlock` → `Pencil` (lucide-react)
   - Button-Stil: Outline → Primär-CTA (amber gradient, volle Breite auf Mobile)
   - Hilfetext vereinfachen zu einem einzigen, verständlichen Satz
   - Auf Mobile: Button unter dem Text, volle Breite

2. **Entwurf-Banner** nach Entsperrung hinzufügen:
   - Wenn `!isLocked && hasBeenSentBefore`: Zeige dezentes Banner *"Version X — Entwurf"*
   - Farbe: Blau/Info-Ton (neutral, kein Grün/Gelb per Design-Regeln)
   - Text: *"Änderungen sind noch nicht gesendet"*

3. **Beschreibungstext** im Header (Zeile 403) anpassen:
   - Locked: *"Angebot wurde versendet — zum Bearbeiten auf den Button klicken"*
   - Unlocked nach Sent: *"Entwurf — Änderungen sind noch nicht gesendet"*

### Memory aktualisieren
- `mem://business/offer-immutability-and-versioning-principle` — "Angebot bearbeiten" statt "Neues Angebot erstellen" als UX-Sprache

Keine Datenbank-Änderungen nötig. Nur UI-Text und Styling in einer Datei.
