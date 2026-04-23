

# Fix: PDF-Gating im Admin-Preview spiegelt jetzt strikt die Kundensicht

## Root Cause

Im Admin-Preview (`?preview=1&send=proposal|final`) wird `effectivePhase` künstlich gesetzt:

```ts
const effectivePhase = isPreviewMode
  ? (previewSend === 'final' ? 'final_sent' : 'proposal_sent')
  : (...)
```

Zwei Lecks daraus:

1. **Preview mit `send=final`**: `effectivePhase = 'final_sent'` → in Allowlist → Gate öffnet. Auch wenn das echte `offer_phase` der Inquiry noch `proposal_sent` ist und der Kunde NICHTS ausgewählt hat.
2. **Preview mit `send=proposal` + Edge-Case `options.length === 1`** (oder `0`, weil im Preview manchmal leer geladen): Single-Option-Bypass `options.length <= 1 → true` öffnet das Gate ebenfalls.

Beide Fälle widersprechen dem Wunsch "Preview = 1:1 Kundensicht".

## Lösung

### Änderung 1 — Preview-Modus respektiert echte DB-Phase fürs Gating

Das Gating darf NICHT auf `effectivePhase` laufen, sondern muss im Preview-Modus die **echte** `inquiry.offer_phase` aus der DB nehmen. Nur Anzeige-Logik (HeroSection, ProposalView etc.) nutzt weiterhin `effectivePhase` für die Layout-Vorschau.

```ts
// Im PdfDownloadGate-Aufruf:
phase={isPreviewMode ? (inquiry.offer_phase || 'draft') : effectivePhase}
```

### Änderung 2 — Single-Option-Bypass nur, wenn Optionen wirklich vorhanden

`options.length <= 1` ist trügerisch wenn `options.length === 0` (z. B. unvollständig geladen, Preview-Race-Condition). Verschärfung:

```ts
function isCustomerSelectionComplete(options, phase): boolean {
  // Echtes Single-Option-Angebot: genau 1 Option vorhanden → Auto-Pass.
  if (options.length === 1) return true;
  // 0 Optionen → unsicher, lieber sperren.
  if (options.length === 0) return false;
  // Multi-Option → Phase muss echte Kunden-Antwort signalisieren.
  return ['customer_responded', 'final_draft', 'final_sent', 'confirmed', 'paid']
    .includes(phase);
}
```

### Änderung 3 — Gate-Hinweis im Preview-Modus mit Admin-Kontext

Damit Admins im Preview verstehen, warum der Button fehlt, ergänzt die Hinweis-Card im Preview-Modus eine kleine Sub-Zeile:

> *„Vorschau-Hinweis: Auch in der Live-Ansicht wird der Download erst freigegeben, sobald der Kunde seine Auswahl bestätigt."*

(Nur sichtbar wenn `isPreviewMode === true`.)

## Verhaltens-Matrix nach Fix

| Szenario | Admin-Preview send=proposal | Admin-Preview send=final | Echter Kunde proposal_sent | Echter Kunde final_sent / customer_responded |
|---|---|---|---|---|
| 1 Option | Download ✓ | Download ✓ | Download ✓ | Download ✓ |
| 2+ Optionen, keine Wahl | Gate (mit Preview-Hinweis) | Gate (mit Preview-Hinweis) | Gate | Download ✓ |
| 0 Optionen geladen | Gate | Gate | Gate | Gate |

Konsistenz mit `isArchiveMode`: bleibt unverändert (Archiv = immer Download sichtbar, da finalisiert).

## Geänderte Datei

- **`src/pages/PublicOffer.tsx`** — 3 kleine Änderungen, ~25 LOC:
  - `PdfDownloadGate`-Aufruf: `phase={isPreviewMode ? inquiry.offer_phase || 'draft' : effectivePhase}` und neuer Prop `isPreviewMode`.
  - `isCustomerSelectionComplete`: Single-Option-Branch verschärft (genau `=== 1`, nicht `<= 1`).
  - `PdfDownloadGate`: optionale Preview-Hinweis-Sub-Zeile.

Keine DB-, RPC- oder Edge-Function-Änderungen.

## Akzeptanzkriterien (Live-Test im Preview)

1. Admin-Preview, `send=proposal`, 2+ Optionen, `offer_phase=proposal_sent` → Hinweis-Card mit Preview-Sub-Zeile, **kein** Download-Button.
2. Admin-Preview, `send=final`, 2+ Optionen, echte `offer_phase=proposal_sent` → ebenfalls Hinweis-Card (Fix der Hauptlücke).
3. Admin-Preview, `send=final`, echte `offer_phase=final_sent` → Download sichtbar (Kunde hat geantwortet, Admin hat final gesendet).
4. Echter Kunden-Link, Multi-Option, vor Auswahl → Hinweis-Card ohne Preview-Sub-Zeile.
5. Echter Kunden-Link, nach Auswahl → Download-Button.
6. Single-Option-Angebot → Download immer sichtbar.

