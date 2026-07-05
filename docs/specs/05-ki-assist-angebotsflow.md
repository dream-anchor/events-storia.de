# KI-Assist im Angebots-Flow (Querschnitts-Spec)

Modul-Spec MAESTRO · Stand 2026-07-05 · Status: entscheidungsreif
Scope: Intake-Parse (Freitext/Mail → strukturierte Anfrage), KI-Menüvorschlag
(3 Preisvarianten), KI-Anschreiben, Übersetzung DE↔EN, später Chat-Intake.
**Querschnitt:** definiert die KI-Architektur für ALLE Module — Provider-Wahl,
Kosten-Logging, Prompt-Versionierung, Mandanten-Datenschutz, Fallback.

## A — IST im Alt-System (mit Evidenz)

Zugehörige Inventar-Funktionen (docs/MAESTRO-FEATURE-INVENTAR.md): KI-Anschreiben
(generate-inquiry-email) · KI-Menüvorschlag (generate-menu-suggestion) ·
Freitext-Parse + Red-Team-Validierung (parse-freeform-offer, validate-freeform-offer) ·
Intake-Parse (parse-inquiry-text) · KI-Mail-Zuordnung (suggest-email-mapping) ·
KI-Intake-Chat inkl. Uploads (ai-catering-assistant, ai-intake-upload-url,
ai_conversations/ai_messages/ai_extractions) · Übersetzungen (translate-offer-letter,
translate-menu-text, translate-package-menu) · Storno-Text (ai-cancellation-message) ·
Foto-Klassifikation (classify-photo).

Die KI funktioniert im Alltag — aber als **gewachsener Wildwuchs ohne gemeinsame
Infrastruktur**. Belegte Befunde:

1. **Fragmentierte Modell-Landschaft, Vendor-Lock:** 10+ Edge Functions, 5 Modelle,
   2 Gateways. `parse-freeform-offer/index.ts:192-199` (Gemini 2.5 Pro via
   `ai.gateway.lovable.dev`), `generate-menu-suggestion:463` (Gemini 2.5 Flash),
   `ai-catering-assistant:20` (`gemini-3-flash-preview`), `validate-freeform-offer:122`
   (`openai/gpt-5`) — alle über den Lovable-Dev-Gateway (`LOVABLE_API_KEY` in 10
   Functions). Einzig `suggest-email-mapping:277-285` ruft Anthropic direkt
   (`claude-haiku-4-5`). Kein AVV-fähiger Vertragspartner für den kritischen Pfad.
2. **Null Kosten-Logging:** Grep über alle KI-Functions nach
   `usage|total_tokens|cost` → **kein einziger Treffer**. Niemand weiß, was ein
   Vorgang kostet — für ein Multi-Tenant-SaaS mit preissensibler Zielgruppe k.o.
3. **Keine Prompt-Versionierung:** `prompt_version|PROMPT_VERSION` → 0 Treffer.
   Prompts sind Inline-Strings pro Function; Änderungen sind nicht nachvollziehbar
   (Spec 06 dokumentiert die Folge: Prompt eskaliert auf 16 Großbuchstaben-Regeln).
4. **Personendaten hartkodiert:** `generate-inquiry-email/index.ts:9-16` —
   `SENDER_INFO`-Map mit privaten E-Mail-Adressen und Mobilnummern echter
   Mitarbeiter im Quellcode. Nicht mandantenfähig, DSGVO-fragwürdig.
5. **Zweitmodell als Workaround:** `validate-freeform-offer` lässt GPT-5 den
   Gemini-Parse gegen den Originaltext prüfen — ein zweites LLM als
   Symptombekämpfung für einen nicht vertrauenswürdigen Parser (Spec 02 hat die
   Streichung bereits entschieden: deterministischer Summen-Check statt Red-Team).
6. **2.135-Zeilen-Monolith mit Eigenbau-Observability:** `ai-catering-assistant`
   baut sich `createTrace/traceStep/traceEnd` (Z. 28-74) selbst, weil es keine
   gemeinsame KI-Infra gibt; Timeouts (16 s AI, 2,5 s Knowledge/Draft) sind
   pro Function handgestimmt.
7. **Fallback client-seitig dupliziert:** `src/hooks/useAiIntake.ts:92` — „Local
   NLU (used only as fallback when the AI backend is unreachable)": Regex-Extraktion
   im Browser als Schatten-Implementierung des Servers (Z. 432).
8. **Mandanten-Isolation nachgerüstet:** `ai_conversations/ai_messages/ai_extractions`
   entstanden ohne `tenant_id` (Migration 20260615124240); `tenant_id` kam erst
   per 20260625231646 nachträglich — Single-Tenant-Denke im Fundament.
9. **Übersetzung dreifach implementiert, Cache am falschen Ort:** 3 separate
   Functions für Menütext/Paket/Anschreiben (de→en/it/fr), Cache als
   `email_content_translations`-JSONB direkt auf `v2_events` mit eigenem
   Sync-Banner im Editor — Invalidierung ist Handarbeit.

Neubau-Stand (`/home/user/maestro-cloud`): Worker (Hono) + Neon-RLS-Fundament mit
`inquiries/offers/payments`-Routen steht und ist isolationsgetestet — **es existiert
noch null KI-Code** (Grep `anthropic|openai|gemini` in apps/api + packages/db: leer).
Wir bauen auf der grünen Wiese, mit Spec 02 (ai-suggest, parse-freeform als
Endpunkt-Kontrakte) und Spec 03 (Anschreiben, Follow-up-Texte) als Konsumenten.

## B — Der eigentliche Job (Jobs-to-be-done)

**Job:** „Verwandle unstrukturierten Kunden-Input in Sekunden in einen prüfbaren
Vorschlag — Anfrage-Entwurf, 3 Menü-Varianten, Anschreiben, Übersetzung — damit
der Betreiber nur noch bestätigt statt tippt." Jede KI-Sekunde zahlt direkt auf
die Nordstern-Metrik „Minuten bis Angebot" ein. Der Querschnitts-Job dahinter:
**EINE** KI-Infrastruktur (Gateway, Kosten, Prompts, Datenschutz, Fallback) für
alle Module, damit nie wieder Befund 1-9 entsteht.

**Gestrichen / zusammengelegt (mit Begründung):**
- **validate-freeform-offer (GPT-5-Red-Team)** — gestrichen; deterministischer
  Summenabgleich in der Pricing-Engine (Spec 02) ersetzt das Zweitmodell.
- **3 Übersetzungs-Functions → 1 generischer Translate-Endpoint** mit
  Hash-Cache-Tabelle statt JSONB-am-Event. **IT/FR gestrichen** — Produktsprachen
  sind DE+EN (Leitplanke); Storia-Bestandsdaten bleiben lesbar (Archiv).
- **SENDER_INFO-Hardcoding** — ersetzt durch Team-Stammdaten des Mandanten.
- **ai-cancellation-message** — wird Vorlage des generischen Anschreiben-Endpoints
  (gleicher Task, anderer Prompt), keine eigene Function.
- **Lovable-Gateway** — nicht portiert; direkte Provider-SDKs im Worker.
- **Client-seitiger Regex-NLU-Fallback** — gestrichen; bei KI-Ausfall ehrlich
  degradieren (normales Formular), keine Schatten-Implementierung pflegen.
- **Chat-Intake auf der Website (AiIntakeBar)** — auf Phase 2 verschoben; das
  `ai_conversations`-Modell wird übernommen (mit tenant_id ab Tag 1), aber der
  MVP-Intake ist Webformular + E-Mail-Parse. Eigene RAG-Infra
  (knowledge_sources/chunks) wird im MVP nicht portiert.
- **classify-photo** — Storia-only (Website-Fotoalbum), kein MAESTRO-Kern.

## C — Benchmark 2026

KI im Angebotsflow ist **Table Stakes**, kein USP (Digest): Event Temple „AI
Sales Suite" (E-Mail→Lead per Klick, Smart Proposal Builder, 8/2025), iVvy/hivr.ai
„Instant Proposal" (Parse+Score+Proposal in Minuten, 1/2026), Perfect Venue „AI
Reply" in allen Tiers, Univents (Sprachmemo/Mail→Eventdaten, KI-Angebote ab
46 €/Monat), CaterSmart, Proposales AI Inbox. Das relevante Muster liefert
iVvy/hivr.ai: **Human-in-the-Loop über Schwellenwerte** — KI-Entwurf sofort,
Auto-Versand nur unter konfigurierten Grenzen (Eventwert, Sonderwünsche).

**Wo wir gleichziehen:** Mail→strukturierte Anfrage, Angebots-Entwurf in Sekunden,
KI-Antworttexte, Übersetzung — alles als Vorschlag mit Ein-Klick-Übernahme.

**Wo wir bewusst schlagen:**
1. **Kostentransparenz pro Vorgang** — kein Wettbewerber zeigt „diese Anfrage hat
   0,3 ct KI gekostet"; wir loggen jeden Call in Milli-Cents und zeigen es im Admin.
2. **DSGVO by design** — AVV mit dem Modell-Provider, keine Trainingsnutzung,
   EU-Processing-Option, PII-Minimierung im Prompt; US-Tools (Perfect Venue,
   Tripleseat) können das für DACH nicht erzählen.
3. **KI nie als Gatekeeper** — jeder Flow bleibt ohne KI voll bedienbar
   (Ausfall = Beschleuniger weg, nicht Betrieb steht); hivr.ai-abhängige
   Produkte können das nicht garantieren.

## D — Soll-Design (Neubau)

### UX-Hauptflow (Stitch Material-3/Terracotta, mobile-first)
1. E-Mail/Formular-Anfrage trifft ein → Queue-Job `intake_parse` läuft automatisch.
2. Inbox zeigt die Anfrage mit Karte „KI-Entwurf — prüfen": extrahierte Felder
   (Name, Datum, Gäste, Anlass, Budget) mit Konfidenz-Chips; fehlende Felder gelb.
3. Betreiber korrigiert inline, tippt „Übernehmen" → Anfrage/Event entsteht
   (ein Tap pro Feldgruppe, mobil als Bottom-Sheet).
4. Im Builder (Spec 02): Kachel „KI-Vorschlag" → 3 Options-Entwürfe Low/Mid/High
   aus Anfrage + Katalog, je mit 1-Satz-Begründung und Preis pro Person;
   Übernahme pro Option, Badge bleibt bis zur ersten Bearbeitung.
5. Composer (Spec 03): „KI-Anschreiben" generiert Entwurf passend zu Phase
   (Erstangebot/Final/Nachfass/Storno) und Mandanten-Tonalität; Variablen bleiben
   als Platzhalter sichtbar; Erstversand nie ohne Menschen.
6. Kundensprache EN: Toggle „Übersetzen" → gecachte DE↔EN-Übersetzung von
   Anschreiben + Positionstexten; Badge „maschinell übersetzt" bis Review.
7. Admin → Einstellungen → KI: pro Feature an/aus, Auto-Send-Schwellen,
   Monatsbudget, Kosten-Dashboard (Calls, Cents, Ø-Latenz pro Feature).
8. Ausfall-Zustand: Banner „KI derzeit nicht verfügbar — alle Funktionen manuell
   nutzbar"; Kacheln degradieren zu Leer-/Vorlagen-Start, nichts blockiert.

### KI-Architektur (Querschnitt, `packages/ai`)
- **Ein Gateway-Paket im Worker** (TypeScript, kein Deno): Provider-Adapter
  Anthropic (primär, `@anthropic-ai/sdk`) + OpenAI (sekundär) hinter EINEM
  Interface `runTask(task, input, ctx) → zod-validiertes Ergebnis`. Keys als
  Worker-Secrets, pro Umgebung; kein Dritt-Gateway.
- **Task-Routing (Default, per ENV/Tenant-Override änderbar):**

| Task | Modell (Default) | Warum | ~Kosten/Call |
|---|---|---|---|
| `intake_parse` | claude-haiku-4-5 | einfache Extraktion, Latenz | ~0,3 ct |
| `mail_classify` | claude-haiku-4-5 | Masse, Stufe 2 nach Heuristik | ~0,2 ct |
| `translate` | claude-haiku-4-5 | Standardaufgabe, Cache davor | ~0,3 ct |
| `menu_suggest` | claude-sonnet-5 | Katalog-Reasoning, 3 Varianten | ~4 ct |
| `letter_draft` | claude-sonnet-5 | Tonalität, Kundenkontakt | ~1,5 ct |
| `freeform_parse` | claude-opus-4-8 | **Geldbeträge 1:1 — Präzision vor Kosten** | ~7 ct |

  Eskalations-Retry: scheitert die zod-Validierung, ein zweiter Versuch mit dem
  nächststärkeren Modell, dann Fehler mit Klartext (Muster aus Spec 06).
  Katalog-Snippet bei `menu_suggest` als stabiler Prompt-Präfix mit
  `cache_control` → Wiederholungs-Calls ~90 % billiger.
- **Structured Outputs statt Prompt-Drohungen:** jedes Task-Schema als zod +
  `output_config.format` (JSON-Schema erzwungen); ein Schema von Prompt bis DB.
- **Prompt-Registry im Code:** `packages/ai/prompts/<task>/vN.ts` — versioniert
  via Git, `prompt_key`+`prompt_version` werden pro Call geloggt; Golden-Tests
  je Prompt-Version gegen reale Beispiel-Anfragen (auch Storia-Regressionsfälle).
- **Human-in-the-Loop-Muster (verbindlich für alle Module):** KI schreibt nie
  direkt in Fachtabellen. Ergebnis → `ai_drafts` → UI-Badge → Mensch übernimmt.
  Auto-Aktionen (z. B. Auto-Send Nachfass, Spec 03) nur wenn `ai_task_settings`
  es erlaubt UND Schwellen eingehalten (Eventwert ≤ X Cents, keine
  Sonderwunsch-Signale, kein Exklusiv-Buchungs-Flag) — iVvy-Muster.

### Datenmodell (Neon, tenant_id + RLS FORCE überall, Geld in Cents)
```
ai_runs (Telemetrie, KEINE Prompt-/Output-Texte — nur Metadaten)
  id uuid pk · tenant_id → tenants · task text · prompt_key text ·
  prompt_version int · provider text · model text · input_tokens int ·
  output_tokens int · cost_millicents int not null   -- 1/1000 Cent, integer;
     (bewusste Ausnahme zur Cents-Leitplanke: interne Kostenrechnung, kein
      Kundengeld; Aggregate werden in Cents gerendert) ·
  latency_ms int · status text ('ok','invalid_output','provider_error',
  'timeout','rate_limited','budget_blocked') · error text ·
  entity jsonb ({event_id?, inquiry_id?, email_id?}) · created_by · created_at

ai_task_settings (pro Mandant, pro Task)
  tenant_id · task · enabled bool default true · model_override text ·
  auto_action bool default false · auto_max_value_cents int ·
  monthly_budget_cents int · pk (tenant_id, task)

ai_drafts (Human-in-the-Loop-Protokoll + Lernsignal)
  id · tenant_id · task · entity_type/entity_id · payload jsonb (zod-validiert) ·
  confidence jsonb · status ('proposed','accepted','edited','rejected') ·
  run_id → ai_runs · decided_by · decided_at · created_at
  → Purge-Policy (Retention-Muster aus Alt-Migration 20260624132809 übernehmen)

translations (ersetzt 3 Functions + JSONB-Cache am Event)
  tenant_id · entity_type · entity_id · field · lang ('en') ·
  source_hash text (Invalidierung = Hash-Mismatch, kein Sync-Banner) ·
  text · reviewed bool default false · created_at
  unique (tenant_id, entity_type, entity_id, field, lang)

Phase 2: ai_conversations / ai_messages (Website-Chat) — Schema aus Alt-System
übernehmen, aber tenant_id NOT NULL ab Tag 1, RLS FORCE, Rate-Limit-Spalten.
```

### API (Hono-Worker)
- `POST /api/ai/parse-inquiry {text | inbound_email_id}` → InquiryDraft
  (kein Fachtabellen-Write; Draft in `ai_drafts`).
- `POST /api/events/:id/offers/ai-suggest` → 3 Options-Drafts (Kontrakt Spec 02).
- `POST /api/events/:id/offers/parse-freeform {text}` → Items-Draft +
  `totals_from_text` (Kontrakt Spec 02; Task `freeform_parse`).
- `POST /api/events/:id/ai/letter {phase, tone?}` → Anschreiben-Entwurf
  (Kontrakt Spec 03; ersetzt generate-inquiry-email + ai-cancellation-message).
- `POST /api/ai/translate {entity | text, target:'en'}` → Cache-first-Übersetzung.
- `POST /api/ai/drafts/:id/decide {status, edited_payload?}` → Übernahme/Ablehnung.
- `GET /api/ai/usage?month=` → Aggregat Calls/Kosten/Fehler pro Task (Dashboard).
- Alle Endpunkte laufen durch `withTenant()`; `runTask` prüft `ai_task_settings`
  (enabled, Budget) VOR dem Provider-Call → `budget_blocked` statt Überraschung.

### Automatisierungen (Queue/Cron)
- **Queue `ai-jobs`:** Inbound-Mail → `mail_classify` + `intake_parse` async;
  UI aktualisiert via Polling/SSE. Timeout 20 s, 1 Retry, dann `failed` sichtbar.
- **Circuit Breaker:** n Provider-Fehler in 5 Min → Task auf Sekundär-Provider;
  beide down → Flag `ai_degraded` (KV) → UI-Banner, Endpunkte antworten 503
  mit Klartext. Kein stiller Client-Fallback.
- **Cron nightly:** Kosten-Aggregation pro Tenant/Task; Budget zu 80 %/100 % →
  Benachrichtigung bzw. Soft-Stop (nur inklusive Tasks laufen weiter).
- **Nordstern-Kopplung:** `ai_drafts.accepted` stempelt Zeitersparnis-Metrik
  („KI-unterstützte Angebote vs. manuell: Minuten bis Versand") ins Dashboard.

### KI-Punkte (Input → Vorschlag → Bestätigung)
Sind hier der Modulkern selbst (Tabelle oben). Verbindliche Regeln für ALLE
Module: (1) KI-Ergebnis ist immer Draft mit Badge, (2) Auto-Aktion nur unter
Schwellen aus `ai_task_settings`, (3) jeder Call geloggt in `ai_runs`,
(4) Ablehnung/Bearbeitung wird protokolliert (spätere Prompt-Verbesserung).

### Datenschutz & Provider-Vertrag (verbindlich)
- **Keine Trainingsnutzung:** Anthropic-API nutzt Kundendaten vertragsgemäß nicht
  zum Training (Commercial Terms); AVV/DPA vor Go-Live abschließen; gleiches Gate
  für den Sekundär-Provider (OpenAI API mit DPA, Training opt-out per Default).
- **EU-Processing:** Option A `inference_geo: "eu"` (First-Party-API, Residency-
  Parameter); Option B Vertex AI EU-Region als Deployment-Pfad. Entscheidung vor
  Vertrieb an datenschutz-sensible Kunden; im Datenschutzhinweis dokumentieren.
- **PII-Minimierung:** Prompts erhalten nur benötigte Felder (kein ganzer
  Mail-Thread, wenn Datum+Gäste reichen); `ai_runs` speichert keine Texte;
  `ai_drafts` unterliegt der Retention-Policy; Kill-Switch pro Tenant sofort wirksam.

### Integrations-Berührungen
- **Inbox/E-Mail (Welle 1):** Inbound-Adresse liefert den Roh-Input für
  `intake_parse`/`mail_classify`. **Spec 02/03:** konsumieren die Endpunkte.
- **Katalog (Spec 01):** liefert das Snippet für `menu_suggest` (nur aktive
  Artikel, Preise als Cents-Snapshot). **WhatsApp (Welle 2):** Follow-up-Texte
  aus `letter_draft`-Task. **Registry (B10):** jeder Task ein Registry-Flag.

## E — Klassifikation

**Kern (Infrastruktur):** `packages/ai`, `ai_runs`, `ai_task_settings`,
Datenschutz-Setup — nicht abschaltbar, weil alle Module darauf bauen.
**Pro Tenant schaltbar (Registry B10):** jedes einzelne KI-Feature
(`intake_parse`, `menu_suggest`, `letter_draft`, `translate`, Auto-Aktionen) —
Kriterium: Betrieb muss ohne KI voll arbeitsfähig sein (Gatekeeper-Verbot).
**Modul (Phase 2):** Website-Chat-Intake inkl. `ai_conversations` + Uploads.
**Storia-only:** classify-photo, IT/FR-Bestandsübersetzungen, Ristorante-Knowledge-Base.

## F — Bau-Plan

| # | Schritt | Abhängig von | Aufwand | Neu |
|---|---------|--------------|---------|-----|
| 1 | `packages/ai`: Provider-Adapter (Anthropic+OpenAI), runTask, zod-Gate, Eskalations-Retry, Kosten-Berechnung | — | M | Paket |
| 2 | Migration: `ai_runs`, `ai_task_settings`, `ai_drafts`, `translations` + RLS FORCE + Isolationstests | — | S | Tabellen |
| 3 | Prompt-Registry v1: intake_parse + translate (Schemas, Golden-Tests mit Storia-Realfällen) | 1 | M | Prompts |
| 4 | Endpunkte parse-inquiry, translate, drafts/decide + Draft-Karten-UI (Konfidenz-Chips, Übernehmen) | 1-3 | L | API/UI |
| 5 | `menu_suggest` (Katalog-Snippet + Prompt-Caching) + Builder-Kachel-Anbindung (Spec 02) | 1-3, Spec 01 | L | Prompt/UI |
| 6 | `letter_draft` (Phasen-Vorlagen, Mandanten-Tonalität) + Composer-Anbindung (Spec 03) | 1-3 | M | Prompt/UI |
| 7 | `freeform_parse` auf Opus + deterministischer Summen-Check (ersetzt Red-Team) | 1-3, Spec 02 Engine | M | Prompt |
| 8 | Queue `ai-jobs` (Mail→Parse async), Circuit Breaker, Degraded-Banner | 4 | M | Queue |
| 9 | KI-Einstellungen + Kosten-Dashboard (`/api/ai/usage`), Budget-Cron, Kill-Switch | 2,4 | M | UI/Cron |
| 10 | AVV/DPA + EU-Processing-Entscheidung dokumentieren, Datenschutzhinweis-Baustein | — | S | Doku |
| 11 | Phase 2: Chat-Intake (ai_conversations tenant-native, Uploads, Rate-Limits) | 4,8 | XL | Modul |

Kritischer Pfad 1→4; 5-7 parallelisierbar; 10 parallel ab Tag 1 starten.

## G — Risiken & Lösungen (Top 3)

1. **Halluzinierte Zahlen bei Geld** (Alt-System brauchte GPT-5-Red-Team +
   Repair-Function). → Structured Outputs + zod-Gates, Preise nur als Snapshot
   aus Katalog bzw. 1:1 aus Text mit deterministischem Summenabgleich (Engine
   Spec 02), `freeform_parse` auf stärkstem Modell, Mensch bestätigt immer.
2. **DSGVO / Datenabfluss** (Alt: Kunden-PII über Lovable-Dev-Gateway ohne AVV,
   Personendaten im Code). → Direkter Provider-Vertrag mit AVV + No-Training,
   EU-Processing-Option, PII-Minimierung, keine Texte in Logs, Retention-Policy,
   Tenant-Kill-Switch; Schritt 10 ist Go-Live-Gate.
3. **Kosten- und Verfügbarkeits-Risiko** (Alt: null Kosten-Logging; ein Gateway).
   → `cost_millicents` pro Call + Monatsbudget + Soft-Stop; Zwei-Provider-
   Abstraktion mit Circuit Breaker; KI-Gatekeeper-Verbot macht Ausfall zum
   Komfortverlust statt Betriebsstopp.

## H — Akzeptanzkriterien

1. Eine Freitext-Anfrage (Storia-Realfall) wird in ≤ 10 s zu einem geprüften
   Anfrage-Draft mit Konfidenz-Chips; Übernahme erzeugt die Anfrage ohne
   erneutes Tippen der erkannten Felder.
2. `menu_suggest` liefert genau 3 Varianten (Low/Mid/High) ausschließlich mit
   existierenden Katalog-Artikeln und Cents-Preisen; kein DB-Write vor Übernahme.
3. Jeder KI-Call erzeugt eine `ai_runs`-Zeile mit Modell, Tokens,
   `cost_millicents`, `prompt_version`, Latenz und Status; das Admin-Dashboard
   zeigt Monatskosten pro Task; ein Testmonat Storia-Last kostet nachweislich
   < 20 € (Log-Auswertung).
4. Kein KI-Ergebnis erreicht Fachtabellen oder Kunden ohne explizite Übernahme —
   außer Auto-Aktionen unterhalb konfigurierter Schwellen, die abgeschaltet
   (Default) keinen einzigen Auto-Versand auslösen (Audit über `ai_drafts`).
5. Zod-Validierungsfehler führt zu genau einem Eskalations-Retry, dann zu einem
   verständlichen Fehler — nie zu einem stillen Teil-Ergebnis.
6. Bei simuliertem Ausfall beider Provider bleiben Anfrage-Anlage, Builder,
   Versand und Annahme voll bedienbar; UI zeigt den Degraded-Banner; keine
   Client-seitige Regex-Extraktion springt ein.
7. Übersetzungs-Cache: gleiche Quelle wird kein zweites Mal berechnet
   (`source_hash`-Treffer); geänderte Quelle invalidiert automatisch; EN-Texte
   tragen bis zum Review ein „maschinell übersetzt"-Kennzeichen.
8. RLS: Mandant A kann `ai_runs`/`ai_drafts`/`translations`/`ai_task_settings`
   von Mandant B weder lesen noch schreiben (automatisierter Isolationstest).
9. Prompts existieren nur versioniert in `packages/ai/prompts/` mit bestehenden
   Golden-Tests; ein Prompt-Update ändert `prompt_version` in neuen `ai_runs`.
10. AVV/DPA mit dem Primär-Provider und die EU-Processing-Entscheidung sind vor
    dem ersten zahlenden Mandanten dokumentiert (Go-Live-Gate).
