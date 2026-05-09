## 1. Kommunikations-Tab als Mailprogramm + Kundenrückmeldung integrieren

### Problem
Wenn der Kunde im öffentlichen Angebot eine Option wählt (Anmerkung/Auswahl), erscheint das nur unter „Angebot" als blaues Hinweis-Karten-UI (`offer_customer_responses`). Im Tab „Kommunikation" sieht man die Antwort gar nicht — dort liegen ausschließlich Zeilen aus `email_messages`. Außerdem ist die jetzige Chat-Bubble-Optik (orange Sprechblasen) keine Mailprogramm-Ansicht.

### Lösung

**Library:** [`@chatscope/chat-ui-kit-react`](https://chatscope.io/) — etablierte React-Library mit Mailprogramm-tauglichen Bausteinen (`MainContainer`, `Sidebar`, `ConversationList`, `Conversation`, `ChatContainer`, `ConversationHeader`, `MessageList`, `Message`, `MessageInput`). MIT-Lizenz, ~100k Wochen-Downloads, gepflegt.

Falls die Library aus irgendeinem Grund nicht installierbar ist (sehr selten), Fallback: `react-resizable-panels` (in shadcn schon enthalten) + manuelles Master-/Detail-Layout.

**Neue Komponente:** `src/components/admin/shared/MailClient.tsx` ersetzt das aktuelle `ConversationThread`-Layout. Drei Spalten:

```text
┌────────────┬───────────────────────────────────────────┐
│ Sidebar    │  Reading Pane                              │
│ (Threads)  │                                            │
│            │  Header: Betreff · Von · An · Datum        │
│ Posteingang│  ──────────────────────────────────────── │
│ • Mail 1   │  HTML-Inhalt (sanitized) oder Plain-Text  │
│ • Mail 2   │  Anhänge (Chips)                           │
│ • Antwort  │  Status-Badge (Versendet / Geöffnet / ..)  │
│ • …        │                                            │
│            │  ──────────────────────────────────────── │
│            │  MessageInput unten (Antwort schreiben)    │
└────────────┴───────────────────────────────────────────┘
```

- Linke Sidebar: chronologische Liste aller Thread-Items, gemischter Quelle (siehe unten). Item zeigt Sender-Avatar (Initialen), Betreff/Vorschau, Zeit, Inbound/Outbound-Pfeil, ungelesen-Punkt.
- Rechtes Reading-Pane: nur ausgewählte Mail. HTML wird via `DOMPurify` sanitized in einem Iframe (`sandbox="allow-same-origin"`) gerendert — wie bisher in `OfferArchivePreview`.
- `MessageInput` unten zum direkten Antworten (verwendet weiter `send-offer-email` mit Operator-Guard, identisch zu heute).
- Auf Mobile (≤768 px): Sidebar wird zur Drawer-Liste, Reading-Pane Vollbild — `useIsMobile`-Hook + `Sheet` von shadcn.

**Datenquellen-Merge:**

`useMailThread(inquiryId)` Hook fasst zwei Tabellen zusammen, sortiert nach `created_at` ASC:

1. `email_messages` (wie heute) — direction = `inbound`/`outbound`, Subject, Body (HTML/Plain), Attachments, Resend-Status.
2. `offer_customer_responses` — Mapped als virtuelles Inbound-Item:
   - `kind: "form_response"`
   - `subject: "Kundenrückmeldung: Option X gewählt"`
   - `body_html`: gerenderte Karte mit gewählter Option, Optionslabel/Paketname, optionale Anmerkung, Versand-Zeitstempel (visuell ähnlich der jetzigen blauen Karte aus Tab „Angebot", aber im Reading-Pane)
   - `from_email`: Kunden-E-Mail aus `event_inquiries.email`
   - `to_email`: `info@events-storia.de`
   - Sidebar-Vorschau: „Hat Option A gewählt — Anmerkung: …"

**Realtime:** Der bestehende `postgres_changes`-Subscribe auf `v2_event_emails` bleibt; zusätzlich Subscribe auf `offer_customer_responses` (filter `inquiry_id`).

**Aufruf-Site:** `SmartInquiryEditor.tsx` Tab `kommunikation` ersetzt `<ConversationThread …>` durch `<MailClient inquiryId={id} customerEmail={inquiry.email} onSendReply={…} />`. Die Kunden-Antwort-Karte unter Tab „Angebot" bleibt unverändert (informativer Quick-View dort).

### Files

| Datei | Änderung |
|---|---|
| `package.json` | + `@chatscope/chat-ui-kit-react`, `@chatscope/chat-ui-kit-styles` |
| `src/components/admin/shared/MailClient.tsx` | NEU |
| `src/hooks/useMailThread.ts` | NEU — merged Source aus `email_messages` + `offer_customer_responses` |
| `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` | ConversationThread → MailClient |
| `src/components/admin/shared/ConversationThread.tsx` | bleibt vorerst (für andere Stellen falls genutzt), wird aber von MailClient ersetzt im Inquiry-Editor |

---

## 2. Anzahlungs-Toggle (% / €) — Audit aller Touchpoints

Audit-Ergebnis nach Durchsicht aller relevanten Pfade — kein Code-Change nötig, nur Bestätigung:

| Touchpoint | Datei | % | € (Fix) | Status |
|---|---|---|---|---|
| Maestro Editor | `PaymentTermsBlock.tsx` | ✓ | ✓ (Toggle „depositMode") | OK |
| Public Offer | `PublicOffer.tsx` (`computeDeposit`) | ✓ | ✓ | OK (heute gefixt) |
| Public Offer (separate Files, ungenutzt) | `public-offer/{Proposal,FinalOffer}View.tsx` | ✓ | ✓ | OK |
| Stripe-Checkout | `create-payment-session/index.ts` | ✓ | ✓ (`Math.min(fixedDeposit, total)`) | OK |
| Stripe-Maestro-Checkout | `create-event-payment-session/index.ts` | n/a | n/a | uses pre-computed `amount_cents` — OK |
| Stripe-Webhook | `handle-stripe-webhook/index.ts` | ✓ | ✓ (uses `session.amount_total`) | OK |
| LexOffice-Quotation | `create-event-quotation/index.ts` | ✓ | ✓ (`paymentTermLabel` mit `fixedDepositAmount.toFixed(2)`) | OK |
| AI-Anschreiben | `generate-inquiry-email/index.ts` | n/a | n/a | nennt nur "Anzahlung online", keine konkrete Zahl — OK |
| Internes Notify | `notify-customer-response/index.ts` | n/a | n/a | erwähnt Anzahlung nicht — OK |

**Ergebnis:** Beide Modi werden überall korrekt berücksichtigt. Es gibt **keinen** verbleibenden 20-%-Hardcode in customer-facing Flows. Damit ist Item 2 nur eine Bestätigung — kein Code-Change.

---

## Out of scope
- Volltext-Suche im Mail-Client (späteres Ticket).
- Mail-Threading nach `in_reply_to` (heute reicht chronologische Liste; bei Bedarf später Gruppierung).
- Migration der bestehenden `ConversationThread`-Komponente an anderen Stellen (`OrdersList.tsx`) — nur `SmartInquiryEditor` umstellen.
