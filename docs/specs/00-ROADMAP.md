# MAESTRO — Produkt-Roadmap & Modul-Landkarte

> Synthese aus: 393-Funktionen-Inventar, Gap-Analyse, Wettbewerbs-/Integrations-Recherche
> (Phase-1-Workflow, 17 Agenten) und den Modul-Specs 01–06. Stand 2026-07-05 (Nacht).
> Dies ist das Steuerungsdokument; Details in den Einzel-Specs `docs/specs/NN-*.md`.

## Vision & verteidigbarer Vorsprung
**Nordstern-Metrik: „Minuten von Anfrage bis Angebot versendet"** (und „Tage bis gewonnen").
Alles wird daran gemessen — und die Metrik wird **produktisiert** (Dashboard-Kachel mit
anonymem Benchmark „du antwortest schneller als X % vergleichbarer Betriebe"). Das zeigt
kein Wettbewerber.

**Wichtige Korrektur aus der Recherche:** „KI-Angebot" ist **kein USP mehr** — 7+ Anbieter
haben es 2025/26 (Event Temple AI Suite, iVvy/hivr.ai, Univents, Gastrosync, CaterSmart …).
Der verteidigbare Vorsprung ist die **Kombination**, die weder die Reservierungs- noch die
Bankett-Welt bedient: vollständiger **Abschluss-Flow** (Web-Angebot → E-Signatur → Stripe-
Anzahlung → Auto-Nachfassen) für **deutschsprachige Gastro-Betriebe mit 1–20 MA**, über das
ganze Spektrum von der 2er-Reservierung bis zur Exklusiv-Buchung, **< 15 Min Onboarding**
statt Setup-Projekt, **transparente Preise** statt Demo-Gate. Nordstern-These validiert:
5-Min-Antwort = 21× Qualifizierung; 78 % kaufen beim Erstantworter; 70 % der Anfragenden
erhalten NIE ein Angebot.

## Positionierung (bewusst NICHT)
Kein Oktopus: keine Warenwirtschaft, keine Mitarbeiterverwaltung, keine eigene Buchhaltung,
kein POS-Kern. Stattdessen schlanker Abschluss-Flow + wenige, exzellente Integrationen.
Nicht in den Hotel-/MICE-Markt abdriften (dort kämpfen Event Temple, iVvy, Amadeus mit mehr
Kapital) — die unbesetzte Flanke ist 1–20-MA-Gastro.

## Modul-Landkarte (Kern · Modul · Storia-only)

| Modul | Spec | Klasse | Kurz |
|---|---|---|---|
| Katalog & Stammdaten | 01 | **Kern** (Import = Modul) | ✅ **umgesetzt+live-verifiziert** — 1 Katalog `catalog_items`; KI-Import als Onboarding-Hebel |
| Angebots-Builder | 02 | **Kern** | `offer_items` mit echten Preisen/MwSt; 1 Pricing-Engine |
| Versand & Annahme | 03 | **Kern** | Mail-Versand, Web-Angebot, E-Sign-light, Stripe-Anzahlung, Nachfass-Cron |
| Dokumente/Vorlagen/Versionen | 04 | **Kern** | eigenes PDF (Cloudflare Browser Rendering), WORM-Archiv, Vorlagen |
| KI-Assist (Querschnitt) | 05 | **Kern** | 1 KI-Gateway-Paket, Human-in-the-Loop, Kosten-Logging |
| Speisekarten-KI + Website-Widget | 06 | **Modul** (Import Kern-nah) | Karte→Katalog; SEO-Hosted-Page + Web-Component |
| Zusammenarbeit (Aufgaben/Notizen/Kanban) | P2 | Kern | *Spec ausstehend* |
| Zahlungen (Checkout/Links/Erinnerungen) | P3 | Kern | *Spec ausstehend; Fundament steht* |
| Kunden-Intelligenz (Risiko-Ampel) | (eigene Spec vorhanden) | Modul | an P3 andocken |
| E-Mail-Inbox (IMAP/Graph) | P4 | Modul | *Spec ausstehend* |
| LexOffice/Rechnungen | P5 | Modul | *Spec ausstehend* |
| Profil-Seite + Anfrage-Widget | (Marktplatz-Ph.1) | Kern-nah | öffentliche Mini-Landingpage je Mandant |
| eSign/WhatsApp/Bewertungen/Gutscheine/Fotoalbum | — | Modul/Storia-only | nach Bedarf |
| Catering-Shop, Restaurant-Speisekarten-CMS | — | **Storia-only** | bleibt außerhalb SaaS-Kern |

## Abhängigkeiten & Bau-Reihenfolge (P1 zuerst)
```
01 Katalog ──► 02 Builder ──► 03 Versand/Annahme ──► (P3 Zahlungen live)
                   │                 │
                   └──► 04 Doku/PDF ─┘        05 KI-Gateway = Querschnitt (parallel, von 01-03 genutzt)
06 Speisekarten-Import schreibt in 01 (Katalog)
```
**Sprint P1 (in Umsetzung):** ~~01~~ ✅ → 02 → 04(PDF) → 03(Versand+Annahme+Anzahlung) →
05(KI-Gateway als Basis). Ergebnis = kompletter Nordstern-Flow.
**Stand Nacht 2026-07-05:** Spec 01 (Katalog) implementiert, 57/57 Tests grün gegen Live-Neon,
RLS-Isolation live bewiesen, Migration angewendet. Details: `docs/CHECKPOINT-2026-07-05-katalog.md`.
**P2** Zusammenarbeit · **P3** Zahlungen scharf (+ Kunden-Intelligenz) · **P4** E-Mail-Inbox ·
**P5** LexOffice · danach eSign/WhatsApp/…

## Integrations-Wellen (hinter Modul-Registry, Adapter-Muster, Token je Mandant tenant-isoliert)
- **Welle 1 (Geldfluss + Nordstern, M1–3):** E-Mail-Inbound (dedizierte Adresse je Mandant via
  Cloudflare Email Routing + Microsoft-Graph-Connector + generisches IMAP) · Stripe-Connect-
  Anzahlung (steht) · LexOffice (steht). Vorbereitend: Google-Business-Profile-API-Zugang +
  Mozrest-Konditionen JETZT beantragen (Wochen Vorlauf).
- **Welle 2 (Abschluss beschleunigen, M4–8):** WhatsApp Business via EU-BSP (360dialog) =
  größter Hebel auf „Tage bis gewonnen" · sevdesk/easybill · Reservierung via Mozrest/aleno/
  Zenchef · GBP-Bewertungsanfragen.
- **Welle 3 (M9+):** POS-Umsatz-Rückspielung (Lightspeed/ready2order/SumUp — orderbird/
  gastronovi nur bilateral) · iCal-Feed für Personal · optional OpenTable-Partnerantrag.
- **Ehrliche Fakten:** OpenTable = KEINE öffentliche API (nur Partnerprogramm). Quandoo stellt
  31.12.2026 ein (Migrations-Vertriebsfenster!). giropay tot. PayPal = echte Lücke (dt.
  Endkunden erwarten es). Gmail-Vollsync erst bei Nachfrage (teure CASA-Prüfung).

## Geschäftsmodell (entschieden)
- **Preis: Hybrid** (nicht reines %). FREE 0 € (5 Angebote/Mon, 1,5 % Fee, Cap 90 €/Event) ·
  PRO 79 € Launch→99 € (0,8 %, Cap 49 €/Mon) · TEAM 149 € (0,4 %, Module à 19–29 €). Invers
  sinkende, gedeckelte Plattform-Fee auf Online-Zahlungen (Stripe application_fee).
- **Marktplatz: Sequenz** — Profil-Seite/Widget jetzt → Overflow-Routing ab ~10–15 Mandanten/
  Stadt → Verzeichnis erst ab 30–50 Betrieben (5–10 % nur auf gewonnene Buchungen, Opt-in,
  nie Pay-per-Lead). Storia-Neutralität offenlegen.

## ⚠️ OFFENE ENTSCHEIDUNGEN (Brainstorm-Agenda für den Checkpoint)
Aus den Specs 01–06 gebündelt — pro Punkt meine Default-Empfehlung in Klammern:

**Architektur/Betrieb**
1. Sending-Domain festlegen (Vorschlag `mail.maestro.app`) + Resend-EU-AVV bestätigen — oder EU-Provider (Brevo/Scaleway) prüfen? *(Empf.: Resend + Plattform-Subdomain je Mandant, eigene Domain im Pro-Tier)*
2. PDF-Provider: Cloudflare Browser Rendering (10 h/Mon inkl.) — okay oder gleich Gotenberg self-hosted? *(Empf.: Cloudflare zuerst, Adapter-Fallback)*
3. EU-KI-Processing: First-Party-API mit `inference_geo=eu` oder Vertex-EU? AVV mit Anthropic+OpenAI = Go-Live-Gate. *(Empf.: First-Party + EU-Flag, AVV vor Vertrieb)*

**Produkt/Flow**
4. Follow-up-Kadenz T+3/T+7 beibehalten? Auto-Send-Wertschwelle (z. B. < 1.000 € automatisch, darüber Freigabe)? *(Empf.: ja, Default-Schwelle 1.000 €, Auto-Send im MVP AUS)*
5. Anzahlung für alle Neu-Mandanten Pflicht, oder „vor Ort/Rechnung" als Default erlaubt? *(Empf.: Anzahlung Default an, abschaltbar)*
6. Max. Angebots-Optionen: 3 sichtbar (A–E technisch) — reichen 3? *(Empf.: Default 1, max 3)*
7. Preisanpassungs-Zeile im Web-Angebot sichtbar (auditierbar) oder eingerechnet? *(Empf.: sichtbar)*
8. Brutto-Standard (B2C) — Netto-Anzeige-Option für B2B ab Tag 1? *(Empf.: Brutto zuerst, Netto-Toggle P2)*

**Scope/Sprachen**
9. **IT/FR streichen?** Kern = DE+EN. Storia nutzt IT/FR heute produktiv → Storia-Fork/Registry-Modul? *(Empf.: Kern DE+EN, IT/FR als Storia-Modul)*
10. „Räume"-Screen für reine Caterer ausblendbar? *(Empf.: per Tenant-Setting ausblenden)*
11. KI-Import MVP nur Speise-/Getränkekarten, oder auch Alt-Angebots-PDFs → Paket-Templates? *(Empf.: Karten zuerst)*

**Daten/Recht**
12. Storia-Datenmigration (Alt-Supabase → Storia-Mandant, Float→Cents, Allergen-Freitext→LMIV): vor oder nach MVP-Launch anderer Mandanten? *(Empf.: Dry-Run jetzt, Scharf nach MVP)*
13. WORM-Archiv-Aufbewahrung: GoBD 10 Jahre für Angebote/PDFs? Kürzer für nicht gewonnene? *(Empf.: gewonnen 10 J., nicht gewonnen 12 Mon.)*
14. KI-Kosten als Inklusiv-Kontingent je Tier (kundensichtbar) oder internes Schutzlimit? *(Empf.: Inklusiv-Kontingent + transparenter Cent-Preis darüber)*

## Wettbewerbsbeobachtung (quartalsweise)
Perfect Venue (DACH-Lokalisierung?) · Tripleseat PartyPay Europa · hivr.ai/Amadeus (Vorstoß
Richtung kleiner Betriebe?) · Univents/Gastrosync-Preisbewegungen.
