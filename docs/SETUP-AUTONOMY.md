# MAESTRO — Einrichtung, damit Claude künftig alles allein deployt

> Ziel: Claude entwickelt → committet → **pusht**, und die CI erledigt Deploy + Secrets
> **ohne dein Zutun**. Dafür ist eine **einmalige** Einrichtung nötig (~15 Min). Danach ist
> dein Aufwand pro Änderung: **null**.

## Warum überhaupt eine Einrichtung?
Aktuell fehlt Claude in der Cloud-Session dreierlei: **(1)** Push-Zugriff auf den MAESTRO-Code
(das Repo `maestro-cloud` existiert bislang nur als lokaler Klon + Bundle), **(2)** Cloudflare-
Zugangsdaten, **(3)** der Composio-Key. Statt Claude all diese Geheimnisse zu geben (unnötig
riskant), leiten wir **alles über ein GitHub-Repo**: Die Secrets liegen **einmalig** als GitHub-
Actions-Secrets dort, die CI deployt bei jedem Push. Claude braucht dann **nur noch Push-Zugriff
auf dieses eine Repo** — sonst nichts.

## Deine einmalige Einrichtung (3 Schritte)

### 1. Privates GitHub-Repo `dream-anchor/maestro-cloud` anlegen & Code hochladen
Auf deiner Maschine, im gelieferten Bundle-Ordner:
```bash
# Repo bei GitHub anlegen (Web-UI: New repository → dream-anchor/maestro-cloud, privat)
# Dann lokal den gelieferten Stand hineinspielen und pushen:
git clone <dein-lokaler-maestro-cloud-Klon-oder-leer> maestro-cloud && cd maestro-cloud
git fetch ../maestro-cloud-full.bundle HEAD && git merge FETCH_HEAD   # falls schon Klon vorhanden
git remote add origin https://github.com/dream-anchor/maestro-cloud.git   # falls noch kein origin
git push -u origin main
```
(Hast du den Code schon lokal mit `origin`, genügt `git push -u origin main`.)

### 2. Drei GitHub-Actions-Secrets im Repo setzen
`maestro-cloud` → **Settings → Secrets and variables → Actions → New repository secret**:
| Secret | Woher |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens (Rechte: Workers Scripts + Pages: Edit) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare-Dashboard → rechte Seitenleiste |
| `COMPOSIO_API_KEY` | app.composio.dev → Settings → API Keys |

Das war's mit Secrets — **die CI setzt den Composio-Key ab jetzt bei jedem Deploy selbst**
(siehe `.github/workflows/deploy.yml`, Schritt „Worker-Secrets synchronisieren"). Du fasst
`wrangler` nie wieder an.

### 3. Claude Code den Repo-Zugriff geben
In **claude.ai/code** die MAESTRO-Umgebung so einstellen, dass sie auf `dream-anchor/maestro-cloud`
zeigt (bzw. das Repo bei der GitHub-App-Installation autorisieren). Ab dann ist jede Claude-Session
auf dieses Repo **git-scoped** und darf pushen.
→ Doku: https://code.claude.com/docs/en/claude-code-on-the-web

## Ergebnis: der neue Ablauf (vollautomatisch)
```
Claude:  Code ändern → committen → git push origin main
GitHub-CI:  Web bauen → Worker deployen → Composio-Secret setzen → Pages deployen
Live:    Worker + Web aktualisiert, Live-Flow scharf — ohne einen Handgriff von dir
```
Der erste Push nach der Einrichtung ist zugleich der Go-Live. `go-live.sh` (aus dem Bundle) ist
danach nur noch für den *allerersten* Anstoß von deiner Maschine nützlich — sobald das Repo steht,
genügt Claude ein `git push`.

## Optional (Komfort, später)
- **SessionStart-Hook** im Repo (`session-start-hook`-Skill): lässt jede Web-Session automatisch
  `pnpm install` + Tests + Migrations-Check laufen, bevor Claude arbeitet.
- **Neon-Branch je PR**: Vorschau-DB pro Pull Request, damit Migrationen isoliert getestet werden.
- **Netzwerk-Policy** der Umgebung so wählen, dass Neon + Composio + Cloudflare erreichbar sind
  (sind sie heute schon — hier nur dokumentiert).

## Was du dafür NICHT tun musst
- Kein manuelles `wrangler deploy` / `wrangler secret put` mehr (macht die CI).
- Keine Bundles mehr hin- und herkopieren (Claude pusht direkt).
- Kein Cloudflare-/Composio-Login an Claude weitergeben (Secrets bleiben in GitHub).
