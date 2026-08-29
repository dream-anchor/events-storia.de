# KI-Assist im Angebots-Flow (Querschnitts-Spec)

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Intake-Parse (Freitext/Mail → strukturierte Anfrage), Mail-Klassifikation + Mail→
Event-Zuordnung, KI-Menüvorschlag (3 Preisvarianten), KI-Anschreiben, Übersetzung DE↔EN,
später Chat-Intake. **Querschnitt:** definiert die KI-Architektur für ALLE Module —
Provider-Wahl, Kosten-Logging, Prompt-Versionierung, Datenschutz, Abuse-Schutz, Fallback.

## A — IST im Alt-System (mit Evidenz)

Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md): KI-Anschreiben (generate-inquiry-
email) · Menüvorschlag (generate-menu-suggestion) · Freitext-Parse + Red-Team (parse-/
validate-freeform-offer) · Intake-Parse (parse-inquiry-text) · Mail-Zuordnung
(suggest-email-mapping, laut Inventar Z. 137 TÄGLICH genutzt) · Intake-Chat inkl. Uploads
(ai-catering-assistant, ai_conversations/-messages/-extractions) · Übersetzungen (translate-
offer-letter/-menu-text/-package-menu) · Storno (ai-cancellation-message) · classify-photo.

Die KI funktioniert im Alltag — aber als gewachsener Wildwuchs. Belegte Befunde:

1. **Fragmentiert + Vendor-Lock:** 10+ Functions, 5 Modelle, 2 Gateways: Gemini 2.5 Pro
   (`parse-freeform-offer:192-199`), 2.5 Flash (`generate-menu-suggestion:463`), gemini-3-
   flash-preview (`ai-catering-assistant:20`), openai/gpt-5 (`validate-freeform-offer:122`)
   — alle via `ai.gateway.lovable.dev` (`LOVABLE_API_KEY` in 10 Functions); nur `suggest-
   email-mapping:277-285` ruft Anthropic direkt (claude-haiku-4-5). Kein AVV-Partner.
2. **Null Kosten-Logging:** Grep `usage|total_tokens|cost` → kein einziger Treffer.
3. **Keine Prompt-Versionierung:** 0 Treffer; Inline-Strings pro Function
   (Spec 06: Prompt eskalierte auf 16 Großbuchstaben-Regeln).
4. **Personendaten hartkodiert:** `generate-inquiry-email:9-16` — `SENDER_INFO` mit
   privaten Mails/Mobilnummern echter Mitarbeiter. DSGVO-fragwürdig.
5. **Zweitmodell als Workaround:** GPT-5 prüft den Gemini-Parse (Streichung in Spec 02
   entschieden: deterministischer Summen-Check statt Red-Team).
6. **2.135-Zeilen-Monolith mit Eigenbau-Observability** (createTrace Z. 28-74); Timeouts handgestimmt.
7. **Fallback client-seitig dupliziert:** `useAiIntake.ts:92` — Regex-NLU im Browser als Schatten-Server.
8. **Isolation nachgerüstet:** `ai_conversations` ohne `tenant_id` (20260615124240), erst per 20260625231646.
9. **Übersetzung dreifach implementiert,** Cache als JSONB am Event mit Sync-Banner — Invalidierung = Handarbeit.

Neubau (`/home/user/maestro-cloud`): Worker (Hono) + Neon-RLS-Fundament steht,
isolationsgetestet — noch null KI-Code. Konsumenten: Spec 02 (ai-suggest, parse-freeform),
Spec 03 (Anschreiben; Follow-up-Pause hängt laut Z. 319 an der Inbound-Mail-Zuordnung).

## B — Der eigentliche Job (Jobs-to-be-done)

**Job:** „Verwandle unstrukturierten Kunden-Input in Sekunden in einen prüfbaren Vorschlag —
Anfrage-Entwurf, Mail-Zuordnung, 3 Menü-Varianten, Anschreiben, Übersetzung — damit der
Betreiber nur noch bestätigt statt tippt." Jede KI-Sekunde zahlt auf die Nordstern-Metrik
„Minuten bis Angebot" ein. Dahinter: EINE KI-Infrastruktur (Gateway, Kosten, Prompts,
Datenschutz, Abuse-Schutz, Fallback) — nie wieder Befund 1-9.

**Gestrichen / zusammengelegt (mit Begründung):**
- **validate-freeform-offer (GPT-5-Red-Team)** — deterministischer Summenabgleich in der Pricing-Engine (Spec 02) ersetzt das Zweitmodell.
- **3 Übersetzungs-Functions → 1 Translate-Endpoint** mit globalem Hash-Cache; **IT/FR gestrichen** (Produktsprachen DE+EN; Storia-Bestand bleibt lesbar).
- **SENDER_INFO-Hardcoding** — ersetzt durch Team-Stammdaten des Mandanten.
- **ai-cancellation-message** — Vorlage des generischen Anschreiben-Endpoints.
- **Lovable-Gateway** — nicht portiert; direkte Provider-SDKs im Worker.
- **Client-Regex-NLU-Fallback** — gestrichen; bei Ausfall ehrlich degradieren.
- **Chat-Intake (AiIntakeBar)** — Phase 2; `ai_conversations` übernommen (tenant_id ab Tag 1). MVP = Webformular + E-Mail-Parse; keine RAG-Infra.
- **classify-photo** — Storia-only, kein MAESTRO-Kern.
- **suggest-email-mapping wird NICHT gestrichen oder verschoben** — es wird Task `mail_map` (s. D); Spec 03 hängt für die Follow-up-Pause daran.

## C — Benchmark 2026

KI im Angebotsflow ist **Table Stakes** (Digest): Event Temple „AI Sales Suite" (E-Mail→Lead,
Smart Proposal Builder, 8/2025), iVvy/hivr.ai „Instant Proposal" (Parse+Score+Proposal in
Minuten, 1/2026), Perfect Venue „AI Reply", Univents, CaterSmart, Proposales. Muster:
**Human-in-the-Loop über Schwellenwerte** (iVvy). Tripleseat/Perfect Venue prüfen
Verfügbarkeit bereits am Lead — Doppelbuchungs-Erkennung am Intake ist 2026 Standard.

**Wo wir gleichziehen:** Mail→strukturierte Anfrage, Komplett-Entwurf aus einer Mail in
EINEM Durchlauf (Draft-Chaining, s. D), KI-Antworttexte, Übersetzung,
Verfügbarkeits-Check am Intake — alles als Vorschlag mit Ein-Klick-Übernahme.

**Wo wir bewusst schlagen:** 1. **Kostentransparenz pro Vorgang** (Milli-Cent-Logging inkl.
Cache-Token-Klassen im Admin — zeigt kein Wettbewerber). 2. **DSGVO by design** (AVV,
No-Training, EU-Processing, PII-Minimierung — US-Tools können das für DACH nicht erzählen).
3. **KI nie als Gatekeeper** — jeder Flow bleibt ohne KI voll bedienbar.

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. Mail/Formular → **Pre-LLM-Gate** (s. u.) → Queue-Kette `mail_classify` → `mail_map` →
   `intake_parse`; nach dem Parse feuert die Queue `menu_suggest` + `letter_draft`
   asynchron (**Draft-Chaining**) — Builder/Composer zeigen beim Öffnen fertige Drafts.
2. Inbox-Karte „KI-Entwurf — prüfen": Felder mit Belegt-Chips (Grounding, s. u.), Fehlendes gelb;
   dazu deterministischer **Verfügbarkeits-Chip** „Termin frei / Konflikt mit Event X / Teilbelegung"
   aus dem Tenant-Kalender (kein LLM); bei Konflikt wird ein Alternativ-Termin Baustein für `letter_draft`.
3. Inline korrigieren, „Übernehmen" → Anfrage/Event; danach „**Komplett-Entwurf prüfen & senden**":
   Ein-Screen-Review aus Daten + 3 Optionen + Anschreiben — statt drei KI-Auslösungen auf drei
   Screens (Antwort auf „Instant Proposal").
4. Einzeln bleibt alles nutzbar: Builder-Kachel „KI-Vorschlag" (3 Optionen Low/Mid/High,
   Begründung, Preis p. P., Badge bis Bearbeitung); Composer „KI-Anschreiben" (Phase, Tonalität
   aus `tenant_settings`); EN-Toggle „Übersetzen" (Cache-first, Badge „maschinell übersetzt"
   bis Review); Erstversand nie ohne Menschen.
5. Admin → KI: pro Feature an/aus, Auto-Send-Schwellen, Monatsbudget, Kosten-Dashboard
   (Calls, Cents, Ø-Latenz pro Feature).
6. Ausfall: Banner „KI nicht verfügbar — alles manuell nutzbar"; Kacheln degradieren zu
   Leer-/Vorlagen-Start, nichts blockiert.

### Inbound-Pipeline: Gate, Klassifikation, Zuordnung, Grounding
**Pre-LLM-Gate (MVP, nicht Phase 2):** Die Inbound-Adresse ist öffentlich, jede Mail triggert
bezahlte Calls. VOR jedem KI-Call: SPF/DKIM/Spam-Score-Check, Message-ID-Dedupe, Größen-/Anhang-
Limits, Rate-Limit pro Absender UND pro Tenant. Die Prompt-Registry enthält verbindliche Injection-
Regeln (User-Content strikt delimitiert, Instruktionen im Content ignorieren, Output nur Schema);
Injection-Fälle sind Teil der Golden-Tests. Unsichere `mail_classify`-Ergebnisse landen IMMER
sichtbar in der Inbox — nie im Spam-Nirwana.

**`mail_classify` — Label-Taxonomie + Routing (verbindlich):** `neue_anfrage` → `mail_map` →
`intake_parse` → Draft-Karte in der Inbox · `antwort_auf_angebot` → `mail_map` → Thread am
Event, Follow-up-Kadenz pausieren (Spec 03) · `aenderungswunsch` → `mail_map` → Thread +
Aufgabe · `spam_werbung` → eingeklappte Sektion „Aussortiert", nie löschen ·
`sonstiges`/Konfidenz unter Schwelle → immer sichtbar, unklassifiziert.

**`mail_map` — Mail→Event-Zuordnung (täglich genutzt; Spec 03 hängt daran):** Stufe 1
deterministisch VOR jedem LLM-Call: Message-ID/In-Reply-To-Threading, Empfänger-Alias
(`event-{id}@…`), eindeutiger Absender-Match auf offene Vorgänge. Nur Ungelöstes → Stufe 2 LLM
(Kandidaten = offene Events/Anfragen des Tenants); Draft mit Konfidenz, unter Schwelle bestätigt
der Mensch in der Inbox. Queue-Schritt nach `mail_classify`; Bestätigung via `drafts/decide`.

**Konfidenz = Grounding, nicht Modell-Selbstauskunft:** LLM-Selbst-Konfidenzen sind unkalibriert
und werden nicht angezeigt. `intake_parse` liefert pro Feld ein Evidenz-Zitat; Substring-Match
gegen den Originaltext (Grounding-Check) + Plausibilitätsregeln (Datum in Zukunft, Gäste numerisch,
Budget deckt Textstelle) ergeben genau zwei Chip-Zustände: „im Text belegt" / „fehlt — bitte
ergänzen". Nichts Unbelegtes wird vorbefüllt.

### KI-Architektur (Querschnitt, `packages/ai`)
- **Ein Gateway-Paket im Worker** (TypeScript, kein Deno): Adapter von Tag 1 auf DREI Backends
  ausgelegt — Anthropic First-Party (`@anthropic-ai/sdk`), OpenAI (sekundär), Vertex AI (mögl.
  EU-Pfad, s. Datenschutz) — hinter EINEM Interface `runTask(task, input, ctx) →
  zod-validiertes Ergebnis`; Keys als Worker-Secrets, kein Dritt-Gateway.
- **Task-Routing (Default, per ENV/Tenant-Override änderbar):**

| Task | Modell (Default) | Sekundär (Failover) | Warum | ~Kosten/Call |
|---|---|---|---|---|
| `intake_parse` | claude-haiku-4-5 | gpt-5-mini | einfache Extraktion, Latenz | ~0,3 ct |
| `mail_classify` | claude-haiku-4-5 | gpt-5-mini | Masse, Stufe 2 nach Gate | ~0,2 ct |
| `mail_map` | claude-haiku-4-5 | gpt-5-mini | Stufe 2 nach Heuristik | ~0,2 ct |
| `translate` | claude-haiku-4-5 | gpt-5-mini | Standardaufgabe, Cache davor | ~0,3 ct |
| `menu_suggest` | claude-sonnet-5 | gpt-5 | Katalog-Reasoning, 3 Varianten | ~4 ct |
| `letter_draft` | claude-sonnet-5 | gpt-5 | Tonalität, Kundenkontakt | ~1,5 ct |
| `freeform_parse` | claude-opus-4-8 | gpt-5 | **Geldbeträge 1:1 — Präzision vor Kosten** | ~7 ct |

  Eskalations-Retry: scheitert zod, ein Versuch mit dem nächststärkeren Modell, dann Klartext-
  Fehler (Spec 06). Katalog-Snippet bei `menu_suggest` als stabiler Prompt-Präfix mit
  `cache_control` → Wiederholungs-Calls ~90 % billiger. Der Failover-Pfad ist kein Papiertiger:
  Golden-Tests in CI gegen BEIDE Provider (mind. `intake_parse`, `letter_draft`); täglicher
  Canary-Call auf dem Sekundär-Pfad, geloggt in `ai_runs`.
- **Structured Outputs statt Prompt-Drohungen:** Task-Schema als zod + erzwungenes
  JSON-Schema; ein Schema von Prompt bis DB, Adapter mappt aufs Provider-Format.
- **Prompt-Registry:** `packages/ai/prompts/<task>/vN.ts`, Git-versioniert; `prompt_key` +
  `prompt_version` pro Call geloggt; Golden-Tests je Prompt-Version × Provider
  (Storia-Regressions- + Injection-Fälle).
- **Human-in-the-Loop (verbindlich für ALLE Module):** KI schreibt nie direkt in Fachtabellen:
  Ergebnis → `ai_drafts` → Badge → Mensch; jeder Call geloggt, jede Entscheidung protokolliert
  (Lernsignal). Auto-Aktionen nur wenn `ai_task_settings` es erlaubt UND Schwellen eingehalten
  (Eventwert ≤ X Cents, Sonderwunsch-frei) — iVvy-Muster.

### Datenmodell (Neon, tenant_id + RLS FORCE überall, Geld in Cents)
```
ai_runs (Telemetrie, KEINE Prompt-/Output-Texte)
  id · tenant_id · task · prompt_key · prompt_version · provider · model ·
  input_tokens · output_tokens · cache_creation_input_tokens · cache_read_input_tokens
    -- Cache-Writes/-Reads anders bepreist; ohne diese Klassen wäre
       cost_millicents bei menu_suggest systematisch falsch ·
  cost_millicents int not null  -- 1/1000 Cent (bewusste Cents-Ausnahme; intern) ·
  latency_ms · status ('ok','invalid_output','provider_error','timeout',
  'rate_limited','budget_blocked','deduped') · error · entity jsonb · created_at

ai_usage_counters (synchroner Budget-Zähler): tenant_id · task · month ·
  spent_millicents — atomar pro Run inkrementiert; runTask liest VOR dem Call.

ai_task_settings (pro Mandant, pro Task): tenant_id · task · enabled ·
  model_override · auto_action · auto_max_value_cents · monthly_budget_cents.

ai_drafts (HITL-Protokoll + Lernsignal): id · tenant_id · task · entity_type/
  entity_id · payload jsonb (zod-validiert) · confidence jsonb · status
  ('proposed','accepted','edited','rejected') · run_id · decided_by/at · created_at
  part. Unique-Index (tenant_id, task, entity_type, entity_id) WHERE
    status='proposed'  -- Idempotenz: nie zwei offene Drafts je Mail+Task
  → Purge-Policy (Retention-Muster aus Alt-Migration 20260624132809)

translation_cache (global pro Tenant — Positionstexte wiederholen sich massiv):
  tenant_id · source_hash · lang ('en') · text · reviewed · created_at ·
  unique (tenant_id, source_hash, lang); Entity-Bezug via translation_refs
  (entity_type, entity_id, field → source_hash) bzw. Lookup zur Renderzeit;
  Invalidierung = Hash-Mismatch, kein Sync-Banner.

tenant_settings — Tonalitäts-Block (Input für letter_draft): tone_preset
  ('du'|'sie' × 'formell'|'herzlich') · tone_styleguide? · tone_example_letter? (Few-Shot);
  Default aus Betriebstyp beim Onboarding (Time-to-Value ohne Konfiguration);
  später: Lernsignal aus 'edited'-Drafts als Tonalitäts-Vorschlag.

Phase 2: ai_conversations/ai_messages — Alt-Schema, aber tenant_id NOT NULL
ab Tag 1, RLS FORCE, Rate-Limit-Spalten.
```

### API (Hono-Worker)
- `POST /api/ai/parse-inquiry {text|inbound_email_id}` → InquiryDraft in `ai_drafts`.
- `POST /api/events/:id/offers/ai-suggest` → 3 Options-Drafts (Kontrakt Spec 02).
- `POST /api/events/:id/offers/parse-freeform {text}` → Items-Draft + `totals_from_text` (Kontrakt Spec 02; Task `freeform_parse`).
- `POST /api/events/:id/ai/letter {phase, tone?}` → Anschreiben-Entwurf (Spec 03; ersetzt generate-inquiry-email + ai-cancellation-message).
- `POST /api/ai/translate {entity|text, target:'en'}` → Cache-first-Übersetzung.
- `POST /api/ai/drafts/:id/decide {status, edited_payload?}` → Übernahme/Ablehnung
  (auch für `mail_map`-Zuordnungs-Vorschläge).
- `GET /api/ai/usage?month=` → Aggregat Calls/Kosten/Fehler pro Task (Dashboard).
- Alles via `withTenant()`; `runTask` prüft `ai_task_settings` (enabled) UND `ai_usage_counters`
  (Month-to-Date) VOR dem Provider-Call → `budget_blocked` in Sekunden statt am Folgetag;
  Idempotenz-Dedupe ebenfalls vor dem Call.

### Automatisierungen (Queue/Cron)
- **Queue `ai-jobs`:** Inbound-Mail → Pre-LLM-Gate → `mail_classify` → `mail_map` →
  `intake_parse` → Draft-Chaining (`menu_suggest` + `letter_draft`); UI via Polling/SSE;
  Timeout 20 s, 1 Retry, dann `failed` sichtbar. Idempotency-Key pro Job (`inbound_email_id`
  +task): Redelivery/Retry erzeugt genau einen Draft, max. einen bezahlten Call (`deduped`).
- **Circuit Breaker:** n Provider-Fehler in 5 Min → Sekundär-Modell laut Routing-Tabelle;
  beide down → `ai_degraded` (KV) → UI-Banner + 503 mit Klartext; kein Client-Fallback.
- **Cron nightly:** nur Reconciliation `ai_usage_counters` gegen `ai_runs` + Budget-Alarm
  80 %/100 %; der Soft-Stop selbst greift synchron in `runTask`.
- **Nordstern-Kopplung:** `ai_drafts.accepted` stempelt Zeitersparnis-Metrik
  („KI-unterstützt vs. manuell: Minuten bis Versand") ins Dashboard.

### KI-Punkte (Input → Vorschlag → Bestätigung)
Sind hier der Modulkern selbst; die verbindlichen Regeln für alle Module (Draft-Pflicht
mit Badge, Auto-Schwellen, Call-Logging, Entscheidungs-Protokoll) stehen im HITL-Absatz.

### Datenschutz & Provider-Vertrag (verbindlich)
- **Keine Trainingsnutzung:** AVV/DPA mit Anthropic vor Go-Live; gleiches Gate für den
  Sekundär-Provider (OpenAI API mit DPA, Training-Opt-out per Default).
- **EU-Processing = offene ENTSCHEIDUNG, kein Doku-Punkt:** Ob die First-Party-API einen
  EU-Residency-Parameter bietet, ist UNVERIFIZIERT — vor Schritt 1 klären. Falls nein, ist
  Vertex AI (EU-Region) der Pfad: andere Auth (GCP Service Account statt API-Key), anderes
  SDK-Verhalten, zu prüfende Feature-Parität (Structured Outputs, cache_control). Deshalb
  Adapter dreigleisig + Vertex-Spike (Schritt 10); Entscheidung vor Vertrieb, im DSH dokumentiert.
- **PII-Minimierung:** Prompts nur mit benötigten Feldern; `ai_runs` ohne Texte;
  `ai_drafts` mit Retention; Kill-Switch pro Tenant sofort wirksam.

### Integrations-Berührungen
- **Inbox/E-Mail (Welle 1):** Roh-Input für `mail_classify`/`mail_map`/`intake_parse`;
  das Pre-LLM-Gate sitzt dort.
- **Kalender/Events:** deterministischer Verfügbarkeits-Check für den Intake-Draft-Chip (frei/
  Konflikt/Teilbelegung). **Spec 02/03:** konsumieren die Endpunkte; Spec 03 pausiert
  Follow-ups über die `mail_map`-Zuordnung.
- **Katalog (Spec 01):** Snippet für `menu_suggest` (aktive Artikel, Cents-Snapshot).
  **WhatsApp (Welle 2):** Texte aus `letter_draft`. **Registry (B10):** Flag je Task.

## E — Klassifikation

**Kern (Infrastruktur):** `packages/ai`, `ai_runs`, `ai_usage_counters`, `ai_task_settings`,
Pre-LLM-Gate, Datenschutz-Setup — nicht abschaltbar. **Pro Tenant schaltbar (Registry B10):**
jedes KI-Feature (`intake_parse`, `mail_classify`, `mail_map`, `menu_suggest`, `letter_draft`,
`translate`, Draft-Chaining, Auto-Aktionen) — Kriterium: Betrieb ohne KI voll arbeitsfähig
(Gatekeeper-Verbot). **Modul (Phase 2):** Website-Chat-Intake inkl. `ai_conversations` +
Uploads. **Storia-only:** classify-photo, IT/FR-Bestand, Ristorante-Knowledge-Base.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | `packages/ai`: Adapter dreigleisig (Anthropic/OpenAI/Vertex-ready), runTask, zod-Gate, Eskalations-Retry, Kostenrechnung inkl. Cache-Token-Klassen, Idempotenz-Dedupe | 10 (EU-Frage) | M | Paket |
| 2 | Migration: ai_runs, ai_usage_counters, ai_task_settings, ai_drafts (+part. Unique-Index), translation_cache/_refs, Tonalitäts-Block + RLS FORCE + Isolationstests | — | S | Tabellen |
| 3 | Prompt-Registry v1: intake_parse + translate + Injection-Regeln; Golden-Tests (Storia-Realfälle + Injection) gegen beide Provider | 1 | M | Prompts |
| 4 | Endpunkte parse-inquiry, translate, drafts/decide + Draft-Karten-UI (Grounding-Chips, Verfügbarkeits-Chip via Kalender) | 1-3 | L | API/UI |
| 5 | menu_suggest (Katalog-Snippet + Prompt-Caching) + Builder-Kachel (Spec 02) | 1-3, Spec 01 | L | Prompt/UI |
| 6 | letter_draft (Phasen-Vorlagen, Tonalität aus tenant_settings) + Composer (Spec 03) | 1-3, 2 (Tonalität) | M | Prompt/UI |
| 7 | freeform_parse auf Opus + deterministischer Summen-Check (ersetzt Red-Team) | 1-3, Spec 02 Engine | M | Prompt |
| 8 | Queue ai-jobs: Pre-LLM-Gate, Kette classify→map→parse, Draft-Chaining, Idempotency-Keys, Circuit Breaker + Canary, Degraded-Banner | 4 | L | Queue |
| 9 | KI-Einstellungen + Kosten-Dashboard (/api/ai/usage), synchroner Budget-Stopp, Reconciliation-Cron, Kill-Switch | 2,4 | M | UI/Cron |
| 10 | EU-Processing: **Entscheidung + Spike** (First-Party-Residency verifizieren; sonst Vertex-Spike) + AVV/DPA + Datenschutzhinweis | — | M | Entscheidung |
| 11 | Phase 2: Chat-Intake (ai_conversations tenant-native, Uploads, Rate-Limits) | 4,8 | XL | Modul |

Kritischer Pfad: 10 (EU-Verifikation) → 1 → 4 → 8; 5-7 parallelisierbar. Schritt 8 ist
Go-Live-Voraussetzung für den Inbound-Kanal (Pre-LLM-Gate ≠ Phase 2).

## G — Risiken & Lösungen (Top 4)

1. **Halluzinierte Zahlen bei Geld** (Alt brauchte GPT-5-Red-Team). → Structured Outputs +
   zod-Gates; Preise nur als Katalog-Snapshot bzw. 1:1 aus Text mit deterministischem
   Summenabgleich (Spec 02); `freeform_parse` auf stärkstem Modell; Mensch bestätigt immer.
2. **DSGVO / Datenabfluss** (Alt: PII via Lovable-Gateway ohne AVV). → Direkter
   Provider-Vertrag mit AVV + No-Training, EU-Processing-Entscheidung (Schritt 10 =
   Go-Live-Gate), PII-Minimierung, keine Texte in Logs, Retention, Tenant-Kill-Switch.
3. **Kosten-/Verfügbarkeits-Risiko** (Alt: null Kosten-Logging; ein Gateway). →
   `cost_millicents` inkl. Cache-Token-Klassen + synchroner Budget-Stopp (`ai_usage_counters`);
   Zwei-Provider-Failover, durch CI-Golden-Tests + täglichen Canary nachweislich
   funktionsfähig; Gatekeeper-Verbot: Ausfall = Komfortverlust, kein Betriebsstopp.
4. **Abuse & Prompt Injection über den Inbound-Kanal** (öffentliche Mail-Adresse triggert
   bezahlte Auto-Calls): Mail-Flut verbrennt Tenant-Budgets; Injection steuert Klassifikation/
   Extraktion — schlimmster Fall: echte Anfrage als Spam versenkt = verlorener Lead (maximaler
   Nordstern-Schaden). → Pre-LLM-Gate (SPF/DKIM/Spam-Score, Dedupe, Größen-/Rate-Limits),
   Injection-Regeln in der Prompt-Registry + Injection-Golden-Tests, synchroner Budget-Stopp,
   Spam nie löschen, Unsicheres immer sichtbar in der Inbox.

## H — Akzeptanzkriterien

1. Freitext-Anfrage (Storia-Realfall) → geprüfter Anfrage-Draft in ≤ 10 s; jeder „belegt"-Chip
   hält dem Grounding-Check stand (Zitat = Substring des Originaltexts); Übernahme erzeugt
   die Anfrage ohne erneutes Tippen erkannter Felder.
2. End-to-End (Nordstern): Storia-Realfall-Mail → versandfertiges Angebot (3 Optionen +
   Anschreiben) in ≤ 3 Minuten ohne erneutes Tippen erkannter Daten (Chaining + Ein-Screen-Review).
3. `menu_suggest`: genau 3 Varianten (Low/Mid/High), ausschließlich existierende
   Katalog-Artikel und Cents-Preise; kein DB-Write vor Übernahme.
4. Jeder Call → `ai_runs`-Zeile (Modell, Tokens inkl. Cache-Write/-Read-Klassen,
   `cost_millicents`, `prompt_version`, Latenz, Status); berechnete Kosten ==
   Provider-Usage-Abrechnung (Golden-Test); Testmonat Storia-Last nachweislich < 20 €.
5. Budget-Überschreitung stoppt weitere Calls in ≤ 60 s (synchroner
   `ai_usage_counters`-Check) — nicht erst am Folgetag.
6. Kein KI-Ergebnis erreicht Fachtabellen/Kunden ohne explizite Übernahme — außer
   Auto-Aktionen unter Schwellen; Default aus = kein einziger Auto-Versand (Audit `ai_drafts`).
7. Zod-Fehler → genau ein Eskalations-Retry, dann verständlicher Fehler — nie ein stilles Teil-Ergebnis.
8. Golden-Set Mail-Handling: keine echte Anfrage wird als Spam/Sonstiges klassifiziert;
   Unsicheres erscheint immer in der Inbox; Spam wird nie gelöscht, nur eingeklappt;
   Injection-Testmails ändern weder Klassifikation noch Output.
9. Idempotenz: doppelte Zustellung derselben Mail (Webhook-Redelivery/Queue-Retry)
   erzeugt genau einen Draft und maximal einen bezahlten Call.
10. Zuordnung: Antworten auf versandte Angebote werden per Message-ID/Alias ohne LLM-Call
    zugeordnet; nur Ungelöstes erzeugt einen `mail_map`-Call; Unsicheres bestätigt der Mensch
    (Spec-03-Follow-up-Pause greift).
11. Provider-Ausfall: alles bleibt manuell bedienbar (Degraded-Banner, keine Client-Regex);
    Golden-Tests laufen in CI gegen beide Provider (mind. intake_parse, letter_draft); der
    tägliche Canary-Call auf dem Sekundär-Pfad ist in `ai_runs` nachweisbar.
12. Übersetzungs-Cache: gleiche Quelle wird tenant-weit — auch über verschiedene Angebote hinweg
    — kein zweites Mal berechnet (`source_hash`-Treffer); Änderung invalidiert automatisch;
    Badge „maschinell übersetzt" bis Review.
13. RLS: Mandant A kann `ai_runs`/`ai_drafts`/`translation_cache`/`ai_task_settings`/
    `ai_usage_counters` von Mandant B weder lesen noch schreiben (Isolationstest).
14. Prompts existieren nur versioniert in `packages/ai/prompts/` mit Golden-Tests;
    ein Prompt-Update ändert `prompt_version` in neuen `ai_runs`.
15. AVV/DPA mit dem Primär-Provider und die EU-Processing-Entscheidung (inkl. verifizierter
    First-Party-Residency-Frage) sind vor dem ersten zahlenden Mandanten dokumentiert (Gate).
