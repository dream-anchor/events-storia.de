# Migration `/admin/events` → `/admin/inquiries`

## Ziel
`/admin/inquiries` (Live-URL, im Menü verlinkt) zeigt künftig die neue Ansicht (aktuell unter `/admin/events`). Alle Subseiten (Edit, Preview, Archive, Create) ziehen mit unter `/admin/inquiries/...`. Alte `/admin/events/...`-URLs leiten sauber weiter, damit Bookmarks, Notification-Links und E-Mail-Links nicht brechen.

## Was passiert konkret

### 1. Routen umstellen (`src/pages/RefineAdmin.tsx`)
- `<Route path="inquiries">` wird zur neuen Hauptroute mit allen Subrouten:
  ```
  /admin/inquiries                      → EventsList (neu)
  /admin/inquiries/create               → AdminOfferCreate
  /admin/inquiries/:id/edit             → SmartInquiryEditor
  /admin/inquiries/:id/preview          → OfferSendPreview
  /admin/inquiries/:id/archive/:version → OfferArchivePreview
  ```
- Alter `<Route path="events">`-Block wird ersetzt durch **Redirects**:
  ```
  /admin/events                      → /admin/inquiries
  /admin/events/create               → /admin/inquiries/create
  /admin/events/:id/edit             → /admin/inquiries/:id/edit
  /admin/events/:id/preview          → /admin/inquiries/:id/preview
  /admin/events/:id/archive/:version → /admin/inquiries/:id/archive/:version
  ```
- `UnifiedInquiriesList` wird nicht mehr eingebunden (Datei bleibt zunächst liegen, kann später entfernt werden).
- Refine-`resources`-Array: `events` raus, `inquiries` bekommt `edit/show`-Pfade.

### 2. Interne Links umstellen (alle `/admin/events` → `/admin/inquiries`)
Betroffene Dateien (alle gefunden, ~20 Stellen):

**Hooks & Daten:**
- `src/hooks/useUpcomingReminders.ts` (3×)
- `src/hooks/useNotifications.ts` (4×)
- `src/hooks/useDashboardData.ts` (4×)
- `src/lib/dashboardPriority.ts` (1×)

**Admin-UI:**
- `src/components/admin/refine/EventsList.tsx` (2×)
- `src/components/admin/refine/KanbanView.tsx` (1×)
- `src/components/admin/refine/UnifiedKanbanView.tsx` (1×)
- `src/components/admin/refine/ContextBar.tsx` (Default-`backPath`)
- `src/components/admin/refine/AdminLayout.tsx` (3×: Pfad-Check + 2× Create-Button)
- `src/components/admin/refine/FloatingPillNav.tsx` (5×: Nav-Items mobile + desktop)
- `src/components/admin/refine/CommandPalette.tsx` (4×)
- `src/components/admin/refine/TasksWidget.tsx` (1×)
- `src/components/admin/refine/EventEdit.tsx` (2×)
- `src/components/admin/refine/OfferCreate/index.tsx` (2×)
- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (3×)
- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` (2×)
- `src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx` (3×)
- `src/components/admin/refine/InquiryEditor/OfferBuilder/SendControls.tsx` (1×)
- `src/components/admin/refine/InquiryEditor/OfferHistoryList.tsx` (1×)
- `src/pages/admin/Posteingang.tsx` (1×)

Ersatz: schlichtes Find-and-Replace auf `/admin/events` → `/admin/inquiries`. Kommentare in Dateien werden mit angepasst.

### 3. Was nicht angefasst wird
- Datenbank, Edge Functions, E-Mail-Templates: brauchen keine Änderung (alte E-Mail-Links bleiben dank Redirects funktional).
- `UnifiedInquiriesList.tsx`-Datei bleibt im Code (ungenutzt) — kann in einem Folge-Cleanup gelöscht werden, sobald die neue Ansicht live verifiziert ist.

## Risiko & Rollback
- Niedriges Risiko: Redirects fangen alle Alt-URLs ab; Refine-Resource-Routen werden konsistent umgehängt.
- Rollback = Routenblock in `RefineAdmin.tsx` zurücktauschen + Find-and-Replace umkehren.

## Verifikation nach Deploy
1. Live `/admin/inquiries` zeigt neue Ansicht (Spalten Neu / In Bearbeitung / Angebot verschickt / Gebucht).
2. Alter Bookmark `/admin/events` → leitet auf `/admin/inquiries`.
3. Notification-Link `/admin/events/:id/edit` → leitet auf `/admin/inquiries/:id/edit`.
4. "Zurück zur Liste" landet auf `/admin/inquiries`.
