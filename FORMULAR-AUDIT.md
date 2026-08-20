# Formular-Audit: MAESTRO-Migration

Stand: 2026-08-19 · Scope: `events-storia.de` + `ristorantestoria.de`

## Management Summary

- **MAESTRO ist in keinem der beiden Repos produktiv im Einsatz.**
- **events-storia.de:** `data-maestro-widget` kommt im gesamten Repository **kein einziges Mal** vor. Alle Kundenformulare sind native React-Formulare (react-hook-form + Zod) gegen Supabase Edge Functions, ohne Widget-Layer, ohne Fallback-Pfad. "Maestro" existiert hier nur als Name eines internen Backend-Systems für Zahlungs-/Buchungsabwicklung (`maestroHandoff.ts`), nicht als Frontend-Widget.
- **ristorantestoria.de:** `data-maestro-widget` kommt genau **einmal** vor — auf einer internen, nicht verlinkten, `noindex`-Testseite (`/test`). Kein produktives Formular ist umgestellt. Keine Fallback-Logik vorhanden.
- Folgeprobleme, die vor einer echten MAESTRO-Migration bereinigt werden sollten: ein toter Formular-Rest (`EventInquiryForm.tsx` in ristorantestoria.de), ein Architektur-Bruch bei den Event-Anfrage-Endpunkten (`GroupInquiryForm` ruft fremde Function direkt/client-seitig statt über die lokale Proxy-Function), sowie eine "Kontakt"-Seite in beiden Projekten, die trotz ihres Namens kein Anfrageformular einbindet.

---

## events-storia.de

**MAESTRO-Status Repo-weit:** nicht vorhanden (0 Treffer für `data-maestro-widget`).

| Komponente / Seite | Verwendung | Darstellungsart | Aktueller Zustand | Layout-Status |
|---|---|---|---|---|
| `EventContactForm` ([src/components/events/EventContactForm.tsx](src/components/events/EventContactForm.tsx)) | `EventsImStoria.tsx` (`/catering/events-im-storia`), Section `#kontaktformular` | Inline | Natives `<form>`, react-hook-form + Zod, Submit via `supabase.functions.invoke('receive-event-inquiry')` | Sauber in `max-w-2xl mx-auto` gewrappt — kein Problem |
| `EventPackageInquiryDialog` ([src/components/events/EventPackageInquiryDialog.tsx](src/components/events/EventPackageInquiryDialog.tsx)) | Button "Angebot erhalten" auf `EventPackageShopCard` | **Popup/Modal** (Radix Dialog) | Kein `<form>`-Tag — 2-Schritt-Flow per `useState` + Zod, Submit via `onClick` → `receive-event-inquiry` | Modal selbst begrenzt (`sm:max-w-lg max-h-[90vh]`); fehlende Formular-Semantik (kein Enter-to-Submit) ist ein UX-, kein Layout-Problem |
| `Checkout` ([src/pages/Checkout.tsx](src/pages/Checkout.tsx)) | Route `/checkout` | Inline, ganze Seite | Natives `<form id="checkout-form">`, Honeypot gegen Spam | Kein Problem |
| `Gutschein` ([src/pages/Gutschein.tsx](src/pages/Gutschein.tsx)) | Route `/gutschein` | Inline, ganze Seite | Natives `<form>`, reiner `useState` | Kein Problem |
| `OrderConfirmationDialog` ([src/pages/public-offer/OrderConfirmationDialog.tsx](src/pages/public-offer/OrderConfirmationDialog.tsx)) | Buchungsbestätigung nach Angebotsannahme (`PublicOffer.tsx`) | **Popup/Modal** (Radix Dialog) | **Kein `<form>`-Tag** — Inputs direkt im `DialogContent`, Submit via `onClick` → `confirm-order` | Funktional ok, aber unsauber als "Formular ohne Form-Tag" (kein Enter-Submit) |
| `Kontakt`-Seite ([src/pages/Kontakt.tsx](src/pages/Kontakt.tsx)) | Route `/kontakt`, `/en/contact` | Inline, ganze Seite | **Kein Formular** — nur `tel:`/`mailto:`-Links, Google-Maps-Embed, FAQ | Auffällig: Seite heißt "Kontakt", bietet aber keine Anfragemöglichkeit; das eigentliche Formular liegt separat unter `/catering/events-im-storia` |
| `ContactSection` ([src/pages/public-offer/ContactSection.tsx](src/pages/public-offer/ContactSection.tsx)) | Angebotsseite (`PublicOffer.tsx`) | Inline | Kein Formular, nur `tel:`/`mailto:`-Buttons | Bewusst simpel, kein Problem |
| `CustomerAuth` (Login/Register) | Kundenkonto-Route | Inline, 2 Formulare auf einer Seite | Native `<form>`-Tags | Kein Problem |
| `AdminLogin`, `PasswordReset`, `OrderSuccess`, `CreateManualInvoiceDialog` (admin), diverse Admin-Dialoge (`InquiryEditor/*`) | Admin-Bereich | Inline / Modal | Native `<form>`-Tags bzw. Dialoge | Admin-only, kein Kunden-/MAESTRO-Kontext, nicht im Detail geprüft |

---

## ristorantestoria.de

**MAESTRO-Status Repo-weit:** 1 Treffer, ausschließlich auf interner Testseite.

| Komponente / Seite | Verwendung | Darstellungsart | Aktueller Zustand | Layout-Status |
|---|---|---|---|---|
| `TestWidget` ([src/pages/TestWidget.tsx](src/pages/TestWidget.tsx)) | Route `/test` — nicht verlinkt, `noIndex` | Inline, eigene Card-Sektion | **MAESTRO aktiv:** `data-maestro-widget="b61887bf-7f94-4e2c-a4cb-0615c7aa20e5"`, `data-maestro-api="https://storia.schrittmacher.ai"`, Script async nachgeladen | Sauber gebaut mit Status-Anzeige (idle/loading/loaded/error) — reine Testseite, kein Kunden-Traffic |
| `GroupInquiryForm` ([src/components/GroupInquiryForm.tsx](src/components/GroupInquiryForm.tsx)) | Nur `ReisegruppenPage.tsx` | Inline (Container `max-w-3xl`, Formular selbst ohne eigene Breitenbeschränkung) | Natives `<form>`, react-hook-form + Zod, Honeypot + Timing-Check. Submit via **direktem `fetch()`** an fest kodierte Fremd-URL `.../receive-group-inquiry` (Projekt `sovlfqncotxcjqseeawp`) | **Architektur-Inkonsistenz statt Layout-Problem:** bypasst den lokalen Supabase-Client/CORS-Schutz, anderer Endpunkt-Name als die übrigen Formulare — vor MAESTRO-Migration klären, ob `receive-group-inquiry` noch bedient wird |
| `FilmfestInquiryForm` ([src/components/FilmfestInquiryForm.tsx](src/components/FilmfestInquiryForm.tsx)) | Nur `FilmfestMuenchen.tsx`, Section `#kontakt` | Inline, eigenes Custom-CSS-Grid (`.ff-form`), kein Tailwind | Natives `<form>`, react-hook-form + Zod, Submit via `supabase.functions.invoke('submit-event-inquiry')` → `receive-event-inquiry` | Sauber im Grid eingebettet, kein Problem |
| `EventInquiryForm` ([src/components/EventInquiryForm.tsx](src/components/EventInquiryForm.tsx)) | **Nirgends importiert — toter Code** | — | Voll funktionsfähiges natives `<form>` (281 Zeilen, eigene i18n-Keys), gleiche Ziel-Function wie `FilmfestInquiryForm` | **Verwaister Formular-Rest** — sollte vor MAESTRO-Migration gelöscht oder reaktiviert werden; vermutlich Vorgänger von `GroupInquiryForm`/`FilmfestInquiryForm` |
| `SeasonalSignupForm` ([src/components/SeasonalSignupForm.tsx](src/components/SeasonalSignupForm.tsx)) | `BesondererAnlass.tsx`, `SilvesterMuenchen.tsx`, `ValentinstagMuenchen.tsx`, `WeihnachtenMuenchen.tsx` | Inline | Natives `<form>`, react-hook-form + Zod, `supabase.functions.invoke('subscribe-seasonal')` (Double-Opt-In) | Kein Problem |
| `ReservationBooking` ([src/components/ReservationBooking.tsx](src/components/ReservationBooking.tsx)) | `Reservierung.tsx`, `WmPublicViewingMuenchen.tsx`, `OktoberfestMuenchen.tsx` | Inline, `max-w-2xl` Card | Kein echtes Formular — Date/Time/Guests-Picker (React State), leitet zu OpenTable weiter | Kein Problem |
| `ReservationCTA` / `InlineReservationCTA` | Diverse Seiten (Kontakt, Speisekarte, SEO-Landingpages etc.) | Inline-Banner/-Leiste | Kein Formular — nur Links (`/reservierung`, WhatsApp) | Kein Problem |
| `Kontakt`-Seite ([src/pages/Kontakt.tsx](src/pages/Kontakt.tsx)) | Route `/kontakt` | Ganze Seite | **Kein Formular** — Tel/Mail/WhatsApp-Links, Maps-Embed, `<ReservationCTA />` | Bewusst formularfrei |
| `AdminLogin`, `AdminResetPassword` | `/admin/login`, `/admin/reset-password` | Ganze Seite | Native `<form>`, Supabase Auth | Admin-only, kein MAESTRO-Kandidat |
| Radix Dialog/Sheet-Nutzung (`PhotoGallery`, `ImageLightbox`, `Navigation`, Admin-Manager) | Diverse | Popup/Modal/Sheet | Ausschließlich für Bild-Lightbox, Mobile-Nav und Admin-Backend — **kein Kontakt-/Anfrage-Formular läuft als Modal** | — |

---

## Offene Punkte für die MAESTRO-Migration

1. **Ausgangsbasis klären:** Da MAESTRO in beiden Repos faktisch noch nicht produktiv ist, betrifft die "Migration" primär eine Neu-Einführung, nicht eine Ablösung bestehender Widgets — die Formulierung "läuft hier ein Fallback" trifft aktuell auf keine Komponente zu.
2. **Toten Code entfernen:** `EventInquiryForm.tsx` (ristorantestoria.de) vor der Migration löschen oder klären, warum er nicht mehr eingebunden ist.
3. **Endpunkt-Inkonsistenz bereinigen:** `GroupInquiryForm` auf denselben Proxy-Weg (`submit-event-inquiry`) wie `FilmfestInquiryForm` umstellen, bevor MAESTRO als einheitliche Schicht darüber gelegt wird.
4. **"Kontakt"-Seiten:** In beiden Projekten heißt eine Seite "Kontakt", bietet aber kein Anfrageformular — falls MAESTRO dort ein Widget bekommen soll, ist das der naheliegende erste Einsatzort.
5. **Redundanz:** ristorantestoria.de hat vier unabhängige native Formular-Implementierungen mit je eigenem Zod-Schema — potenzieller Kandidat für Konsolidierung im Zuge der MAESTRO-Einführung.
