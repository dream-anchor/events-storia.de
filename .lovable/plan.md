## Ziel
Der eingefügte E-Mail-Text muss zuverlässig als ein Angebot mit Speisen erkannt werden — unabhängig davon, ob die KI die Bulletpoints korrekt strukturiert.

## Plan
1. **Deterministischen Speisen-Extractor ergänzen**
   - Nicht nur auf die KI verlassen.
   - Aus dem Originaltext werden Abschnitte anhand der Formulierungen erkannt:
     - Empfang / Aperitivo
     - Vorspeise / Fingerfood / Platten
     - Carpaccio-Variationen
     - Hauptgang
     - Dessert
   - Die Bulletpoints darunter werden als echte `sections[].items[]` gespeichert:
     - Roastbeef
     - Vitello Tonnato
     - verschiedenes mediterranes Gemüse
     - hausgemachter Oktopussalat
     - hausgemachter Meeresfrüchtesalat
     - Rinderfilet-Carpaccio
     - Pulpo-Carpaccio
     - Battuta di Tonno mit Bottarga auf Avocado-Tatar
   - Zusätzlich werden Fließtext-Speisen ohne Bullet als Items erkannt:
     - verschiedene italienische Appetizer und kleine Köstlichkeiten
     - sommerlicher Wildfang-Gelbflossen-Thunfisch
     - zarter Kalbsbraten
     - verschiedene saisonale Beilagen
     - zwei bis drei kleine Desserts im Glas

2. **Fallback verschärfen**
   - Aktuell greift das Safety-Net nur, wenn eine Mahlzeit komplett keine Items hat.
   - Neu: Wenn die KI bei diesem Text keine brauchbaren Speisen liefert oder Bulletpoints fälschlich in Hinweise/Zusatzleistungen landen, überschreibt/ergänzt der Import die Mahlzeit mit den deterministisch extrahierten Speisen-Sektionen.
   - Ergebnis: Der Editor zeigt direkt Speisen statt leerem Tag/leerem Menü.

3. **Preis korrekt übernehmen**
   - `Der Preis beginnt ab 99,00 € pro Person` wird auf der Mahlzeit gespeichert als:
     - `pricePerPersonNet = 99`
     - `pricePerPersonPrefix = "ab"`
     - `flatPriceNet = 0`
   - Keine Hochrechnung, kein Runden, kein Gesamtbetrag erfinden.

4. **Zusatzleistungen getrennt lassen**
   - Diese Positionen bleiben in `additionalServices[]`:
     - Service- und Küchenpersonal: 59 €/Stunde
     - Auf- und Abbauhelfer: 46 €/Stunde
     - Anfahrt: 50 € pauschal
     - Abfahrt: 50 € pauschal
   - `Equipment nach Aufwand` bleibt als Hinweis, weil kein Betrag genannt ist.

5. **Single-Day-Anzeige reparieren**
   - Ein einzelner unbenannter Tag darf keine Rolle spielen.
   - Unsichtbare Unicode-Zeichen aus KI/Text werden beim Prüfen entfernt, damit ein leer aussehender Tag nicht als benannter Tag behandelt wird.
   - Bei genau einem unbenannten Tag werden die Mahlzeiten sofort offen angezeigt.

6. **Validator toleranter für deterministische Korrektur**
   - Der Validator soll nicht mehr verhindern, dass ein korrekt repariertes Programm übernommen wird.
   - Fehlende Gesamtsummen bleiben erlaubt, wenn im Text keine Gesamtsumme steht.

## Technische Umsetzung
- Änderungen in:
  - `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformImportPanel.tsx`
  - `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformProgramEditor.tsx`
  - `src/pages/public-offer/FreeformProgramSection.tsx`
  - optional ergänzend `supabase/functions/parse-freeform-offer/index.ts` für bessere KI-Vorgaben
- Keine Migration.
- Keine Änderung an Public-Offer-Preisbuttons/Kostenübernahme außerhalb dieses Import-Fixes.