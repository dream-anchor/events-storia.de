## 1) Bild-Bug — rechtes Galerie-Bild wirkt kürzer

**Ursache:** Beide Quellbilder sind exakt 1536×1024 (3:2), genauso wie der Container `aspect-[3/2]` mit `object-cover`. Das rechte Bild (`storia-uebersicht-details.webp`) hat aber **am unteren Rand einen hellen Streifen mit den Caption-Labels**. Dadurch wirkt der Inhalt visuell kürzer, obwohl die Container exakt gleich hoch sind.

**Fix:** Das rechte Asset einmalig per `imagegen--edit_image` neu rendern — ohne den hellen Bottom-Streifen, sodass die Bildkomposition bis zum Rand reicht (oder alternativ: `object-cover` mit Skalierung 1.05 + `objectPosition: 'center 30%'` als CSS-only-Workaround). Bevorzugt Asset-Re-Crop, da das Ergebnis sauberer ist.

**Datei:** `src/assets/storia-uebersicht-details.webp` (überschreiben).

---

## 2) Sprachumschalter — komplette Seite übersetzen

Aktuell schaltet `lang` in `src/pages/PublicOffer.tsx` nur die Anzeige der DB-übersetzten Menü-/Getränke-Felder um. Hero-Texte, Section-Headlines, Buttons und das **Anschreiben** bleiben deutsch.

### 2a) Statische UI-Labels lokalisieren

Mini-Wörterbuch direkt in `PublicOffer.tsx` (oder `src/pages/public-offer/i18n.ts`):

```ts
export const OFFER_UI = {
  de: { language: 'Sprache', greeting_open: 'Liebe', ... },
  en: { language: 'Language', greeting_open: 'Dear', ... },
  it: { ... }, fr: { ... },
};
```

Per `lang` an alle Sub-Views (`HeroSection`, `AnschreibenSection`, `ProposalView`, `FinalOfferView`, `ConfirmationView`, `ThankYouView`, `PaymentSection`, `OrderConfirmationDialog`, `RestaurantGallery`, `OfferFooter`) durchreichen — die meisten bekommen `lang` schon, müssen aber Texte daraus ableiten statt hartzucodieren.

### 2b) Anschreiben (E-Mail-Body) via AI übersetzen + cachen

Anschreiben ist Freitext aus `inquiry.email_content`. Lösung analog zu `translate-menu-text`:

- **Neue Edge Function** `translate-offer-letter`: nimmt `inquiry_id`, `target_lang`, ruft Lovable AI Gateway (`google/gemini-3-flash-preview`), schreibt Ergebnis in neue Spalte `inquiry.email_content_translations jsonb` (`{ en: "...", it: "...", fr: "..." }`).
- **Migration:** `ALTER TABLE inquiry ADD COLUMN email_content_translations jsonb`. Beim Versand der Übersetzung gehen automatisch alle 3 Sprachen einmalig durch (lazy/on-demand beim ersten Klick auf Sprache reicht ebenfalls).
- **Frontend:** `AnschreibenSection` empfängt `lang` + `translations`. Wenn `lang !== 'de'` und `translations[lang]` existiert → anzeigen. Sonst → on-demand-Fetch über `supabase.functions.invoke('translate-offer-letter', { inquiry_id, target_lang })`, Spinner zeigen, danach rendern.
- Bei Archiv-Snapshots (`isArchive`): Übersetzung ebenfalls aus dem Snapshot lesen, **nicht** neu generieren (Immutability).

### 2c) Switcher immer sichtbar

`OfferLanguageSwitcher` zeigt sich aktuell nur bei vorhandenen Menü-Übersetzungen (`hasTranslations`). Diese Bedingung entfernen — der Toggle soll auch bei reinen Text-Angeboten funktionieren.

---

## Technische Details

**Geänderte/neue Dateien:**
- `src/assets/storia-uebersicht-details.webp` — neu gerendert ohne hellen Footer
- `src/pages/public-offer/i18n.ts` — neue UI-Strings für de/en/it/fr
- `src/pages/PublicOffer.tsx` — `OfferLanguageSwitcher` immer rendern, `lang` an alle Subviews durchreichen, `translations` an `AnschreibenSection`
- `src/pages/public-offer/AnschreibenSection.tsx` — `lang` + `translations` Props, on-demand Fetch
- `src/pages/public-offer/HeroSection.tsx`, `ProposalView.tsx`, `FinalOfferView.tsx`, `ConfirmationView.tsx`, `ThankYouView.tsx`, `PaymentSection.tsx`, `OrderConfirmationDialog.tsx`, `ContactSection.tsx`, `PdfDownloadSection.tsx`, `RestaurantGallery.tsx` — Texte über `OFFER_UI[lang]`
- `supabase/functions/translate-offer-letter/index.ts` — neu, analog zu `translate-menu-text`
- Migration: `email_content_translations jsonb` auf `inquiry`

**Out of Scope:** Übersetzung von dynamischen Restaurant-Adressen, Footer-Legal-Links und PDF-Download-Inhalten (PDF bleibt Deutsch — separate Aufgabe).
