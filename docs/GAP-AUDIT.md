# MAESTRO — Gap-Audit: Alt-System vs. maestro-cloud

> Systematischer Code-Abgleich (nicht Erinnerung) zwischen dem **Alt-System**
> (`events-storia.de`: öffentliche Website + MAESTRO-Backoffice + ~105 Supabase Edge Functions)
> und dem **Neu-System** (`maestro-cloud`: Cloudflare-Worker-API + React-Backoffice + Neon/Drizzle).
> Methode: 10 parallele Inventar-Leser über beide Codebasen → Gap-Matrix → adversariale
> Verifikation jeder kritischen Lücke gegen den echten Neu-Code. 53 Agenten, 0 Fehler.
> Stand: 2026-07-06.

## Kernbefund (die 5 wichtigsten Erkenntnisse)

1. **Das Rückgrat ist sauber portiert — teils besser.** Multi-Tenant-RLS, Event-State-Machine,
   Angebots-Builder mit server-gerechneten Integer-Cent-Summen, Public-Offer per Token,
   KI-Speisekarten-Import, Nachfass-Automatik. Fundament steht.
2. **Das Herzstück — die KI-Angebotserstellung — ist nur zu ~⅓ da.** Der Freitext-Parser
   existiert (teilweise). Es **fehlen komplett**: der **KI-Menüvorschlag (3 Varianten)**, das
   **KI-Anschreiben**, der **Anfragetext-Parser**, der **öffentliche Chat-Intake** und das
   **Paket-System** (der Preis-Anker, auf dem die ganze KI-Kalkulation aufsetzt).
3. **Der Prozess bricht nach der Angebots-Annahme ab.** LexOffice ist nur ein **unverdrahtetes
   Mapping** (`lexoffice.ts` wird von keiner Route importiert). Die gesamte **Rechnungskette**
   (Anzahlungs-/Schlussrechnung §14(5) UStG, Storno/Gutschrift, Sync) fehlt. Stripe kann nur
   **einen** 50%-Anzahlungslink über das Plattform-Konto — echte Checkout-Sessions sind TODO.
   **Verbindliche Buchung** (confirm-order, AGB, Beweisdaten) und **eSign** fehlen.
4. **Das komplette E-Mail-Modul fehlt** — im Alt-System das zentrale Tageswerkzeug: kein
   IMAP-Posteingang, keine Event-Zuordnung, keine KI-Klassifikation, keine Zustell-Logs/
   SMTP-Fallback, keine Vorlagen.
5. **Kein öffentlicher Anfrage-Intake.** `POST /api/inquiries` verlangt Auth — die IONOS-Website
   kann derzeit **keine Anfragen ins SaaS liefern**. Klein, aber blockierend: ohne diesen Endpoint
   startet der Nordstern-Flow gar nicht. Dazu Betriebsreife-Lücken: Settings/Team read-only,
   kein Activity-Log, kein Error/Health-Tracking, kein Cron-Scheduler verdrahtet.

**Bewusst out-of-scope** (bleibt auf IONOS): Webshop/Checkout, Gutscheine, Website-CMS/Fotoalbum/
SEO, Ristorante-Fremdsystem-Integration.

---

## Das Herzstück im Detail — so lief die KI-Angebotserstellung im Alt-System

> Dies ist die **Bau-Spezifikation** für den Nachbau. Wichtig: Das Alt-System nutzte das
> **Lovable AI Gateway mit Gemini-Modellen**. Der Neubau nutzt stattdessen **Claude über Composio**
> (bereits live bewiesen) — die *Logik* bleibt, der *Transport* ist schon vorhanden.

**Zwei Eingänge:**
- **(A) Öffentliche Website** — eine KI-Intake-Bar (`ai-catering-assistant`): klassifiziert
  FAQ/Anfrage/gemischt, extrahiert Lead-Felder (Name, E-Mail mit Anti-Halluzinations-Check, Gäste,
  Datum, Diät, Budget), führt einen strengen Funnel (Pflichtfelder → Ernährung → Budget →
  Bestätigung), zieht FAQ-Wissen per RAG aus `knowledge_chunks`. Submit → Event; ein
  **serverseitig bepreister** KI-Draft (Preise NIE vom LLM, immer aus dem Katalog) wandert als
  `ai_draft` mit.
- **(B) Admin-Wizard** — eingefügter Anfragetext läuft parallel durch `parse-inquiry-text`
  (Kontakt/Datum/Gäste/Event-Typ/Paket-Vorschläge) und `parse-freeform-offer`; füllt das Formular.

**Der ✨-Kern — `generate-menu-suggestion`:** Input ist nur die `inquiryId`. Lädt Anfrage + aktive
**Pakete** + Katalog-Items (mit `serving_info`/`min_order`) + Equipment, baut einen deutschen
„Maître"-Systemprompt mit **verbindlichen Preis-Ankern (±15 %)** aus den Paket-p.P.-Preisen und
erzwingt einen Tool-Call. Output: **exakt 3 Varianten (low/medium/high)**, je `mode=paket` oder
`mode=menu` (Gänge mit Katalog-IDs), `estimatedPricePerPerson`, Equipment, Reasoning. Server
**validiert hart**: unbekannte IDs und linienfremde Items werden gestrippt; **nichts wird
persistiert** — die UI schreibt die Varianten in Options-Slots mit **DB-Preisen als
`overridePrice`**, danach volle manuelle Nachbearbeitung.

**KI-Anschreiben — `generate-inquiry-email`:** lädt Optionen/Rabatte, nutzt die **letzten 3
versendeten Mails als Few-Shot-Stil**, harte Regeln (Siezen, exakte Brutto-Preise, genau ein
Rabatt-Satz), server-Postprocessing (Markdown-Strip, Pflicht-Link, Signatur je Sender). Entwurf
landet **editierbar** in `email_draft`.

**Beim Versand — `create-event-quotation` (kein LLM):** erzeugt deterministisch das LexOffice-
Angebot 1:1 aus den Optionen (Brutto, MwSt-Split, Rabattzeilen, Freshness-/Summen-Hard-Check).

**Absicherung — `validate-freeform-offer`:** ein **Zweitmodell (Red-Team)** prüft den Freitext-Parse
1:1 gegen den Originaltext, bis zu 2 Auto-Retries mit Korrekturhinweisen.

**Leitprinzipien, die wir übernehmen:** (1) **Preise kommen NIE vom LLM**, immer server-seitig aus
dem Katalog. (2) KI **schlägt vor**, Mensch bestätigt — nichts geht ungesehen raus. (3) Harte
Server-Validierung strippt LLM-Halluzinationen (fremde IDs). (4) Preis-Anker aus Paketen halten die
KI realistisch.

---

## Gap-Matrix (nur in-scope; 55 Zeilen)

Legende Status: ✅ portiert · 🟡 teilweise · ❌ fehlt · Kritikalität: **K**ern / **W**ichtig /
**N**ice-to-have · Aufwand: S/M/L.

### KI-Angebot (das Herzstück)
| Feature | St | Krit | Aufw |
|---|:--:|:--:|:--:|
| Angebots-Builder (Varianten, Rabatt/Zielpreis, Mehrtages, Optimistic Locking, Server-Totals) | ✅ | K | S |
| KI-Speisekarten-Import (PDF/Bild/Text → Katalog) | ✅ | W | S |
| **KI-Menüvorschlag (3 Varianten, Preis-Anker, Linien-Erkennung, Equipment)** | ❌ | **K** | L |
| **Paket-System (buchbare Pakete, Preismodell/Staffeln, Baukasten, Paket-Modus)** | ❌ | **K** | L |
| **Anfragetext-Parser (Mail/Freitext → Kontakt/Datum/Gäste/Typ) für Admin-Intake** | ❌ | **K** | M |
| **KI-Anschreiben-Generator (Stilregeln, Few-Shot, editierbarer Entwurf)** | ❌ | **K** | M |
| **Verbindliche Buchung ohne Online-Zahlung (confirm-order: AGB, IP/UA-Nachweis)** | ❌ | **K** | M |
| Freitext-Angebots-Parser (Tages-Struktur, Fuzzy-Katalog-Match, Retries) | 🟡 | K | M |
| Angebotsversand (WYSIWYG-Preview, Testmail, PDF-Anhang, Zustell-Verifikation) | 🟡 | K | M |
| Öffentliche Angebotsseite (Phasen, Anschreiben, Zahlungsplan, PDF, 4 Sprachen) | 🟡 | K | M |
| Öffentlicher KI-Chat-Intake (Funnel, RAG-FAQ, bepreister Draft, Uploads) | ❌ | W | L |
| KI-Übersetzungen IT+FR (Anschreiben/Menüs on-demand) | ❌* | W | M |
| Red-Team-Validierung des Freitext-Parses (Zweitmodell) | 🟡 | W | M |
| Angebots-Versionsarchiv (+ „als neues Angebot kopieren") | 🟡 | N | S |
| Knowledge-Base/RAG-Pflege | ❌ | N | M |

### Zahlungen & LexOffice (Prozess nach der Zusage)
| Feature | St | Krit | Aufw |
|---|:--:|:--:|:--:|
| Stripe-Checkout aus Angebot (Anzahlung %/Fix, Vollzahlung, Multi-Option) | 🟡 | K | M |
| Stripe-Webhook mit Folgeaktionen (Rechnung, Mails, Status-Kaskade) | 🟡 | K | M |
| Zahlungsplan je Event (mehrere Posten, Typen, Fälligkeit) | 🟡 | K | M |
| **LexOffice-Rechnungskette (Anzahlung §14(5), Schluss mit Abzug, POS-Guards)** | ❌ | **K** | L |
| LexOffice-Angebotserzeugung aus Optionen (verdrahten) | 🟡 | K | M |
| LexOffice-Belegverwaltung (Listen, PDF-Proxy, Status-Sync, Storno/Gutschrift) | ❌ | W | L |
| Restzahlungs-Links (anpassbare Gästezahl, Anzahlungs-Verrechnung) | ❌ | W | M |
| Zahlungs-E-Mails (Link, Bestätigung, Restzahlung, mehrsprachig) | ❌ | W | M |
| Zahlungs-Reconciliation + Overdue-Sweep (Cron) | ❌ | W | S |
| Storno-Workflow (KI-Text, Stripe-Refund, LexOffice-Gutschrift) | 🟡 | W | M |

### E-Mail / Inbox (das Tageswerkzeug — komplett offen)
| Feature | St | Krit | Aufw |
|---|:--:|:--:|:--:|
| IMAP-Posteingang (Sync INBOX/SENT/DRAFTS, Attachments, Triage-UI) | ❌ | W | L |
| E-Mail↔Event-Zuordnung (Filterregeln, Backfill, Matching) | ❌ | W | L |
| Mail-Client pro Vorgang (Threads, Antworten, gesendete Mails) | ❌ | W | L |
| KI-Mail-Klassifikation (Heuristik + Claude Haiku, Feedback-Loop) | ❌ | W | M |
| Anfrage aus E-Mail erzeugen (find-or-create Kunde/Event, Inbound-Webhook) | ❌ | W | M |
| E-Mail-Vorlagen / Textbausteine / Signaturen | ❌ | W | M |
| E-Mail-Zustell-Infra (Resend-Webhook, delivery_logs, SMTP-Fallback) | ❌* | W | L |

### Kunden & Dokumente
| Feature | St | Krit | Aufw |
|---|:--:|:--:|:--:|
| Event-Vorgangs-Spine mit State-Machine | ✅ | K | S |
| Katalog-Stammdaten (Equipment/Personal, Kategorien, Allergene, Archiv) | ✅ | W | S |
| Kunden-CRUD/CRM (Dubletten-Merge, Historie) | ✅ | W | S |
| **Öffentlicher Anfrage-Intake-Endpoint (Rate-Limit, Bestätigungs-Mails, Idempotenz)** | ❌ | **K** | M |
| Menü-Bestätigungs-Workflow (MenuComposer, Mail 4-sprachig, `menu_confirmed`) | ❌ | W | M |
| eSignatures-Kostenübernahme (Template-Versionierung, MFA, Webhook, Lock) | ❌ | W | L |
| Angebots-/Auftragsdokument als PDF | 🟡 | W | S |
| Kundenkonto/Portal (Profil, Bestellhistorie, Rechnungs-Download) | ❌ | N | L |
| Locations-Stammdaten (Räume, Kapazitäten, Paket-Zuordnung) | ❌ | N | S |

### Betrieb / Cron / Verwaltung
| Feature | St | Krit | Aufw |
|---|:--:|:--:|:--:|
| Angebots-Nachfass-Automatik T+3/T+7 | ✅ | W | S |
| Aufgaben-Board (Kanban, Priorität, Zuweisung, Event-Bindung) | 🟡 | W | S |
| **Cron-Infrastruktur (Scheduler für Reminder/Reconciliation/Audits verdrahten)** | 🟡 | W | S |
| **Mandanten-Einstellungen schreibbar (NAP, Absender, Branding, Modul-Config)** | ❌* | W | M |
| **Nutzer-/Team-Verwaltung (einladen, Rolle ändern, deaktivieren)** | 🟡 | W | M |
| Dashboard-Worklist „Pinnwand" (SLA-Buckets, Snooze, Fehler-Kachel) | 🟡 | W | M |
| Weitere Reminder (Menü-Bestätigung T-7, Event-morgen, Restzahlung T-13) | ❌ | W | M |
| Druck-System (Küchenzettel, Laufzettel, Sammel-Druck) | ❌ | W | M |
| Activity-Log / Audit-Trail + Kollaboration (Presence, Locks, Kommentare) | ❌ | W | L |
| System-Health / Error-Hub (Tracking, Eskalation, Daily-Audit) | ❌ | W | M |
| DSGVO-Retention (Policies, Purge-Views, Dry-Run-Runner) | ❌ | W | M |
| Conversion-Analytics (Funnel nach Kanal/Mitarbeiter, Verlustgrund) | 🟡 | N | M |
| WhatsApp-Betreiber-Alerts | ❌ | N | S |
| Google-Review-Anfragen-Automation | ❌ | N | M |

*\* = Erstbefund „teilweise" wurde bei der adversarialen Verifikation zu **„fehlt" korrigiert**
(siehe unten).*

---

## Adversariale Verifikation — 3 Erstbefunde verschärft

Die Verifikations-Agenten haben drei „teilweise"-Einordnungen als **tatsächlich fehlend** entlarvt:

1. **KI-Übersetzung / Mehrsprachigkeit:** `offer_language` (de/en) hat **keinen Schreibpfad**
   (kein Endpoint/UI setzt es); Katalog-`translations`-JSONB wird **nie gerendert** (0 Konsumenten);
   `ai-gateway.ts` sagt explizit „ÜBERSETZE NICHTS". Kein IT/FR im Code. → **fehlt.**
2. **E-Mail-Zustell-Infrastruktur:** `mailer.ts` macht nur Versand; die Message-ID wird verworfen,
   Fehler landen nur in der Response; `offer_history.email_content` wird nie befüllt; einziger
   Webhook ist Stripe. Kein svix/smtp/bounce/alert im Repo. → **fehlt.**
3. **Mandanten-Einstellungen schreibbar:** `settings.tsx` sagt selbst „keine Speicher-Route";
   `tenants` hat nur slug/name/stripeAccountId mit `RLS modify:false`; kein Settings-Write-Endpoint.
   Absender kommt aus `env`, nicht pro Mandant. → **fehlt.**

---

## Empfohlene Bau-Reihenfolge (Nordstern zuerst)

**Welle 0 — Sofort-Blocker (klein):**
- ❌ **Öffentlicher Anfrage-Intake-Endpoint** — ohne ihn startet der Funnel nicht.

**Welle 1 — Das Herzstück (goldener Pfad „Anfrage → Angebot in Minuten"):**
1. ❌ **Paket-System** (Preis-Anker — Basis für alles Folgende)
2. ❌ **KI-Menüvorschlag (3 Varianten)** — der ✨-Button
3. ❌ **Anfragetext-Parser** (Mail rein → Formular vorausgefüllt)
4. ❌ **KI-Anschreiben-Generator**
5. 🟡 **Angebotsversand vervollständigen** (Preview, PDF-Anhang, Testmail)
6. 🟡 **Freitext-Parser** vervollständigen + Red-Team-Validierung

**Welle 2 — Auftrag & Beleg (nach Zusage):**
- ❌ Verbindliche Buchung (confirm-order) · 🟡 Stripe-Checkout/Zahlungsplan/Webhook-Folgen ·
  🟡→ LexOffice-Angebot verdrahten + ❌ Rechnungskette · ❌ eSign-Kostenübernahme

**Welle 3 — Tageswerkzeug E-Mail:**
- ❌ IMAP-Inbox · Event-Zuordnung · KI-Klassifikation · Vorlagen · Zustell-Infra

**Welle 4 — Betriebsreife:**
- Settings/Team schreibbar · Cron-Scheduler verdrahten · Activity-Log · Health/Error-Hub ·
  DSGVO-Retention · Druck-System · weitere Reminder

**Out-of-scope (bleibt IONOS):** Catering-Webshop + 3-Stufen-Checkout + Lieferkosten + Billie-BNPL ·
Gutschein-System · Website-CMS/Speisekarten/Fotoalbum/SEO · Ristorante-Fremdsystem.

---

## UX-Rückgrat für die Umsetzung (aus den Design-Sessions)

Zwei Lebensphasen, eine Vorgangsseite, die je nach Status das Richtige nach vorn stellt:
- **Verkaufen** (Anfrage → ✨ → Angebot → Zusage): Geschwindigkeit = Nordstern. Screens:
  Anfrage-Drawer mit **einem** ✨-Button · KI-Moment · Builder im Prüf-Modus (amber „Prüfen"-Pills).
- **Durchführen** (nach Zusage): Kontrolle. Screen: Gala-Layout mit Tabs Ablauf/Personal/Logistik/
  Menü + Automatik-Timeline + ⋯-Kontextmenü.

**KISS-Regeln:** ein primärer Button pro Screen · Defaults statt Fragen (Anzahlung 50 %, Gültigkeit
14 Tage, Sprache erkannt) · KI schlägt vor / Mensch bestätigt · **Sidebar ≤ 9 Einträge** · kein
Feature verlängert den goldenen Pfad (dockt seitlich an oder verschwindet als Hintergrund-Automatik).
