
# Fix: Menü-Konfiguration in Multi-Optionen-Karten integrieren

## Problem

In der `OfferOptionCard` wird beim Klick auf "Menü konfigurieren" nur ein Platzhalter-Text angezeigt:

> "Menü-Konfiguration wird über den Haupt-Editor vorgenommen"

Der eigentliche `MenuComposer` (mit dem geführten 3-Stufen-Workflow: Gänge → Getränke → Angebot) ist **nicht eingebunden**.

## Ursache

Als der `MultiOfferComposer` als neuer Standard eingeführt wurde, wurde der `MenuComposer` nicht in die `OfferOptionCard` integriert. Stattdessen wurde nur ein Platzhalter eingefügt.

## Lösung

Den `MenuComposer` direkt in die `OfferOptionCard` einbetten, sodass jede Option ihren eigenen vollständigen Menü-Workflow hat.

```text
┌─────────────────────────────────────────────────────────┐
│  Option A: Premium-Paket                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 45 Gäste × 99€ p.P. = 4.455,00 €                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  [Menü konfigurieren ▼]  ← Klick öffnet MenuComposer   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  [Gänge ●] ─── [Getränke ○] ─── [Zusammenfassung] │  │
│  │                                                   │  │
│  │  🥗 Vorspeise: Burratina ausgewählt              │  │
│  │  🍝 Primo: Tagliatelle ausgewählt                │  │
│  │  ...                                              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Technische Änderungen

### Datei: `src/components/admin/refine/InquiryEditor/MultiOffer/OfferOptionCard.tsx`

1. **Import hinzufügen**: `MenuComposer` aus dem benachbarten Verzeichnis importieren

2. **Platzhalter ersetzen**: Den Text "Menü-Konfiguration wird über den Haupt-Editor vorgenommen" durch den echten `MenuComposer` ersetzen

3. **Props durchreichen**: Die `onUpdate`-Funktion nutzen, um Menü-Änderungen in `option.menuSelection` zu speichern

```tsx
// Vorher (Zeilen 198-207)
<Collapsible open={showMenuEditor} onOpenChange={setShowMenuEditor}>
  <CollapsibleContent>
    {selectedPackage && (
      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground text-center py-4">
          Menü-Konfiguration wird über den Haupt-Editor vorgenommen
        </p>
      </div>
    )}
  </CollapsibleContent>
</Collapsible>

// Nachher
<Collapsible open={showMenuEditor} onOpenChange={setShowMenuEditor}>
  <CollapsibleContent>
    {selectedPackage && (
      <div className="pt-4 border-t">
        <MenuComposer
          packageId={option.packageId}
          packageName={selectedPackage.name}
          guestCount={option.guestCount}
          menuSelection={option.menuSelection}
          onMenuSelectionChange={(selection) => 
            onUpdate({ menuSelection: selection })
          }
        />
      </div>
    )}
  </CollapsibleContent>
</Collapsible>
```

## Anpassungen am MenuComposer

Der `MenuComposer` wird in diesem Kontext **ohne** die E-Mail-Generierung verwendet (da diese im übergeordneten `MultiOfferComposer` stattfindet). Die optionalen Props `inquiry`, `emailDraft`, `onEmailDraftChange`, `onSendOffer` werden daher nicht übergeben.

## Workflow nach der Änderung

1. Nutzer wählt Paket in Option A
2. Klick auf "Menü konfigurieren" expandiert den MenuComposer
3. Der geführte 3-Stufen-Workflow (Gänge → Getränke → Zusammenfassung) wird angezeigt
4. Nutzer wählt Gerichte und Getränke aus
5. Änderungen werden automatisch in `option.menuSelection` gespeichert
6. Nach Fertigstellung aller Optionen: "E-Mail generieren" im MultiOfferComposer

## Betroffene Dateien

1. `src/components/admin/refine/InquiryEditor/MultiOffer/OfferOptionCard.tsx`
   - MenuComposer importieren
   - Platzhalter durch echten MenuComposer ersetzen
