
# StoriaMaestro 2026: Radikal vereinfachte UX

## Analyse der aktuellen Situation

### 1. Einfaches Angebot vs. Multi-Optionen

**Ergebnis der Analyse:**

| Feature | Einfaches Angebot | Multi-Optionen |
|---------|-------------------|----------------|
| Paketauswahl | ✅ Einzelpaket | ✅ Bis zu 5 Pakete als A/B/C |
| Menü-Composer | ✅ Geführter 3-Stufen-Workflow | ❌ Nur Basis-Menüauswahl |
| Stripe-Links | ❌ Nicht integriert | ✅ Individuelle Zahlungslinks |
| Email-Generator | ✅ Im FinalizePanel | ✅ Eigener Generator |
| Versionierung | ❌ Nicht vorhanden | ✅ Angebotshistorie |

**Empfehlung:** Multi-Optionen bietet den vollständigeren Workflow (Stripe-Links, Versionierung) und sollte zum **einzigen Modus** werden. Der "Einfaches Angebot"-Toggle ist redundant, da Multi-Optionen mit einer einzigen Option genauso funktioniert.

→ **Toggle "Einfaches Angebot / Multi-Optionen" entfernen**

---

### 2. Kommunikation-Tab

**Aktuelle Situation:**
- Tab "Kommunikation" zeigt `AIComposer` mit E-Mail-Generierung und Versand
- **Aber:** Der `FinalizePanel` im MenuComposer (unter "Kalkulation") enthält exakt dieselbe Funktionalität
- Das bedeutet: Kommunikation ist doppelt vorhanden

**Empfehlung:** Der "Kommunikation"-Tab ist redundant, da:
1. Der MenuWorkflow endet bereits mit dem FinalizePanel (inkl. E-Mail-Generierung + Versand)
2. Der Workflow sollte linear sein: Pakete → Menü → Getränke → Anschreiben → Senden

→ **"Kommunikation"-Tab entfernen, FinalizePanel als finalen Schritt behalten**

---

### 3. Gespeichert-Indikator "blinkt"

**Problem:** Der Auto-Save läuft alle 800ms wenn sich Daten ändern. Bei jedem Speichervorgang:
1. "Speichert..." erscheint
2. Nach Success: "Gespeichert" für 2 Sekunden
3. Dann verschwindet es wieder

Bei kontinuierlichen Eingaben entsteht ein störendes Flackern.

**Lösung:** "Gespeichert" nur einmalig anzeigen und dann **permanent subtil eingeblendet** lassen. Nur bei aktiven Änderungen auf "Speichert..." wechseln.

```text
Vorher:  [Speichert...] → [Gespeichert ✓] (2s) → [nichts] → [Speichert...] ...
Nachher: [Speichert...] → [✓ Gespeichert] (permanent, dezent) → [Speichert...] ...
```

---

## State of the Art 2026 Redesign

### Kernprinzip: Progressive Disclosure

Statt alle Features gleichzeitig zu zeigen, wird der Nutzer durch einen **linearen, geführten Flow** geleitet:

```text
┌──────────────────────────────────────────────────────────────────────┐
│  SCHRITT 1: GRUNDDATEN                                               │
│  ┌─────────────────────┐                                             │
│  │ Event-Details       │  ← Kompakte Card mit Datum, Gäste, Typ     │
│  │ 📅 15.03.2026       │                                             │
│  │ 👥 45 Gäste         │                                             │
│  │ 🏢 Firmenfeier      │                                             │
│  └─────────────────────┘                                             │
├──────────────────────────────────────────────────────────────────────┤
│  SCHRITT 2: PAKET WÄHLEN                                             │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                         │
│  │  Essenz   │  │  Premium  │  │  Exclusiv │  ← Große, klare Cards  │
│  │   79€ pp  │  │   99€ pp  │  │   129€ pp │                         │
│  │     ○     │  │     ●     │  │     ○     │                         │
│  └───────────┘  └───────────┘  └───────────┘                         │
├──────────────────────────────────────────────────────────────────────┤
│  SCHRITT 3: MENÜ ZUSAMMENSTELLEN (erscheint nach Paketauswahl)       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  [Gänge ●] ─── [Getränke ○] ─── [Zusammenfassung ○]            │ │
│  │                                                                 │ │
│  │  🥗 Vorspeise                                                   │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ Burratina mit San-Marzano-Tomaten              gewählt ✓ │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  🍝 Primo                                                       │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ Wähle ein Gericht...                                     │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│  SCHRITT 4: ANSCHREIBEN & SENDEN (erscheint nach Menü-Auswahl)       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  [✨ Anschreiben generieren]                                    │ │
│  │                                                                 │ │
│  │  Hallo Max,                                                     │ │
│  │                                                                 │ │
│  │  vielen Dank für Ihre Anfrage...                               │ │
│  │                                                                 │ │
│  │  ───────────────────────────────────────────────                │ │
│  │                                                                 │ │
│  │  [     Angebot senden & E-Mail versenden     ]                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Konkrete Änderungen

### Datei: `SmartInquiryEditor.tsx`

**1. ToggleGroup "Einfaches Angebot / Multi-Optionen" entfernen**
- Zeilen 391-415: Kompletter ToggleGroup-Block wird gelöscht
- Der `offerMode` State wird nicht mehr benötigt
- Es wird nur noch `MultiOfferComposer` verwendet (funktioniert auch mit 1 Option)

**2. "Kommunikation"-Tab entfernen**
- Zeilen 380-387: TabsList auf 2 Tabs reduzieren ("Kalkulation", "Aktivitäten")
- Zeilen 476-501: TabsContent "kommunikation" komplett entfernen
- Der AIComposer bleibt im FinalizePanel des MenuComposer erhalten

**3. Gespeichert-Indikator optimieren**
- Zeilen 362-375: Logik ändern
- "Gespeichert" bleibt permanent sichtbar (ohne Animation)
- Nur "Speichert..." wird bei aktiver Speicherung angezeigt

```tsx
// Vorher
{saveStatus === 'saved' && (
  <>
    <CheckCircle2 className="h-4 w-4 text-primary" />
    <span>Gespeichert</span>
  </>
)}

// Nachher
{(saveStatus === 'idle' || saveStatus === 'saved') && (
  <span className="text-muted-foreground/60 text-sm">
    <Check className="h-3.5 w-3.5 inline mr-1" />
    Gespeichert
  </span>
)}
{saveStatus === 'saving' && (
  <span className="text-muted-foreground text-sm">
    <Loader2 className="h-3.5 w-3.5 inline mr-1 animate-spin" />
    Speichert...
  </span>
)}
```

---

### Datei: `EventModules.tsx`

**Vereinfachung:** Der komplette Paket-Auswahl-Block wird kompakter gestaltet. Die Menü-Logik wird in den MenuComposer verlagert, der bereits gut funktioniert.

---

### Datei: `MultiOfferComposer.tsx`

**Anpassungen für Single-Option-Default:**
- Startet mit genau 1 Option (A)
- "Weitere Option hinzufügen" Button ermöglicht bei Bedarf mehr Optionen
- E-Mail-Generierung ist bereits integriert
- Keine UI-Änderung nötig, da der aktuelle Flow bereits gut ist

---

### Weitere Optimierungen

**1. MenuComposer beibehalten**
- Der geführte 3-Stufen-Workflow (Gänge → Getränke → Angebot) ist bereits "State of the Art"
- FinalizePanel enthält AIComposer + Versand – das ist der richtige Ort

**2. Aktivitäten-Tab bleibt**
- Zeigt Timeline/History
- Wichtig für Nachvollziehbarkeit

**3. Keine funktionalen Einschränkungen**
- Alle bestehenden Features bleiben erhalten
- Nur die Präsentation wird vereinfacht

---

## Zusammenfassung der Änderungen

| Was | Aktion |
|-----|--------|
| Toggle "Einfaches/Multi" | Entfernen (Multi als Default, funktioniert auch mit 1 Option) |
| Tab "Kommunikation" | Entfernen (redundant, FinalizePanel bleibt) |
| Tab "Kalkulation" | Bleibt (enthält Paket + MenuComposer) |
| Tab "Aktivitäten" | Bleibt (Timeline) |
| Gespeichert-Blinken | Permanent dezent anzeigen, nur bei Speicherung "Speichert..." |

---

## Betroffene Dateien

1. `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`
   - Toggle entfernen
   - Kommunikation-Tab entfernen
   - Save-Status-Indikator optimieren

2. (Optional) `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx`
   - Default auf 1 Option setzen (falls nicht bereits so)

