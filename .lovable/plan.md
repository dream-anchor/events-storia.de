# Plan: Freitext-Import, Mail-zu-Angebot, leere Anfragenliste

Drei Themen aus deiner Nachricht. Ich schlage vor, in dieser Reihenfolge zu fixen (1 ist blockierend, dann 2, dann 3).

---

## 1) "Keine Inhalte" in `/admin/inquiries` (BLOCKIEREND)

**Diagnose:** Die DB enthält **142 aktive Nicht-Test-Events**, aber die Liste zeigt 0. In den Browser-Logs stapeln sich `TypeError: Failed to fetch` aus `SupabaseAuthClient._refreshAccessToken`. Das bedeutet: der Token-Refresh kollidiert mit den Daten-Queries (Race), die Queries laufen ohne gültigen JWT durch RLS-Filter und liefern leeres Ergebnis — Fehler werden im Hook aber **stillschweigend** als "isLoading=false, records=[]" behandelt.

**Fix:**
- `useUnifiedInquiries`: `isError`/`error` exponieren, in `UnifiedInquiriesList` als sichtbarer Banner mit "Erneut laden"-Button zeigen — **statt** stilles "0 Anfragen".
- `eventsQuery`: `retry: 2` + `retryDelay` mit Exponential Backoff hinzufügen, damit ein erster Failed-Fetch nach Token-Refresh automatisch erneut versucht wird.
- `AdminAuthGuard`/`useAdminAuth`: beim `TOKEN_REFRESHED`-Event `queryClient.invalidateQueries({ queryKey: ["unified-v2-events"] })` und `["unified-orders"]` triggern, damit nach erfolgreichem Refresh frische Daten geladen werden.
- Optional: globaler `QueryCache.onError`-Handler, der bei `Failed to fetch` einmalig nach 1 s alle Queries invalidiert.

---

## 2) Freitext-Import auch für 1-Tages-/einfache Angebote

**Aktuelles Verhalten:** `parse-freeform-offer` zwingt das Tool-Schema in `days[].meals[]` und `FreeformImportPanel` wirft den Fehler `"KI konnte keine Tage erkennen"`, wenn keine Tagesüberschrift erkannt wurde. Dadurch funktioniert der Import nur für mehrtägige Programme.

**Fix:**
- `parse-freeform-offer/index.ts`:
  - System-Prompt umschreiben: "Falls **kein** Datum/Mehrtages-Struktur erkennbar ist, erzeuge **genau einen** Tag mit `dateLabel=''`, `isoDate=''` und packe alle Mahlzeiten/Positionen dort hinein. Falls auch keine Mahlzeitsstruktur, lege **eine** Sektion `Leistungen` mit allen Items an."
  - `meals[].guestCount`, `meals[].flatPriceNet`, `meals[].vatRate` von `required` auf optional setzen (Default 0 / 7).
  - `days[].dateLabel` ebenfalls optional.
- `FreeformImportPanel.tsx`:
  - Hard-Check `days.length === 0` entfernen — stattdessen wenn leer: einen synthetischen Tag mit einer Sektion `"Leistungen"` aus `rawText` füllen.
  - Toast-Text "Programm mit X Tag(en)" → für 1 Tag "Programm importiert" ohne Zähler.
- `FreeformProgramEditor`: prüfen, dass UI auch sauber rendert, wenn nur 1 Tag / 1 Mahlzeit ohne Datum existiert (Header "Tag 1" statt leeres Datum-Label).
- `validate-freeform-offer`: Regel "Mehrtages-Konsistenz" überspringen, wenn `days.length === 1`.

---

## 3) Mail-Weiterleitung → automatisches Angebot via Freitext-Import

**Was schon existiert:**
- `receive-inbound-email` (Resend Inbound) ordnet Antworten bestehenden Anfragen zu.
- `create-inquiry-from-inbox-email` legt aus einer Posteingang-Mail eine neue Anfrage an.
- `parse-inquiry-text` extrahiert Strukturdaten (Name, Datum, Gäste) aus Freitext.

**Was fehlt für deinen Wunsch:** eine dedizierte Weiterleitungs-Adresse (z. B. `angebot@events-storia.de` oder `lead+auto@…`), die eingehende Kunden-Mails (z. B. von Plattformen oder via manueller Forward) **automatisch** in eine neue Anfrage **plus erstes Angebots-Draft** umwandelt und den Freitext-Import-Pfad nutzt.

**Fix:**
1. `receive-inbound-email`:
   - Neue Routing-Regel: wenn `to`-Adresse mit `lead@` / `auto@` / `angebot@events-storia.de` beginnt und **kein** `reply+{uuid}` Match → "Auto-Lead-Pfad".
   - Auto-Lead-Pfad ruft intern `parse-inquiry-text` (für Kontaktdaten) + `parse-freeform-offer` (für Programm/Preise) auf.
   - Erstellt `v2_events`-Datensatz mit `source='email_forward'`, `offer_phase='draft'`, hängt das geparste Programm als Draft-Angebot an, speichert Original-Mail in `email_messages`.
   - WhatsApp/Email-Alarm an `info@events-storia.de` ("Neue Auto-Anfrage von …, Angebots-Draft erstellt → Öffnen").
2. Im Admin (`UnifiedInquiriesList`): Badge "📩 Auto-Import" für Anfragen mit `source='email_forward'`, plus Hinweis im Editor "Angebot wurde aus weitergeleiteter Mail generiert — bitte Preise und Daten prüfen".
3. Doku-Snippet (`docs/MAESTRO-CX-ROADMAP.md`): Resend Inbound-Routing-Regel für die neue Adresse dokumentieren.

**Hinweis zu Resend-Setup:** Die MX-Routing-Regel für die neue Adresse muss in Resend selbst eingerichtet werden (UI). Code-Seite ist hier komplett.

---

## Reihenfolge & Risiko

1. **#1 zuerst** — sonst sind alle anderen Tests blind.
2. **#2** — kleiner, lokaler Schema-/Prompt-Patch, kein DB-Touch.
3. **#3** — größter Block, eigene Edge-Function-Logik + UI-Badge, kein Schema-Change nötig (nutzt vorhandene Felder `source`, `offer_phase`).

## Offene Frage (nur bei #3)

Soll die Auto-Import-Adresse `lead@events-storia.de` heißen — oder bevorzugst du etwas anderes (z. B. `auto@…`, `angebot@…`)?
