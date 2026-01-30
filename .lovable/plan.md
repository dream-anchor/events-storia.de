
## Problem (kurz & verständlich)
Der Button **„Anschreiben generieren“** ist zwar klickbar, aber es passiert sichtbar nichts, weil **UI und Backend-Funktion nicht denselben “Vertrag” sprechen**:

- In der **Multi-Offer**-Ansicht wird die Backend-Funktion mit einem **anderen Request-Format** aufgerufen (nested `inquiry` + `options` + `isMultiOption`).
- Die Backend-Funktion `generate-inquiry-email` erwartet aber aktuell **flache Felder** wie `inquiryType`, `contactName`, `preferredDate`, usw.
- Zusätzlich liefert die Backend-Funktion **`{ success, email }`** zurück, während `MultiOfferComposer` aktuell auf **`data.emailDraft`** wartet.
- Ergebnis: kein Fehler, kein Draft – aus Nutzersicht „passiert nichts“.

## Ziel
1) Klick auf **„Anschreiben generieren“** erzeugt zuverlässig einen E-Mail-Entwurf und zeigt ihn direkt an.  
2) Multi-Offer-E-Mails enthalten die aktiven Optionen (A/B/C…) verständlich.  
3) Bestehende Stellen (FinalizePanel/AIComposer) dürfen nicht kaputtgehen.

---

## Umsetzung (konkret)

### 1) Backend-Funktion kompatibel machen (Multi-Offer + bestehende Calls)
**Datei:** `supabase/functions/generate-inquiry-email/index.ts`

**Änderungen:**
- Request zuerst als „raw“ einlesen und dann **zwei Formate** unterstützen:
  - **Format A (bestehend):** `inquiryType`, `contactName`, `menuSelection`, `packageName`, …
  - **Format B (Multi-Offer):** `{ inquiry: {...}, options: [...], isMultiOption: true }`
- Wenn Multi-Offer erkannt wird:
  - `contactName/companyName/preferredDate/eventType` aus `raw.inquiry` ableiten
  - Pro Option eine kompakte Beschreibung bauen (Option-Label, Paketname, Gästezahl, Gesamtbetrag, ggf. Menüauswahl, ggf. Payment-Link falls vorhanden)
  - Kontext so formulieren, dass das Modell daraus einen **kurzen, übersichtlichen** Text erstellen kann
- Response vereinheitlichen/abwärtskompatibel machen:
  - Immer zurückgeben:  
    ` { success: true, email: generatedEmail, emailDraft: generatedEmail } `
  - Bei Fehlern weiterhin:  
    ` { success: false, error: "...", status: ... } `  
  (Damit funktionieren alle Aufrufer sicher, egal ob sie `email` oder `emailDraft` lesen.)

**Warum so?**
- Schnellster Fix ohne Side-Effects
- Keine Migration nötig
- Keine neue Backend-Funktion nötig, kein Secret-Setup nötig

---

### 2) MultiOfferComposer: korrektes Response-Handling + sichtbares Feedback
**Datei:** `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx`

**Änderungen:**
- Neues State: `isGeneratingEmail` (ähnlich wie `isSending`)
- `generateEmail`:
  - Button währenddessen deaktivieren + Spinner/Text („Generiere…“)
  - Nach `invoke`:
    - `if (error) throw error`
    - `if (!data?.success) throw new Error(data?.error || "Generierung fehlgeschlagen")`
    - Draft-Text aus `data.email ?? data.emailDraft` holen
    - Wenn leer: verständlicher Fehler („Keine E-Mail vom Service erhalten“)
    - `setEmailDraft(...)` + Success-Toast
- Optional (UX-Polish): nach erfolgreicher Generierung zum Draft-Bereich scrollen, damit man direkt sieht „da ist was passiert“.

**Warum so?**
- Der Button wirkt “tot”, weil es keinen Ladezustand gibt und weil der Erfolg nicht erkannt wird.
- Mit Spinner + klaren Fehlermeldungen ist sofort sichtbar, ob:
  - gerade generiert wird
  - es einen Service-Fehler gab (z.B. Rate limit)
  - der Draft erfolgreich gesetzt wurde

---

## Edge Cases, die ich abfange
- Keine aktive Option → Toast „Bitte mindestens eine Option aktivieren“
- Aktive Option ohne Paket → Button bleibt deaktiviert wie bisher
- Backend liefert `success:false` mit `error` → Toast zeigt konkrete Fehlermeldung
- Backend liefert `success:true`, aber kein `email` → Toast „Keine E-Mail erhalten“
- Multi-Offer mit 1–5 Optionen → E-Mail bleibt kurz, Optionen kompakt erwähnt

---

## Tests (End-to-End)
1) Öffne eine Anfrage: `/admin/events/:id/edit`
2) Klicke **„Anschreiben generieren“**
   - Erwartung: Button zeigt „Generiere…“ + Spinner
   - Danach: Toast Erfolg + **E-Mail-Entwurf Card** erscheint (Textarea gefüllt)
3) Teste den anderen Flow:
   - In einem Menü-Flow (FinalizePanel) ebenfalls „Anschreiben generieren“
   - Erwartung: funktioniert unverändert, Text wird weiterhin angezeigt
4) Negativtest:
   - Warte beim Generieren absichtlich kurz / mehrfach klicken
   - Erwartung: saubere Fehlermeldung bei Rate-Limit, keine “stille” Aktion

---

## Dateien, die ich anfassen werde
- `supabase/functions/generate-inquiry-email/index.ts`
- `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx`

---

## Technische Notiz (Ursache in einem Satz)
Die Multi-Offer-UI sendet ein anderes Payload-Format und erwartet ein anderes Response-Feld als die Backend-Funktion liefert – dadurch wird kein Draft gesetzt und es gibt keine sichtbare Reaktion.