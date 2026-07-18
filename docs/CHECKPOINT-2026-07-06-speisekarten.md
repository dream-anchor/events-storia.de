# Checkpoint 2026-07-06 — Speisekarten-Import (Spec 06, F1–F3)

> Zweite umgesetzte + live-verifizierte Modul-Stufe nach dem Katalog. Der **Karten-Import**
> ist der Onboarding-Hebel: eine hochgeladene Speisekarte füllt in Minuten den Katalog –
> und zahlt damit direkt auf die Nordstern-Metrik („Minuten von Anfrage bis Angebot").

## Getroffene Produkt-Entscheidungen (2026-07-06)
Kern **DE+EN** (IT/FR = Storia-Modul) · KI-Import **nur Speise-/Getränkekarten** ·
Angebots-Optionen **Default 1 / max. 3** · Preis-Anzeige **Brutto zuerst**.
(In `docs/specs/00-ROADMAP.md` festgehalten.)

## Was gebaut wurde — Weg „Karte → KI → Review → Katalog"

| Ebene | Datei(en) | Inhalt |
|---|---|---|
| DB | `packages/db` · `sql/31_menu_imports.sql` | `menu_imports` (Parse-Jobs) + RLS/Grants/FORCE — auf Neon angewendet |
| Parse-Logik | `apps/api/src/lib/menu-parse.ts` | **Ein** zod-Schema (Parser→DB) + Sanity-Gates (Preisbereich, Preis/Allergen im Text, leere Sektionen, Duplikate, Konfidenz) |
| KI-Gateway | `apps/api/src/lib/ai-gateway.ts` | Provider-Abstraktion (kein Vendor-Lock), Anthropic-Default (erzwungener Tool-Call, multimodal), Kosten-Log je Job |
| API | `apps/api/src/routes/menu-imports.ts` | POST (inline Parse), GET, PATCH (Review), **POST /:id/commit** → Katalog in EINER Transaktion |
| UI | `apps/web/src/pages/menu-import.tsx` | 3-Schritt-Flow Upload/Text → Review → Commit; editierbar, Konfidenz-Flags, LMIV-Toggles, Pflicht-Bestätigung |
| Einstieg | Button „Speisekarte importieren" auf der Katalog-Seite, Route `/katalog/import` |

### Bewusst behobene Altsystem-Bugs (Spec 06 A)
- **Allergene/Diät-Flags gehen nicht mehr verloren** — ein einziges Schema von Parser bis
  `catalog_items` (Regressionstest bewacht das).
- **Extraktion ≠ Übersetzung** — der Parse liefert nur die Quellsprache (kein
  4-Sprachen-Ein-Schuss-Prompt, der im Altsystem deutschen Text in IT/FR kopierte).
- **Commit = eine Transaktion** (kein destruktives Delete+Insert, kein Teilzustand);
  Doppel-Commit blockiert; Re-Import **dedupliziert** (Update statt Duplikat).
- **Fehlerhafter Parse** endet als `failed` mit Klartext — nie mit leerem Katalog.

## Verifikation (gegen LIVE Neon)
- **75/75 Tests grün** (57 bestehende + 18 neue: 11 Unit für Schema/Gates, 7 e2e für den
  ganzen Import→Commit-Weg mit injiziertem Fake-Parser, ohne Modellkosten).
- **Regressionsnachweis:** importierte Allergene `["A","G"]` + `dietary.vegetarian`
  landen unverändert in `catalog_items`, `source='ai_import'`.
- Typecheck DB/API/Web grün, Web-Build grün. `menu_imports` live angewendet
  (14 Spalten, 4 RLS-Policies, FORCE RLS).

## Zum Live-Schalten des KI-Parse
Der eigentliche Modell-Aufruf braucht **einen Worker-Secret** `ANTHROPIC_API_KEY`
(`wrangler secret put ANTHROPIC_API_KEY` im `apps/api`-Verzeichnis; optional `AI_MODEL`).
Fehlt der Key, endet ein Import sauber als `failed` — nichts bricht. Der ganze Rest
(Tabellen, Routen, Review-UI, Commit) ist unabhängig davon lauffähig und getestet.

## Anwenden (im lokalen `maestro-cloud`-Checkout)
Bundle `maestro-katalog-speisekarten.bundle` (enthält **Katalog + Speisekarten-Import**,
2 Commits auf Basis `5efc2b2`):
```bash
git fetch ./maestro-katalog-speisekarten.bundle HEAD && git merge FETCH_HEAD && git push
```
DB-Migrationen (`30_catalog.sql`, `31_menu_imports.sql`) sind bereits live — für frische
Umgebungen sind beide idempotent.

## Offen für die nächste Stufe (Entscheidung nötig, hält den Rest NICHT auf)
- **KI-Anbieter/AVV** (Roadmap-Punkt 3/11): Anthropic ist als Default verdrahtet; für echten
  Kundenbetrieb den AVV + EU-Processing bestätigen, bevor echte Karten verarbeitet werden.
- **Externes Widget (Spec 06 F4/F5):** Hosted Page `karte.maestro.app` + Web Component —
  braucht die Domain/CDN-Entscheidung. Bewusst noch nicht gebaut.

## Nächster logischer Baustein
**Angebots-Builder (Spec 02):** liest die jetzt befüllbaren `catalog_items`, baut daraus
Angebote mit echten Preisen/MwSt (Default 1, max. 3 Optionen; Brutto). Damit rückt der
komplette Nordstern-Flow (Anfrage → Angebot) in Reichweite.
