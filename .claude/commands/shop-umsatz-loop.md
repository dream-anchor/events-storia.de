---
description: Shop-Umsatz-Loop — Protokoll für EINE Iteration
---

Du arbeitest den **Shop-Umsatz-Loop** ab. Zustand: `docs/LOOP-SHOP-UMSATZ.md`,
Bauplan: `docs/KONZEPT-SHOP-UMSATZ.md`.

Pro Turn **GENAU EIN Kriterium**. Jeden Beweis (Build-/Lint-Ausgabe, Query-Ergebnis, Diff-Auszug,
Befehlsausgabe) **sichtbar in die Ausgabe schreiben** — was nicht im Verlauf steht, existiert für
den Prüfer nicht.

## Ablauf

1. **Orientieren:** `docs/LOOP-SHOP-UMSATZ.md` lesen, dann `git log --oneline -10` und
   `git status`. Hängt ein Einheits-Branch offen, dort weiterarbeiten — **nicht** neu von
   `origin/main` abzweigen. `git pull` vor jeder Iteration (Lovable committet häufig auf `main`).
2. **Wählen:** das erste unerledigte Kriterium in der Reihenfolge P7 → P8 → P9 → P10 → P11 → P12.
   Reihenfolge nie umdrehen. **P7 ist ein Gate:** P8 startet erst, wenn P7.2 entschieden ist.
   P11 und P12 starten erst, wenn P9 durch ist (vorher kommt das Schema gar nicht im HTML an).
3. **Nachlesen:** den zugehörigen `§`-Abschnitt in `docs/KONZEPT-SHOP-UMSATZ.md`. Zeilennummern
   und Dateizustände gegenprüfen statt blind übernehmen.
4. **Umsetzen:** minimaler Eingriff auf dem Einheits-Branch. Bestandscode wird **aufgerufen, nicht
   umgebaut**. Für P9 das Muster aus `~/Developer/Websites/ristorantestoria.de/prerender.js`
   übernehmen, nicht neu erfinden.
5. **Beweisen:** `bun run build` und `bun run lint` (Baseline 599/512/87 — identisch = grün), plus
   den im Kriterium zusätzlich verlangten Nachweis. `bun` ggf. über
   `export PATH="$HOME/.bun/bin:$PATH"`. Build-Nebenwirkungen (`public/sitemap.xml`,
   `src/data/static-menus.json`) vor dem Commit mit `git checkout --` zurücksetzen.
6. **Committen:** ein Commit je Kriterium auf den Einheits-Branch. **Kein Push, kein PR**, solange
   die Einheit nicht fertig ist. Einheit = P7, dann P8, dann P9, dann P10–P12.
   Am Ende einer Einheit: Branch pushen, `gh pr create --base main`, **nicht mergen**.
7. **Festhalten — im selben Commit:** Checkbox + Beweiszeile (`✓ <datum> · <befehl> → <ergebnis>`)
   in `docs/LOOP-SHOP-UMSATZ.md`. Kein eigener Doku-Commit.

## Harte Regeln

- **Messbarkeit vor Optimierung.** P7 blockiert P8. Ist die Kauf-Zahl nicht verifiziert, wird nicht
  am Checkout optimiert — sonst optimiert man gegen ein Tracking-Artefakt.
- **Datenbank-Zugriff nur über Composio bzw. die Konnektoren**, nie über 1Password, nie per
  Supabase-CLI gegen die DB (`~/.claude/CLAUDE.md` § Datenbank-Zugriff). Supabase-Schema und Edge
  Functions ausschließlich über Lovable.
- **Merge nach `main` = sofortiges Live-Deployment.** Der Subagent mergt nie. Das Hauptfenster
  liest den Diff selbst, bevor es merged.
- **„Build grün" ist kein Beweis für Content.** Besonders bei P9: der Nachweis ist die
  Fallback-Titel-Prüfung über alle 44 Sitemap-URLs, nicht der Exit-Code.
- **Die Google Indexing API wirkt hier nicht.** Sie unterstützt nur `JobPosting` und
  `BroadcastEvent`; für normale Seiten nimmt sie den Aufruf an und ignoriert ihn (Beleg:
  30 URLs am 01.09. eingereicht, 14 Tage später keine einzige gecrawlt). Nicht erneut als Lösung
  einplanen.
- **Nicht raten:** fehlt eine Entscheidung, die Antoine treffen muss, im Chat fragen, `BLOCKED`
  ins Log, Turn beenden (`~/.claude/CLAUDE.md` § Fragen & Meldungen — Slack erst nach 5 Minuten).
- **Abbruchregel:** dreimal dasselbe Kriterium gescheitert → `BLOCKED` mit Kurzanalyse.

## Wie die Iteration gefahren wird

**Jede Iteration läuft in einem eigenen Subagenten.** Im Hauptfenster pro Turn:
`Agent` mit `subagent_type: "general-purpose"`, `run_in_background: false`; Auftrag = dieser
gesamte Protokolltext plus: „Führe GENAU EINE Iteration aus. Melde am Ende zurück: gewähltes
Kriterium, Branch-Name, Beweiszeile im Wortlaut, offene Punkte." Im Hauptfenster bleiben nur die
Rückmeldung, das Diff-Lesen und der Merge — keine Dateiinhalte, keine Build-Logs.
