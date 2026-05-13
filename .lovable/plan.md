## Problem

Auf `/admin/inquiries/{id}/preview?send=proposal` rendert die Admin-Preview ein iframe mit
`/offer/{id}?preview_send=proposal&preview_body=…`.

Die Anfrage `90321866-…` hat aktuell `offer_phase = 'draft'` und `status = 'new'` (Angebot wurde
noch nie versendet). In `PublicOffer.tsx` wird `effectivePhase` so berechnet:

```ts
const effectivePhase = phase === "draft" && inquiry.status === "offer_sent"
  ? "final_sent"
  : phase;
```

→ Bei `status = 'new'` bleibt die Phase `draft`. Keiner der View-Branches (`proposal_sent`,
`final_sent`, …) trifft zu, daher rendert weder `ProposalView` (Menü-Vorschau + Zahlbutton)
noch `FinalOfferView`. Das Anschreiben + die Zahlungsbuttons unten sind sichtbar, aber der
mittlere Block (Menü + großer "Auswählen"/"Jetzt zahlen"-Button) fehlt.

Der URL-Parameter `preview_send`, den die Admin-Preview schon mitsendet, wird bisher
**nicht** ausgewertet — nur `preview_body` wird gelesen.

## Lösung

In `src/pages/PublicOffer.tsx` den `preview_send`-Param auswerten und damit die Phase für
die Anzeige überschreiben — strikt nur visuell, keine DB-Änderung, keine Geschäftslogik:

- `preview_send = 'proposal'` → `effectivePhase = 'proposal_sent'`
- `preview_send = 'final'`    → `effectivePhase = 'final_sent'`

Override greift nur, wenn `preview_send` in der URL steht (also nur im Admin-iframe). Echte
Kunden sehen weiterhin die echte Phase.

## Änderungen

**Nur eine Datei:** `src/pages/PublicOffer.tsx`

1. Neben `previewBodyRaw` auch `previewSend = searchParams.get('preview_send')` lesen.
2. Nach dem bestehenden `effectivePhase`-Block ergänzen:
   ```ts
   const previewPhase: OfferPhase | null =
     previewSend === 'proposal' ? 'proposal_sent' :
     previewSend === 'final'    ? 'final_sent'    : null;
   const renderPhase = previewPhase ?? effectivePhase;
   ```
3. In den View-Branches (Zeilen 463–492) `effectivePhase` durch `renderPhase` ersetzen,
   ebenso im `HeroSection`-Aufruf wenn das Badge konsistent sein soll.

Keine Änderungen an Hooks, RPC, Migration, Edge-Functions, ProposalView/FinalOfferView selbst.

## Nicht-Ziele

- Status oder Phase in der DB ändern
- Verhalten für echte Kunden (ohne `preview_send`) verändern
- Anschreiben-Logik anfassen
