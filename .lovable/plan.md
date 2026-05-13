## Plan

### 1. Live vs. Lovable Preview (fehlende „Gebucht"-Spalte)

**Das ist kein Browser-Cache-Problem.**

`events-storia.de` wird **nicht** von Lovable gehostet. Die Live-Seite wird per GitHub Actions Workflow (`.github/workflows/deploy-ionos.yml`) per SFTP zu IONOS deployed — Trigger ist `push to main`. Die Lovable-Preview (`id-preview--…lovable.app`) zeigt dagegen sofort jede ungespeicherte Änderung.

**Konsequenz:** Wenn in Lovable schon „Gebucht" zu sehen ist, auf der Live-Seite aber nicht, dann ist der Code noch nicht nach `main` gepusht oder der GitHub-Action-Build ist fehlgeschlagen / läuft noch.

**Was ich tun werde:**
- Keine Code-Änderung nötig.
- In der Antwort konkret erklären: Lovable-Änderungen müssen via **Publish** (oder git-Push nach `main`) auf IONOS deployed werden, dann GitHub-Action-Status prüfen.
- Hinweis: Hard-Reload hilft nicht, weil der Server selbst die alte Version ausliefert.

---

### 2. Eventdatum + Uhrzeit immer in Kanban & Tabelle

**Status quo:**
- **Kanban-Card** (`KanbanView.tsx`): zeigt `preferred_date` als „d. MMM" oben rechts. **Uhrzeit fehlt.**
- **Tabelle** (`EventsList.tsx`): hat Spalte `preferred_date` mit Datum. **Uhrzeit fehlt.**

**Änderungen:**
- **KanbanView.tsx**: Datum-Pill um Uhrzeit erweitern. Format: `13. Okt · 18:30`. Wenn nur Datum vorhanden → nur Datum. Datenfeld: `preferred_time` (existiert in `event_inquiries`) bzw. `time_from` (v2).
- **EventsList.tsx**: in der Datums-Cell unter dem Datum eine zweite Zeile mit `HH:mm` ergänzen (kleiner, `text-muted-foreground`). Wenn keine Zeit vorhanden → leer lassen, kein Platzhalter.
- Beide Views nutzen denselben `formatEventDateTime`-Helper (neu in `src/lib/utils.ts` oder lokal), damit das Format konsistent ist.
- `EventInquiry`-Type in `src/types/refine.ts` und Mapping in `useEventInquiries`/`mapV2Event` prüfen, dass `preferred_time` vorhanden ist (sonst nachladen via `select`).

---

### 3. „Testmail an Betreiber" wird nicht immer verschickt

**Ursachenanalyse** (Code-Pfad: `OfferSendPreview.tsx` → URL `?confirmed=test&send=…` → `SmartInquiryEditor.tsx` ab Zeile 443):

Es gibt **drei unabhängige Stolperdrähte**, die jeden zweiten Versand blockieren:

1. **`sendTriggerHandledRef`** (Zeile 442/448): wird beim ersten Trigger im Component-Lifetime auf `true` gesetzt — bleibt über alle Re-Mounts derselben Editor-Instanz erhalten. Kommt der User zurück und klickt erneut „Test", wird der Effect nicht nochmal ausgeführt, weil die URL bereinigt ist und der Ref nicht zurückgesetzt wird.
2. **`sessionStorage`-Guard** (Zeile 453–460): blockt jede Wiederholung 10 Sekunden lang **pro `inquiry+sendType+confirmed`-Kombination**. Für Test-Mails ist dieser Schutz unnötig — Tests dürfen jederzeit wiederholt werden.
3. **`isInitialized`-Race** (Zeile 447): wenn der Editor noch nicht „initialized" ist (100 ms-Delay nach Mount), wird der Trigger ignoriert und kommt erst beim nächsten Render. Wenn die URL aber inzwischen bereinigt wurde, geht der Versand verloren.

Zusätzlich: der Test-Versand passiert **nicht direkt** auf der Preview-Seite, sondern via Re-Routing zurück zum Editor mit URL-Param. Das ist fragil — jeder Navigations-Hiccup verliert den Klick.

**Fix:**
- **Test-Mail direkt aus `OfferSendPreview.tsx` versenden** statt über URL-Hop:
  - Neuer Handler `handleSendTest` ruft `send-offer-email` mit `isTestPreview: true` direkt auf.
  - Toast bei Erfolg/Fehler bleibt auf der Preview-Seite, kein Redirect.
  - Nur der **echte** Versand geht weiterhin den URL-Hop (weil dort die Phase-Änderung im Editor passieren muss).
- **In `SmartInquiryEditor.tsx`** den `confirmed === 'test'`-Branch entfernen (oder als Fallback behalten) — Test-Versand läuft dann nicht mehr über den State-Editor.
- Den `sessionStorage`-Guard auf den **echten** Versand beschränken (`confirmed === '1'`), nicht auf `test`.
- Console-Logging vor jedem `invoke('send-offer-email')` ergänzen, damit künftige Probleme im Network/Console sofort sichtbar sind.

**Zusatz-Robustheit (Edge Function-Seite):**
- Kurz prüfen, ob `send-offer-email` bei `isTestPreview: true` und fehlender `senderEmail` (kein eingeloggter User) abbricht. Falls ja: Fallback auf Default-Adresse (`info@events-storia.de`) protokollieren.

---

### Reihenfolge der Umsetzung

1. (Klein) Datum + Uhrzeit in Kanban-Card und Tabellen-Cell.
2. (Mittel) Test-Mail direkt aus Preview senden + Guards entschärfen.
3. (Doku) User in Antwort über Live-Deploy-Mechanismus aufklären.

Keine DB-Migrations nötig.