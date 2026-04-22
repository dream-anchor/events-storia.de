

# Restaurant-Komplett-Menüs (Mittag/Abend) im Wizard wieder verfügbar machen

## Befund

Es existieren **zwei** Restaurant-Datenquellen:

1. **`useRistoranteMenus` / `useCombinedMenuItems`** — liefert **einzelne Speisen** (à-la-carte). Das ist, was aktuell im Wizard `CourseSelector` unter „Restaurant" gezeigt wird.
2. **`useRistoranteCompleteMenus`** (Edge Function `fetch-ristorante-complete-menus`) — liefert die **kuratierten Komplett-Menüs**:
   - **Mittag**: 3-Gänge-Menü-Pakete + Kursauswahl pro Gang
   - **Abend**: Degustationsmenüs mit optionaler Weinbegleitung + à-la-carte-Kategorien

Die Komponente, die diese Komplett-Menüs als ganze Optionen importiert, heißt **`MenuImporter.tsx`** (in `OfferBuilder/`). Sie ist **nur im alten OfferBuilder** (`OptionCardGrid.tsx`) eingebunden — im neuen Wizard (`MultiOffer/WizardConfigurator.tsx`) fehlt sie. Das ist die Regression.

## Lösung

Den `MenuImporter`-Button in den `MultiOffer`-Workflow integrieren — auf der **Optionen-Übersichts-Ebene**, nicht im Wizard-Inneren. Logik: Admin klickt „Restaurant-Menü importieren" → wählt Mittag-Menü(s) oder Abend-Tasting-Menü(s) aus → für jede Auswahl wird **automatisch eine neue Option** angelegt (mit korrektem Namen, Preis, Menü-Selection als Custom-Items, Weinbegleitung optional).

### Umsetzung in 2 Schritten

**Schritt 1 — `MultiOfferComposer.tsx` (Übersichtsseite)**

Den `MenuImporter`-Button neben „Neue Option hinzufügen" platzieren. `onImportMultiple`-Callback der `MenuImporter`-API nutzen:

```ts
import { MenuImporter } from "../OfferBuilder/MenuImporter";
import type { OfferBuilderOption } from "../OfferBuilder/types";

// Innerhalb MultiOfferComposer:
<MenuImporter
  guestCount={inquiry.guest_count_int ?? 10}
  currentOptionCount={state.options.length}
  onImportMultiple={(importedOptions) => {
    // importedOptions: OfferBuilderOption[] aus MenuImporter
    importedOptions.forEach((imp) => {
      addOption({
        optionLabel: nextLabel(),
        packageId: null,                  // Restaurant-Menü = kein Paket
        packageName: imp.title,           // z.B. "Mittagsmenü 3 Gänge"
        guestCount: imp.guestCount,
        totalAmount: imp.totalAmount,
        menuSelection: imp.menuSelection, // Courses als Custom-Items
      });
    });
  }}
  disabled={state.options.length >= 5}
/>
```

**Schritt 2 — Mapping `OfferBuilderOption` → `OfferOption` (MultiOffer-Format)**

Die zwei Typen unterscheiden sich leicht. Eine kleine Adapter-Funktion in `useMultiOfferState.ts`:

```ts
function mapImportedToMultiOfferOption(imp: OfferBuilderOption): OfferOption {
  return {
    id: crypto.randomUUID(),
    optionLabel: imp.optionLabel,
    packageId: null,
    packageName: imp.title || imp.packageName,
    guestCount: imp.guestCount,
    totalAmount: imp.totalAmount,
    menuSelection: {
      courses: imp.menuSelection?.courses?.map(c => ({
        courseType: c.courseType,
        courseLabel: c.courseLabel,
        itemId: null,
        itemName: c.itemName,
        itemDescription: c.itemDescription || null,
        itemSource: 'manual',
        isCustom: true,
        overridePrice: c.overridePrice ?? null,
        quantity: c.quantity ?? 1,
      })) ?? [],
      drinks: imp.menuSelection?.drinks ?? [],
    },
  };
}
```

### Verifikation

1. Build grün.
2. Im Wizard-Übersicht erscheint Button „🍴 Restaurant-Menü importieren".
3. Klick → Sheet öffnet sich → zeigt **Mittagsmenü** (3-Gänge-Paket + alternative Gänge) und **Degustationsmenüs** mit Weinbegleitung.
4. Auswahl + Bestätigen → 1-N neue Optionen erscheinen in der Übersicht mit Namen wie „Degustationsmenü 5 Gänge" und korrektem Preis.
5. Optionen lassen sich speichern (View-Trigger funktionieren bereits, Bug 1 gefixt).
6. Public Offer zeigt die importierten Menüs korrekt an.

## Geänderte Dateien

- `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` (+10 Zeilen: MenuImporter einbinden)
- `src/components/admin/refine/InquiryEditor/MultiOffer/useMultiOfferState.ts` (+15 Zeilen: `addImportedOptions(...)` + Mapper)

**Nicht geändert**: `MenuImporter.tsx` selbst, die Edge Function `fetch-ristorante-complete-menus`, `useRistoranteCompleteMenus`. Die existierende, funktionierende Pipeline wird wiederverwendet.

Keine DB-Migration. Keine RLS-Änderung. Reine Frontend-Reparatur, die eine bestehende, getestete Komponente in den neuen Wizard-Flow re-integriert.

