## Ziel
Systematisch alle geschäftskritischen Flows von StoriaMaestro auf Fehler prüfen — nicht "alles auf einmal", sondern in klar priorisierter Reihenfolge mit reproduzierbarem Ergebnis pro Flow (✅ / ⚠️ / ❌ + Fundstellen).

## Warum nicht "alles auf einmal"
Ein pauschaler "prüfe alles"-Durchlauf produziert entweder oberflächliche Checks oder eine unlesbare 200-Punkte-Liste. Wir gehen deshalb in **drei Ebenen**:

```text
Ebene 1  Statische Analyse       (findet Kategorien von Bugs — 30 Min)
Ebene 2  Kritische Happy Paths    (findet echte Prod-Bugs — priorisiert)
Ebene 3  Edge Cases pro Flow      (nur für Flows, die Ebene 2 überleben)
```

## Ebene 1 — Statische Analyse (Basis-Hygiene)
Läuft ohne Klick durchs UI. Ergebnis: eine Liste "verdächtiger Stellen":
- TypeScript-Build (`tsgo`) — echte Typfehler
- ESLint auf `src/` — tote Referenzen, ungenutzte States, falsche Hook-Deps
- `supabase--linter` — RLS/Grants/Security-Warnungen der DB
- Grep-Sweeps für bekannte Fehlerklassen:
  - `console.error`/`toast.error`-Aufrufe → welche Fehler werden dem User aktuell wirklich gezeigt
  - `TODO` / `FIXME` / `HACK` / `@ts-ignore` / `as any`
  - Direkte Feldzugriffe ohne Null-Check auf `company_name`, `contact_name`, `amount_total`, `preferred_date` (Klassiker für "null"-Anzeige)
- Edge-Function-Logs der letzten 7 Tage — welche Functions haben Fehlerrate > 0

## Ebene 2 — Priorisierte Flow-Checks
Wir definieren **die kritischen Flows** und arbeiten sie in dieser Reihenfolge ab. Jeder Flow wird per Playwright im Sandbox-Browser end-to-end durchgeklickt, mit Screenshot + Console-/Network-Log-Auswertung. Ergebnis pro Flow: **eine Zeile** — funktioniert / kaputt / kaputt in Detail X.

**Priorität P0 (Umsatz-relevant, jede Störung = Geldverlust):**
1. Anfrage kommt rein (Kontaktformular → `event_inquiries` → Benachrichtigung Admin + WhatsApp)
2. Angebot erstellen (OfferBuilder: Menu/Paket/Freitext) → Speichern → Versand
3. Public-Offer-Seite (Kunde sieht Angebot, wählt Option, akzeptiert)
4. Zahlung (Stripe-Session → Webhook → Status → LexOffice-Rechnung)
5. Restzahlung / Balance-Payment-Link
6. Gutschein-Verkauf & Einlösung

**Priorität P1 (Admin-Alltag, Störung blockiert Team):**
7. Kanban-Board & Filter (Kartentitel, Drag&Drop, Archivieren)
8. E-Mail-Kommunikation (Posteingang, Antworten, Anhänge, Bilingual-Template)
9. Rechnungen-Liste + LexOffice-Sync
10. Bestellungen (Catering-Orders)
11. Reisegruppen-Anfragen
12. Cost-Acceptance / Kostenübernahme

**Priorität P2 (wichtig, aber selten):**
13. Fotoalbum + Menü-Verwaltung
14. Auth (Login, Password-Reset, User-Rollen)
15. System-Health-Dashboard
16. Cookie-Consent / Analytics-Loading

## Ebene 3 — Edge Cases (nur wo Ebene 2 hält)
Pro Flow gezielt: leere Felder, sehr lange Texte, gelöschte Referenzen, abgelaufene Sessions, Netz-Timeouts, mehrsprachig, Test-Mode-Flag.

## Reporting-Format
Ich lege pro Prüfrunde eine Markdown-Datei unter `docs/audit/YYYY-MM-DD-audit.md` an:

```text
## P0-1  Anfrage → Admin-Notification
Status: ⚠️  Teil-defekt
Fund:   WhatsApp-Alarm feuert, aber E-Mail-Bestätigung an Kunde
        fehlt bei event_type = "catering" (siehe supabase Function
        `send-lead-notify`, Zeile 142 — company_name null)
Repro:  Playwright-Script docs/audit/p0-1-repro.py
Fix:    (leer, wird in Build-Mode angegangen)
```

Das ist der einzige Ort, wo alle Findings zentral landen — nicht in 50 einzelnen Chat-Nachrichten.

## Was ich in dieser Session tue (wenn du "OK" sagst)
1. Ebene 1 komplett ausführen (statische Analyse + Lint + Grep-Sweeps + Edge-Function-Log-Auswertung 7 Tage). Ergebnis: erste `docs/audit/…-audit.md` mit den auffälligen Kategorien.
2. Aus Ebene 1 die **Top 10 konkret verdächtigen Stellen** ableiten und dir zeigen.
3. Danach entscheidest du: entweder wir starten sofort mit P0-1 (Playwright-Runs) oder du willst zuerst die Top 10 aus Ebene 1 fixen.

## Was ich in dieser Session **nicht** tue
- Keine Fixes (das ist Build-Mode).
- Keine 100-Punkte-Bug-Liste ohne Priorisierung.
- Keine Aussage "läuft" ohne Screenshot-/Log-Beleg.

## Offene Frage vor Start
- **Scope**: Soll ich mich strikt auf das **Admin-Panel + Public-Offer + Zahlungen** konzentrieren (dort steckt der Umsatz), oder auch die öffentliche Website (SEO-Seiten, Katering-Seiten, Reservierung) mitprüfen?
- **Test-Daten**: Darf ich in P0-Flows echte Aktionen auslösen (z.B. Test-Anfrage anlegen, Test-Angebot versenden im Test-Mode)? Ohne echtes Auslösen kann ich Webhooks & LexOffice-Sync nicht validieren.
