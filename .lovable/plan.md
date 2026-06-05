## Befund

Im Code ist bereits alles korrekt auf Brutto gesetzt:

- `supabase/functions/create-event-quotation/index.ts` Zeile 1167: `taxConditions: { taxType: 'gross' }`
- Alle `lineItems` werden mit `unitPrice.grossAmount` (Brutto) übergeben (Zeilen 283, 298, 325, 347, 366, 379, 396, 415, 430, 443, 465, 473, 483, 491, 533, 547, 560, 638, 1019)
- Die Werte stimmen rechnerisch: 48,60 × 3 = 145,80 entspricht dem Brutto-Linientotal, Gesamt 1.053,99 € (inkl. 68,95 € USt 7 %)

Die übergebenen Beträge **sind** also bereits Brutto-Einzelpreise. Was im PDF passiert: LexOffice rendert mit dem **Standard-Drucklayout „Nettodarstellung"** trotzdem die Spalte „Einzelpreis" als Netto-Wert (Brutto → Netto rückgerechnet) und weist die USt separat aus.

## Ursache

Die Brutto-/Netto-**Darstellung im PDF** ist **keine API-Option** der LexOffice-Endpunkte `/v1/quotations` und `/v1/invoices`. Sie wird ausschließlich in den LexOffice-Account-Einstellungen unter

> Einstellungen → Druck & Layout → Drucklayout → **„Bruttodarstellung in Rechnungen/Angeboten"**

global festgelegt. Es gibt keinen Pro-Vorgang-Schalter (`printLayout`, `displayMode` o. Ä.) im API-Payload.

## Lösung (manueller Schritt in LexOffice nötig)

1. In LexOffice einloggen → Einstellungen → Druck & Layout → Drucklayout öffnen.
2. Option **„Bruttodarstellung"** für Angebote (und ggf. Rechnungen) aktivieren.
3. Vorhandenes Angebot AG0146 erneut als PDF abrufen → Einzelpreise erscheinen jetzt als 52,00 € (Brutto) statt 48,60 € (Netto), Gesamt bleibt 1.053,99 €.

Optional ergänzend im Code: nichts zu tun, da bereits sauber Brutto übergeben wird. Sobald die LexOffice-Einstellung aktiv ist, gilt sie automatisch für alle neu erzeugten Angebote/Rechnungen aus Maestro.

## Falls die Einstellung in LexOffice nicht gewünscht ist

Alternative wäre, die Angebots-PDF nicht mehr von LexOffice rendern zu lassen, sondern in Maestro selbst zu erzeugen (eigenes PDF-Template mit Brutto-Spalten). Das ist deutlich größerer Aufwand und sollte nur erwogen werden, wenn die LexOffice-Einstellung nicht umgestellt werden kann/soll.

## Betroffene Dateien

Keine Code-Änderungen erforderlich. Die Korrektur erfolgt einmalig im LexOffice-Account.
