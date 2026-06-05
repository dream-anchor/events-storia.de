## Ziel
Der Button **„KI generieren“** soll für alle bestehenden und neuen Kunden immer den aktuell sichtbaren Angebotsstand verwenden: geänderte Positionen, geänderte Mengen, Preise und vorhandene Rabatte müssen im Anschreiben korrekt berücksichtigt werden.

## Plan
1. **Vor dem KI-Call aktuellen Angebotsstand speichern**
   - Im Offer Builder wird vor `generate-inquiry-email` ein expliziter Save/Flush ausgelöst.
   - Dadurch liest die Backend-Funktion nicht mehr veraltete DB-Daten, wenn Positionen/Mengen gerade erst geändert wurden.

2. **Aktuelle Mengen strukturiert an die KI geben**
   - Die Backend-Funktion `generate-inquiry-email` wird erweitert, damit sie bei Speisen, Getränken, Equipment und Personal die hinterlegten Mengen aus `menu_selection` ausliest.
   - Beispiel: `3 × Vitello Tonnato-Platte`, `25 × Burratina ...`, `4 × Rosmarin Focaccia ...` statt nur Namen ohne verlässliche Menge.
   - Alte Daten mit Mengen im Namen bleiben kompatibel.

3. **Rabatte im Kontext und Prompt verbindlich machen**
   - `discountPercent` und `discountAmount` aus `menu_selection` werden in den KI-Kontext aufgenommen.
   - Wenn ein Rabatt existiert, bekommt die KI eine harte Regel: Rabatt nennen, z. B. „inklusive 10 % Rabatt“ oder „abzüglich 117,11 € Rabatt“.
   - Preise bleiben weiterhin 1:1 aus Maestro übernommen, ohne Neuberechnung im Anschreiben.

4. **Legacy-/Catering-Flows absichern**
   - Der ältere `AIComposer`/Finalize-Flow wird ebenfalls so angepasst, dass Mengen und ggf. Rabattdaten im Request nicht verloren gehen.
   - Damit betrifft die Korrektur nicht nur den Screenshot-Fall, sondern bestehende und neue Kunden.

5. **Validierung**
   - Nach der Umsetzung prüfe ich gezielt den Codepfad „Position ändern → KI generieren“ und stelle sicher, dass der Generator nicht mehr mit veralteten Daten arbeitet.

## Technische Details
- Relevante Dateien:
  - `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx`
  - `src/components/admin/refine/InquiryEditor/AIComposer.tsx`
  - `src/components/admin/refine/InquiryEditor/MenuComposer/FinalizePanel.tsx`
  - `supabase/functions/generate-inquiry-email/index.ts`
- Keine neue Datenbanktabelle nötig.
- Keine automatische Rabatt-Neuberechnung: vorhandene Rabattwerte werden nur ausgelesen und erwähnt.