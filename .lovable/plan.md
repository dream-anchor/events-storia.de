## 1. Archiv-Ansicht (`/admin/events/:id/archive/:v`) als E-Mail-Programm

**Ziel:** Block „1. E-Mail an den Kunden" zeigt einen vollständigen Mail-Header (Von / An / CC / BCC / Betreff / Datum) wie in einem Mailclient. Der gelbe „Als neues Angebot kopieren"-Button wandert vom oberen Banner an das Ende der Seite (Footer-Aktion).

### Änderungen

**`src/hooks/useOfferHistory.ts` — `useOfferHistoryVersion`**
- Analog zu `useOfferHistory`: zusätzlich `email_messages` für die Inquiry holen und nach nächster Sendezeit (±5 min, bevorzugt Subject „Angebot/Offer") matchen.
- Liefert zusätzlich: `recipient_email`, `cc_email`, `bcc_email`, `subject`, `from_email`.
- `OfferHistoryEntry`-Interface um `subject` und `from_email` erweitern.

**`src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx`**
- Oberes Banner schlanker: nur „Zurück zum Angebot" + Archiv-Badge + „Gesendet am … von …" + Schreibgeschützt-Hinweis. **Kein** Kopieren-Button mehr im Banner.
- Block „1. E-Mail an den Kunden" bekommt **vor** dem iframe ein Mail-Header-Panel:

```text
Von:      Storia Catering & Events <info@events-storia.de>
An:       Max Mustermann <max@firma.de>
CC:       — (falls vorhanden)
BCC:      info@events-storia.de (falls vorhanden)
Betreff:  Ihr Angebot von Storia · v2
Datum:    08.05.2026 um 12:23
```

- Stil: zweispaltiges Grid `grid-cols-[80px_1fr]`, Labels in `text-muted-foreground uppercase tracking-wide text-[11px]`, Werte in `font-mono text-sm`. Fehlende Felder dezent als `—` oder ausblenden.
- Iframe-Inhalt bleibt unverändert darunter.
- Neuer Footer-Bereich am Seitenende (unter Block 3): primärer Button „Als neues Angebot kopieren" rechtsbündig, links kurzer Hinweistext. Bestätigungsdialog bleibt wie bisher.

**Out-of-scope:** kein DB-Schema, keine Edge-Function-Änderung. Falls `from_email` nicht im email_messages-Log steht, wird statisch `info@events-storia.de` angezeigt (offizielle Absenderadresse laut Memory).

---

## 2. Public Offer: Anzahlung respektiert gewählten Betrag (100 €)

**Bug:** `src/pages/PublicOffer.tsx` enthält zwei inline-Komponenten (`ProposalView` Zeile 546, `FinalOfferView` Zeile 1066) die hart `Math.round(totalAmount * 0.2 * 100) / 100` rechnen und „Anzahlung 20 %" anzeigen. Die RPC `get_public_offer` liefert seit 09.05. bereits `deposit_amount`, `deposit_percent`, `deposit_due_days`, `payment_method` — diese werden aber ignoriert. (Die separaten Dateien unter `src/pages/public-offer/ProposalView.tsx` machen es bereits richtig, sind aber nicht eingebunden.)

### Änderungen

**`src/pages/PublicOffer.tsx`**
- `PublicInquiry` Interface um Felder erweitern: `deposit_amount: number | null`, `deposit_percent: number | null`, `deposit_due_days: number | null`, `payment_method: string | null`.
- Helper `computeDeposit(inquiry, totalAmount)` einführen (analog `public-offer/ProposalView.tsx` Zeilen 152–165):
  - Wenn `deposit_amount > 0` → fixer Betrag (gecappt auf totalAmount)
  - Sonst Prozentsatz (Default 20 wenn null) → `totalAmount * percent / 100`
  - Anzeige nur wenn `< totalAmount` und `> 0`.
- In `ProposalView` (Zeile 568) und `FinalOfferView` (Zeile 1158) den hardcoded `* 0.2` durch `computeDeposit(...)` ersetzen.
- Label „Anzahlung 20 %" (Zeilen 740 und 1356) dynamisch:
  - Fixer Betrag → einfach „Anzahlung"
  - Prozent → „Anzahlung X %"
- Kommentar Zeile 542 entsprechend anpassen.

**Verifikation:** Inquiry `78680730-…` per `read_query` prüfen (`deposit_amount`, `deposit_percent`), dann Public-Offer-URL im Preview testen → muss 100 € statt 20 % anzeigen.

---

## Out of scope
- Keine Migrations.
- Keine Änderungen an `send-offer-email` oder anderen Edge-Functions.
- Keine Refactor von PublicOffer.tsx zu den separaten `public-offer/*View.tsx`-Dateien (eigenes Ticket).
