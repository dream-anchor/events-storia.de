## Plan: Freitext-Import reparieren

### 1. Parser absichern (`parse-freeform-offer`)
- Prompt verschärfen: bei einfachen Mail-Angeboten muss IMMER mindestens eine Mahlzeit mit Speisen-Sektionen entstehen.
- Bulletpoints (Roastbeef, Vitello Tonnato, mediterranes Gemüse …) müssen als `sections[].items[]` landen — niemals leer oder nur in Hinweisen.
- Typische Sektionen für so eine Mail:
  - Empfang / Aperitivo
  - Vorspeise (Sharing-Platten)
  - Carpaccio-Variationen
  - Hauptgang
  - Dessert
- "99,00 € pro Person" → `pricePerPersonNet=99`, `pricePerPersonPrefix="ab"`. Keine Hochrechnung.
- Zusatzleistungen (Personal €/h, Anfahrt/Abfahrt, Equipment) bleiben unverändert in `additionalServices`.

### 2. Client-Safety-Net (`FreeformImportPanel`)
- Wenn die KI trotzdem keine Speisen liefert (Mahlzeit ohne Items), aus dem Originaltext deterministisch Bullet-Zeilen extrahieren und als Sektion einsetzen, damit der Operator nie ein leeres Ergebnis sieht.

### 3. Single-Day-Modus in der UI (`FreeformProgramEditor`)
- Wenn das Programm nur einen einzigen Tag enthält und dieser Tag kein/leeres `dateLabel` hat:
  - Tages-Header (Calendar-Zeile, Datum-Input, "X Mahlzeiten", Lösch-Button, Aufklapp-Pfeil) wird ausgeblendet.
  - Mahlzeiten werden direkt angezeigt, ohne Tag-Wrapper.
  - "Tag hinzufügen" bleibt sichtbar als kleiner Sekundär-Link — erst beim Klick erscheint die Tagesstruktur.
- Bei zwei oder mehr Tagen (oder einem benannten Tag wie "MONTAG, 29.06.") wird die bisherige Tages-Ansicht unverändert genutzt.

### 4. Public Offer Anzeige (`FreeformProgramSection`)
- Spiegelung der Single-Day-Logik: bei einem unbenannten Einzeltag wird die `Calendar + dateLabel`-Zeile übersprungen und nur Mahlzeiten gerendert.

### 5. Keine Seiteneffekte
- Keine Migration.
- Nur `parse-freeform-offer` als Edge Function angefasst.
- Keine Änderungen an Payment-, Versand- oder Maestro-Logik.