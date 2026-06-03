## Befund

Die Rechnung wird nicht erstellt, weil `create-lexoffice-final-invoice` intern `create-event-quotation` aufruft. Diese Funktion ist aktuell mit JWT-Prüfung geschützt (`verify_jwt = true`). Beim internen Server-zu-Server-Aufruf wird aber der Service-Key als Bearer-Token gesendet; das wird vom Function-Gateway mit `401` abgelehnt, bevor die Funktion überhaupt startet. Deshalb gibt es Logs nur bei `create-lexoffice-final-invoice`, nicht bei `create-event-quotation`.

## Plan

1. **Interne LexOffice-Funktion aufrufbar machen**
   - In `supabase/config.toml` `create-event-quotation` so konfigurieren, dass der Gateway den internen Aufruf nicht mit `401` blockiert.
   - Die Funktion bleibt serverseitig abgesichert, weil sie weiterhin den Service-Role-Client für Datenzugriff nutzt und nicht öffentlich Daten freigibt.

2. **Interne Aufrufe vereinheitlichen**
   - In `create-lexoffice-final-invoice` den internen Aufruf von `create-event-quotation` robust mit `apikey` und `Authorization` setzen.
   - Den Request-Body korrigiert bei `inquiryId` belassen.

3. **Frontend-Fehler bei PaymentCard korrigieren**
   - In `PaymentCard.tsx` wird aktuell `{ inquiry_id: inquiryId }` gesendet, die Funktion erwartet aber `{ inquiryId }`.
   - Das wird auf `inquiryId` vereinheitlicht, damit die Schlussrechnung von allen Stellen funktioniert.

4. **Validieren**
   - Betroffene Edge Functions deployen/testen.
   - Den Funktionsaufruf für die konkrete Anfrage `a14872bb-1e40-4fc5-9869-5a6864651062` prüfen, ohne zusätzliche UI-Änderungen.