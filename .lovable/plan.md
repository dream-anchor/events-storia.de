## Ziel
Zwei klare Bugfixes im KI-Anschreiben (`generate-inquiry-email`):

1. **Keine erfundenen Getränke mehr.** Wenn im Angebot keine Getränke hinterlegt sind, darf die KI auch keine Getränke erwähnen — weder den Standardsatz „Wasser wird … Dazu zwei Getränke pro Person …" noch sonst irgendeine Formulierung. Getränke erscheinen ausschließlich, wenn sie im Angebot stehen.
2. **Überarbeitetes Angebot kennzeichnen.** Wenn bereits eine frühere Version verschickt wurde und nun eine neue Version generiert wird, muss das Anschreiben das ausdrücklich erwähnen (z. B. „anbei das überarbeitete Angebot mit den angepassten Punkten").

## Plan

### 1. Standard-Wassertext entfernen (kein Halluzinieren)
- In `buildMultiOfferContext` den Else-Zweig `!hasRealDrinks` so ändern, dass er **keinen Standardsatz mehr in den Kontext schreibt**. Stattdessen klare Anweisung: „Getränke: keine im Angebot — im Anschreiben **darf kein Satz zu Getränken** stehen (auch kein Standard-Wassersatz)."
- System-Prompt-Regeln entsprechend umstellen:
  - Bisher: „Wenn keine echten Getränke da sind, verwende exakt den Standardsatz."
  - Neu: „Getränke dürfen **nur** erwähnt werden, wenn sie im Daten-Kontext explizit unter ‚Getränke:' oder ‚Weitere Getränke:' stehen. Wenn dort nichts steht, **kein Getränke-Satz**, kein ‚Wasser wird gestellt', keine erfundenen Optionen wie Wein/Spritz/Bier."
- Auch das Few-Shot-Beispiel mit „Wasser und Kaffee-Spezialitäten sind inklusive" prüfen — solche Sätze nur dann lassen, wenn das jeweilige Beispiel auch echte Inklusiv-Getränke im Datenblock hat. Sicherheitshalber das Beispiel umformulieren, damit die KI nicht daraus lernt, Getränke zu erfinden.

### 2. Hinweis auf überarbeitetes Angebot
- In `generate-inquiry-email` zusätzlich die Versionierung aus `inquiry_offer_history` laden:
  - Anzahl bereits **versendeter** Versionen ermitteln (Einträge mit `sent_at not null` oder analog).
  - Wenn ≥ 1 frühere versendete Version existiert → Flag `isRevision = true` plus, falls vorhanden, das Datum der letzten Sendung als Kontext.
- Kontext-Block erweitern: „Revisions-Status: Dies ist eine überarbeitete Version. Vorherige Version wurde am {Datum} versendet."
- Neue harte Regel im System-Prompt:
  - Wenn `isRevision = true`: Einleitungssatz muss klarstellen, dass es sich um ein **überarbeitetes Angebot** handelt (z. B. „anbei das überarbeitete Angebot mit den angepassten Punkten" / „wie besprochen erhalten Sie hier die überarbeitete Version"). Kein Doppel-„vielen Dank für Ihre Anfrage" wie bei der Erstversion.
  - Wenn `isRevision = false`: bisheriger Erstkontakt-Stil bleibt unverändert.
- Frontend (`OfferBuilder.tsx`) braucht **keine Änderung** — das Flag wird serverseitig aus der DB abgeleitet, damit es für alle Kunden (bestehend & neu) automatisch korrekt ist.

### 3. Keine weiteren Änderungen
- Maestro-/Preislogik, Rabattanzeige, Endpreis nach Rabatt: alles bleibt wie aktuell (1:1 Werte aus DB).
- Keine UI-Änderungen, kein neues Feld am Frontend.

### 4. Deploy & Validierung
- Edge Function `generate-inquiry-email` neu deployen.
- Am Starke-Angebot (`a14872bb…`, Version 2) testen:
  - Es darf **kein** „Wasser wird … zwei Getränke pro Person" mehr auftauchen, da im Angebot keine Getränke hinterlegt sind.
  - Anschreiben muss als „überarbeitetes Angebot" formuliert sein, da Version 1 bereits verschickt wurde.
- Gegencheck mit einem Angebot, das echte Getränke enthält → Getränke werden weiterhin 1:1 ausgegeben.
- Gegencheck mit einer brandneuen Erstversion → klassischer „vielen Dank für Ihre Anfrage"-Einstieg ohne Revisions-Hinweis.

## Technische Details
- Datei: `supabase/functions/generate-inquiry-email/index.ts`
  - `buildMultiOfferContext`: Else-Zweig `!hasRealDrinks` neu (kein Standardtext, klare „darf nicht erwähnt werden"-Direktive).
  - Neuer DB-Query auf `inquiry_offer_history` zur Bestimmung von `isRevision` + letztem Sendedatum.
  - System-Prompt: zwei neue Hard Rules (Getränke nur wenn vorhanden / Revisions-Einleitung), Beispieltexte bereinigen.
- Kein Frontend-Patch nötig.
