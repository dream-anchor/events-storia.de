## Problem

Beim Freitext-Import-Angebot (DataGuard – Spike Week 2026) generiert die KI immer noch unsinnige Sätze: "833 Gäste", "34,16 € pro Person", nur ein Datum statt Zeitraum, mehrere Tage werden ignoriert.

## Ursache

In der DB ist die Option als `offer_mode = 'menu'` gespeichert, obwohl im `menu_selection` ein vollständiges `freeformProgram` mit 4 Tagen liegt (per psql verifiziert). Der letzte Fix in `generate-inquiry-email/index.ts` aktiviert die Freitext-Logik nur, wenn `offerMode === 'freeform'` — diese Bedingung trifft nie zu, also läuft die Option in den leeren Menü-Pfad und die KI bekommt keine Freitext-Daten. Zusätzlich wurde `guest_count = 833` (Summe aller Mahlzeiten-Gäste) auf die Option geschrieben, woraus die KI „34,16 € pro Person" errechnet.

## Plan

### 1. Erkennung umstellen auf „hat freeformProgram"

Datei: `supabase/functions/generate-inquiry-email/index.ts`

- Hilfsfunktion `isFreeform(opt)` einführen: `!!opt.freeformProgram?.days?.length` — unabhängig vom `offer_mode`-String.
- Alle Stellen umstellen:
  - `hasFreeform` in `buildMultiOfferContext` (Zeile 191)
  - Der `if (opt.offerMode === 'freeform' && opt.freeformProgram?.days?.length)`-Branch (Zeile 202)
  - `hasFreeformContext` im System-Prompt
- Im Mapping (Zeile 503ff.) `freeformProgram` weiterhin aus `menu_selection.freeformProgram` lesen (bleibt wie ist).

### 2. Falschen Pro-Person-Preis und Gesamt-Gästezahl im Kontext neutralisieren

- Wenn `isFreeform(opt)`, im Multi-Offer-Kontext für diese Option:
  - **Keinen** `guestCount` der Option in den Kontext schreiben (kein "Gäste: 833").
  - **Keinen** Pro-Person-Preis ausgeben.
  - Stattdessen explizit: "Gäste: variabel je Mahlzeit (siehe Tagesübersicht)".
- Im Inquiry-Header-Block (`buildMultiOfferContext` Zeilen 182–185): wenn alle aktiven Optionen Freitext sind, `guest_count` und `preferred_date` aus `inquiry` weglassen und durch `freeformProgram.dateRangeLabel` der ersten Option ersetzen, damit die KI nicht versehentlich „29. Juni 2026" / „833" greift.

### 3. System-Prompt-Regeln (F1–F7) auf neue Erkennung umhängen

- `hasFreeformContext`-Trigger nutzt jetzt die Markierung "FREITEXT-PROGRAMM, mehrtägig" aus dem überarbeiteten Kontext-Block — bleibt funktionsfähig, sobald Schritt 1 greift.
- Regel F2 schärfen: „Wenn die Anfrage Freitext-Daten enthält, ist **jede** Erwähnung einer Gesamt-Gästezahl oder eines Pro-Person-Preises ein Fehler — auch wenn im allgemeinen Kontext eine Zahl steht."

### 4. Verifikation

- Edge Function neu deployen.
- Mit Anfrage 6ddaabe0-… „Anschreiben generieren" erneut auslösen.
- Erwartet: Anschreiben nennt 29.06.–02.07.2026, AAHHH Werksviertel, listet 4 Tage mit Mahlzeiten/Personen, Endbetrag 25.000,00 € (bzw. 28.460,84 € falls so in Maestro), kein „833", kein „34,16 € pro Person".

## Nicht im Scope

- Nachträgliches Setzen von `offer_mode='freeform'` für bestehende Datensätze (separate Aufräumaktion).
- Frontend-Änderungen in `OptionCard`/`FreeformImportPanel` — der DB-Inhalt ist ausreichend, sobald die Edge Function ihn liest.

## Technische Details

- Betroffene Datei: nur `supabase/functions/generate-inquiry-email/index.ts`.
- DB-Datenstand verifiziert per `psql`: `offer_mode='menu'`, `freeformProgram` ist `object` mit 4 `days`, `guest_count=833`, `total_amount=28460.84`.
- Keine Migration, kein Frontend-Change.
