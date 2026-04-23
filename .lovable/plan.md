

# Mobile UX Audit 2026 — Maestro Admin & Public Offer

## TL;DR — Ehrliche Einschätzung

**Public Offer (Kundensicht)**: ~85% State-of-the-Art. Premium, ruhig, gut typografiert. Kleine Schwachstellen bei mobiler Stickyness und Tap-Targets.

**Admin OfferBuilder auf Handy (Screenshot)**: ~55%. Sieht hübsch aus, ist aber für ernsthafte mobile Bedienung **nicht** state-of-the-art. Konkrete Painpoints:

1. **3-Spalten-Zeile pro Gang** (Drag-Handle · Icon · Name | Select „A./P./D." | Preis | Trash) bei 414 px Breite → Select-Trigger nur ~50 px breit, zeigt nur „A.", „P." statt „Antipasto". Preis-Inputs sind leer/dünn, schwer tappbar. **Anti-Pattern für Mobile.**
2. **Floating „+" Button unten rechts** — widerspricht Memory-Regel *„No floating buttons. Use inline bottom-left aligned primary actions."* Außerdem überlappt er den Eingabe-Bereich.
3. **`MobileBottomBar` und `ScrollableTabs` existieren** im Codebase, sind aber im OfferBuilder/SmartInquiryEditor **nicht eingesetzt** — ungenutzte Infrastruktur.
4. **Kein Bottom-Sheet / Drawer** für Gang-Bearbeitung. 2026-Standard für mobile Editoren ist „Tap row → Sheet von unten mit großem Touch-UI".
5. **Tap-Targets unter 44 px** (Trash-Icons in den Zeilen, Drag-Handle).
6. **Header redundant**: Avatar + Name + Status + 3 Chips + Karten-Header + Mode-Select = ~250 px nur für Kontext, bevor man irgendetwas bearbeiten kann.
7. **Keine Haptics, keine Swipe-Actions, keine Sticky-Save-Bar** auf Mobile.

**Public Offer mobil**: Sehr ordentlich, aber:
- Kein Sticky-Buchen-CTA am unteren Rand → User scrollt durch lange Page und verliert die primäre Aktion.
- Optionen-Karten (A/B) stapeln sich vertikal ohne Snap-Carousel → man scrollt viel, vergleicht schlecht.
- Email-Copy-Input (`max-w-sm`) bleibt auf Mobile unnötig klein.

---

## Plan: 3 Wellen, klar priorisiert

### Welle 1 — High-Impact Mobile-Quick-Wins (½ Tag)

**1.1 Sticky Buchen-CTA auf Public Offer (Mobile)**
- Neuer `MobileStickyBookingBar` unter `<ProposalView>` — fixed bottom, sicher-area-aware, ab 414px sichtbar, ab `lg:` versteckt.
- Zeigt: Gewählter Optionsname + Total + Primary-CTA „Jetzt buchen". Bei fehlender Auswahl: Disabled mit Hinweis „Bitte Option wählen".
- Auto-versteckt im Archiv-/Preview-Modus mit Hinweis.

**1.2 Floating „+" Button im OfferBuilder entfernen**
- Memory-Verstoß beheben. Inline bottom-left „+ Option hinzufügen" bleibt (existiert bereits in `OptionCardGrid`).
- Wenn der Floating-Button Teil von `FloatingActionBar` ist und ohne Selection sichtbar → conditional render fixen.

**1.3 Tap-Targets ≥ 44×44 px im OptionCard**
- Trash, Drag-Handle, Eye-Toggle, Copy-Button auf min. 44×44 erweitern (mit `before:` pseudo-target).

**1.4 Mobile-Layout für Gang-Zeile umbauen**
- < `sm:` (640): Zeile wird **2-zeilig** statt 4-spaltig.
  - Zeile 1: Drag-Handle · Icon · Voller Gang-Name (kein Truncate auf „A.") · Trash
  - Zeile 2: Dish-Picker (full-width) · Preis-Input (kompakt rechts)
- ≥ `sm:`: Aktuelles Grid-Layout bleibt.
- Select-Trigger zeigt **vollständigen Namen** ("Antipasto", "Pasta", "Dessert"), nicht abgekürzt.

---

### Welle 2 — 2026-Standard-Patterns (1 Tag)

**2.1 Bottom-Sheet für Gang-Bearbeitung (Mobile)**
- Bei < `md:` öffnet ein Tap auf eine Gang-Zeile ein `Drawer` (vaul) von unten mit:
  - Großem Dish-Picker (full-screen Suche)
  - Preis-Input (großes numerisches Tastatur-Layout via `inputMode="decimal"`)
  - Mengen-Stepper bei `per_event`-Mode
  - Speichern-Button als Sticky-Footer im Sheet
- Desktop bleibt Inline-Editor.

**2.2 Snap-Carousel für Multi-Option im Public Offer (Mobile)**
- Bei 2–3 Optionen auf Mobile: horizontaler Snap-Carousel statt Stack.
- Pagination-Dots + „Option A · B · C" Pill-Tabs oben (nutzt vorhandenes `ScrollableTabs`).
- Vergleich erleichtert durch Wischgeste — moderner Standard (siehe Stripe-Pricing, Apple).

**2.3 `MobileBottomBar` im SmartInquiryEditor aktivieren**
- Primäre Actions („Senden", „Speichern-Status", „Neue Version") wandern auf Mobile in die `MobileBottomBar` statt in den Header.
- Header wird auf Mobile schlanker: nur Back · Initialen · Name · Status-Chip.
- Chips (Firma · Datum · Gäste) werden auf Mobile in horizontale `ScrollableTabs` umgelegt (1 Zeile, swipebar).

**2.4 Haptisches Feedback (iOS/Android)**
- `navigator.vibrate(10)` bei Speichern, Optionswahl, Gang-Hinzufügen.
- Optional: Web-Animations API für leichte Scale-Animation auf Tap.

---

### Welle 3 — Premium-Polish (½ Tag)

**3.1 Skeleton-Loaders statt `Loader2`-Spinner**
- OfferBuilder-Loading: animierte Card-Skeletons (Layout-stabil, kein Jump nach Hydration).

**3.2 PullToRefresh im SmartInquiryEditor (Mobile)**
- Bei Scroll-oben + Pull → Refetch der Inquiry. Subtile Spinner-Animation.

**3.3 Keyboard-Aware Input-Resizing**
- Beim Fokus auf Preis-/Mengen-Input scrollt der Sheet/Editor automatisch über die Tastatur (`scrollIntoView` + `visualViewport` API).

**3.4 Public Offer: Sticky-Section-Indicator**
- Auf Mobile dünne sticky Top-Bar (3 px) mit Progress-Indicator: „Schritt 2 von 3 — Auswahl treffen".

---

## Was nicht angefasst wird

- Visuelles Theme (monochrom, Inter, rounded-2xl) bleibt.
- Datenmodell, RLS, Edge Functions: keine Änderungen.
- Desktop-Layouts bleiben unverändert (alle Änderungen sind `lg:`-gated).

---

## Geänderte Dateien (Zusammenfassung)

| Datei | Welle | Kernaufgabe |
|---|---|---|
| `src/pages/PublicOffer.tsx` | 1, 2, 3 | Sticky-Buchen-Bar, Snap-Carousel, Progress-Bar |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx` | 1 | Tap-Targets, Mobile-Header schlanker |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx` | 1, 2 | 2-zeiliges Mobile-Layout, Bottom-Sheet-Trigger |
| `src/components/admin/refine/InquiryEditor/OfferBuilder/MobileCourseSheet.tsx` | 2 | **Neu** — Bottom-Sheet für Gang-Edit |
| `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` | 2 | `MobileBottomBar` + `ScrollableTabs` integrieren |
| `src/components/admin/motion/FloatingActionBar.tsx` o.ä. | 1 | Floating-„+" entfernen / conditional |

---

## Erwartetes Ergebnis

Nach allen drei Wellen erreicht das Tool **2026-Standard** vergleichbar mit Linear, Notion Mobile, Stripe Dashboard Mobile, Cal.com:
- Vollständig daumen-bedienbar
- Bottom-Sheets statt mikroskopischer Inline-Inputs
- Sticky primäre Aktionen
- Swipe-Vergleich für Multi-Option-Angebote
- Konsistente 44px-Touch-Targets, haptisches Feedback

**Empfehlung**: Mit **Welle 1** starten (höchster ROI, ½ Tag), danach Welle 2 als zweiten Sprint. Welle 3 ist Polish und kann parallel laufen.

