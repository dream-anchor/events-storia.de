## Ziel
Den Admin-Login so umbauen, dass eine erfolgreiche Anmeldung nicht mehr zurück auf `/admin/login` springt und keine konkurrierenden Auth-Prüfungen den Zustand überschreiben.

## Feststellung
- Die Anmeldung im Backend funktioniert: der Benutzer `info@ristorantestoria.de` hat die Rolle `admin`.
- Die `user_roles`-Policies erlauben dem Benutzer, die eigene Rolle zu lesen.
- Das Problem sitzt im Frontend-Auth-Flow: `AdminLogin`, `useAdminAuth`, `AdminAuthGuard` und Refine `authProvider.check()` prüfen parallel Session/Rolle und können kurzzeitig `unauthenticated` liefern. Refine leitet dann wieder auf `/admin/login` um.

## Umsetzungsplan
1. **Eine zentrale Admin-Auth-Utility einführen**
   - Gemeinsame Funktionen für Session lesen, Rollen laden, Cache setzen/löschen und Timeouts.
   - Kein doppelter Rollen-Code mehr in Guard, Hook und Refine-Provider.

2. **Login-Flow atomar machen**
   - Nach `signInWithPassword` die zurückgegebene Session/User-ID direkt verwenden.
   - Rolle direkt danach prüfen und cachen.
   - Erst nach erfolgreicher Rollenprüfung nach `/admin` navigieren.
   - Wenn keine Admin-/Staff-Rolle vorhanden ist: sauber abmelden und deutsche Fehlermeldung zeigen.

3. **AdminAuthGuard robust machen**
   - Beim ersten Laden zuerst lokalen Session-Zustand abwarten.
   - Während der Rollenprüfung niemals auf `unauthenticated` springen, solange eine Session vorhanden ist.
   - `SIGNED_OUT` nur dann als Logout behandeln, wenn danach wirklich keine Session mehr vorhanden ist, um Refresh-Races abzufangen.

4. **Refine AuthProvider entschärfen**
   - `check()` verwendet dieselbe zentrale Prüfung.
   - Bei temporären Timeout-/Netzwerkproblemen nicht sofort hart auf Login umleiten, wenn eine gecachte Admin-Rolle zur aktuellen Session passt.
   - `getPermissions()` und `getIdentity()` verwenden denselben Cache/Session-Pfad.

5. **Login-Seite vereinfachen**
   - Keine zweite konkurrierende Auto-Weiterleitung aus `useEffect`, die gegen Guard/Refine laufen kann.
   - Nach erfolgreichem Login `navigate('/admin', { replace: true })`, damit der Login nicht in der History bleibt.

6. **Verifikation**
   - TypeScript-Check ausführen.
   - Per Browser-Test mit vorhandener Preview-Session `/admin/login → Login → /admin` und Reload auf `/admin` prüfen.
   - Falls weiterhin ein Redirect passiert, gezielte Debug-Logs nur für Admin-Auth ergänzen und anhand der Live-Konsole finalisieren.

## Betroffene Dateien
- `src/lib/adminAuth.ts` neu
- `src/components/admin/AdminAuthGuard.tsx`
- `src/hooks/useAdminAuth.ts`
- `src/providers/refine-auth-provider.ts`
- `src/pages/AdminLogin.tsx`

## Nicht Teil des Fixes
- Keine Datenbankmigration.
- Keine Änderungen an Rollen/Policies.
- Keine Änderungen an Customer-Login oder öffentlichen Seiten.