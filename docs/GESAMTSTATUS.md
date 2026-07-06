# MAESTRO — Gesamtstatus (Stand 2026-07-06)

> Wo stehen wir gegenüber dem ursprünglichen Plan (Roadmap + Specs 01–06 + Playbook)?
> ✅ fertig & verifiziert · 🔨 teilweise · ⬜ offen. Details: `00-ROADMAP.md`, `OFFENE-PUNKTE.md`,
> `INTEGRATIONS-COMPOSIO.md`, `CHECKPOINT-*.md`.

## 1. Der Nordstern-Flow ist durchgängig gebaut
**Anfrage → Katalog → Angebot bauen → senden (E-Mail) → Kunde wählt (öffentlich) → Anzahlung (Link).**
Jedes Glied existiert und ist gegen Live-Systeme getestet. **108/108 API-Tests grün.** Was zum
scharfen Produktionsbetrieb noch fehlt, steht unten (v. a. Worker-Secrets, PDF, Nachfassen,
Stripe-Connect je Mandant).

## 2. Fundament (aus früheren Sessions, live)
✅ Neon Postgres + RLS (FORCE, tenant-scoped) + Stack-Auth-JWT + SECURITY-DEFINER-Helfer ·
✅ Mandanten/Mitglieder · ✅ Anfragen, Kunden, Events, Angebotsvarianten (CRUD) · ✅ Versand-
Snapshot + öffentliche Angebotsseite (lesen/annehmen) · ✅ Zahlungstabelle + Stripe-Webhook-Skelett ·
✅ Web-Backoffice (9 Seiten, Stitch-Design) · ✅ CI/CD (GitHub Actions → Cloudflare).

## 3. Diese Sessions — neu & verifiziert
| Modul | Spec | Status |
|---|---|---|
| **Katalog & Stammdaten** | 01 | ✅ Tabellen+RLS, CRUD-API, UI, Import-Button |
| **Speisekarten-Import** (Karte→Katalog) | 06 F1–F3 | ✅ menu_imports, Parse-Schema+Gates, KI-Gateway, transakt. Commit, Review-UI; **KI-Parse live bewiesen** |
| **Preis-Engine** (Cents, deterministisch) | 02 F1 | ✅ 20 Tests + 400-Fall-Property-Test |
| **Angebots-Datenmodell + API** | 02 F2/F3 | ✅ offer_items/-_days, Items-Upsert (Optimistic Locking), Rabatt/Zielpreis/Duplizieren |
| **Builder-Oberfläche** | 02 F4 | ✅ Editor, Live-Summen, Katalog-Picker, Mehrtags, Autosave |
| **Kundenseite rendert Positionen** | 02 F7 | ✅ SQL-Funktion + UI; **E2E bauen→senden→öffentlich lesen** |
| **LexOffice-Export** | 02 F8 | ✅ Mapping **cent-exakt gegen echte API golden-verifiziert** |
| **Versand (E-Mail)** | 03 | ✅ Resend-Adapter, **live an info@monot.com zugestellt**, in /send verdrahtet |
| **Anzahlung (Zahlungslink)** | P3 | ✅ Stripe-Adapter, **live 125 €-Link erzeugt**, bei Zusage verdrahtet |
| **Integrationen via Composio** | — | ✅ Anthropic·LexOffice·Resend·Stripe ACTIVE + live bewiesen |

### Nachtrag (später am 2026-07-06)
- ✅ **Flow verdrahtet:** Senden-Button → **Angebots-E-Mail an den Kunden**; Kunden-Zusage →
  **Anzahlungslink** (beide Adapter live bewiesen, jetzt im Ablauf).
- ✅ **PDF-Dokument (04):** druckfertiges Angebots-HTML (`GET /api/offers/:id/document`,
  Browser druckt zu PDF); serverseitige HTML→PDF-Wandlung (Cloudflare Browser Rendering) offen.
- ✅ **Nachfassen (03):** T+3/T+7-Logik + Nachfass-Mail + Sweep-Route je Mandant
  (`POST /api/events/followups/run`); **globaler Cron-Scheduler** (ruft den Sweep je Mandant)
  ist der verbleibende Transport.
- **122/122 API-Tests grün.**

## 4. Angefangen / teilweise
- 🔨 **LexOffice (P5):** Mapping+Golden fertig; **automatisches Anlegen beim Senden noch nicht
  verdrahtet** (bewusst — echtes Buchhaltungsdokument je Versand ist eine Nebenwirkung, die du
  zuerst freigeben solltest). Sync/Webhook offen.
- 🔨 **Zahlungen (P3):** Anzahlungslink bei Zusage steht; **Stripe Connect je Mandant**
  (`application_fee`/`transfer_data`) + Zahlungsstatus-Abgleich + Rest-/Erinnerungszahlungen offen.
  ⚠️ Aktuelle Stripe-Verbindung ist **LIVE-Mode** — für Tests Test-Mode nutzen.
- 🔨 **KI-Assist (05):** Menü-Parse + `ai_usage`-Kostenlog stehen; breiteres KI-Gateway
  (Angebots-Vorschlag, Freitext-Import F9) offen.

## 5. Noch offen (nach Modul)
| Bereich | Spec | Was fehlt |
|---|---|---|
| Versand & Annahme | 03 | E-Sign-light, **Nachfass-Cron** (T+3/T+7), Auto-Expire `valid_until` |
| Dokumente/Vorlagen/Versionen | 04 | **eigenes PDF** (Cloudflare Browser Rendering), WORM-Archiv (GoBD), Vorlagen |
| KI-Vorschlag/Freitext-Import | 02 F9 | ai-suggest + parse-freeform (nutzt bewiesenen Parser-Seam) |
| Nordstern-Messstrecke | 02 F10 | KPI „Minuten bis Angebot" + „Angebot hängt"-Queue + Nightly-Konsistenzcheck |
| Speisekarten-**Widget** | 06 F4/F5 | Hosted Page `karte.maestro.app` + Web-Component + QR |
| Zusammenarbeit | P2 | Aufgaben/Notizen/Kanban — nicht begonnen |
| Kunden-Intelligenz (Risiko-Ampel) | eigene Spec | nur Spec, nicht gebaut |
| E-Mail-Inbox (IMAP/Graph) | P4 | nicht begonnen |
| Profil-Seite + Anfrage-Widget | Marktplatz-Ph.1 | öffentliche Mini-Landingpage je Mandant |
| eSign/WhatsApp/Bewertungen/Gutscheine/Fotoalbum | — | spätere Wellen |
| Storia-Datenmigration | — | ETL Alt-`menu_selection` → `offer_items` |

## 6. Damit es „scharf" läuft (Worker-Secrets/Vars)
`COMPOSIO_API_KEY` (schaltet KI + LexOffice + Resend + Stripe live) · `MAIL_FROM`
(z. B. `angebot@events-storia.de`) · `MAIL_SENDER_NAME` · `WEB_BASE_DOMAIN` · `DEPOSIT_PERCENT_BP`.
→ `cd apps/api && wrangler secret put …` / `[vars]` in `wrangler.toml`.

## 7. Offene Entscheidungen & Aufräum-To-Dos
Vollständig in `OFFENE-PUNKTE.md`. Die wichtigsten:
- ⚠️ **AVV / EU-KI-Verarbeitung** vor echtem KI-Kundenbetrieb (Anthropic/OpenAI).
- **Stripe:** Test-Mode-Verbindung fürs Testen; **Connect je Mandant** fürs Multi-Tenant.
- 🧹 **Aufräumen:** LexOffice-Test-Entwurf **AG0237** löschen; Stripe-Test-Produkt
  **`prod_Upr3wu0wSzgYGN`** archivieren (Link ist bereits inaktiv).
- Kleiner: Nachfass-Kadenz, Anzahlung-Pflicht-Default, PDF-Provider, WORM-Aufbewahrung.

## 8. Empfohlene nächste Reihenfolge
1. **F10 Nordstern-Messstrecke** — die produktisierte Metrik (klein, hoher Signalwert).
2. **04 PDF** — Kunde/LexOffice brauchen ein PDF; schließt den Abschluss-Flow sichtbar ab.
3. **03 Nachfass-Cron** — größter Hebel auf „Tage bis gewonnen".
4. **F9 KI-Freitext-Import** — Alt-Angebote → Positionen (bewährter Parser-Seam).
5. Danach Modul-Wellen: Widget (06 F4/F5) · Zahlungen scharf (Connect) · Zusammenarbeit (P2).
