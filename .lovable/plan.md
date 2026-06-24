## Problem

Beim Öffnen einer neuen Anfrage (z. B. Maximilian Walter) im Angebots­editor sieht der Betreiber zwar Kontaktdaten und die Originalnachricht im `InquiryDetailsPanel`, aber **nicht auf einen Blick, was der Kunde konkret angefragt hat** (ein bestimmtes Paket? Ein Funnel-Pfad? Allgemeine Kontaktanfrage?). Der Menüwizard / die Optionskarten (A–E) starten leer — der Betreiber muss raten oder hochscrollen.

Die Information liegt bereits in der DB:
- `v2_events.source` z. B. `package_inquiry_<packageId>`, `contact_form`, `funnel`, `manual_entry`, `email`, `phone`, `email_forward`
- `v2_events.event_type` (Anlass-Label vom Funnel/Dialog)
- `v2_events.selected_packages` (Array von Package-IDs, falls vorausgewählt)
- `v2_events.message` (Originalnachricht)

## Lösung

Neuer **„Anfrage-Kontext"-Banner** direkt im `OfferBuilder.tsx`, **oberhalb des `OptionCardGrid`** (= Menüwizard / A–E-Karten), unterhalb der bestehenden Versions-Info.

### Inhalt des Banners

Kompakte, monochrome Card im Premium-UI-2026-Stil (rounded-2xl, neutral, kein Grün/Gelb), z. B.:

```text
┌──────────────────────────────────────────────────────────────┐
│  Was hat der Kunde angefragt?                                │
│                                                              │
│  Quelle:    Paket-Anfrage (Website)                          │
│  Paket:     Business Dinner   [Als Option A übernehmen]      │
│  Anlass:    Firmenfeier                                      │
│                                                              │
│  „Wir wären 25 Personen, Termin ca. Mitte März…" ▸ mehr      │
└──────────────────────────────────────────────────────────────┘
```

- **Quelle**: gemappt von `inquiry.source` über dieselbe Logik wie `getSourceLabel` in `supabase/functions/receive-event-inquiry/index.ts` (im Frontend dupliziert in `src/lib/inquirySource.ts`):
  - `package_inquiry_<uuid>` → „Paket-Anfrage (Website)" + Paketname-Lookup
  - `contact_form` → „Kontaktformular"
  - `funnel` / `funnel_*` → „Anfrage-Funnel"
  - `manual_entry` → „Manuell erfasst"
  - `email` / `email_forward` → „E-Mail-Weiterleitung"
  - `phone` → „Telefonisch"
  - Fallback: humanisiert
- **Paket** (nur wenn vorhanden): aufgelöst aus
  1. `source = package_inquiry_<id>` → `packages.find(p => p.id === id)`, sonst
  2. `inquiry.selected_packages[0]` → Lookup,
  
  inkl. kleinem Outline-Button **„Als Option A übernehmen"**, der `builder.updateOption('A', { packageId, mode: 'package' })` auslöst (analog zur bestehenden Option-Mutation). Nur sichtbar, solange Option A leer ist und das Angebot nicht gesperrt ist (`!isSignatureLocked && !inquiry.offer_sent_at`).
- **Anlass**: `inquiry.event_type` (Badge).
- **Nachricht**: erste ~140 Zeichen aus `inquiry.message`, „▸ mehr"-Toggle expandiert auf volle Höhe (whitespace-pre-wrap). Falls leer: Hinweis „Keine Nachricht — direkt aus dem Funnel/Dialog".

### Edge Cases

- Banner wird **immer** gerendert, wenn mindestens eines der Felder (Quelle, Paket, Nachricht, Anlass) Inhalt liefert. Andernfalls (z. B. komplett manuell angelegt ohne Daten): kein Banner.
- Wenn das Paket aus `source` und `selected_packages` differiert, wird beides angezeigt („Angefragt: X / Vorausgewählt: Y").
- Banner ist rein informativ — verändert keine DB-Werte außer durch den expliziten „Übernehmen"-Button.

## Technische Details

**Neue Datei**
- `src/components/admin/refine/InquiryEditor/OfferBuilder/RequestContextBanner.tsx`
  - Props: `inquiry: ExtendedInquiry`, `packages: Package[]`, `onApplyPackageToOptionA?: (packageId: string) => void`, `disabled?: boolean`
  - Reine Präsentations­komponente + ein optionaler Click-Callback.

**Neue Datei**
- `src/lib/inquirySource.ts`
  - `parseInquirySource(source: string | null): { label: string; packageIdFromSource: string | null }`

**Geändert**
- `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx`
  - Import + Render von `<RequestContextBanner …/>` direkt nach den Versions-Info-Blöcken und vor `OptionCardGrid` (Zeile ~382).
  - Handler `handleApplyPackageToOptionA(packageId)`: ruft `builder.updateOption('A', { mode: 'package', packageId })` (Pattern identisch zu bestehenden Mutationen in `OptionCardGrid`). Falls Option A nicht leer ist, wird der Button gar nicht angezeigt — kein Konflikt.

**Nicht angefasst**
- `InquiryDetailsPanel.tsx` bleibt unverändert (oben in der Editor-Seite, anderer Kontext).
- Keine DB-Migration, keine Edge-Function-Änderung, keine neuen Felder. Reine Frontend-/Presentation-Änderung.

## Akzeptanz

- Bei Anfrage „Maximilian Walter" (oder jeder neuen Anfrage) erscheint im OfferBuilder oberhalb der A–E-Karten ein klar sichtbarer Block mit Quelle, ggf. Paketname und Originalnachricht.
- Bei Paket-Anfragen kann der Betreiber per Klick das angefragte Paket direkt in Option A übernehmen.
- Banner verschwindet sauber, wenn keine Quell-Info vorliegt; bricht keinen anderen Flow (Send, Versions­historie, Signature-Lock).
