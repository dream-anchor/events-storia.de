# Bestell-E-Mail im Look & Feel der Event-Anfragen

## Problem
Die Kunden-Bestellbestätigung aus `send-order-notification` ist aktuell ein einfacher Plain-Text in einem `<div white-space:pre-wrap>`. Die Event-/Angebots-Mail (`send-offer-email`) ist dagegen eine vollwertige STORIA-HTML-Vorlage mit Header, cremefarbenem Hintergrund, abgerundeter Karte, Footer mit Kontakt.

Ziel: Kunden-Bestellbestätigung im selben Look & Feel.

## Umfang
- **Nur Kunden-Mail** (Catering-Bestellung **und** Event-Buchung — beide laufen über dieselbe Funktion).
- **Restaurant-/Admin-Mail** bleibt schlichter Plain-Text (für interne Lesbarkeit ist das besser).
- Inhalt der Kundenmail bleibt unverändert (Grußformel, Bestellnummer, Items, Lieferung, Datum, nächste Schritte), wird nur strukturiert in das STORIA-Template eingebettet.

## Umsetzung

### 1. `supabase/functions/send-order-notification/index.ts`
- Neue Funktion `generateCustomerHtml(data)` parallel zu `generateCustomerEmailText`:
  - Übernimmt das Template aus `send-offer-email` (cremefarbener Wrapper `#faf6f0`, weiße Karte `border-radius:16px`, STORIA-Serif-Header, Footer mit Tel/Mail-Links in `#b45309`).
  - Strukturierte Sektionen statt freier Text:
    - **Header**: „STORIA" + „Catering & Events — München"
    - **Begrüßung + Bestell-/Buchungsnummer**
    - **Tabelle „Ihre Auswahl / Ihre Buchung"** (Items mit Menge, Name, Einzelpreis, Summe; Chafing Dish; Mindestbestellwert-Aufschlag; Lieferung; Gesamtsumme fett hervorgehoben)
    - **Block „Termin & Lieferung"** (Datum, Uhrzeit, Lieferart/Adresse oder Abholung, ggf. Gästezahl)
    - **Anmerkungen** (falls vorhanden)
    - **Next Steps** (Zahlungstext / 24h-Antwort)
    - **Footer**: Tel/E-Mail-Links + Adresse + `events-storia.de`
  - HTML-Escaping für alle dynamischen Felder (kleine `escapeHtml`-Helferfunktion).
- `sendEmail(...)` bekommt einen optionalen `htmlOverride`-Parameter; wenn gesetzt, wird er statt des Plain-Text-Wrappers verwendet (Plain-Text bleibt für Spam-Score weiterhin als `text:` mit dabei).
- Aufrufstelle: Kunden-Versand ruft `sendEmail` mit `htmlOverride = generateCustomerHtml(data)`, Restaurant-Versand bleibt unverändert (alter pre-wrap-Wrapper).

### 2. Deployment
- `deploy_edge_functions(["send-order-notification"])` nach dem Patch.

## Out of Scope
- Keine inhaltlichen Änderungen am Text der Bestätigung.
- Keine Änderung der Admin-/Restaurant-Mail.
- Keine neue Edge Function, kein Transactional-Email-System — die bestehende Resend/IONOS-Pipeline bleibt 1:1.
