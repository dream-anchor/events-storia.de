## Ziel

1. Im Anfrage-Editor nur noch **einen primären Button** „Kostenübernahme an Kunden schicken" statt der großen Integration-Check-Karte.
2. Alle Integrations-/Template-Einstellungen wandern in **Einstellungen → eSignatures**, inkl. editierbarem Template-ID-Feld (vorbelegt mit `0f9f9ad4-02a8-4678-889a-52d3b4bd459e`).
3. eSign-Anbindung: laut Integration-Check (Screenshot) sind API-Key, Webhook-Secret, Template und Webhook-URL bereits gesetzt — es fehlt nur der Admin-Send-Weg und die UI-Vereinfachung.

## Antwort auf deine Frage
Ich brauche von dir **nichts mehr** — Template-ID hast du geliefert, alle Secrets sind gesetzt. Eine Entscheidung möchte ich aber im Plan festhalten (unten, "Offen").

---

## Änderungen

### A. Neue Edge-Function `admin-send-cost-acceptance`
Startet den Signatur-Flow vom Admin aus (nicht mehr erst durch Kunden-Klick im Public Offer).

- Auth: `requireAuth` (admin/staff).
- Input: `{ inquiry_id }`.
- Zieht aus `v2_events` + aktiver `v2_offer_options`-Zeile: Signer (Kunde), Event, Rechnungsadresse, Betrag (Maestro-Total, unverändert).
- Ruft `createEsignaturesContract` mit aktuellem Template aus `crm_settings.esignatures_cost_acceptance_template`.
- Legt/aktualisiert `cost_acceptances`-Row (Idempotenz analog Public-Offer-Function: aktive/signed Row → 409-artig; defekte Pending-Row wird bereinigt).
- Setzt `cost_acceptance_requested=true` + Zeitstempel auf `v2_events`.
- Response: `{ id, status, sign_page_url }`.
- eSignatures verschickt die Signatur-E-Mail selbst (`emails: "signer"`); der bestehende `send-cost-acceptance-email` bleibt für „Erneut senden" nutzbar.

### B. `CostAcceptanceCard.tsx` radikal verschlanken
Neuer Aufbau (eine Karte, keine Integration-Check-Sektion, kein „Template initialisieren/synchronisieren"-Panel mehr):

- Header: Titel + Status-Badge.
- **Vor Versand**: großer Primary-Button „Kostenübernahme an Kunden schicken" → ruft `admin-send-cost-acceptance`.
- **Nach Versand**: kompakte Info-Zeile (Signer, versendet am, Status) + Sekundär-Buttons „Erneut senden", „Signatur-Seite öffnen", „Zurückziehen", „Signiertes PDF" (nur wenn vorhanden), „Audit".
- Der bestehende „Kostenübernahme anfordern"-Switch entfällt — Klick auf den Send-Button setzt das Flag automatisch.
- Kein Integration-Health-Check mehr in dieser Karte (wandert komplett in Settings).

### C. Settings → neuer Tab „eSignatures"
In `src/components/admin/refine/Settings.tsx` neue Section:

- **Integration-Status** (read-only): API-Key ✓/✗, Webhook-Secret ✓/✗, Webhook-URL (kopierbar), aktive Template-Version.
- **Template-ID** (editierbar): Textfeld, vorbefüllt aus `crm_settings.esignatures_cost_acceptance_template.template_id`. Falls leer → Default `0f9f9ad4-02a8-4678-889a-52d3b4bd459e` als Placeholder + „Übernehmen"-Button.
  - Speichern via neuer Edge-Function `set-esignatures-template-id` (admin-only, schreibt in `crm_settings`, ergänzt `history`-Eintrag).
- Buttons: „Template initialisieren" (bestehende `create-esignatures-cost-acceptance-template`), „Template synchronisieren" (bestehende `sync-esignatures-template`).
- Kein Verhalten für bereits signierte Verträge — die behalten ihre alte `template_id` (revisionssicher, unverändert).

### D. Public-Offer bleibt Fallback
Die vorhandene `create-cost-acceptance-from-public-offer` bleibt bestehen, damit Kunden bei Bedarf auch selbst starten können. Standardpfad ist ab jetzt aber Admin-Send.

---

## Betroffene Dateien

- **Neu**: `supabase/functions/admin-send-cost-acceptance/index.ts`
- **Neu**: `supabase/functions/set-esignatures-template-id/index.ts`
- **Ändern**: `src/components/admin/refine/InquiryEditor/CostAcceptanceCard.tsx` (großer Rewrite, ~60 % Code weg)
- **Ändern**: `src/components/admin/refine/Settings.tsx` (neue eSignatures-Sektion)
- optional: `esignatures-integration-status` bleibt unverändert und wird nur noch von Settings genutzt

## Offene Entscheidung (bitte kurz bestätigen im Build)
Bei Admin-Send werden die 4 Kunden-Bestätigungs-Checkboxen (AGB, Widerruf, Auftragsverarbeitung, Datenschutz) **nicht** vorab vom Kunden gesetzt — der Kunde bestätigt sie stattdessen direkt im eSignatures-Signaturprozess (Template enthält sie bereits als Markdown-Klauseln). Falls du willst, dass sie zusätzlich als separate Checkboxen im Public Offer erscheinen müssen, bevor Admin senden darf: sag Bescheid, dann drehe ich das um. Default im Plan: **direkt versendbar, ohne Kunden-Vorab-Klick**.
