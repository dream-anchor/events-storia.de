## Problem

Bei drei Paket-Varianten als Optionen werden in der Lex-Office-Quotation aktuell alle drei aufaddiert (z. B. 3 × 1.000 € = 3.000 €). Korrekt wäre: Eine Hauptposition + zwei **Alternativpositionen**, sodass die Summe nur die gewählte Variante enthält.

## Lösung: Lexware-API „Alternativposition"

Die Public-API unterstützt das in der Web-UI bekannte „OR"-Konzept direkt:

- `subItems[]` mit `alternative: true` → Alternativposition unter einer Hauptposition; nicht in Gesamtsumme
- `optional: true` auf Top-Level → optionale Position, nicht in Gesamtsumme

Quelle: `developers.lexware.io/docs/#quotations-endpoint-quotations-properties` — `alternative` ist „currently only valid for subitems, and mandatory to be true in that case". Wichtig: Pursue Angebot → Rechnung wird mit 406 abgelehnt, solange alternative/optionale Items enthalten sind. Daher wird die Branch-Logik nur dann eingesetzt, wenn der Kunde noch nicht gewählt hat.

## Mapping

```text
LineItem A (parent, top-level)        ← Variante A („Paket A: Gesamte Location")
  └─ subItem B (alternative: true)    ← Variante B
  └─ subItem C (alternative: true)    ← Variante C
```

Pro Variante eine **konsolidierte** Position (Name = Paketname, Description = Aufschlüsselung der Detail-Items als Text, Preis = `total_amount` brutto). Detail-Items wandern in `description`, nicht als Top-Level-Zeilen.

## Branch-Logik in `create-event-quotation/index.ts`

```text
options = aktive inquiry_offer_options (sort_order)

if useSelectedQuantity OR forceDocumentType in {'invoice','order'}:
  → Kunde hat gewählt: nur Optionen mit selected_quantity > 0
  → KEINE alternative/optional Flags (bisheriges Verhalten, Pursue funktioniert)
else if options.length === 1:
  → bisheriges Verhalten
else:
  → options[0]   = parent line item (mit subItems[])
  → options[1..] = subItems mit alternative:true
```

## Konsolidierte Variant-Position

```ts
function buildVariantLineItem(opt, packageName, guestOverride): LineItem {
  const detailItems = buildLineItems(opt, packageName, guestOverride);
  const description = detailItems
    .map(i => `- ${i.name}: ${formatEUR(i.unitPrice.grossAmount * i.quantity)}`)
    .join('\n');
  const total = round2(detailItems.reduce(
    (s, i) => s + i.unitPrice.grossAmount * i.quantity, 0));

  // Steuersatz aus den Detail-Items ableiten (nicht hardcoden):
  // - Wenn alle Detail-Items denselben Satz haben → diesen verwenden
  // - Wenn gemischt → gewichteter Durchschnitt → auf nächsten gültigen
  //   Lex-Satz mappen (7 oder 19); fällt der Mix wirklich dazwischen,
  //   wird der dominierende Satz (höchster brutto-Anteil) gewählt.
  // Fallback (keine Detail-Items): 7 % (Catering-Standard).
  const taxRate = deriveTaxRate(detailItems);

  return {
    type: 'custom',
    name: packageName || labelForMode(opt.offer_mode),
    description,
    quantity: 1,
    unitName: 'Pauschale',
    unitPrice: { currency: 'EUR', grossAmount: total, taxRatePercentage: taxRate },
  };
}

function deriveTaxRate(items: LineItem[]): 7 | 19 {
  if (items.length === 0) return 7;
  const rates = new Set(items.map(i => i.unitPrice.taxRatePercentage));
  if (rates.size === 1) return [...rates][0] as 7 | 19;
  // gemischt: dominierender Satz nach Brutto-Anteil
  const sumByRate: Record<number, number> = {};
  for (const i of items) {
    const r = i.unitPrice.taxRatePercentage;
    sumByRate[r] = (sumByRate[r] || 0) + i.unitPrice.grossAmount * i.quantity;
  }
  return (sumByRate[19] || 0) > (sumByRate[7] || 0) ? 19 : 7;
}
```

Hinweis: Eine korrektere Lösung wäre, die Variante in **zwei** parent-LineItems zu splitten (Speisen 7 % + Getränke 19 %) und beide als gemeinsamen Block zu behandeln. Da die Lex-API `alternative` aber nur auf Sub-Item-Ebene erlaubt und ein Parent immer **eine** Position ist, bleibt die dominierende Steuer-Heuristik der pragmatische Weg. Der Brutto-Gesamtbetrag ist exakt korrekt; nur der MwSt-Ausweis im PDF kann bei stark gemischten Varianten leicht abweichen.

## Geänderte Dateien (beide!)

### 1. `supabase/functions/create-event-quotation/index.ts`
- Neue Funktionen `buildVariantLineItem` und `deriveTaxRate`.
- Branch in der lineItems-Schleife (≈ Zeile 622–632): Bei `> 1` aktiven Optionen ohne Kundenauswahl `parent.subItems` mit `alternative: true` füllen.

### 2. `supabase/functions/repair-quotation-pricing/index.ts` — **Pflicht, identische Änderung**
- Dieselbe `buildVariantLineItem` + `deriveTaxRate` einbauen.
- Dieselbe Multi-Option-Branch in der lineItems-Schleife (≈ Zeile 250–260).
- Da das Repair-Skript die Quotation komplett neu erstellt, muss es die neue Branch ebenfalls beherrschen — sonst erzeugt der nächste Repair-Run wieder die fehlerhafte 3.000-€-Summe.

Keine Änderungen an DB-Schema, UI/Maestro oder Public-Offer-Flow.

## Smoke-Test

1. Anfrage mit 3 aktiven Optionen (A: 1.000 €, B: 400 €, C: 200 €) → „Angebot PDF" → Lex-Quotation: 1 Hauptposition (1.000 €) + 2 Alternativen, Gesamtsumme = 1.000 €.
2. Kunde wählt B → erneut „Angebot PDF" → klassisch eine Position (400 €), keine Alternativen, Pursue zu Rechnung möglich.
3. Single-Option-Anfrage → unverändert.
4. Multi-Option mit gemischter Variante (Speisen 7 % + Getränke 19 %) → Steuersatz folgt dem Brutto-dominierenden Satz, Gesamt-Brutto stimmt aufs Cent.
5. `repair-quotation-pricing` auf eine Multi-Option-Anfrage anwenden → produziert dieselbe Alternativ-Struktur wie `create-event-quotation`.

## Out-of-Scope (bewusst nicht enthalten)

- `is_recommended` / `primary_option_id` (eigenes UX-Thema).
- PDF-Layout-Tuning der Klammerpreise — erst nach echtem PDF-Test entscheiden.
- Pursue-Branch-Logik — bereits korrekt im Plan.
