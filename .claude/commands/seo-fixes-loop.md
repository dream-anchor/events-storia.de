---
description: SEO-Fixes-Loop — Protokoll für EINE Iteration
---

Du arbeitest die **SEO/GEO-Fixes** nach dem Search-Audit vom 01.09.2026 ab. Zustand:
`docs/LOOP-SEO-FIXES.md`, Bauplan: `docs/KONZEPT-SEO-FIXES.md`.

Pro Turn **GENAU EIN Kriterium**. Jeden Beweis (Build-/Lint-Output, Diff-Auszug, PR-Link)
**sichtbar in die Ausgabe schreiben** — was nicht im Verlauf steht, existiert für den Prüfer nicht.

## Ablauf

1. **Orientieren:** `docs/LOOP-SEO-FIXES.md` lesen (Checkboxen), dann `git log --oneline -10` und
   `git status`. Hängt ein Einheits-Branch aus einer vorherigen Iteration offen (nicht gemergt,
   Kriterien darauf schon committet), auf diesem Branch weiterarbeiten — **nicht** erneut von
   `origin/main` abzweigen.
2. **Wählen:** das erste unerledigte Kriterium in der Reihenfolge P0 → P1 → P2 → P3 → P4. Phasen
   nie überspringen, Reihenfolge nie umdrehen. P4 ist ein hartes Gate (siehe unten) — erst wenn
   P0–P3 vollständig sind UND das Credential vorliegt.
3. **Nachlesen:** den zugehörigen `§`-Abschnitt in `docs/KONZEPT-SEO-FIXES.md` — dort stehen die
   bereits verifizierten Code-Ursachen (Zeilennummern in `StructuredData.tsx` können sich durch
   vorherige Iterationen verschoben haben, gegenprüfen statt blind vertrauen).
4. **Umsetzen:** minimaler Eingriff auf dem Einheits-Branch. Deutsche Kommentare nur wo der Code
   selbst eine nicht-offensichtliche Entscheidung braucht (siehe `CLAUDE.md`-Kommentar-Konvention:
   möglichst keine). Bestandscode wird **aufgerufen, nicht umgebaut** — z. B. bei P1.1 das Muster
   aus `Kontakt.tsx` kopieren, nicht neu erfinden.
5. **Beweisen:** `bun run build` (enthält Sitemap-Generierung) und `bun run lint`, beide grün.
   Wo im Kriterium ein zusätzlicher Beweis verlangt ist (z. B. `grep`-Ergebnis), diesen zusätzlich
   zeigen. **Rot vor grün wo sinnvoll** (z. B. Build-Fehler vor dem Fix zeigen, falls einer auftritt).
6. **Committen:** ein Commit für dieses eine Kriterium auf dem Einheits-Branch (Branch-Name:
   `seo-fixes-p0-p3` für alle Kriterien bis P3, `seo-fixes-p4` separat sobald das Credential da ist —
   P4 ist ohnehin blockiert, siehe unten). **Kein Push, kein PR**, solange die Einheit nicht
   abgeschlossen ist (Einheit = P0+P1+P2+P3 zusammen, da alle vier ohne Zwischen-Deploy zusammengehören
   und `.github/workflows/` hier nicht betroffen ist — keine Ausnahme für sofortigen Einzel-PR).
   Läuft dies die letzte offene Kriterium vor P4 (also P3.3 abgeschlossen): Branch pushen,
   `gh pr create --base main` mit Zusammenfassung aller P0–P3-Commits, PR-Link in die Rückmeldung.
7. **Festhalten — im selben Commit:** Checkbox + Beweiszeile (Format `✓ <datum> · <befehl> →
   <ergebnis>`) in `docs/LOOP-SEO-FIXES.md` direkt unter dem Kriterium ersetzen. Kein eigener Doku-Commit.

## Harte Regeln

- **Der Zustand wohnt in `docs/LOOP-SEO-FIXES.md`.** Weicht dieser Loop-Text vom Konzept ab, gilt
  das Konzept (`docs/KONZEPT-SEO-FIXES.md`).
- **Kein Satz ohne Beleg.** Jede Beweiszeile zeigt auf einen tatsächlich ausgeführten Befehl mit
  echtem Output — nie geraten, nie als erledigt markiert ohne Build/Lint-Lauf.
- **git pull vor jeder Iteration**, falls `origin/main` sich seit dem letzten Abzweigen verändert
  hat (z. B. durch Lovable-Commits) — Konflikte sofort lösen, nicht überschreiben.
- **P4 ist ein hartes Gate:** `scripts/service-account.json` in
  `~/Developer/Websites/seo.schrittmacher.ai/scripts/` existiert nicht automatisch — vor P4 prüfen
  (`ls` auf den Pfad). Fehlt sie: `BLOCKED` ausgeben, Eintrag im BLOCKED-Log bestätigen/aktualisieren,
  Turn beenden. **Nicht raten, nicht überspringen, nicht durch einen anderen Mechanismus ersetzen.**
- **Keine Aktion auf ristorantestoria.de.** Dieser Loop fasst ausschließlich das
  events-storia.de-Repo an — P1 löst die Kannibalisierung nur durch Entity-Bereinigung hier, nicht
  durch Änderungen am Schwesterprojekt.
- **Abbruchregel:** scheitert dasselbe Kriterium dreimal (Build/Lint bleibt rot), `BLOCKED` mit
  Kurzanalyse ausgeben statt weiter zu versuchen.
- **Abschluss:** sind P0–P3 vollständig abgehakt und der PR gemergt, wörtlich
  `SEO-FIXES-EINHEIT-FERTIG` ausgeben.

## Wie die Iteration gefahren wird

**Jede Iteration läuft in einem eigenen Subagenten**, nicht im Hauptfenster (siehe
`~/.claude/CLAUDE.md` § „Loop-Arbeit"). Ablauf im Hauptfenster, pro Turn:

1. `Agent` mit `subagent_type: "general-purpose"`, `run_in_background: false`. Auftrag: dieser
   gesamte Protokolltext plus „Führe GENAU EINE Iteration aus. Melde am Ende zurück: gewähltes
   Kriterium, Branch-Name, Beweiszeile im Wortlaut, ob ein PR geöffnet wurde (Link), offene Punkte."
2. Nur die Rückmeldung im Hauptfenster behalten — keine Dateiinhalte, keine Build-Logs nachlesen.
3. Beweiszeile aus der Rückmeldung sichtbar ausgeben.
4. Bei geöffnetem PR: CI gibt es hier nicht (kein Test-Gate, siehe KONZEPT § „Deploy-Modell") —
   stattdessen den PR-Diff kurz selbst gegenlesen, dann mergen. Merge nach `main` = sofortiges
   Live-Deployment — deshalb vor dem Merge den Diff tatsächlich ansehen, nicht blind vertrauen.
