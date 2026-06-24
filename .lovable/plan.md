## Problem

Bei „Nur E-Mail"-Angeboten (offer_mode = `email`, kein Preis, kein Stripe-Link) zeigt die Public-Offer-Seite trotzdem:

- die Preis-Spalte „0,00 € · Gesamtpreis · inkl. gesetzl. MwSt." in der Angebots-Karte
- die Sub-Headline „Buchen Sie direkt über den sicheren Zahlungslink …"
- den kompletten Kostenübernahme-Block („Bezugnehmend auf Angebot A über 0,00 € brutto …")

Das ist verwirrend — eine reine Mail-Anfrage hat weder Preis noch verbindliche Kostenübernahme.

## Änderungen (nur UI / Sichtbarkeit, keine Datenänderung)

### 1. `src/pages/public-offer/ProposalView.tsx`
- In `ProposalOptionCard`: wenn `option.offer_mode === 'email'`, die rechte Preis-Spalte (`text-2xl … Gesamtpreis … inkl. gesetzl. MwSt.`) komplett weglassen. Die linke Spalte (Paketname, Gäste, Beschreibung, Includes) bleibt.
- Im Section-Header: wenn **alle** Options `offer_mode === 'email'` sind, Sub-Text durch eine neutrale Variante ersetzen, z.B. „Wir haben Ihnen vorab eine Nachricht zusammengestellt — antworten Sie direkt unten oder per Mail." (kein „Zahlungslink"-Wording).

### 2. `src/pages/PublicOffer.tsx`
- Vor dem Render von `<CostAcceptanceSection …>`: wenn **alle** Options `offer_mode === 'email'` sind, gar nicht rendern. (Selected-Option-only-Check reicht nicht, weil bei Single-Option-E-Mail nichts ausgewählt ist; bei Multi-Option mit gemischten Modi bleibt der Block, sobald mindestens eine zahlende Option existiert.)
- Analog: `<PublicPaymentSection>` schon vorhanden — bei email-only sollte `totalCents=0` bleiben; falls dort eine 0-€-Karte erscheint, ebenfalls ausblenden. (Wird beim Test geprüft, ggf. nachgezogen.)

### 3. Nicht angefasst
- Datenmodell, Maestro-Speicherung, E-Mail-Versand.
- `ConfirmationView` / `FinalOfferView` — separater Pfad, dort taucht bei email-only normalerweise gar nichts auf.

## Akzeptanz

- Single-Option-Anfrage mit `offer_mode='email'`: Karte zeigt nur Inhalt + Gästezahl, **keine** 0,00 €-Spalte, **kein** Kostenübernahme-Block.
- Multi-Option mit gemischten Modi: Mail-Karte ohne Preisspalte, andere Karten unverändert, Kostenübernahme bleibt sichtbar.
