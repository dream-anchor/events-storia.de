# Plan: KI-Kontext + KI-Vorschlag für **alle** Anfragen (Event + Catering)

## Was sich ändert

Der `RequestContextBanner` ist aktuell nur im Event-Flow (`OfferBuilder`) und nur dann sichtbar, wenn die Anfrage Quelle / Paket / Anlass / Nachricht hat. Das wird auf zwei Ebenen erweitert:

1. **Banner immer zeigen** — auch bei leerer Anfrage, damit der KI-Button immer erreichbar ist.
2. **Catering-Flow** bekommt denselben Banner + KI-Vorschlag (an die Catering-Cart-Mechanik angepasst).

## Verhalten

### Event-Anfragen (unverändert + Banner-Sichtbarkeit)
- Banner erscheint immer über dem Optionen-Grid (auch ohne Quelle/Anlass/Nachricht).
- "3 Menü-Varianten mit KI" → unverändert: Low/Medium/High in die nächsten freien Optionen A–E.
- Bereits funktionierende Quellen: Funnel (`funnel_*`), Paket-Anfrage (`package_inquiry_<uuid>`), `selected_packages`, Kontaktformular, E-Mail (inbound + Forward), Manuell, Telefon, Website.

### Catering-Anfragen (neu)
- Derselbe `RequestContextBanner` wird oberhalb der `CateringModules` gerendert.
- Da Catering einen **einzelnen Cart** (`quoteItems`) statt 5 Optionen hat, passt Low/Medium/High dort nicht 1:1. Lösung:
  - Button-Label im Catering-Modus: **"Cart mit KI befüllen"** (statt "3 Varianten")
  - KI generiert genau **eine** Empfehlung (Medium-Tier-Logik), passend zu Anlass/Tonfall/Ortsbezug, ausschließlich aus `menu_items` (Pakete passen nicht ins Catering-Cart-Modell).
  - Wenn der Cart bereits Items enthält → Bestätigungs-Toast (kein blockierender Dialog): „Cart wird mit KI-Vorschlag erweitert" → Items werden additiv via `onItemAdd` hinzugefügt (Duplikate erhöhen die Quantity über `onItemQuantityChange`).
  - Bei leerem Cart → direkt befüllen.

### "Als Paket übernehmen"-Button im Catering
- Wenn die Catering-Anfrage aus einer Paket-Anfrage stammt, zeigt der Banner das Paket informativ an. Der "Als Option A übernehmen"-Button entfällt im Catering-Kontext (keine Optionen).

## Technische Umsetzung

**`RequestContextBanner.tsx`**
- `hasAnyContext` Gate entfernen → Banner rendert immer.
- Wenn keine `source`/`event_type`/`message`/`packageName` vorhanden: kompaktes Layout ("Keine Vor-Information aus der Anfrage" als Placeholder), KI-Button bleibt sichtbar.
- Neues Prop `mode?: "event" | "catering"` (default `"event"`). Im `catering`-Mode:
  - Button-Label = "Cart mit KI befüllen"
  - Hilfstext angepasst
  - `onApplyPackageToOptionA` wird nicht gerendert (irrelevant)

**`SmartInquiryEditor.tsx`**
- Im `inquiryType !== 'event'`-Branch: `RequestContextBanner` oberhalb von `<CateringModules>` einfügen, mit `mode="catering"` und neuem Handler `handleGenerateCateringSuggestion`.

**`SmartInquiryEditor.tsx` – `handleGenerateCateringSuggestion`**
- Ruft dieselbe Edge Function `generate-menu-suggestion` auf, aber mit neuem Flag `{ inquiryId, target: "catering" }`.
- Edge Function liefert bei `target="catering"` **nur eine Variante (tier="medium", mode="menu")** statt 3.
- Handler iteriert über `suggestion.variants[0].courses[*].items` und ruft pro Item `handleItemAdd(item)` auf; bestehende Items werden via `onItemQuantityChange` um +1 erhöht (Standard-Behaviour des Carts).
- Toast: `overallReasoning` + Anzahl hinzugefügter Items.

**Edge Function `generate-menu-suggestion`**
- Akzeptiert optional `target: "event" | "catering"` (default `"event"`).
- Bei `target="catering"`:
  - System-Prompt-Append: „Liefere genau EINE Variante (tier=medium, mode=menu). Pakete sind nicht erlaubt. Wähle 6–12 Catering-Items, die zum Anlass und zur Gästezahl passen."
  - Validierung: `variants.length === 1`, `mode === "menu"`.
- Bei `target="event"` (default): bisheriges Verhalten unverändert (3 Varianten Low/Medium/High, Paket oder Menu).

## Nicht angefasst
- `useOfferBuilder`, `OptionCardGrid`, `OptionCard`, Catering-Cart-Mechanik (`QuoteItem`, `handleItemAdd`), `EmailComposer`, `generate-inquiry-email`, DB-Schema, `config.toml`.
