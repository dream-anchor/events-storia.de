## Ziel

Die Kostenübernahme ist heute logisch an die Zahlungswahl gekoppelt: `evaluateCostAcceptanceRequirement` leitet aus `deposit_method` / `balance_method` ab, ob die Kostenübernahme "Pflicht" oder "Optional" ist. Public-Offer und Admin zeigen dadurch die Kostenübernahme als von der Zahlung abhängigen Block.

Neu: Die Kostenübernahme ist eine **eigenständige Option**, die Admin **unabhängig von jeder Zahlungswahl** an den Kunden schicken kann (auch bei Anzahlung 0 % + Restzahlung 100 % vor Ort). Der Admin entscheidet pro Anfrage, ob und wann sie angefordert wird.

## Änderungen

### 1. Datenmodell — neuer expliziter Admin-Schalter
Neues Feld auf der Inquiry: `cost_acceptance_requested` (boolean, default `false`) plus optional `cost_acceptance_requested_at` (timestamptz). Damit ist "Kostenübernahme senden" ein bewusster Admin-Akt, keine Ableitung aus Zahlungsdaten.

### 2. `src/lib/costAcceptanceRequirement.ts`
Entkoppeln. Rückgabe wird zu:
- `required: boolean` — nur `true`, wenn Admin `cost_acceptance_requested = true` gesetzt hat.
- `reasonDe`: kurzer Text, warum sie aktiv/inaktiv ist.
- Zahlungs-Parameter bleiben zulässig, werden aber **nicht mehr** verwendet, um Pflicht abzuleiten (Signatur der Funktion bleibt kompatibel, damit Aufrufer nicht brechen).

### 3. Admin — `CostAcceptanceCard.tsx`
- Badge "Pflicht / Optional" (aus Zahlungswahl abgeleitet) entfällt.
- Neuer, eigenständiger Umschalter am Kopf der Card: **"Kostenübernahme anfordern"** (Toggle, schreibt `cost_acceptance_requested`). Nur wenn aktiv erscheint der Kunde-sichtbare Block auf der Public-Offer.
- Die Aktion **"Per E-Mail senden"** ist immer möglich, sobald Angebot final ist — unabhängig von `deposit_method` / `balance_method`.
- Hinweis-Banner "Pflicht für Vertragsschluss" fällt weg; ersetzt durch neutralen Statuszeile ("Angefordert am …", "Signiert am …", "Nicht angefordert").

### 4. Public-Offer — `PublicOffer.tsx` + `CostAcceptanceSection.tsx`
- Sichtbarkeit der Kostenübernahme-Section: **nur** wenn `inquiry.cost_acceptance_requested === true` (statt Ableitung aus Zahlungswahl). Phasen-Gate (`proposal_sent` … `order_confirmed`) und E-Mail-Only-Ausschluss bleiben.
- `required`-Prop wird immer `true` gesetzt, sobald der Block gezeigt wird (Admin hat ihn bewusst angefordert). Badge "Optional/Pflicht" entfällt visuell — es ist immer der aktive, angeforderte Vorgang.
- Section funktioniert weiterhin ohne Kopplung an Zahlungsflow: 0 % Anzahlung + 100 % vor Ort + Kostenübernahme jetzt ist ein regulär unterstützter Zustand.

### 5. Aufrufer bereinigen
`SmartInquiryEditor.tsx` und `OfferBuilder.tsx` reichen `depositMethod` / `balanceMethod` weiterhin nur informativ durch; die Anzeigelogik in der Card nutzt sie nicht mehr für Pflicht-Ableitung. Kein weiterer Funktionsumbau in Editor/Builder.

### 6. Kein Umbau der Edge Functions
Sende- und Signatur-Flows (`send-cost-acceptance-email`, `create-cost-acceptance-from-public-offer`, eSignatures-Client) bleiben unverändert — sie sind bereits payment-agnostic.

## Red-Team-Checks

- **Kein verbindlicher Vertrag mehr durch Zahlungsweg?** Der Vertragsschluss läuft weiterhin über die signierte Kostenübernahme; er ist jetzt aber explizit ein Admin-getriebener Akt, nicht implizit an Zahlungsdaten gebunden. Bereits signierte Dokumente bleiben immutable.
- **Alt-Anfragen ohne Flag:** `cost_acceptance_requested` defaultet auf `false`. Public-Offer-Block wird für Alt-Anfragen erst sichtbar, wenn Admin ihn aktiv anschaltet. Bereits gestartete/gesignete Kostenübernahmen bleiben über den Status sichtbar (Card zeigt sie weiter, auch ohne aktives Flag — Statusquelle ist `cost_acceptances`-Zeile).
- **Rückzug/Neuversion:** Bestehende Sperr- und Versionslogik (`lockedAfterSignature`, immutability) bleibt unberührt.
- **Race-Condition Kunde signiert nach Admin-Deaktivierung:** Solange eine aktive Signatur-URL existiert, wird der Section-Status aus der Row angezeigt, nicht aus dem Flag → keine tote Signatur-Session.

## Nicht Teil dieser Änderung

- Kein Umbau der Zahlungslogik (`deposit_method`, `balance_method`, Stripe-Flows).
- Kein Umbau des eSignatures-Contract-Layouts.
- Keine Änderung an bereits signierten oder laufenden Kostenübernahmen.

## Technische Notizen

- Migration: `ALTER TABLE public.v2_events ADD COLUMN cost_acceptance_requested boolean NOT NULL DEFAULT false, ADD COLUMN cost_acceptance_requested_at timestamptz;` (Tabelle prüfen — Feld gehört auf die Inquiry-Tabelle, die auch heute `deposit_method`/`balance_method` trägt; vor Umsetzung bestätigen).
- Frontend-Schreiben des Flags über bestehenden Refine-Update-Pfad, keine neue Edge Function.
- Types werden nach Migration regeneriert; TS-Casts `as any` in Editor entfallen für das neue Feld.
