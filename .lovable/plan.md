## Ziel
LexOffice darf keine eigenen Sammel-/Personenpositionen mehr aus Maestro bauen. Die Positionen aus Maestro müssen als einzelne LexOffice-Positionen übernommen werden – inklusive Mengen, Preisen, MwSt-Sätzen und Rabattzeilen – sodass die LexOffice-Summe exakt dem Maestro-Gesamtbetrag entspricht.

## Problem, das behoben wird
Aktuell entstehen falsche LexOffice-Belege, weil der Generator je nach Angebotsart noch eigene Positionen konstruiert:

- Paket/Event wird teilweise zu `833 × 30,01 €` verdichtet.
- Mehrere aktive Varianten werden teilweise zu einer Sammelposition mit Details in der Beschreibung verdichtet.
- Menü-/Per-Person-Pfade erzeugen zusätzliche Rechenpositionen wie `Speisen × Gäste`.
- Dadurch kann LexOffice durch Cent-Rundung von Maestro abweichen.

Maestro zeigt aber bereits die echte Struktur, z. B.:

```text
Lunch                     450,00 €
Dinner Live Cooking       796,00 €
Frühstück                 276,00 €
Grab & Go Lunch         3.180,00 €
BBQ Sommerfest          7.300,00 €
...
Rabatt                - 3.460,84 €
Gesamt brutto          25.000,00 €
```

Genau diese Struktur muss in LexOffice stehen.

## Umsetzung

### 1. LexOffice-LineItems aus Maestro-Struktur bauen
In `create-event-quotation` wird die Line-Item-Erstellung so angepasst, dass sie die vorhandenen Maestro-Positionen aus `menu_selection` direkt nutzt:

- pro sichtbarer Maestro-Position eine LexOffice-Zeile
- Name = Maestro-Titel, z. B. `Lunch`, `Dinner Live Cooking`, `BBQ Sommerfest`
- Beschreibung = enthaltene Speisen/Programmpunkte aus Maestro
- Menge = `1`
- Einheit = `Pauschale`
- Bruttobetrag = exakt der in Maestro sichtbare Positionsbetrag
- MwSt = passend zur Position, Speisen 7 %, Personal/Equipment/Logistik 19 %

Damit wird nicht mehr aus Gesamtbetrag/Gästen ein künstlicher Einzelpreis berechnet.

### 2. Rabatt 1:1 als eigene LexOffice-Zeile(n)
Der Maestro-Rabatt wird nicht mehr in Einzelpreise eingerechnet und nicht versteckt.

Stattdessen:

```text
Zwischensumme brutto   28.460,84 €
Rabatt                - 3.460,84 €
Gesamt brutto          25.000,00 €
```

In LexOffice wird der Rabatt als negative Position übergeben. Wenn 7 % und 19 % gemischt sind, wird der Rabatt steuerlich korrekt aufgeteilt, aber die Summe bleibt exakt der Maestro-Rabatt.

### 3. Keine Rundung über Gästezahl
Für pauschale Eventpositionen werden Gästezahlen nur noch informativ in der Beschreibung verwendet, nicht als rechnende Menge, wenn Maestro bereits einen Pauschalbetrag vorgibt.

Beispiel künftig:

```text
Lunch                  1 × 450,00 €
Dinner Live Cooking    1 × 796,00 €
...
Rabatt                 1 × -3.460,84 €
```

Nicht mehr:

```text
Veranstaltungspaket    833 × 30,01 €
```

### 4. Varianten/Sammelpositionen entfernen, wo sie Maestro-Struktur zerstören
Die Funktion `buildVariantLineItem`, die Details in eine Beschreibung verdichtet, wird für diese Angebotsart nicht mehr verwendet, sobald Maestro konkrete Positionen liefert.

LexOffice soll die echten Positionen sehen, nicht nur eine Beschreibung.

### 5. Repair-Funktion angleichen
`repair-quotation-pricing` wird ebenfalls angepasst, damit Reparaturen alter LexOffice-Angebote denselben 1:1-Maestro-Pfad verwenden und nicht wieder alte Rundungslogik erzeugen.

### 6. Sicherheitsprüfung der Summe
Vor dem Senden an LexOffice wird geprüft:

```text
Summe aller LexOffice-Bruttozeilen == Maestro total_amount
```

Wenn eine Cent-Differenz entsteht, wird sie nicht über Einzelpreise verteilt, sondern über eine explizite Korrektur-/Rabattzeile ausgeglichen, damit der Endbetrag exakt stimmt und nachvollziehbar bleibt.

## Ergebnis
Nach der Änderung gilt für alle betroffenen Angebote:

- Maestro-Gesamtbetrag bleibt exakt erhalten.
- Einzelne Maestro-Positionen stehen einzeln in LexOffice.
- Rabatt ist sichtbar und nachvollziehbar.
- Keine `833 × 30,01 €`-Rundungsfehler mehr.
- Keine versteckten Brutto/Netto-Konvertierungen.
- Keine Neuberechnung gegen Maestro.