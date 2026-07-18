# MAESTRO — Integrationen über Composio (live verifiziert)

> Stand 2026-07-06. Architektur-Entscheidung: **Composio als Integrations-Layer** (Variante A).
> Ein `COMPOSIO_API_KEY` im Worker statt roher Provider-Keys; Verbindungen je Mandant in
> Composio. Hinter unserer eigenen Adapter-Schnittstelle, damit später direkt-SDK möglich bleibt.

## Verbindungsstatus (Composio, ACTIVE)
`anthropic` (Toolkit `anthropic_administrator`) · `lexoffice` · `resend` · `stripe`.
(Ferner verbunden: openai, openrouter, cloudflare, neon, github, google-Suite u. a.)

## Live-verifiziert (echte API-Aufrufe am 2026-07-06)

### LexOffice-Export (Spec 02 F8) — cent-exakt ✅
Tool `LEXOFFICE_CREATE_QUOTATION` + `LEXOFFICE_GET_QUOTATION`. Testangebot (Entwurf
**AG0237**, `id cf87c494-…`) aus 100 €@7 % + 100 €@19 % − 10 % Rabatt. LexOffice rechnete
**unabhängig aus den Zeilen EXAKT** die Engine-Werte:

| | Engine | LexOffice |
|---|---|---|
| Brutto | 180,00 € | 180,00 € |
| USt 7 % (netto) | 5,89 € (84,11) | 5,89 € (84,11) |
| USt 19 % (netto) | 14,37 € (75,63) | 14,37 € (75,63) |
| USt / netto gesamt | 20,26 / 159,74 | 20,26 / 159,74 |

Der Ansatz **Rabatt je USt-Satz als eigene Zeile** reproduziert die deutsche USt-Aufteilung.
Mapping: `apps/api/src/lib/lexoffice.ts` (7 Unit-Tests inkl. Golden-Zahlen).
**Live entdeckte Constraints (eingebaut):** `title` ≤ 25 Zeichen · `totalPrice` muss
Netto/USt/Brutto tragen · `voucherDate` Pflicht. LexOffice ergänzt Zahlungsziel + Standard-
Bemerkung aus den Kontoeinstellungen automatisch.
⚠️ **Bitte den Test-Entwurf „MAESTRO TEST" (AG0237) in LexOffice löschen** — die LexOffice-API
bietet kein Löschen von Angeboten (nur im UI).

### KI-Menü-Parse (Spec 06) — sauber ✅
Tool `ANTHROPIC_ADMINISTRATOR_CREATE_MESSAGE`, Modell `claude-haiku-4-5-20251001`. Eine
deutsche Testkarte wurde korrekt strukturiert (Preise in Cent, Allergene als LMIV-Buchstaben,
Preise/Allergene aus dem Namen heraus, „Tagespreis" → `priceCents null` + `priceDisplay`).
**Wichtig:** Das Composio-CREATE_MESSAGE-Tool kennt **keinen erzwungenen Tool-Call** → die
strukturierte Ausgabe kommt als **JSON-in-Text** (`extractJsonPayload`), validiert durch
`parsedMenuSchema` + Sanity-Gates. `ai-gateway.test.ts` prüft das gegen die ECHTE Antwort.

### Versand — Resend (Spec 03) ✅
Tool `RESEND_SEND_EMAIL`. Verifizierte Sender-Domain **`events-storia.de`** (eu-west-1). Eine
Angebots-Test-E-Mail wurde live an info@monot.com zugestellt (Message-ID 47f893a7…).
Baustein: `apps/api/src/lib/mailer.ts` — `buildOfferEmail` (rein, DE/EN, HTML+Text,
HTML-escaped) + `sendEmailViaComposio`.

### Anzahlung — Stripe (Spec P3) ✅
Tools `STRIPE_CREATE_PRODUCT` → `STRIPE_CREATE_PRICE` → `STRIPE_CREATE_PAYMENT_LINK`.
Live-Test: Zahlungslink über 125,00 € erzeugt (`https://buy.stripe.com/…`) und danach wieder
**deaktiviert** (`STRIPE_UPDATE_PAYMENT_LINK active:false`). Baustein:
`apps/api/src/lib/deposit.ts` — `computeDepositCents` (Integer-Cents, 50 %-Default, Deckelung)
+ `createDepositLinkViaComposio`.
- ⚠️ **Die Stripe-Verbindung ist LIVE-Mode** (`livemode:true`) und läuft über eine
  Connect-Application (`ca_P6KP…`). Für echte Anzahlungen: `application_fee_amount`/`transfer_data`
  je Mandant (Stripe Connect) ergänzen. Für Tests unbedingt einen **Test-Mode-Key/Connection**
  verwenden.
- 🧹 **Aufräumen:** Test-Produkt `prod_Upr3wu0wSzgYGN` / Preis `price_1TqBLM…` im Stripe-
  Dashboard archivieren (der Payment-Link ist bereits inaktiv, nichts ist zahlbar).

## Verdrahtung im Worker
- `apps/api/src/lib/ai-gateway.ts` → `createComposioMenuParser({apiKey, connectedAccountId})`:
  POST `https://backend.composio.dev/api/v3/tools/execute/ANTHROPIC_ADMINISTRATOR_CREATE_MESSAGE`
  mit Header `x-api-key`. Default-Parser (app.ts) nimmt Composio, sobald `COMPOSIO_API_KEY`
  gesetzt ist; sonst Fallback direkter Anthropic-Key.
- **Zum Scharfschalten:** `cd apps/api && wrangler secret put COMPOSIO_API_KEY`
  (optional `COMPOSIO_ANTHROPIC_ACCOUNT` = Connected-Account-ID). Ohne Key läuft alles außer
  dem echten KI-Aufruf; ein Import endet dann sauber als „fehlgeschlagen".

## Multi-Tenant-Nuance (wichtig)
- **LexOffice & Stripe sind pro Mandant** (jeder Betrieb sein eigenes Konto). Die aktuell eine
  Composio-Verbindung deckt **Storia als ersten Mandanten**. Für weitere Mandanten: je Betrieb
  eine Composio-Verbindung (OAuth) bzw. Stripe-Connect — dann `connected_account_id`/Entity je
  Mandant an den Adapter geben.
- **Anthropic & Resend** sind plattform-geteilt (eine Verbindung genügt).

## Noch offen
- Adapter für **Resend** (Versand) und **Stripe** (Zahlungen) nach demselben Muster wie oben —
  Tools sind verbunden und bereit (`RESEND_SEND_EMAIL`, `STRIPE_CREATE_PAYMENT_LINK/CHECKOUT`).
- Der Worker→Composio-REST-Aufruf ist geschrieben, aber erst mit gesetztem `COMPOSIO_API_KEY`
  im Worker end-to-end lauffähig (die zugrundeliegenden Composio-Tools sind live bewiesen).
- **F9** KI-Freitext-Import (Alt-Angebot → offer_items) nutzt denselben Parser-Seam.
