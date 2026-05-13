## Ziel

Drei Verbesserungen am Offer-/Menu-Builder unter `/admin/inquiries`:

1. Änderungen im Builder müssen **sofort** im Druck-/PDF-Preview erscheinen.
2. Gang-Bezeichnungen (z.B. „🍽️ Antipasto") **inline editierbar** machen — Label und Icon änderbar.
3. **Equipment & Personal** im OptionCard nach oben (direkt unter dem Essen, vor der Preisaufstellung) verschieben, damit klar ist, dass sie in die Gesamtsumme einfließen.

Plus: Den Button **„Angebot PDF"** überall im Admin entfernen.

---

## 1. Live-Sync Builder ↔ Druck/PDF

### Problem
`useOfferBuilder` speichert via Debounce (Timeout in `saveTimeoutRef`). Wenn man direkt nach einer Änderung auf **Drucken** klickt, lädt `PrintPreviewDialog` über `fetchPrintInquiries` die noch nicht gespeicherte alte DB-Version.

### Lösung
- In `PrintMenu.tsx` vor dem Öffnen des Dialogs ein globales Flush-Event auslösen (z.B. `window.dispatchEvent(new CustomEvent('lovable:flush-saves'))`) und kurz `await` auf die Promise warten.
- In `useOfferBuilder.ts` einen `useEffect` registrieren, der auf `lovable:flush-saves` lauscht und `flushSave()` synchron ausführt; `flushSave` gibt Promise zurück.
- Alternative (sauberer): Einen kleinen Save-Coordinator (`src/lib/saveCoordinator.ts`) bauen, mit `register(flush)` / `flushAll()`. PrintMenu ruft `await flushAll()` vor `setOpen(true)`.

### Bonus: PDF-Vorschau im Builder bereits live
`MultiOffer/LivePDFPreview.tsx` reagiert bereits auf `options`-Änderungen via `useMemo` — hier nichts zu tun.

---

## 2. Inline-editierbare Gang-Bezeichnungen

Datei: `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx`

Aktuell ist `course.courseLabel` ein nicht-klickbarer `<span>` (Zeile 147–153). `COURSE_ICONS` mappt `courseType → Emoji`.

### Änderungen
- Icon-`<span>` (Zeile 147) wird ein **Popover-Trigger**: zeigt eine kleine Auswahl aller Gang-Typen (`COURSE_ICONS`-Keys: Antipasto, Pasta, Main, Dessert, …) mit Icon + Default-Label. Klick → setzt `courseType` UND `courseLabel` neu (über `onUpdateCourse(idx, { courseType, courseLabel })`).
- Label-`<span>` (Zeile 152) wird klickbar → öffnet ein kleines `Input`-Popover (oder switch zu inline `Input` analog dem bestehenden `editingName`-Pattern für `itemName`). Speichert in `courseLabel`.
- `onUpdateCourse`-Signatur unterstützt das bereits (`Partial<CourseSelection>`). `courseLabel` ist bereits Teil des Snapshots.
- Mobile: gleiche Popover funktionieren auch im `MobileCourseSheet` — dort identisches Pattern hinzufügen.

### Persistenz
`courseLabel` und `courseType` sind bereits in `CourseSelection` und werden von `useOfferBuilder` mitgespeichert — keine DB-Migration nötig. PDF/Print liest aus `menu_selection.courses` → übernimmt geänderte Bezeichnung automatisch.

---

## 3. Equipment & Personal vor PriceBreakdown

Datei: `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx`

Aktuelle Reihenfolge (Zeilen ~419–493):
```
Menu/Paket-Content (Gänge)
PriceBreakdown
Equipment + Personal (InlineServiceEditor)
```

### Änderung
JSX-Blöcke umordnen:
```
Menu/Paket-Content (Gänge)
Equipment + Personal (InlineServiceEditor)   ← hochgezogen
PriceBreakdown                                ← danach
```

`PriceBreakdown` erhält `equipment` und `staff` bereits als Props (Zeile 472–473) und summiert sie in die Gesamtsumme — Logik bleibt unberührt.

Visuelles Subheading (klein, muted) für die Service-Sektion: „Equipment & Personal — fließen in die Gesamtsumme ein", damit die neue Hierarchie selbsterklärend ist.

---

## 4. Button „Angebot PDF" entfernen

Treffer im Code:

- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` Zeilen 807–825: Der konditionale Header-Button, der je nach `lexofficeDocType` „Rechnung PDF" oder **„Angebot PDF"** rendert. → Button entfernen, aber `handleDownloadDocument` für Rechnungen anderswo erhalten lassen (oder den Button auf `lexofficeDocType === 'invoice'` einschränken, falls die Rechnungs-Variante bleiben soll).
- `src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx` Zeile 292: Hinweistext „…kann über den 'Angebot PDF'-Button im Editor abgerufen werden." → Satz entfernen/umformulieren, da der Button weg ist.

**Klärung benötigt** (siehe unten): Soll auch die Rechnungs-Variante (`Rechnung PDF`) weg? Aktuell ist es ein einziger Button, der je nach Doc-Typ umlabelt.

---

## Technische Details

- Keine DB-Migration nötig — alle Felder sind im JSONB `menu_selection` bereits enthalten.
- Kein neuer Edge-Function-Code; PDF-Generatoren (`KitchenSheet`, `ServiceSheet`, `FullOrderSheet`, `download-public-offer-pdf`) lesen aus `menu_selection.courses` / `.equipment` / `.staff` und übernehmen geänderte Labels automatisch.
- `ReturnType<typeof setTimeout>` Pattern beibehalten (Memory).

---

## Offene Frage

Der einzige „Angebot PDF"-Button im Admin ist eigentlich ein Doppel-Button: er heißt **„Angebot PDF"** für offene Angebote und **„Rechnung PDF"** sobald eine Rechnung verknüpft ist. Soll der Button komplett weg (auch die Rechnungs-Variante), oder nur die Angebots-Variante?
