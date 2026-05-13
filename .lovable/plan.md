## 1) Maestro Smartphone „schwarze Seite" – Ursache & Fix

### Diagnose
- Tailwind nutzt `darkMode: ["class"]`, eine `.dark`-Klasse wird im Code aber **nirgends** auf `<html>` gesetzt.
- Trotzdem enthalten viele Admin-Komponenten `dark:bg-gray-900` / `dark:bg-neutral-900` Varianten (z. B. `AdminLayout`, `DataTable`, `SmartInquiryEditor`, `InquiryDetailsPanel`, `MultiOfferComposer`, `PaymentCard`, `OfferHistoryList`, `ContextBar` …).
- `color-scheme: light !important` ist nur innerhalb `.admin-layout` gesetzt — auf `<html>`/`<body>` nicht. iOS Safari mit System-Dark-Mode interpretiert dadurch native UI-Flächen (Form-Controls, Scroll-Hintergrund, „bounce area", Status-Bar-Einfärbung) dunkel und manche Bereiche/Modale (Mobile-Sidebar, Toaster-Overlay) erscheinen schwarz.
- Memory-Regel: **Strict Light-Mode**. Dark-Varianten dürfen also gar nicht greifen.

### Fix
1. **Globaler Light-Mode-Lock** in `src/index.css`:
   - `html, body { color-scheme: light !important; background-color: hsl(var(--background)); }`
   - Optional `<meta name="color-scheme" content="light">` und `<meta name="theme-color" content="#f6f7f8">` in `index.html`, damit iOS Status-Bar/Bounce hell bleibt.
2. **Tailwind-Dark-Hook neutralisieren**: in `tailwind.config.ts` `darkMode` auf `["class", ".__never__"]` setzen, sodass `dark:`-Utilities zur Laufzeit nie matchen (kein Refactor aller Komponenten nötig). Die existierenden `dark:`-Klassen bleiben als historischer Code erhalten, sind aber wirkungslos.
3. **AdminLayout konkret aufräumen** (Sicherheitsnetz):
   - `src/components/admin/refine/AdminLayout.tsx` Zeilen 133, 244, 277: `dark:bg-[#1a2632]` / `dark:bg-[#101922]` entfernen.
   - Mobile Sidebar Overlay (`bg-black/50`) bleibt — ist nur das Backdrop, korrekt.

### Validierung
- Browser-Tool mit Viewport 390×844 auf `/admin` und `/admin/inquiries/.../preview` öffnen, Light-Mode-Rendering prüfen, Sidebar öffnen/schließen.

---

## 2) Public Offer: PDF-Download dezent unter dem Menü

### Aktuell
`src/pages/PublicOffer.tsx` rendert `<PdfDownloadSection />` ganz am Ende (nach `<ContactSection />`, Zeile 505). Dadurch übersieht man den Link.

### Fix
- `<PdfDownloadSection />` direkt **unter den Menü-/Angebot-Block** verschieben, also nach `ProposalView` / `FinalOfferView` / `ConfirmationView`, **vor** `PublicPaymentSection` und `ContactSection`.
- Styling bleibt unverändert (kleiner Text-Link, `text-sm text-muted-foreground`, `underline-offset-2`).
- Innerhalb der `PdfDownloadSection`: `flex justify-end` → `flex justify-center` (oder `justify-start`) damit der Link mittig direkt unter dem Menü sichtbar wird, statt rechts in der Footer-Zone zu verschwinden.

### Technische Details
```text
<main>
  HeroSection
  RestaurantGallery
  OfferLanguageSwitcher
  AnschreibenSection
  ProposalView | FinalOfferView | ConfirmationView   ← Menü/Angebot
  PdfDownloadSection                                  ← NEU hier
  PublicPaymentSection
  ContactSection
</main>
```

Keine Änderungen an Edge Functions, Datenbank oder Business-Logik.
