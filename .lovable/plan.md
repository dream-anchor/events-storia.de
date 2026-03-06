

## Problem

Der Betreiber muss **immer** informiert werden wenn:
1. Eine neue Anfrage/Bestellung eingeht
2. Der Email-Versand fehlschlägt

Aktuell gibt es nur Email (Resend + IONOS SMTP Fallback). Wenn beide fehlschlagen, erfährt niemand davon — die Anfrage geht verloren.

## Lösung: WhatsApp-Benachrichtigung als zusätzlicher Kanal

Eine neue Edge Function `send-whatsapp-alert` erstellen, die über die **WhatsApp Business API** (oder alternativ die kostenlose **WhatsApp Cloud API** von Meta) eine Nachricht an die hinterlegte Nummer `+491636033912` sendet.

Diese wird in zwei Szenarien aufgerufen:
1. **Bei jeder neuen Anfrage/Bestellung** — als Bestätigung parallel zur Email
2. **Bei Email-Fehlschlag** — als Eskalations-Alert

### Architektur

```text
Neue Bestellung/Anfrage
        │
        ├── Email senden (Resend → IONOS Fallback)
        │       │
        │       ├── Erfolg → WhatsApp: "Neue Bestellung #XYZ eingegangen ✓"
        │       └── Fehlschlag → WhatsApp: "⚠️ EMAIL FEHLGESCHLAGEN für #XYZ!"
        │
        └── Alles in email_delivery_logs tracken
```

### Konkrete Änderungen

| Datei | Änderung |
|---|---|
| `supabase/functions/send-whatsapp-alert/index.ts` | Neue Edge Function: sendet WhatsApp-Nachricht via Meta Cloud API |
| `supabase/functions/send-order-notification/index.ts` | Nach Email-Versand → `send-whatsapp-alert` aufrufen (Erfolg oder Fehler) |
| `supabase/functions/receive-event-inquiry/index.ts` | Nach Email-Versand → `send-whatsapp-alert` aufrufen (Erfolg oder Fehler) |
| `supabase/config.toml` | Neue Function `send-whatsapp-alert` registrieren |

### WhatsApp Integration

Die **Meta WhatsApp Business Cloud API** ist kostenlos nutzbar (nur Konversationsgebühren ~0,04€/Nachricht). Dafür benötigt:
- Ein Meta Business Account (kostenlos)
- Eine WhatsApp Business API Telefonnummer
- Ein **WHATSAPP_ACCESS_TOKEN** und eine **WHATSAPP_PHONE_NUMBER_ID**

Die Edge Function sendet eine einfache Textnachricht an `+491636033912`:

```
📦 Neue Catering-Bestellung CAT-2026-0142
Kunde: Max Mustermann
Datum: 15.03.2026
Summe: 450,00 €
→ https://events-storia.de/admin
```

Bei Fehler:
```
⚠️ EMAIL-VERSAND FEHLGESCHLAGEN
Bestellung: CAT-2026-0142
Kunde: max@example.com
Fehler: Resend + SMTP beide fehlgeschlagen
→ Bitte sofort prüfen!
```

### Benötigte Secrets

- `WHATSAPP_ACCESS_TOKEN` — aus dem Meta Developer Dashboard
- `WHATSAPP_PHONE_NUMBER_ID` — die Absender-Nummer-ID
- `WHATSAPP_RECIPIENT` — Empfänger-Nummer (`491636033912`)

### Alternative falls WhatsApp zu aufwändig

Falls die Meta API zu komplex einzurichten ist, könnte stattdessen ein einfacher **Webhook an einen bestehenden Dienst** (z.B. Callmebot WhatsApp API oder ein n8n-Workflow) verwendet werden, der die WhatsApp-Nachricht auslöst. Das wäre schneller einzurichten.

