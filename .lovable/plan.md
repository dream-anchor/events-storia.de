

# UI-Redesign: Multi-Offer-Composer auf "State of the Art 2026"

## Analyse des aktuellen Problems

Die aktuelle UI nutzt:
- **Orange/Rot-Töne** via `text-primary` und `bg-primary` (Primary ist derzeit HSL 358°, also ein warmes Rot)
- **Überladene Karten** mit vielen verschachtelten Containern
- **Inkonsistente Hierarchie** - zu viele visuelle Elemente konkurrieren um Aufmerksamkeit
- **Fehlende Glassmorphism-Effekte** die im Rest des Admin-Bereichs verwendet werden

## Design-Prinzipien "State of the Art 2026"

Basierend auf dem bestehenden Premium UI Framework:

| Element | Alt (Aktuell) | Neu (2026) |
|---------|---------------|------------|
| Farben | `text-primary` (Rot/Orange) | Monochromes Grau + `text-foreground` |
| Akzente | `bg-primary/5` | Dezentes `bg-muted/50` oder `glass-card` |
| Cards | Standard borders | `glass-card` mit `backdrop-blur` |
| Preise | `text-primary` Bold | `text-foreground` mit eleganter Typografie |
| Badges | Farbige Borders | Subtile monochromatische Varianten |
| Spacing | Kompakt | Großzügiger mit mehr Weißraum |

## Technischer Plan

### Datei 1: `OfferOptionCard.tsx` - Komplettes Redesign

**Aktuelle Probleme:**
- Orange Option-Labels (`bg-primary text-primary-foreground`)
- Orange Preisanzeige (`text-primary`)
- Orange Status-Badges und Links
- Verschachtelte Container mit zu wenig Kontrast

**Änderungen:**
```text
1. Option-Label (A, B, C...):
   - Alt: bg-primary (orange) → Neu: bg-foreground/10 text-foreground
   - Aktiv: Dezent hervorgehoben mit border statt Farbe

2. Preis-Anzeige:
   - Alt: text-xl font-bold text-primary → Neu: text-2xl font-semibold text-foreground
   - Elegante typografische Hierarchie statt Farbakzent

3. Aktiv/Inaktiv Toggle:
   - Alt: text-primary vs text-muted-foreground
   - Neu: Switch-Komponente oder minimalistischer Toggle

4. Menü-Konfiguration Status:
   - Alt: text-primary für konfiguriert
   - Neu: Checkmark-Icon + text-muted-foreground

5. Zahlungslink-Box:
   - Alt: bg-primary/5 border-primary/20
   - Neu: glass-card Styling oder subtle bg-muted
```

### Datei 2: `MultiOfferComposer.tsx` - Vereinfachtes Layout

**Änderungen:**
```text
1. Summary Card:
   - Alt: bg-primary/5 border-primary/20
   - Neu: Standard Card mit glass-card oder neutral bg-muted/30

2. Version Badge:
   - Bleibt neutral (variant="outline" ist bereits gut)

3. Speicher-Status:
   - Alt: text-primary für "Gespeichert"
   - Neu: text-muted-foreground mit Check-Icon

4. Button "Weitere Option hinzufügen":
   - Bleibt border-dashed, ist bereits neutral

5. Email-Draft Card:
   - Saubere Typografie, weniger visuelles Rauschen
```

### Datei 3: `OfferVersionHistory.tsx` - Konsistenz prüfen

- Sicherstellen dass keine orange Akzente verwendet werden

## Visual-Konzept

```text
┌─────────────────────────────────────────────────────────────────┐
│  Multi-Paket-Angebot                    [Version 1] [Historie]  │
│  Erstellen Sie bis zu 5 Optionen...                ✓ Gespeichert│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ GLASS-CARD ──────────────────────────────────────────────┐ │
│  │  ┌──┐                                                     │ │
│  │  │A │  [Paket wählen ▼]                    ○ Aktiv  ✕     │ │
│  │  └──┘                                                     │ │
│  │                                                           │ │
│  │  ┌ Dezenter Container ─────────────────────────────────┐  │ │
│  │  │  Preis pro Person              85,00 €              │  │ │
│  │  │  Gäste                         × 50                 │  │ │
│  │  │  ─────────────────────────────────────              │  │ │
│  │  │  Gesamt                        4.250,00 €           │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                           │ │
│  │  📦 3 Gänge, 2 Getränke konfiguriert   [Menü bearbeiten]  │ │
│  │                                                           │ │
│  │  ✓ Zahlungslink erstellt              [Link öffnen ↗]     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌ + Weitere Option hinzufügen ─────────────────────────────┐  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ────────────────────────────────────────────────────────────── │
│                                                                 │
│  ┌ SUMMARY ──────────────────────────────────────────────────┐ │
│  │  1 aktive Option                [Anschreiben generieren]  │ │
│  │  Gesamtwert: 4.250,00 €                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Konkrete CSS-Klassen-Änderungen

| Komponente | Alt | Neu |
|------------|-----|-----|
| Option Circle | `bg-primary text-primary-foreground` | `bg-foreground/10 text-foreground border border-border` |
| Option Circle (aktiv) | `bg-primary text-primary-foreground` | `bg-foreground text-background` |
| Preis Gesamt | `text-xl font-bold text-primary` | `text-2xl font-semibold text-foreground tracking-tight` |
| Aktiv Button | `text-primary` | `text-foreground` |
| Menü konfiguriert | `text-primary` | `text-foreground` mit ✓ Icon |
| Payment Link Box | `bg-primary/5 border-primary/20` | `bg-muted/50 border-border` |
| Payment Link Text | `text-primary` | `text-foreground` |
| Summary Card | `bg-primary/5 border-primary/20` | `bg-muted/30` oder `glass-card` |
| Saved Status | `text-primary` | `text-muted-foreground` |

## Zusätzliche UX-Verbesserungen

1. **Mehr Weißraum**: `space-y-4` → `space-y-6` zwischen Sections
2. **Größere Touch-Targets**: Buttons mindestens `h-10`
3. **Subtilere Trennlinien**: `border-border/50` statt volle Opacity
4. **Konsistente Schriftgrößen**: `text-base` als Standard, `text-sm` nur für Metadaten

## Betroffene Dateien

1. `src/components/admin/refine/InquiryEditor/MultiOffer/OfferOptionCard.tsx`
2. `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx`
3. `src/components/admin/refine/InquiryEditor/MultiOffer/OfferVersionHistory.tsx` (optional, falls orange Elemente)

