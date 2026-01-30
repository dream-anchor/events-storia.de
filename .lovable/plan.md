

# Plan: Angebot nach Versand einfrieren – "Locked after Send"

✅ **IMPLEMENTIERT** (30.01.2026)

## Übersicht

Nachdem ein Angebot verschickt wurde, soll es nicht mehr bearbeitet werden können. Die gesendete Konfiguration muss **unveränderlich** bleiben, damit immer nachvollziehbar ist, was der Kunde erhalten hat.

Will der Kunde Änderungen, muss eine **neue Version** erstellt werden.

---

## Aktueller Stand

```text
┌─────────────────────────────────────────────────────────────────┐
│ inquiry_offer_history                                           │
│   → Snapshots jeder gesendeten Version (options_snapshot JSON)  │
│   → Version 1, 2, 3 ...                                         │
├─────────────────────────────────────────────────────────────────┤
│ inquiry_offer_options                                           │
│   → Aktuelle Optionen (editierbar)                              │
│   → PROBLEM: Werden auch nach Versand verändert!                │
├─────────────────────────────────────────────────────────────────┤
│ event_inquiries                                                 │
│   → offer_sent_at: Wann zuletzt gesendet                        │
│   → current_offer_version: Aktuelle Version                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Lösung: "Locked Mode" nach Versand

### Konzept

```text
                    ┌──────────────────────────────────┐
                    │       Angebot gesendet?          │
                    │     (offer_sent_at != null)      │
                    └───────────────┬──────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                    ┌─────────┐           ┌─────────────┐
                    │   JA    │           │    NEIN     │
                    └────┬────┘           └──────┬──────┘
                         │                       │
                         ▼                       ▼
              ┌─────────────────────┐    ┌──────────────────┐
              │  READONLY-MODUS     │    │  EDIT-MODUS      │
              │  • Paket-Dropdown   │    │  • Alles normal  │
              │    deaktiviert      │    │    bearbeitbar   │
              │  • Menü-Editor      │    │                  │
              │    deaktiviert      │    │                  │
              │  • Gäste-Anzahl     │    │                  │
              │    deaktiviert      │    │                  │
              │  • "Neue Version"   │    │                  │
              │    Button aktiv     │    │                  │
              └─────────────────────┘    └──────────────────┘
```

---

## Schritt 1: Read-Only State an Komponenten übergeben

### MultiOfferComposer.tsx

Neue Prop `isLocked` berechnen und an alle Kinder durchreichen:

```text
const isLocked = Boolean(inquiry.offer_sent_at);

// Wenn gelockt, werden Optionen aus History-Snapshot gelesen
// NICHT aus den editierbaren inquiry_offer_options
```

### OfferOptionCard.tsx

Neue Prop `isLocked` empfangen:

```text
interface OfferOptionCardProps {
  ...
  isLocked?: boolean;  // NEU
}
```

Bei `isLocked = true`:
- Paket-Select: `disabled`
- Gäste-Input: `disabled`  
- Menü-Bearbeiten-Button: Versteckt
- Aktiv/Inaktiv-Toggle: `disabled`
- Löschen-Button: Versteckt

---

## Schritt 2: Gesendete Optionen anzeigen

Wenn `isLocked = true`, sollen die Optionen **aus dem letzten History-Snapshot** angezeigt werden, nicht aus den editierbaren `inquiry_offer_options`.

```text
const displayOptions = isLocked && history.length > 0
  ? history[0].optionsSnapshot  // Letzte gesendete Version
  : options;                    // Aktuelle bearbeitbare Optionen
```

Dies stellt sicher, dass immer genau das angezeigt wird, was gesendet wurde.

---

## Schritt 3: "Neue Version erstellen" Flow

Wenn gesperrt, gibt es einen Button um eine neue Version zu starten:

```text
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Dieses Angebot wurde am 15.01.26 um 14:30 versendet.       │
│                                                                 │
│  Die gesendete Konfiguration kann nicht mehr geändert werden.  │
│                                                                 │
│  [ 📝 Neue Version erstellen ]                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Ablauf "Neue Version erstellen":**

1. System kopiert die gesperrten Optionen in neue bearbeitbare Optionen
2. `offer_sent_at` wird auf `null` gesetzt (entsperrt zum Bearbeiten)
3. `current_offer_version` wird inkrementiert
4. Nach dem erneuten Senden wird wieder gesperrt

---

## Schritt 4: UI-Änderungen im Detail

### 4a. Gesperrter Zustand – OfferOptionCard

```text
┌─────────────────────────────────────────────────────────┐
│  [A]  Business Dinner                    🔒 Gesendet    │
│       (nicht änderbar)                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Preis pro Person        49,00 €                 │   │
│  │ Gäste                   × 50                    │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ Gesamt                  2.450,00 €              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Gänge (3 ausgewählt)                                   │
│  ✓ Vorspeise: Burrata mit Tomaten                       │
│  ✓ Hauptgang: Saltimbocca                               │
│  ✓ Dessert: Tiramisu                                    │
│                                                         │
│  [Link öffnen]                    ✓ Zahlungslink erstellt│
└─────────────────────────────────────────────────────────┘

(Alle Felder nur zur Ansicht, keine Edit-Buttons)
```

### 4b. Banner für gesperrte Anfragen

```text
┌─────────────────────────────────────────────────────────┐
│  🔒 Angebot v2 wurde am 15.01.26 versendet             │
│     von Domenico Speranza                               │
│                                                         │
│  [ Neue Version erstellen ]   [ Historie anzeigen ]     │
└─────────────────────────────────────────────────────────┘
```

---

## Technische Änderungen

| Datei | Änderung |
|-------|----------|
| `MultiOfferComposer.tsx` | `isLocked` State berechnen, gesperrte Optionen aus History laden, Banner anzeigen |
| `OfferOptionCard.tsx` | `isLocked` Prop, alle interaktiven Elemente deaktivieren |
| `useMultiOfferState.ts` | Funktion `createNewVersion()` erweitern für Copy & Unlock Flow |

---

## Ablauf nach Implementierung

```text
                     Anfrage erstellt
                           │
                           ▼
                    ┌─────────────┐
                    │ Optionen    │
                    │ konfigurieren│
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Angebot     │
                    │ senden      │
                    └──────┬──────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ 🔒 GESPERRT            │
              │ • Optionen readonly    │
              │ • Aus Snapshot geladen │
              │ • Exakt wie gesendet   │
              └───────────┬────────────┘
                          │
                          │ Kunde wünscht Änderung
                          ▼
              ┌────────────────────────┐
              │ "Neue Version" klicken │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ 🔓 ENTSPERRT           │
              │ • Optionen bearbeitbar │
              │ • Version inkrementiert│
              └───────────┬────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │ Erneut      │
                    │ senden      │
                    └──────┬──────┘
                          │
                          ▼
              ┌────────────────────────┐
              │ 🔒 GESPERRT (v2)       │
              └────────────────────────┘
```

---

## Zusammenfassung

- **Nachvollziehbarkeit:** Was gesendet wurde, bleibt unverändert erhalten
- **Versionierung:** Jede Änderung = neue Version
- **Klare UI:** Gesperrte Optionen sind optisch erkennbar (🔒, grau, keine Buttons)
- **Flexibilität:** "Neue Version erstellen" ermöglicht Folge-Angebote

