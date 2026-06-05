## Ziel
Im KI-Anschreiben soll der **Endpreis nach Rabatt** klar als Hauptpreis genannt werden, und bei Getränken sollen **immer die echten Daten** aus dem Angebot verwendet werden (keine Standard-„Wasser wird gestellt"-Floskel, wenn echte Getränke hinterlegt sind).

## Plan

1. **Endpreis nach Rabatt prominent machen**
   - In `generate-inquiry-email` wird im Rabatt-Kontext `totalAmount` explizit als „Endpreis nach Rabatt" markiert.
   - Neue harte Regel im System-Prompt: Der im Anschreiben genannte Hauptpreis muss immer der Endpreis nach Rabatt sein. Die Zwischensumme vor Rabatt darf nur als Zusatzhinweis im Rabatt-Satz erscheinen (z. B. „inklusive 10 % Rabatt auf die Zwischensumme von 1.171,09 €").

2. **Getränke 1:1 aus echten Daten**
   - `buildMultiOfferContext` wird geschärft: Wenn `drinks` oder `drinksEinzeln` Inhalte haben, wird kein Standardtext verwendet — nur die echten Listen mit Mengen.
   - Standardtext „Wasser wird gestellt …" erscheint nur noch, wenn beide Listen wirklich leer sind.
   - Neue harte Regel im System-Prompt: Wenn echte Getränke existieren, ist der Standard-Wassertext verboten; Getränke müssen 1:1 (inkl. Mengen und „inklusive"-Markern) übernommen werden.

3. **Keine anderen Änderungen**
   - Maestro-/Preislogik bleibt unangetastet (Werte 1:1, keine Neuberechnung).
   - Nur die Edge Function wird angepasst und deployed.

4. **Validierung**
   - Nach dem Deploy am bestehenden Starke-Angebot prüfen: Hauptpreis = Endpreis nach Rabatt, Getränke entsprechen den im Angebot hinterlegten Positionen.

## Technische Details
- Datei: `supabase/functions/generate-inquiry-email/index.ts` (Kontext-Builder + System-Prompt-Regeln).
- Anschließend Redeploy der Funktion.
