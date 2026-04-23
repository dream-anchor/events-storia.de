

# PDF-Download-Gating: Erst nach vollständiger Kunden-Auswahl

## Problem heute

Aktuell ist der PDF-Download in `PublicOffer.tsx` (Zeile 523–527) freigegeben, sobald **mindestens eine** Option `selected_quantity > 0` hat:

```tsx
options.length <= 1 || options.some((o) => (o.selected_quantity ?? 0) > 0)
```

Schwächen:
- Bei mehreren Optionsgruppen (Hauptangebot A/B/C + ggf. Zusatz wie Kinder-Menü oder Getränke-Upgrade) reicht eine Teil-Auswahl — Kunde lädt unvollständiges PDF.
- Kein UI-Feedback **warum** der Button (un)sichtbar ist → CX-Lücke ("Wo ist mein PDF?").
- Im Single-Option-Fall (nur ein Angebot) wird sofort freigegeben — auch korrekt, da nichts zu wählen ist.

## Ziel

PDF-Download wird **erst** sichtbar/aktiv, wenn der Kunde seine Auswahl im PublicOffer **vollständig** getroffen und abgesendet hat (`offer_phase = customer_responded` oder weiter). Vorher: erklärender Hinweis statt Button. Ausnahme bleibt: Single-Option-Angebote (nichts zu wählen) — Download sofort verfügbar.

## Lösung in 3 Schritten

### Schritt 1 — Auswahl-Vollständigkeit als zentrale Funktion

Neue reine Helper-Funktion in `PublicOffer.tsx`:

```ts
function isCustomerSelectionComplete(
  options: OfferOption[],
  phase: OfferPhase,
): boolean {
  // Single-Option oder gar keine Optionen → keine Wahl nötig
  if (options.length <= 1) return true;
  // Kunde hat noch nicht geantwortet → unvollständig
  if (phase === 'proposal_sent' || phase === 'draft') return false;
  // Ab customer_responded gilt Auswahl als finalisiert
  return ['customer_responded', 'final_draft', 'final_sent', 'confirmed', 'paid']
    .includes(phase);
}
```

**Warum phase-basiert statt nur `selected_quantity`?**
- `selected_quantity > 0` ist ein technisches Detail aus der DB; `customer_responded` ist die **fachliche** Bestätigung "Kunde hat ausgewählt + abgesendet".
- Verhindert auch, dass eine Admin-seitige Vorbelegung (z.B. Default-Quantity) den Download fälschlich freigibt.

### Schritt 2 — Bedingte Anzeige + Hinweis-Box

Render-Block (Zeile 523–527) wird ersetzt durch eine Komponente `<PdfDownloadGate>`, die **drei Zustände** kennt:

```text
┌────────────────────────────────────────────────────────┐
│ State A — Selection Complete (oder Single-Option)      │
│ → vollwertiger Download-Button (wie heute)             │
├────────────────────────────────────────────────────────┤
│ State B — Multi-Option, noch nicht abgesendet          │
│ → graue Info-Card mit Lock-Icon:                       │
│    "Bitte wähle zuerst deine bevorzugte Option         │
│     unten aus. Sobald du deine Auswahl bestätigst,     │
│     steht hier dein persönliches Angebots-PDF zum      │
│     Download bereit."                                  │
│   + Smooth-Scroll-Link zu ProposalView                 │
├────────────────────────────────────────────────────────┤
│ State C — Kein lexoffice_invoice_id                    │
│ → Komponente rendert nichts (wie heute)                │
└────────────────────────────────────────────────────────┘
```

State B ist der **CX-Mehrwert**: Statt eines verschwundenen Buttons bekommt der Kunde aktive Führung zur nächsten Aktion.

### Schritt 3 — Konsistenz mit Archiv-Modus

`isArchiveMode` (alte Versionen): PDF-Download bleibt sichtbar (Archive haben immer eine finalisierte Version), aber Hinweis-Card entfällt — Archive sind read-only. Pointer-events bleiben aktiv für den Download-Button selbst (Read-Action erlaubt, nur Mutationen sind disabled).

## Ablauf aus Kundensicht (CX-Flow)

```text
1. Kunde öffnet PublicOffer-Link (Multi-Option-Angebot)
   → Sieht Hero, Anschreiben, Optionen
   → STATT Download: Hinweis-Card "Wähle zuerst..." mit Pfeil ↓
2. Kunde wählt Option B im ProposalView, schreibt ggf. Anmerkung
3. Kunde klickt "Auswahl absenden"
   → ThankYouView erscheint
   → offer_phase wechselt zu customer_responded
   → Hinweis-Card verschwindet, Download-Button erscheint oben
4. Kunde lädt sein verbindliches PDF (mit korrekten Beträgen
   nur für die gewählte Option)
```

## Geänderte Dateien

- **`src/pages/PublicOffer.tsx`** — neue Helper-Funktion `isCustomerSelectionComplete`, neue Komponente `PdfDownloadGate` (wrapper um bestehendes `PdfDownloadSection`), Render-Block angepasst. Ca. 60 Zeilen Diff, keine Breaking Changes.

Keine DB-, Edge-Function- oder Type-Änderungen. Bestehende `download-public-offer-pdf` Edge-Function bleibt unverändert.

## Akzeptanzkriterien (manueller Live-Test)

1. **Single-Option-Angebot**: Download sofort sichtbar nach `proposal_sent`.
2. **Multi-Option, vor Auswahl**: Hinweis-Card sichtbar, kein Download-Button, Smooth-Scroll-Link funktioniert.
3. **Multi-Option, nach Absenden**: Hinweis-Card weg, Download-Button erscheint, PDF enthält nur gewählte Option.
4. **Archiv-Modus alter Version**: Download sichtbar (read-only), keine Hinweis-Card.
5. **Mobile (414px)**: Hinweis-Card lesbar, Button-Tap-Area ≥ 44px.

## Technische Details

- Phase-Mapping nutzt das bestehende `effectivePhase` (bereits berechnet in PublicOffer).
- Smooth-Scroll via `document.getElementById('proposal-view')?.scrollIntoView({ behavior: 'smooth' })` — neue ID auf `<ProposalView>`-Wrapper.
- Hinweis-Card folgt monochromer Aesthetic (neutral-100 Background, neutral-700 Text, Lock-Icon aus lucide-react), kein Amber/Gelb.
- Keine neuen Dependencies.

