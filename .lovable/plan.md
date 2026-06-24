## Symptom
Nach erfolgreichem Login bleibt unter `/admin` dauerhaft der Maestro-Spinner stehen (`AdminLoader`), statt das Dashboard zu zeigen.

## Was bereits geprüft ist
- Mit injizierter Session lädt `/admin` im Headless-Browser sofort das Dashboard — Guard, Cache, Rolle und `RefineAdminApp` funktionieren grundsätzlich.
- Der Spinner kommt also nicht vom Dashboard selbst, sondern entsteht im engen Zeitfenster direkt nach `signInWithPassword`.

## Wahrscheinliche Ursache
Race zwischen drei parallelen Auth-Pfaden, die alle nach dem Login feuern und sich gegenseitig blockieren:

1. `useAdminAuth.signIn` ruft direkt nach `signInWithPassword` `loadAdminRole(user.id)` auf — bevor der Supabase-Client das neue Token an die PostgREST-Requests bindet. Resultat kann `null` sein → `signOut()` → Cache leer → Spinner / Bounce.
2. Parallel feuert `onAuthStateChange('SIGNED_IN')` in `useAdminAuth` UND in `AdminAuthGuard`. Beide setzen je einen `setTimeout(checkRole, 0)`, die `user_roles` zeitgleich abfragen.
3. `AdminAuthGuard.checkAuth()` startet zusätzlich beim Mount ein eigenes `getSession() + loadAdminRole`. Wenn `withTimeout` (8 s) auf eine dieser parallelen Queries trifft, bleibt `authState='loading'` → Spinner.

Der Netzwerk-Mitschnitt zeigt passend dazu eine Burst-Sequenz an `/auth/v1/user` direkt nach dem Login.

## Fix-Plan (klein, gezielt)

1. **`src/hooks/useAdminAuth.ts` — `signIn` deterministisch machen**
   - Nach `signInWithPassword` einmalig auf `INITIAL_SESSION`/`SIGNED_IN` warten (kurzer `Promise` mit Timeout-Fallback 500 ms), erst dann `loadAdminRole` aufrufen. Damit ist das JWT garantiert an PostgREST gebunden.
   - Bei erfolgreicher Rollenprüfung: Cache schreiben, `user/session/isAdmin` setzen, `loading=false`, return ohne Error.
   - Bei fehlender Rolle: explizit `clearCachedAdmin()` + `signOut()` + sprechender Fehler.

2. **`src/components/admin/AdminAuthGuard.tsx` — Cache zuerst, Netzwerk nur fallback**
   - Initial-Render: Wenn `getCachedAuth()` einen User hat, sofort `authState='authenticated'` (kein `loading`-State) und `verifyRole` nur im Hintergrund refreshen.
   - `checkAuth()` nur ausführen, wenn KEIN Cache vorhanden ist.
   - `onAuthStateChange`-Handler: `verifyRole` nur dispatchen, wenn `session.user.id` ≠ aktueller Cache-User.

3. **`src/providers/refine-auth-provider.ts` — Cache respektieren**
   - `check()`: Wenn Cache vorhanden ist, sofort `authenticated:true` zurückgeben und Session-Refresh nur asynchron prüfen (kein blockierender `getSession` mehr im Hot-Path).

4. **`src/pages/AdminLogin.tsx` — keine doppelte Navigation**
   - `useEffect`-Redirect entfernen, nur manueller `navigate('/admin', { replace:true })` in `handleSubmit` nach erfolgreichem `signIn`.
   - `AdminLoader` auf der Login-Seite mit `timeoutMs={0}` belassen.

5. **Diagnose-Logs (temporär, eine Iteration)**
   - In `AdminAuthGuard`, `useAdminAuth.signIn` und `loadAdminRole` je ein `console.info('[adminAuth] …')` mit Schritt + Dauer, damit beim nächsten Reproduzieren klar wird, an welcher Stelle der Spinner hängt. Nach erfolgreicher Verifikation wieder entfernen.

## Verifikation
- TypeScript-Check.
- Playwright-Skript: `/admin/login` → echtes `signInWithPassword` (Test-Credentials, falls vorhanden) → Screenshot nach 1 s und 4 s → erwarten: Dashboard sichtbar, keine `unauthenticated`-Navigation, Cache in `sessionStorage` gesetzt.
- Manueller Test durch dich im Browser.

## Nicht angefasst
- DB, RLS, Edge Functions, Customer-Auth, Backend-Migrationen.
- Kein Touch an `src/integrations/supabase/client.ts`, `types.ts`, `.env`.

## Offene Frage
Hast du beim Spinner mal in DevTools → Console nachgesehen, ob ein Fehler erscheint (z. B. `admin role check timeout`)? Falls ja, bitte den genauen Text — dann kann Schritt 5 entfallen.
