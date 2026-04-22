

# Restaurant-Menü-Auswahl auch im Wizard zugänglich machen

## Befund

Der `MenuImporter` (mit Lunch/Dinner/Tasting-Menüs) ist eingebunden — aber **nur in der Übersicht des MultiOfferComposers** (Kopfzeile, Zeile 416 ff.). Sobald der Admin in eine Option hineinklickt und im **Wizard** landet, gibt es keinen Zugang mehr zu diesem Sheet. Statt dessen sieht er:

- den **Source-Filter-Tab „Restaurant"** im `CourseSelector` (Schritt „Gänge") → der zeigt einzelne à-la-carte-Speisen, **nicht** die kuratierten Komplett-Menüs.

Genau das ist die Beschwerde: „Restaurant Menü" im Wizard zeigt das gleiche wie „Eigenes Menü", weil es derselbe CourseSelector ist, nur mit anderem Filter.

## Lösung

Den `MenuImporter` auch im **Wizard-Header** ergänzen — exakt wie in der Übersicht. Logik bleibt identisch: Klick → Sheet öffnet sich → Mittagsmenü / Degustationsmenüs auswählbar → bei Bestätigung wird die **aktuelle Option überschrieben** mit dem importierten Menü (Name, Preis, ggf. Drink-Pauschale / Weinbegleitung).

Wichtig — Unterschied zur Übersicht: Hier wird **eine bestehende Option** befüllt, nicht eine neue angelegt. Wenn der Nutzer mehrere Menüs gleichzeitig wählt, wird die aktuelle Option mit dem ersten Menü überschrieben und die restlichen als zusätzliche Optionen angelegt (über den bestehenden `addImportedOptions`-Pfad).

### Umsetzung — 2 Änderungen

**1. `WizardConfigurator.tsx`**

Neuer Prop `onImportRestaurantMenus` (optional). Im Header neben dem Back-Button einen `MenuImporter`-Button anzeigen:

```tsx
<MenuImporter
  guestCount={option.guestCount}
  currentOptionCount={0}     // erlaube ≥1 Auswahl, Mehrfach wird oben gemanagt
  onImportMultiple={(imported) => {
    if (imported.length === 0) return;
    // Erste Auswahl ersetzt aktuelle Option
    const [first, ...rest] = imported;
    onUpdateOption({
      packageId: null,
      packageName: first.packageName ?? '',
      totalAmount: first.totalAmount ?? 0,
      menuSelection: {
        courses: [],
        drinks: first.menuSelection?.drinks ?? [],
      },
    });
    // Restliche als neue Optionen anlegen
    if (rest.length > 0) onImportRestaurantMenus?.(rest);
    onBack();   // zurück zur Übersicht, damit der User die neuen Optionen sieht
  }}
/>
```

Außerdem: Wenn `option.packageId === null && option.packageName` gesetzt ist (= importiertes Menü), Schritte 1 und 2 (Paket-/Gang-Auswahl) **überspringen** und direkt bei Schritt 3 (Getränke) oder 4 (Zusammenfassung) starten — sonst wirkt die Option leer.

**2. `MultiOfferComposer.tsx`**

Den `addImportedOptions`-Callback an den Wizard durchreichen:

```tsx
<WizardConfigurator
  option={wizardOption}
  packages={packages}
  inquiry={inquiry}
  onUpdateOption={(updates) => updateOption(wizardOption.id, updates)}
  onBack={handleWizardBack}
  onImportRestaurantMenus={addImportedOptions}   // NEU
/>
```

### Verifikation

1. Build grün.
2. Neue Option erstellen → in den Wizard gehen → oben rechts erscheint Button „Restaurant-Menü laden".
3. Klick → Sheet zeigt Lunch/Dinner mit Komplett-Menüs (wie in der Übersicht).
4. Eine Auswahl → Wizard schließt sich, Übersicht zeigt die Option mit korrektem Namen und Preis.
5. Mehrere Auswahlen → erste ersetzt die aktuelle Option, weitere werden als neue Optionen (B, C, …) angelegt.
6. Bestehender Source-Filter-Tab „Restaurant" im CourseSelector bleibt unverändert (für à-la-carte-Auswahl bei „Eigenes Menü").

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/MultiOffer/WizardConfigurator.tsx` (~20 Zeilen: MenuImporter im Header + Prop + ggf. Step-Skip für importierte Menüs)
- `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` (1 Zeile: Prop weiterreichen)

Keine DB-Migration. Keine Änderungen an `MenuImporter` selbst, an der Edge Function oder am `useMultiOfferState`-Hook (die `addImportedOptions`-Funktion existiert bereits aus dem letzten Fix).

