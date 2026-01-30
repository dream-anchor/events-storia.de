

# Plan: "Bearbeiten"-Button in gesperrtem Zustand ausblenden + Button-Benennung klären

## Problem-Analyse

### 1. "Bearbeiten"-Button sollte nicht klickbar sein nach Versand

Der Screenshot zeigt eine Anfrage, bei der:
- Version 2 gesendet wurde (→ in History)
- Version 3 "in Bearbeitung" ist (→ nach Unlock)
- Das System ist im **entsperrten** Modus (`offer_sent_at = NULL`)

**Der "Bearbeiten"-Button ist korrekt sichtbar**, weil Version 3 gerade bearbeitet wird. Das ist das gewünschte Verhalten – nach "Neues Angebot erstellen" kann die Konfiguration geändert werden.

**ABER:** Wenn das Angebot **noch gesperrt** ist (vor dem Klick auf "Neues Angebot erstellen"), sollte der "Bearbeiten"-Button nicht erscheinen.

→ Die Logik ist bereits korrekt implementiert in `OfferOptionCard.tsx` (Zeile 257-270):
```typescript
{!isLocked && (
  <Button onClick={() => setShowMenuEditor(!showMenuEditor)}>
    Bearbeiten
  </Button>
)}
```

### 2. "Weitere Option hinzufügen" vs. "Neues Angebot erstellen"

Diese zwei Buttons haben **unterschiedliche Funktionen**:

| Button | Position | Funktion |
|--------|----------|----------|
| **Weitere Option hinzufügen** | Unter den Options-Karten | Fügt Option B, C, D zum **aktuellen** Angebot hinzu |
| **Neues Angebot erstellen** | Im Locked-Banner | Entsperrt das Angebot für eine neue Version (v3, v4...) |

**"Weitere Option hinzufügen" ist korrekt benannt** – es fügt dem aktuellen Angebot eine weitere Paket-Option hinzu (z.B. "Option B: Aperitivo" neben "Option A: Business Dinner").

**Das ist NICHT das Gleiche** wie "Neues Angebot erstellen", welches eine komplett neue Version (v3) startet.

---

## Empfohlene Klärung

Die Buttons sind korrekt benannt und funktionieren wie vorgesehen:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Locked-Banner (nach Versand sichtbar)                           │
│                           [ Neues Angebot erstellen ] ← v3      │
└─────────────────────────────────────────────────────────────────┘
                                  ↓ Klick
┌─────────────────────────────────────────────────────────────────┐
│ Entsperrt – Version 3 in Bearbeitung                            │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Option A: Business Dinner – 1287€           [✓] Aktiv       │ │
│ │ Menü konfiguriert • 3 Gänge                    [Bearbeiten] │ │ ← Korrekt!
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [ + Weitere Option hinzufügen ]  ← Fügt B, C, D zum v3 hinzu   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Optionale UX-Verbesserung

Falls der "Bearbeiten"-Button dennoch verwirrend wirkt, könnte er umbenannt werden:

| Aktuell | Mögliche Alternative |
|---------|---------------------|
| "Bearbeiten" | "Menü anpassen" |
| | "Gänge ändern" |

### Änderung (optional)

**Datei:** `src/components/admin/refine/InquiryEditor/MultiOffer/OfferOptionCard.tsx`

Zeile 267:
```typescript
// Aktuell:
{showMenuEditor ? 'Schließen' : 'Bearbeiten'}

// Alternativ:
{showMenuEditor ? 'Schließen' : 'Menü anpassen'}
```

---

## Zusammenfassung

- **"Bearbeiten" ist korrekt**: Erscheint nur im entsperrten Modus (nach "Neues Angebot erstellen")
- **"Weitere Option hinzufügen" ist korrekt benannt**: Fügt Option B/C/D zum aktuellen Angebot hinzu
- **"Neues Angebot erstellen" ist korrekt**: Startet eine neue Version

Falls Sie möchten, kann der "Bearbeiten"-Button zu "Menü anpassen" umbenannt werden, um die Funktion klarer zu machen.

