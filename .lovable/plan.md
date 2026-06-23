# Finaler Audit — Maestro Kostenübernahme

> **Modus:** read-only Audit. Es wurden **keine Dateien geändert**, keine Migrationen erzeugt und kein Build/Deploy ausgelöst. Alle Befunde basieren auf Code-Inspektion der in der Aufgabe gelisteten Dateien.

---

## 1. Executive Summary

**Entscheidung: ⚠️ Conditional Go für Staging — No-Go für Live.**

Die Roadmap ist umfangreich umgesetzt, die DB-, Webhook-, Storage-, Lock- und Versand-Logik ist sauber strukturiert und defensiv. Vor Live müssen jedoch zwei **P1-Befunde** geschlossen werden, die die Vertraulichkeit der Signatur-URL und die Integrität der vertraglichen Stammdaten betreffen:

1. **P1 — Public Endpunkte akzeptieren rohe `inquiry_id` ohne Slug/Token-Verifikation.** `get-public-cost-acceptance-state` gibt dadurch `sign_page_url` (= Signatur-Credential) und `event_title` zurück, sobald jemand eine UUID kennt (Bounce-Mails, Logs, Referrer, Shoulder-Surfing). `create-cost-acceptance-from-public-offer` erlaubt Trigger eines Vertragsentwurfs ohne Slug.
2. **P1 — Vertragsstammdaten `event.title`, `event.date`, `event.onsite_contact`, `event.company`, `event.guest_count` werden vom Public-Body übernommen** und im Markdown-Snapshot sowie in `cost_acceptances` persistiert. Der Server lädt `v2_events.date`/`occasion`/`guest_count`, nutzt sie aber nicht. Damit kann der Kunde den Vertragsinhalt frei beeinflussen.

Alles andere (DB-Migration, Bucket-Privacy, Webhook-Härtung, Locking, Versand-Guards, Resume-Flow) ist solide. Nach Behebung der zwei P1-Findings und Verifikation der zwei P2-Findings ist Live freigegeben.

---

## 2. Kritische Findings

| ID | Sev | Bereich | Problem | Risiko | Datei | Empfehlung |
|---|---|---|---|---|---|---|
| F-01 | **P1** | Public API / AuthZ | `get-public-cost-acceptance-state` akzeptiert nur `inquiry_id` (UUID) und gibt `sign_page_url` + `sign_page_url_embedded` + `event_title` zurück. Kein Slug-/Token-Check. | Wer eine `inquiry_id` erlangt (Bounce-Mail, Server-Log, Browser-History), kann den Signatur-Link abgreifen und im Namen des Kunden unterzeichnen. | `supabase/functions/get-public-cost-acceptance-state/index.ts` | Pflicht-Parameter `offer_slug` (oder ein dediziertes Public-Token) ergänzen, gegen `v2_events.offer_slug` matchen, **erst dann** den Datensatz zurückgeben. Alternativ Endpunkt komplett über Slug auflösen statt über `inquiry_id`. |
| F-02 | **P1** | Public API / AuthZ | `create-cost-acceptance-from-public-offer` validiert `inquiry_id` nicht gegen den Slug der aufrufenden Public-Offer-Seite. | Drittparteien können Vertrags­entwürfe in fremden Anfragen erzeugen (Pending-Rows, Storage-Aktivität, eSignatures-Calls, evtl. Mail-Trigger durch eSignatures-Provider). | `supabase/functions/create-cost-acceptance-from-public-offer/index.ts` | `offer_slug` zum Body ergänzen und serverseitig per `get_public_offer_by_slug` / direktem Match auf `v2_events.offer_slug` verifizieren, bevor Insert/Contract-Call läuft. |
| F-03 | **P1** | Datenintegrität | `event.title`, `event.date`, `event.onsite_contact`, `event.company`, `event.guest_count` und `invoice.*` werden aus dem Public-Body in den vertraglichen Markdown-Snapshot und in `cost_acceptances` geschrieben. Der Server lädt zwar `v2_events.date/occasion/guest_count`, nutzt sie aber nicht. | Kunde (oder Angreifer) kann Vertragsinhalt manipulieren (anderes Datum/Ort/Gästezahl), wodurch die unterschriebene Kostenübernahme mit Maestro divergiert. Verstoß gegen „Maestro ist Single Source of Truth" (Core-Memory). | `supabase/functions/create-cost-acceptance-from-public-offer/index.ts`, Zeilen 107-122, 244-368 | Pflicht-Stammdaten serverseitig aus `v2_events` (Title = `occasion`, Date = `date`, Guest Count = `guest_count`) und `v2_customers` ziehen. Body-Werte nur als Anzeige/Bestätigung verwenden, nicht als Vertragsquelle. Rechnungsadresse aus `v2_events.billing_*` ableiten und nur fehlende Felder per Body annehmen lassen. |
| F-04 | **P2** | Admin Lock | UI liest `(mergedInquiry as any).locked_after_signature` — Cast deutet darauf hin, dass der Hook, der `inquiry` liefert, das Feld evtl. nicht im `select(...)` führt. Wenn die Datenquelle es nicht selektiert, ist `isSignatureLocked` immer `false`. | Lock greift visuell, aber nicht zuverlässig — Admin könnte ein gesperrtes Angebot weiter bearbeiten und neue Versionen senden. | `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx:968`, zugehöriger Inquiry-Loader (Refine-Hook / `useEventInquiries` / `useUnifiedInquiries`) | Im jeweiligen Loader-Query `locked_after_signature, cost_acceptance_id, offer_phase` explizit selektieren und in den TS-Typ (`ExtendedInquiry`) aufnehmen, damit der `as any`-Cast wegfällt. Manuell verifizieren, dass der Wert nach Webhook-Signature in der UI ankommt. |
| F-05 | **P2** | Webhook / signed_at | Beim Übergang `signed_pending_pdf → signed` (D8) ist `alreadyFinalSigned` (== status === "signed") `false`, daher wird `signed_at = nowIso` neu gesetzt. Das überschreibt den ursprünglichen Signaturzeitpunkt aus dem ersten Signed-Event. | Vertragsdatum im Audit-Trail wandert auf den Zeitpunkt des Nachzügler-Events; revisionssicher fraglich. | `supabase/functions/esignatures-webhook/index.ts`, Zeilen 162-172 + 186-194 | `signed_at` nur setzen, wenn `existing.signed_at` `null` ist. Ergänzung des Conditions-Checks auf `alreadyPendingPdf` mit Beibehaltung von `signed_at`. |
| F-06 | **P2** | Public-Status / PII | `get-public-cost-acceptance-state` gibt `sign_page_url`, `sign_page_url_embedded`, `amount_gross_cents`, `event_title` zurück. Nach Schließen von F-01 ist das vertretbar; ohne F-01 entstehen hier Daten-Leaks. | Brutto-Betrag und Veranstaltungstitel sind Geschäftsdaten der Anfrage. | Selbe Datei | Nach F-01-Fix kann das Set bleiben; alternativ `event_title` und `amount_gross_cents` aus dem Public-Response entfernen, da die Public-Offer-Seite diese Werte ohnehin bereits aus `get_public_offer_by_slug` kennt. |
| F-07 | **P2** | Activity-Log Konsistenz | `send-cost-acceptance-email` schreibt `entity_type: "inquiry"`, während alle anderen Stellen (Webhook, Triggers) `event_inquiry` verwenden. | Aktivitäten erscheinen nicht in der CRM-Timeline, weil Filter auf `event_inquiry` matchen. | `supabase/functions/send-cost-acceptance-email/index.ts:232` | Auf `"event_inquiry"` vereinheitlichen. |
| F-08 | **P2** | Storage-Reproduzierbarkeit | Bucket-Anlage ist nicht in einer Migration enthalten (SQL-Writes auf `storage.buckets` sind in Lovable Cloud blockiert). Die Migration `..._cost_acceptances_storage_bucket.sql` enthält nur defensive `DROP POLICY`-Aufräumarbeiten. | Bei Klonen/Restore eines anderen Projekts existiert der Bucket nicht automatisch; manueller Schritt nötig. | `supabase/migrations/20260616200046_*.sql`, Go-Live-Doku | In `docs/cost-acceptance-testplan.md` Go-Live-Checkliste explizit „Bucket `cost-acceptances` manuell per Storage-API anlegen (privat, PDF-only, 25 MB)" ergänzen — ist teilweise vorhanden, sollte als **Pflicht-Schritt** markiert sein. |
| F-09 | **P3** | Validator-Lücke | `validateBody` prüft Pflichtfelder im `event`-Block nur bei `!== undefined`. Wenn der Client `event.title` ganz weglässt, wird kein Fehler geworfen — Snapshot enthält `undefined`. | Vertrag könnte mit leeren Pflichtfeldern abgeschickt werden. | `…/create-cost-acceptance-from-public-offer/index.ts:107-122` | Mit F-03 zusammen lösen: nach Wechsel auf Server-Stammdaten entfällt die clientseitige Quelle ohnehin; bis dahin Pflichtprüfung ohne `!== undefined`-Gate. |
| F-10 | **P3** | Code-Konsistenz | `send-cost-acceptance-email` nutzt `serve` aus `std@0.190.0`, die übrigen neuen Functions verwenden `Deno.serve` mit `std@0.224.0`. | Wartbarkeit, keine direkte Auswirkung. | `supabase/functions/send-cost-acceptance-email/index.ts:1` | Auf `Deno.serve` + `std@0.224.0` vereinheitlichen. |
| F-11 | **P3** | Logging | Im `catch`-Block der Top-Level-Function (`create-cost-acceptance-from-public-offer:474`) wird `(err as Error).message` direkt in die Response geschrieben. | Bei internen Fehlern kann technische Information nach außen dringen. | Selbe Datei | Generische deutsche Fehlermeldung an Client, Detail nur ins Server-Log. |
| F-12 | **P3** | Webhook-Header | HMAC-Header wird aus `x-esignatures-signature` **oder** `x-webhook-signature` akzeptiert. eSignatures.com nutzt nur einen davon. | Mehrere akzeptierte Header erweitern die Angriffsfläche minimal (Cache/Proxy-Quirks). | `supabase/functions/esignatures-webhook/index.ts:31-32` | Header-Auswahl auf den tatsächlich gesendeten Header reduzieren, sobald in Logs verifiziert. |

---

## 3. Roadmap-Abdeckung

| Schritt | Inhalt | Umgesetzt | Bemerkung / Rest-Risiko |
|---|---|---|---|
| 1 | DB-Hardening `cost_acceptances` | ✅ Ja | Migration `20260616180900_…` additiv, neuer Status `signed_pending_pdf`, partielle Indizes sinnvoll, keine destruktiven Änderungen. |
| 2 | Shared eSignatures Client | ✅ Ja | `_shared/esignatures-client.ts` deckt Template-/Contract-/Withdraw-/PDF-Operationen ab, parst Responses robust, loggt keinen Key. |
| 3 | Template Create/Sync | ✅ Ja | Beide Functions nutzen Shared Client; keine `undefined`-template_id möglich (extractTemplateId + Guard). |
| 4 | `create-cost-acceptance-from-public-offer` gehärtet | ⚠️ Teilweise | Validierung, Phase-/Lock-Check, Idempotenz, Broken-Row-Cleanup vorhanden. **Offene P1-Risiken: F-02 (kein Slug-Check) und F-03 (Vertragsdaten aus Body).** F-09 als Nachzügler. |
| 5 | Admin-Mailversand `send-cost-acceptance-email` | ⚠️ Teilweise | `requireAuth`, Status-Guards, Fehler in `last_send_error`, `sent_at/_to/_count` sauber. Findings: F-07 (Activity-Log entity_type), F-10 (Stil-Inkonsistenz). |
| 6 | Public Status Resume `get-public-cost-acceptance-state` + UI | ⚠️ Teilweise | Resume funktioniert. **Offen: F-01 (kein Slug-Check) und F-06 (Datenleak ohne F-01).** UI-Mapping ok. |
| 7 | Admin Signature Lock | ⚠️ Teilweise | Zentrale `isSignatureLocked`-Ableitung vorhanden, Banner/Read-only ok. **Offen: F-04** (verifizieren, ob Loader das Feld liefert). |
| 8 | Webhook-Härtung | ✅ Ja (mit P2) | HMAC, Signed-ohne-PDF, PDF-Fehler-Handling, Downgrade-Schutz vorhanden. Findings: F-05 (`signed_at`-Überschreibung), F-12 (zwei Header-Namen). |
| 9 | Storage-Bucket privat | ✅ Ja | Bucket via Storage-Tool privat, Migration räumt potenzielle Policies auf. Finding F-08: Bucket-Anlage selbst nicht in Migration (Plattform-Limit) — explizit dokumentieren. |
| 10 | Testplan / Go-Live | ✅ Ja | `docs/cost-acceptance-testplan.md` deckt A–J ab, klare manuelle Tests, Automatisierungs-Kandidaten benannt. |

---

## 4. Security Review

- **Secrets:** `ESIGNATURES_API_KEY` wird nie geloggt; Shared-Client kapselt Header. `ESIGNATURES_WEBHOOK_SECRET` wird im 401-Pfad nicht zurückgegeben. Service-Role-Key bleibt in Edge-Functions, kein Frontend-Leak. ✅
- **Public Endpoints:** Zwei P1-Befunde (F-01, F-02). Vor Live schließen.
- **PII:** `signer_email/name/mobile` werden korrekt nur in der auth-geschützten Mail-Function und im Admin angezeigt. Public-Status-Endpoint liefert kein Signer-PII (gut). `event_title` + Betrag sind Geschäfts-PII — siehe F-06.
- **Storage:** Bucket privat, keine breite RLS-Policy, Download nur über auth-geschützte Edge-Function mit kurzlebiger Signed URL (300 s). ✅
- **Webhook:** HMAC korrekt, Downgrade-Schutz vorhanden. Findings F-05/F-12 sind Hardening-Verbesserungen, keine offenen Lücken.
- **Auth:** `send-cost-acceptance-email`, `download-signed-cost-acceptance`, `withdraw-cost-acceptance`, Template-Functions korrekt `verify_jwt = true`; Webhook und Public-State korrekt `verify_jwt = false`; `create-cost-acceptance-from-public-offer` erbt Default (public). ✅ (mit F-02 als logischer Lücke)

---

## 5. CX Review

- **Admin-Verständlichkeit:** Lock-Banner im OfferBuilder + Hinweis „neue Version erstellen" ist klar. Voraussetzung: F-04 schließen, damit der Lock tatsächlich greift.
- **Public-Offer-Kundenerlebnis:** Resume per Reload zeigt iframe + Fallback-Link. Bei `signed_pending_pdf` wird Erfolg + Verarbeitungshinweis angezeigt — gute UX.
- **Fehlerzustände:** Server liefert deutsche Validierungsfehler je Feld; UI zeigt sie inline. Generelle 500-er werden mit Roh-Message ausgeliefert (F-11) — vor Live bereinigen.
- **Mailversand:** Bilingualer Standard noch nicht umgesetzt — die Mail in `send-cost-acceptance-email` ist nur deutsch. Memory-Regel „ALL customer emails must be bilingual: full German block first, separator, then full English block" greift hier. **Ergänzendes Finding F-13 (P2, CX/Compliance):** bilinguale Mail nachziehen.
- **Locking-Kommunikation:** Banner-Text vorhanden, aber nur intern. Kunde wird auf der Public-Seite nach Signatur nicht aktiv informiert, dass keine Änderungen mehr möglich sind — vertretbar, da `signed`-View ohnehin Erfolg signalisiert.

---

## 6. Go-Live-Checkliste (abhakbar)

- [ ] **F-01 fix:** `get-public-cost-acceptance-state` erzwingt `offer_slug`-Match.
- [ ] **F-02 fix:** `create-cost-acceptance-from-public-offer` erzwingt `offer_slug`-Match.
- [ ] **F-03 fix:** Vertragsstammdaten (Title/Date/Guest Count/Company/Invoice-Adresse) serverseitig aus `v2_events` + `v2_customers` ziehen; Body-Werte nur als Override/Anzeige für Signer-spezifische Felder (Name, E-Mail, Mobil, Onsite-Ansprechpartner).
- [ ] **F-04 verifizieren:** Inquiry-Loader selektiert `locked_after_signature`; Lock greift in Live-Daten.
- [ ] **F-05 fix:** `signed_at` nicht überschreiben, wenn bereits gesetzt.
- [ ] **F-07 fix:** Activity-Log `entity_type` auf `event_inquiry` korrigieren.
- [ ] **F-11 fix:** Generische Fehlermeldung im Public-Catch-Block.
- [ ] **F-13 (CX/Memory):** Mail-Template bilingual (DE/EN) gemäß Core-Memory.
- [ ] **F-06 / F-08 / F-09 / F-10 / F-12:** nach P1/P2 prüfen, vor Live mitnehmen oder als bewussten Tech-Debt dokumentieren.
- [ ] `ESIGNATURES_API_KEY` + `ESIGNATURES_WEBHOOK_SECRET` in Prod-Secrets gesetzt; eSignatures-Dashboard zeigt denselben Webhook-Secret.
- [ ] Webhook-URL `…/functions/v1/esignatures-webhook` bei eSignatures eingetragen.
- [ ] Template via `create-esignatures-cost-acceptance-template` einmalig angelegt; `crm_settings.esignatures_cost_acceptance_template.template_id` gefüllt.
- [ ] Bucket `cost-acceptances` existiert und ist privat (manuell per Storage-Tool, siehe F-08).
- [ ] Manuelle Tests B/C/D/E/F/G aus `docs/cost-acceptance-testplan.md` durchgespielt.

---

## 7. Empfohlene nächste Aktion

Es gibt **P1-Findings** → kein direkter Live-Go.

**Fix-Reihenfolge (eine Roadmap-Iteration, jeweils klein und gezielt):**

1. **F-03** (Vertragsdaten aus Maestro statt Body) — höchstes vertragliches Risiko und reine Server-Änderung in `create-cost-acceptance-from-public-offer`.
2. **F-02** + **F-01** (Slug-Verifikation in Public-Endpoints) — gemeinsam, weil Frontend in beiden Fällen denselben Slug mitgeben muss; minimaler UI-Diff in `CostAcceptanceSection.tsx` (Slug aus Route mitschicken).
3. **F-04** (Loader-Select verifizieren / `locked_after_signature` in Typ aufnehmen).
4. **F-05 / F-07 / F-11** — kleine Bugfixes in Webhook + Mail-Function.
5. **F-13** — bilinguale Mail.
6. Danach Staging-Durchlauf gemäß Testplan B–G.
7. Bei grünem Staging und Verifikation von F-06/F-08/F-09/F-10/F-12: **Live-Freigabe**.

Solange Schritt 1–3 offen sind: **Nur Staging mit synthetischen Daten testen, kein Live-Versand an echte Kunden.**
