## Plan – Reisegruppen-Pakete in events-storia.de spiegeln (Option A)

Die 3 Menüs sind bestätigt aus ristorantestoria.de/reisegruppen/ extrahiert. Wir spiegeln sie als native Pakete in unsere `packages` + `package_menu_items` + `package_drink_config`-Struktur. Damit funktionieren Maestro-Auto-Befüllung, Shop-Buchung, Lex-Sync und Pricing ohne Cross-DB-Aufrufe.

### 1. Seed-Migration: `packages` + zugehörige Configs

Drei neue Datensätze mit `package_type = 'reisegruppen'`:

| key | name | name_en | price | min_guests | max_guests | description | featured |
|---|---|---|---|---|---|---|---|
| `pizza-e-pasta` | Pizza e Pasta | Pizza & Pasta | 25 € p.P. | 20 | 100 | „Der schnelle Stopp – ideal für Busgruppen mit engem Zeitplan (45–60 Min.)" | nein |
| `benvenuti` | Benvenuti | Benvenuti | 45 € p.P. | 20 | 100 | „Klassisches 3-Gänge-Menü (75–90 Min.)" | **ja** (Beliebt) |
| `tradizione` | Tradizione | Tradizione | 67 € p.P. | 20 | 100 | „4-Gänge-Menü für Gruppen, die sich Zeit nehmen (90–120 Min.)" | nein |

Alle: `is_active = true`, `price_per_person = true`, `show_in_shop = true` (neues Flag, siehe unten), `package_type = 'reisegruppen'`.

`includes`-JSON pro Paket aus den extrahierten Bullet-Points.

### 2. `package_course_config` + `package_menu_items` (Maestro-Auto-Befüllung)

**Pizza e Pasta:**
- Course `main` „Hauptgang (Pizza ODER Pasta)" – Custom-Item-Liste:
  - Pizza Margherita / Diavola / Quattro Formaggi / Prosciutto e Funghi
  - Spaghetti Pomodoro / Penne all'Arrabbiata / Spaghetti Carbonara
- Course `starter` „Gemischter Blattsalat" (Custom)
- Course `dessert` „Espresso oder Gelato (1 Kugel)" (Custom)

**Benvenuti:**
- Course `starter` „Vorspeise zum Teilen": Caprese mit Büffel-Mozzarellina, Vitello Tonnato, Parmigiana-Auflauf, Steinofenbrot
- Course `main` „Hauptgang (Wahl)": Pizza Margherita/Salame Piccante, Penne all'Arrabbiata/Tagliatelle al Ragù, Risotto Edelpilze (glutenfrei)
- Course `dessert` „Kleines Tiramisu oder kleine Panna Cotta"

**Tradizione:**
- Course `starter` (Antipasto misto): Vitello Tonnato / Burrata + Steinofenbrot
- Course `pasta` (Primo): Tagliatelle al Ragù / Ravioli Ricotta+Steinpilze / Risotto Edelpilze
- Course `main` (Secondo): Dorade Royal / Saltimbocca alla Romana / Parmigiana di Melanzane (vegetarisch)
- Course `dessert`: Tiramisu / Panna Cotta / Cannoli Siciliani

Items werden als `package_menu_items` mit `is_custom = true` und `price = 0` (= „inkl.") angelegt – nutzt direkt das in Punkt 1 des Hauptplans definierte „Preis 0 = inkl."-Verhalten.

### 3. `package_drink_config`

**Pizza e Pasta:** Wasser 0,5 l + 1 Softdrink (`is_included`, kein Choice)
**Benvenuti:** 1× 0,1 l Hauswein ODER Helles ODER Softdrink (`is_choice`), + Wasser + Espresso (included)
**Tradizione:** ½ l Wein p.P. + Wasser + Espresso (included)

### 4. Schema-Erweiterung

Migration: `ALTER TABLE packages ADD COLUMN show_in_shop boolean NOT NULL DEFAULT false;`
Diese 3 Pakete bekommen `show_in_shop = true`. Bestehende Event-Pakete bleiben unverändert (default false → müssen wir bei Bedarf später aktivieren).

### 5. Maestro-Auto-Befüllung (OfferBuilder)

In `OptionCard.tsx` bei Paket-Auswahl: wenn `package_id` gesetzt → laden von `package_menu_items` + `package_drink_config` und Vorbelegung der `courses`/`drinks` im `OfferBuilder`-State mit `overridePrice: 0` („inkl.").

### 6. Shop-Integration

`useEventPackages` erweitern: zusätzlich `package_type = 'reisegruppen'` einbeziehen ODER neuer Hook `useReisegruppenPackages`. Auf der Events-Seite (`src/pages/Events*.tsx` bzw. `EventsImStoria.tsx`) eigene Sektion „Für Reisegruppen" mit `EventPackageShopCard` für die 3 Pakete.

Bilder: bestehende Assets wiederverwenden – `ravioliDinner` (Tradizione), `firmenfeier` (Benvenuti), `sommerfest` (Pizza e Pasta). Falls gewünscht, später dedizierte Bilder.

Buchungspfad identisch zu bestehenden Shop-Paketen → Cart → Checkout → `event_inquiries` mit `package_id` referenziert.

### 7. Reihenfolge der Umsetzung

```text
Schritt A: Migration "show_in_shop" + Seed der 3 packages
Schritt B: Seed package_course_config + package_menu_items
Schritt C: Seed package_drink_config
Schritt D: OfferBuilder Auto-Befüllung beim Paket-Wechsel
Schritt E: useEventPackages erweitern + EventsImStoria.tsx Sektion
Schritt F: QA – Maestro-Auswahl + Shop-Buchung Ende-zu-Ende
```

### 8. Bewusst nicht enthalten

- **Live-Sync mit ristorantestoria.de**: Wenn dort Inhalte geändert werden, müssen wir hier manuell nachpflegen. Falls später nötig: separater Sync-Job (eigener Plan).
- **Mehrsprachige Menüs (IT/FR)**: Wir spiegeln nur DE + EN. Das ristorantestoria-System hat 4 Sprachen, das ist hier nicht zwingend.
- **Reiseleiter/Busfahrer-Logik** („ab 25 Pers. isst Reiseleiter gratis"): kommt in einen separaten Folge-Task – würde hier den Scope sprengen.

### 9. Zu klären

Soll ich `show_in_shop` global einführen (auch für bestehende Event-Pakete optional aktivierbar), oder reicht ein einfaches Filter-Flag `package_type IN ('event','reisegruppen')` im Shop-Hook? Empfehlung: das neue Flag, weil es flexibler ist und unabhängig vom `package_type` greift.
