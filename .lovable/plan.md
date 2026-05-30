# Sprachwechsel-Dialog mit Re-Übersetzung

Wenn `customer_language` im Header des `SmartInquiryEditor` geändert wird, öffnet sich ein Bestätigungs-Dialog, der den Nutzer fragt, **welche Inhalte mit-übersetzt werden sollen**. Bereits versendete E-Mails sind explizit ausgeschlossen (immutability). Außerdem werden die 3 Folgeverbesserungen umgesetzt.

## Verhalten beim Sprachwechsel

1. User wählt neue Sprache im Header-Dropdown.
2. Statt sofortiger Übernahme: **Dialog öffnet sich** (`AlertDialog`) mit:
   - Überschrift: „Sprache wechseln auf 🇮🇹 Italienisch?"
   - Hinweis: „Bereits versendete E-Mails und Angebotsversionen bleiben unverändert (immutable)."
   - **Checkbox-Liste** der re-übersetzbaren Inhalte (alle default an, nur sichtbar wenn vorhanden):
     - ☑ Anschreiben / Cover Letter (Draft-Version)
     - ☑ AI-Kundennachricht / Kontext
     - ☑ Menünamen & Beschreibungen (aktuelle Auswahl)
     - ☑ Paket-Beschreibung (falls offer_mode = paket)
   - Buttons: **„Nur Sprache wechseln"** (kein Re-Translate) · **„Sprache wechseln & übersetzen"**
3. Nach Bestätigung:
   - `customer_language` wird gespeichert.
   - Ausgewählte Felder werden parallel via bestehende Edge-Functions (`translate-offer-letter`, `translate-menu-text`, `translate-package-menu`) neu übersetzt.
   - Progress-Toast: „Übersetze 3 Inhalte…" → Success-Toast pro Item.
4. Aktivitätslog-Eintrag: „Kundensprache von DE auf IT geändert. Re-übersetzt: Anschreiben, Menü."

## Zusätzliche Verbesserungen (1–3)

### 1. Auto-Re-Translation
Bereits durch den Dialog oben abgedeckt (statt stiller Auto-Translation: explizite Auswahl mit Default „alles an").

### 2. Visueller Hinweis-Banner im Editor
Im `SmartInquiryEditor` oberhalb des Anschreiben/Menü-Bereichs:
- Erkennung: wenn `customer_language` ≠ `last_translated_language` (neues Feld auf der Draft-Version oder lokaler State pro Feld).
- Banner (gelb-neutral, monochrom konform): „⚠️ Anschreiben ist noch auf **DE** – aktuelle Kundensprache ist **IT**." mit Button **„Jetzt übersetzen"** (öffnet denselben Re-Translate-Flow, vorausgewählt nur das betreffende Feld).
- Pro Feld ein eigener kleiner Indikator (Sprach-Badge neben dem Feldtitel).

### 3. Live-Preview Refresh des Angebotslinks
- Falls eine `OfferPreview`-Iframe / Vorschau im Editor sichtbar ist: nach erfolgreichem Sprachwechsel + Re-Translate automatisch `iframe.src` neu setzen (mit `?lang=...&t=Date.now()` Cache-Bust).
- Toast: „Vorschau aktualisiert."

## Technische Umsetzung

**Neue Komponente:** `src/components/admin/refine/InquiryEditor/LanguageSwitchDialog.tsx`
- Props: `currentLang`, `targetLang`, `availableFields: { coverLetter, customerMessage, menu, package }`, `onConfirm(selected, translate: boolean)`, `onCancel`.

**Edit:** `SmartInquiryEditor.tsx`
- Header-Select: `onValueChange` öffnet jetzt Dialog statt direkt `handleLocalFieldChange`.
- Nach Dialog-Confirm: speichert Sprache, ruft parallel Translate-Functions, invalidiert Refine-Query.
- Banner-Logik oberhalb der Editor-Tabs.

**Edit:** `OfferSendPreview.tsx` (oder wo Preview-Iframe lebt)
- Reagiert auf Sprachwechsel-Event → iframe reload.

**Optionales DB-Feld:** `event_inquiries.last_translated_language` (TEXT) – für Banner-Erkennung. Migration mit GRANT.

**Edge-Functions (bestehend, kein Neuschrieb):**
- `translate-offer-letter` für Anschreiben
- `translate-menu-text` für Menünamen
- `translate-package-menu` für Paket-Beschreibung
- AI-Kundennachricht: vorhandener Generator mit neuer Sprache

## Ausgeschlossen (bewusst)
- Versendete E-Mail-Historie wird nicht angefasst.
- Versendete Offer-Versionen bleiben unverändert; nur die aktuelle Draft.
- LexOffice-Rechnungen unverändert.

## Aufwand
~4 Dateien neu/edit, 1 optionale Migration, ca. 250 Zeilen Frontend + Wiring zu existierenden Translate-Functions.
