Zwei Verbesserungen am KI-Anschreiben werden zusammen umgesetzt — Rabatt-Preis zuverlässig anzeigen und Speisen logisch gruppieren.

1. Endpreis nach Rabatt verbindlich anzeigen
- Der rabattierte Endpreis ist immer der Hauptpreis im Anschreiben — niemals die Zwischensumme vor Rabatt.
- Freundliche Pflichtformulierung, z. B.: „Gerne räumen wir Ihnen einen Rabatt von 10 % ein. Der Endpreis nach Rabatt beträgt 1.053,99 € (Zwischensumme zuvor: 1.171,09 €)."
- Technische Absicherung nach der KI-Ausgabe: Wenn Rabattdaten vorliegen und der Endpreis fehlt oder die Zwischensumme als Hauptpreis erscheint, wird automatisch ein korrekter Rabatt-Absatz eingefügt bzw. korrigiert.
- Werte werden 1:1 aus Maestro übernommen — keine Neuberechnung, kein Runden.

2. Speisen logisch gruppieren
- Die KI darf (und muss) die Speisen sinnvoll nach Kategorien sortieren statt 1:1 wie im Angebot:
  - Antipasti / Vorspeisen
  - Beilagen, Salate, Brot/Focaccia
  - Hauptgang
  - Dessert
- Brot/Focaccia gehört nie zum Dessert.
- Mengen (z. B. „25 × Tiramisù", „4 × Rosmarin Focaccia für 6–8 Personen") bleiben 1:1 erhalten.
- Positiv- und Negativbeispiel im Prompt ergänzen, damit die Trennung wirklich greift.
- Keine Erfindungen — nur tatsächlich im Angebot enthaltene Speisen.

3. Bestehende Regeln bleiben unverändert
- Getränke nur, wenn sie wirklich im Angebot stehen.
- Überarbeitete Versionen werden klar als überarbeitetes Angebot formuliert.
- Maestro bleibt einzige Wahrheitsquelle für Preise.

Technisch:
- Datei: `supabase/functions/generate-inquiry-email/index.ts` (Kontext-Builder + System-Prompt + Post-Processing für Rabatt).
- Anschließend Edge Function neu deployen.