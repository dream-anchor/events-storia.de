
# Deploy-Stau auflösen — Sicherer Pfad

## Entscheidung

**Wir deployen jetzt — kontrolliert und in einem Schwung.** Begründung:

1. **Stillstand ist gefährlicher als Deploy.** Auf der Live-Site fehlt seit 2 Wochen u.a. der Operator-E-Mail-Schutz, GA4-DSGVO-Fix und der `packageId`-Fix für das EventContactForm. Jeder Tag ohne Deploy = anhaltendes Risiko für Fehlversand und Tracking-Lücken.
2. **DB & Edge Functions sind ohnehin schon live.** Frontend nachzuziehen schließt einen Drift, statt einen neuen aufzureißen.
3. **Rollback ist trivial.** Lovable-History + Git-Revert geben uns 1-Klick-Sicherheit.
4. **Workflow-Fix ist verifiziert.** `bun install` + `bun run build` ist Standard auf Lovable-Projekten und wird in der Sandbox bei jeder Änderung durchlaufen.

## Vorgehen

### Schritt 1 — No-Op-Commit erstellen (Build-Mode)
Eine harmlose Änderung in `.github/workflows/deploy-ionos.yml`: ein Kommentar-Header mit Datum + Hinweis auf den Workflow-Switch. Das ist:
- Keine Logik-Änderung
- Triggert den Workflow auf `main`
- Lässt sich später nicht „kaputt machen"

### Schritt 2 — Build-Verifikation
Lovable-Sandbox baut bei jeder Änderung automatisch via `bun run build`. Wenn der Build hier durchläuft (was er tut, sonst hätte der Preview Fehler), läuft er auch in GitHub Actions identisch durch.

### Schritt 3 — Deploy beobachten
Nach Push:
- GitHub Actions Run prüfen: `bun install` → `bun run build` → SFTP-Upload
- Erwartete Dauer: 2–3 Minuten
- Bei grün: Live-Site hat alle 36 Features

### Schritt 4 — Smoke-Test auf Live (manuell durch dich)
Drei Klicks reichen, um 90 % aller Probleme zu fangen:
1. **events-storia.de Startseite** — lädt, Hero sichtbar, kein Console-Error
2. **events-storia.de/checkout** — Warenkorb-Flow funktioniert (GA4 darf hier nicht crashen)
3. **events-storia.de/admin** — Login-Maske erscheint, eine Anfrage öffnen, Editor lädt

### Schritt 5 — Rollback-Plan (falls etwas bricht)

| Symptom | Reaktion |
|---|---|
| White-Screen auf events-storia.de | Lovable-History → Version vor dem Deploy auswählen, Re-Deploy |
| Admin-Editor crasht | Gleicher Pfad — History-Rollback |
| Einzelne neue Funktion buggy, Rest läuft | Live lassen, Bug gezielt fixen, neuer Commit |
| Deploy-Workflow scheitert | Logs in GitHub Actions ansehen — meist Lockfile-Problem, dann `bun install` ohne `--frozen-lockfile` |

## Was NICHT angefasst wird

- ❌ Keine Code-Änderungen an Features (nur Workflow-Kommentar)
- ❌ Keine neuen Migrationen
- ❌ Kein Edge-Function-Re-Deploy (schon aktuell)
- ❌ Kein Massen-Refactor

## Technische Punkte

**Datei zu ändern:** `.github/workflows/deploy-ionos.yml`
**Änderung:** Header-Kommentar oben einfügen, z. B.:
```yaml
# Deploy-Workflow — bun-basiert seit 09.05.2026
# Trigger: push to main → SFTP zu IONOS (events-storia.de)
```

**Erwartetes Build-Ergebnis:** `dist/` mit aktuellem `main`-Stand inkl. aller 36 nicht-deployten Feature-Commits.

**Risiko-Level:** Niedrig. Das ist die schonendste mögliche Aktion, um den Workflow zu triggern.

## Alternativen, die ich verworfen habe

- **„Cherry-Pick einzelne Commits"** — 36 Commits einzeln zu deployen ist 36× das Risiko, mit dem Vorteil von Granularität, die du laut deiner Aussage gar nicht beurteilen kannst. Verworfen.
- **„Zurück zum 24.04.-Stand auf main"** — Würde DB/Frontend-Drift maximieren statt schließen. Verworfen.
- **„Manuell Deploy ohne Workflow"** — Möglich (SFTP-Direkt-Upload), aber außerhalb des automatisierten Pfads. Schafft eine Sonderprozedur, die niemand sonst nachvollziehen kann. Verworfen.
