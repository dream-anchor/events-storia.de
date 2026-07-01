# Plan: "Vorschau anzeigen" regeneriert komplettes Angebotspaket

## Ziel
Beim Klick auf "Vorschau anzeigen" wird **alles neu erzeugt**, was der Kunde später sieht: E-Mail, PDF, Public-Offer-Seite und LexOffice-Rechnung. Bisherige Vorschau bleibt optisch gleich (Mail-Tab + PDF-Tab + Public-Seite-Link) — die Änderung liegt darunter: echte Neu-Generierung statt nur Anzeige.

## Verhalten heute vs. neu

| Bereich | Heute | Neu |
|---|---|---|
| Mail-Vorschau | Dry-Run (regeneriert) | unverändert |
| PDF-Vorschau | Dry-Run (regeneriert) | unverändert |
| Public-Offer-Seite | Liest live aus `event_inquiries` → Draft-Änderungen sofort für Kunden sichtbar | Liest vom letzten **Snapshot** (Version N); Draft nur mit Admin-Preview-Token sichtbar |
| LexOffice-Rechnung | Wird nur bei echtem Versand neu erstellt | Beim Preview wird alte Rechnung **storniert** und neue Draft-Rechnung erzeugt |
| Diff-Anzeige | keine | Kompakte Liste der geänderten Felder ("Rechnungsadresse geändert, Menü geändert, Zahlungsbedingungen geändert") |

## Ablauf beim Klick auf "Vorschau anzeigen"

```text
Admin klickt "Vorschau anzeigen (Version 2)"
        │
        ▼
Preview-Screen öffnet sich
        │
        ├─► Tab 1: E-Mail-Vorschau (regeneriert, wie bisher)
        ├─► Tab 2: PDF-Vorschau (regeneriert, wie bisher)
        ├─► Tab 3: Public-Seite-Link "Kundenansicht Version 2 öffnen"
        │           → öffnet /offer/:id?preview_draft=<token>
        │           → nur Admin sieht Draft, Kunde sieht weiter Version 1
        ├─► Diff-Panel: "Was ändert sich in Version 2"
        │           z.B. "Rechnungsadresse geändert · Menü geändert · Zahlungsbedingungen geändert"
        └─► LexOffice: alte Rechnung wird als "veraltet" markiert,
                       neue Draft-Rechnung entsteht
        │
        ▼
Admin prüft alles → klickt "Version 2 an Kunde senden"
        │
        ▼
- Snapshot v2 wird in offer_history gespeichert
- alte LexOffice-Rechnung wird storniert
- neue Rechnung wird finalisiert
- Kunde bekommt Mail mit Link zur Public-Seite v2
```

## Was der Kunde sieht

- **Vor Versand v2:** Kunde sieht weiter Version 1 (Snapshot). Keine unbeabsichtigten Draft-Änderungen sichtbar.
- **Nach Versand v2:** Kundenlink zeigt Version 2. Version 1 ist im Archiv, aber nicht mehr über den Kundenlink erreichbar.
- **Alte LexOffice-Rechnung:** automatisch storniert. Kunde sieht nur die aktuelle gültige Rechnung.

## Diff-Panel (kompakt)

Vergleicht Draft mit letztem Snapshot. Zeigt nur Feldnamen, keine alten/neuen Werte:

```text
Änderungen für Version 2
· Rechnungsadresse
· Menü & Preise
· Zahlungsbedingungen
```

## Technische Umsetzung

**1. Public-Offer-Seite auf Snapshot umstellen**
- `PublicOffer.tsx`: Default = neuester Eintrag aus `inquiry_offer_history` (Menü + Preise + Adresse + Zahlungsbedingungen + Kontakt).
- Fallback auf `event_inquiries` nur wenn noch keine Version existiert.
- Preview-Modus: Query-Param `?preview_draft=<signed_token>` → liest aus `event_inquiries` (Draft). Token ist kurzlebig (15 min), admin-signiert, nicht ratbar.

**2. Preview-Screen erweitern (`OfferSendPreview.tsx`)**
- Bestehende Mail- und PDF-Tabs bleiben.
- Neuer Button "Kundenansicht Version N+1 öffnen" → generiert Preview-Token, öffnet `/offer/:id?preview_draft=…` in neuem Tab.
- Neues Diff-Panel: berechnet clientseitig, welche Snapshot-Felder sich vom Draft unterscheiden (Menü/Preise, Adresse, Zahlungsbedingungen, Kontakt/Event). Zeigt Feldnamen-Liste.

**3. LexOffice-Regenerierung**
- `create-event-quotation` Edge Function: bekommt Flag `force_recreate: true`.
- Ruft im Preview-Modus mit `force_recreate=true` auf → alte Quotation wird per LexOffice-API storniert, neue Draft-Quotation entsteht.
- Beim echten Versand wird die neue Quotation finalisiert.

**4. Preview-Token**
- Neue Edge Function `create-preview-token` (SECURITY DEFINER, admin-only): erzeugt kurzlebiges signiertes Token, das `PublicOffer.tsx` gegen Serverzeit validiert.

## Betroffene Dateien
- `src/pages/PublicOffer.tsx` — Snapshot-Read + Preview-Token-Support
- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` — Public-Vorschau-Button + Diff-Panel
- `src/lib/adminPublicOfferUrl.ts` — Preview-Token-URL-Builder
- `supabase/functions/create-event-quotation/index.ts` — `force_recreate`-Flag
- `supabase/functions/create-preview-token/index.ts` — neu
- Migration: keine neuen Tabellen; ggf. Index auf `inquiry_offer_history(inquiry_id, version)`

## Nicht Teil dieses Plans
- Kein Umbau von Versionierungs-Logik selbst (bleibt wie beschlossen: Snapshot nur beim Versand).
- Kein Diff mit alten/neuen Werten — nur Feldnamen (auf deinen Wunsch).
- Keine Änderung an "Vorschau anzeigen"-Button-Beschriftung über das hinaus, was bereits existiert.
