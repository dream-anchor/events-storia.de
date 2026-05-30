## Ziel

Pro Anfrage einmal die **Kundensprache** wählen. Ab diesem Moment ist die komplette Außenkommunikation in dieser Sprache:
- Public-Offer-Seite (alle Buttons, Sektionen, Hinweise, Bestätigungsdialog, PDF-Download)
- Anschreiben & E-Mail an den Kunden
- Bestätigungs- und Zahlungsmails

**Bilingual-Regel neu:**
- DE → nur Deutsch
- EN → nur Englisch
- IT / FR → Zielsprache + Englisch als Zweitsprache (zwei Blöcke wie heute DE+EN)

Die bestehende globale Memory-Regel „alle Kundenmails bilingual DE+EN" wird ersetzt.

## 1. Datenmodell

Neues Feld `customer_language` (`'de'|'en'|'it'|'fr'`, Default `'de'`) auf `event_inquiries`. Spiegel-Update durch bestehende Trigger nach `v2_events.customer_language` (falls dort verfügbar — sonst nur Inquiry-Feld).

Migration enthält außerdem Backfill = `'de'` für alle Bestand-Anfragen.

## 2. Admin-UI: Sprachwähler

Im Inquiry-Editor (`/admin/inquiries/:id/edit`) ein kompakter Sprach-Selector neben dem Kontakt-Block:

```text
Sprache an Kunden: [DE ▾]   (DE · EN · IT · FR)
```

- Speichert sofort `customer_language` auf der Inquiry (mutation).
- Sichtbares Banner-Hinweis: „Alle E-Mails und der Angebotslink werden in **Deutsch** verschickt."
- Wechsel zeigt sofort Vorschau-Aktualisierung in der Live-PDF/Mail-Vorschau.

## 3. Public Offer — Sprache aus Datensatz

Aktuell zieht `PublicOffer.tsx` die Sprache aus `?lang=` Query-Param. Neu:

1. Beim Laden des Angebots `customer_language` vom Server mitgeben (`get_public_offer` JSON erweitern).
2. Default `lang = customer_language`. `?lang=` bleibt als Override (für Vorschau).
3. Der vom Admin geteilte Link enthält **keinen** `?lang`-Suffix mehr — Sprache ist im Datensatz.

## 4. i18n-Ausbau Public Offer (alle Strings)

`src/pages/public-offer/i18n.ts` (`OFFER_UI`) wird vom Mini-Set zur vollständigen Map ausgebaut. Alle 4 Sprachen.

Betroffene Komponenten (hartcodierte Strings → `tOffer(lang, key)`):

- `PublicOffer.tsx` (Header, Sektions-Überschriften, Statustexte, Toasts)
- `OfferHeader.tsx`
- `HeroSection.tsx`
- `AnschreibenSection.tsx`
- `ProposalView.tsx` (Optionen, „Weiter mit Option …", Hinweise, Menü-Auswahl-Texte)
- `FinalOfferView.tsx` (Bestätigung, „Jetzt verbindlich bestätigen" etc.)
- `ContactSection.tsx`, `PaymentSection.tsx`, `PdfDownloadSection.tsx`
- `OrderConfirmationDialog.tsx`, `ConfirmationView.tsx`, `ThankYouView.tsx`
- `RestaurantGallery.tsx` (bereits angebunden, nur Keys ergänzen)

Schlüssel werden gruppiert: `cta.*`, `section.*`, `dialog.*`, `status.*`, `error.*`, `pdf.*`, `payment.*`.

Übersetzungen werden manuell für DE/EN gepflegt; IT/FR werden mit einem einmaligen AI-Übersetzungs-Sweep (Lovable AI Gateway) vorgeneriert und im Code abgelegt — keine Laufzeit-Übersetzung der UI.

## 5. Anschreiben & dynamische Inhalte

- `translate-offer-letter` Edge Function bleibt — wird jetzt automatisch in `customer_language` getriggert.
- Menü-Übersetzungen (`pickLang`) funktionieren bereits für `_en/_it/_fr` — bleibt.

## 6. E-Mail-Versand (neue Sprachregel)

Betroffen: `send-offer-email`, `send-customer-response-copy`, `send-menu-confirmation`, `send-payment-email`, `send-payment-confirmation-v2`, `send-cancellation-notification`.

Neuer Helper `supabase/functions/_shared/customer-language.ts`:
- Eingabe: `customer_language`
- Ausgabe: `{ primary: Lang, secondary: 'en' | null }`
  - `de` → `{ primary: 'de', secondary: null }`
  - `en` → `{ primary: 'en', secondary: null }`
  - `it` → `{ primary: 'it', secondary: 'en' }`
  - `fr` → `{ primary: 'fr', secondary: 'en' }`

Alle Mail-Templates rendern jetzt Primary-Block (immer), Separator, Secondary-Block (nur wenn vorhanden). Subject-Zeile in Primärsprache (bei IT/FR mit EN-Klammer-Suffix).

Memory-Update: bestehende Regel `bilingual-customer-emails` wird durch neue Regel ersetzt:
> Sprache pro Anfrage: DE/EN einsprachig in der Kundensprache. IT/FR + EN-Zweitsprache. PDF und Public Offer immer in `customer_language`.

## 7. PDF

`download-public-offer-pdf` erhält `customer_language` und wählt Template-Sprache entsprechend. PDF-Texte werden über dieselbe i18n-Map gerendert (server-seitig dupliziert oder via REST aus Frontend-Strings — gleicher Source-of-Truth).

## 8. Tests / QA

- Anfrage auf EN setzen → Link öffnen ohne `?lang` → komplette Seite EN, „Confirm now" statt „Jetzt bestätigen".
- IT setzen → Angebotsmail kommt in IT, darunter EN-Block.
- DE bleibt unverändert für Bestandsanfragen (Default-Backfill).
- Bestehende `?lang=`-Vorschau-Links funktionieren weiter (Override).

## Technische Details

- Migration: `ALTER TABLE event_inquiries ADD COLUMN customer_language text NOT NULL DEFAULT 'de' CHECK (customer_language IN ('de','en','it','fr'));` + Spiegel auf `v2_events` falls Spalte fehlt, plus Update in `event_inquiries_insert_trigger`/`event_inquiries_update_trigger`.
- `get_public_offer` / `get_public_offer_by_slug`: JSON-Feld `customer_language` ergänzen.
- Frontend: `useUnifiedInquiries`, `useEventInquiries` Typen + Selector lesen Feld.
- Helper-Lib `src/lib/customerLanguage.ts` (Frontend) und `supabase/functions/_shared/customer-language.ts` (Backend) — eine Quelle für die Primary/Secondary-Regel.
- Memory aktualisieren: alte Regel ersetzen.

## Out of Scope

- Übersetzung interner Admin-UI (bleibt Deutsch).
- Mehrsprachige Posteingangs-Mails von Kunden (rein anzeige).
- Automatische Spracherkennung aus eingehenden Mails (kann Folge-Task werden).
