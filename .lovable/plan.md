## Problem

`/admin/fotos` rendert eine eigenständige Seite mit eigenem `<header>` und ohne Admin-Navigation. Dadurch fehlt die Sidebar/Topnav/Menü des restlichen Admin-Bereichs.

## Lösung

`src/pages/admin/Fotoalbum.tsx` so umbauen, dass der Inhalt in `AdminLayout` gewrappt wird – analog zu Dashboard und anderen Admin-Seiten.

### Änderungen in `src/pages/admin/Fotoalbum.tsx`

- Import `AdminLayout` aus `@/components/admin/refine/AdminLayout`.
- Den äußeren `<div className="min-h-screen bg-background">` plus eigener `<header>` entfernen.
- Den Seiteninhalt (Dropzone, Filter, Gallery, Lightbox) als `children` in `<AdminLayout activeTab="fotos" title="Fotoalbum">` setzen.
- Subtitle/Hinweistext ("Zentrale Bildbibliothek …") als kleinen Text über der Dropzone behalten.
- Edit-Dialog bleibt unverändert.

Keine Logik-, Daten- oder Routing-Änderungen. Reine UI-Integration in das bestehende Admin-Shell.
