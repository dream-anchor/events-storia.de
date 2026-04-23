

# Wizard-Audit: OfferCreate (Anfrage anlegen) + WizardConfigurator (Angebotsoption)

## Scope & Architektur

Zwei eigenständige, sequentiell verkettete Wizards:

```text
[1] OfferCreate Wizard  ──────────►  [2] SmartInquiryEditor (Angebot-Tab)  ──►  [3] WizardConfigurator
    /admin/events/create               /admin/events/:id/edit                    (modal-View in MultiOfferComposer)
    2 Schritte                         Inquiry-Bearbeitung                       4 Schritte (Paket→Gänge→Getränke→Summary)
    Eingang → Kontakt/Event            inkl. MultiOffer + History               pro Option A–E
```

---

## TEIL 1 — OfferCreate Wizard (`/admin/events/create`)

### Gesamtbewertung: 7/10 — funktional sauber, hat 4 echte Schwachstellen

### Was funktioniert
- 2 Schritte sind richtig dimensioniert (war früher mehr, wurde sinnvoll reduziert).
- KI-Extraktion (`parse-inquiry-text`) füllt Felder gut, mit "Manuell eingeben"-Fallback.
- Auto-Save (debounced 800ms) + `useRegisterSaveStatus` integriert.
- Sticky Bottom-CTA, mobile Safe-Area, Test-Mode-Toggle vorhanden.
- Hand-off feuert `receive-event-inquiry` mit `skipInsert:true` → keine Doppel-Inserts, Notifications werden ausgelöst.

### Befunde / Bugs

**B1 — Empty Draft-Leak (P1, Daten-Hygiene)**
`useEffect` legt sofort beim Mount eine leere Inquiry an (Zeile 246–269) — auch wenn der User nur kurz reinklickt und sofort schließt. Es gibt **keinen** Cleanup, der den leeren Draft löscht. Bei Tab-Schließen verbleibt für immer eine `event_inquiries`-Row mit leerem `contact_name`/`email`.
- DB-Check zeigt aktuell 0 Leichen, aber das Risiko ist real und wächst mit Nutzung.
- **Fix**: Draft erst beim ersten Auto-Save-Trigger anlegen ODER beim Unmount löschen falls `contact_name+email` leer.

**B2 — Auto-Save überschreibt extrahierte AI-Daten ohne Schutz (P2)**
Der Auto-Save schreibt `event_end_date` NICHT mit (Zeile 286–298 fehlt `event_end_date`), obwohl es im finalen Hand-off (Zeile 412) sehr wohl gespeichert wird. Folge: Wer extrahiert + sofort den Browser schließt ohne Step 2 abzuschließen, verliert das End-Datum.
- **Fix**: `event_end_date: formData.event_end_date || null` in Auto-Save ergänzen.

**B3 — `setTimeout` ohne ref-cleanup im Auto-Save (P2)**
Zeile 304: `setTimeout(() => setSaveStatus('idle'), 2000)` läuft auch nach Unmount weiter → React-Warnung "state update on unmounted component" möglich. Best Practice: in Ref tracken.

**B4 — Hand-off ist nicht idempotent (P2)**
Wenn `handHandoffToEditor` mitten in `update` failed (z. B. Netzwerk), bleibt `isHandingOff=true` in catch nicht zurückgesetzt für den Erfolgsfall ist OK, aber die Inquiry steht trotzdem schon mit leeren Pflichtfeldern in der DB (siehe B1). Doppelklick-Schutz greift, aber Retry-Pfad ist unklar.

**B5 — `email_end_date` fehlt im Notification-Body (P3)**
`receive-event-inquiry` bekommt `preferredDate` aber kein `event_end_date` (Zeile 431–448). Mehrtägige Events erscheinen in der WhatsApp-/Email-Benachrichtigung als 1-Tages-Event.

**B6 — Test-Mode-Redirect ist nur half-baked (P3)**
Zeile 434 leitet `email` für Notification auf `antoine@monot.com` um — aber die Inquiry selbst wird mit der echten Customer-Email gespeichert. Das ist konsistent mit Maestro-Test-Logik (DB hat `is_test`-Flag), aber: sollte die echte Email in der Inquiry stehen ODER auch redirected werden? Heutige Logik OK, aber dokumentationswert.

### UX-Beobachtungen
- "Manuell eingeben" Button ist visuell sehr leise (ghost) — Power-User wollen das prominenter.
- Kein "Speichern als Entwurf"-Button auf Step 2 (nur "Zur Angebotskonfiguration") — wer noch nicht weiter will, kann nur über Browser-Back raus.
- Sticky Bottom-CTA hat `lg:left-64` für Sidebar-Versatz — auf zwischen 768–1024px potentiell falsch positioniert.

---

## TEIL 2 — WizardConfigurator (Angebotsoption A/B/C konfigurieren)

### Gesamtbewertung: 8/10 — solide, gut durchdacht, kleinere Edge-Cases

### Was funktioniert
- 4 klare Schritte mit Pill-Stepper, Step-Gating (Step 3 erst wenn coursesComplete, Step 4 erst wenn drinksComplete).
- Price-Sync-Effect (Zeile 102–122) hält `totalAmount` konsistent mit `(price × guests × per_person)` — verhindert Drift zwischen Sidebar und DB.
- Confirm-Dialog vor Paketwechsel wenn schon Auswahl existiert (Zeile 282–296).
- Min-Guests-Warning visuell + im Stepper.
- Locked-State (nach Versand) mit klarem Banner.
- "Speichern & Anschreiben generieren" als primärer CTA in Step 4 — flusht Save, navigiert zurück, triggert AI-Email.
- Multi-Select pro Course funktioniert (Toggle add/remove).
- Inline Gäste-Stepper im Header — direkt sichtbar.

### Befunde / Bugs

**B7 — Race-Condition bei rapidem Step-Wechsel + Auto-Save (P1)**
`useMultiOfferState.performSave` macht `DELETE * FROM inquiry_offer_options WHERE inquiry_id` und re-inserted alle. Wenn zwei Auto-Saves parallel feuern (z. B. User wechselt Paket während alter Save noch läuft), kann der zweite DELETE die Inserts des ersten löschen. Es gibt KEINE Sequenznummer/Lock.
- Code-Kommentar erwähnt Cleanup-Flush, aber kein Mutex.
- **Fix**: `isSavingRef` mutex einbauen — pending Saves queuen statt parallel feuern.

**B8 — `isLoading || isInitialLoad` triggert Auto-Save-Flush im Cleanup (P2)**
Zeile 292–299 in `useMultiOfferState.ts`: Cleanup ruft `performSave()` ohne await — fire-and-forget. Bei schnellem Inquiry-Wechsel kann ein Save für Inquiry A abgesendet werden während Component schon mit Inquiry B remountet hat → potentiell Daten in falscher Inquiry.
- **Fix**: Inquiry-ID im closure capturen oder Versionsguard.

**B9 — `useEffect` Dependency-Array enthält `selectedPackages` als Object-Reference (P2)**
`useMultiOfferState`-Loader-Effect (Zeile 192) hat `selectedPackages` als Dep. Da das Array bei jedem Parent-Render neu erstellt wird (Zeile 52–54 in MultiOfferComposer: `Array.isArray(...) ? (...) : []`), könnte der Loader bei jedem Re-Render erneut feuern.
- Aktuell vermutlich gemildert durch `isInitialLoad`-Ref, aber fragil.
- **Fix**: `useMemo` um `selectedPackages` in MultiOfferComposer.

**B10 — Step-Gating-Inkonsistenz: Stepper vs. LiveCalculation-CTA (P3)**
Zeile 506–510: Stepper-Click Step 3 erfordert `coursesComplete`. ABER: `getNextStepInfo()` Step 2 → 3 hat als `disabled: !coursesComplete` — konsistent. Step 1 → 2: `disabled: !option.packageId` — konsistent. ✓ Geprüft, OK.

**B11 — `isFinishing` State wird in `handleFinishAndCompose` nicht zurückgesetzt wenn `onGenerateEmail` failed (P3)**
Zeile 327–338: try/finally setzt `isFinishing(false)` — aber `onBack()` läuft VOR `onGenerateEmail()`. Wenn `generateEmail` fehlschlägt, ist Wizard schon zu, User sieht keinen Fehler im Wizard-Kontext.
- Tatsächlich: Toast-Error wird in `generateEmail` gefeuert, also UX OK. Nur Code-Lesbarkeit.

**B12 — `MultiOfferComposer.handleSendOffer` callt `createNewVersion` BEVOR Stripe-Quotation (P2)**
Zeile 235–255: Erst `createNewVersion(emailDraft)` → Version inkrementiert + History-Entry. Dann erst LexOffice-Quotation. Wenn LexOffice-Call failed, ist Version trotzdem erhöht und History-Entry geschrieben — Inquiry steht im "versendet"-Lock obwohl `send-offer-email` noch nicht mal aufgerufen wurde.
- **Wait — gravierend**: Ich sehe in `handleSendOffer` auch keinen Aufruf von `send-offer-email`! Nur `createNewVersion` + LexOffice + Status-Update. Wo wird die E-Mail tatsächlich versendet?

**B13 — KRITISCH: `handleSendOffer` versendet KEINE E-Mail (P0)**
Zeile 220–278 in `MultiOfferComposer.tsx`:
- Saves options ✓
- Generates payment links ✓
- Creates version+history ✓
- LexOffice quotation ✓
- Updates status to `offer_sent` ✓
- **Versendet aber NIE die E-Mail an den Kunden!** Kein `supabase.functions.invoke('send-offer-email', ...)`.

Das bedeutet: Der Status sagt "offer_sent", die History sagt "versendet", aber der Kunde bekommt keine Mail.
- **Bestätigung nötig**: Vielleicht passiert das in `EmailEditorPanel` selbst oder einem nachgelagerten Hook? Muss verifiziert werden — wenn nicht, ist das ein P0-Bug.

**B14 — Importierte Restaurant-Menüs verlieren `customDrink`-Field (P3)**
`mapImportedToMultiOfferOption` Zeile 41–46: Nur `selectedChoice` und `quantityLabel` werden gemappt, `customDrink` aus `OfferBuilderOption` fehlt — falls dort vorhanden, geht es beim Import verloren.

### UX-Beobachtungen
- Stepper auf Mobile (sm-): nur Icons, keine Labels. Auf 414px-Viewport gerade noch OK.
- LiveCalculation-Sidebar nur ab `lg:` sichtbar — auf Tablet (768–1024px) fehlt sie komplett, kein Mobile-Fallback (z. B. Sticky-Bottom-Bar wie in OfferCreate).
- Course-Selector zeigt keine Indikation "max X Items pro Gang" wenn das aus Config käme.
- Summary (Step 4) zeigt Option-Total, aber NICHT die Aufschlüsselung Paket-Preis × Gäste — Memory `mem://admin/offer-editor-pricing-ux` fordert Transparenz. Hier nicht umgesetzt.

---

## TEIL 3 — Cross-Flow: OfferCreate → SmartInquiryEditor → WizardConfigurator

### Befunde

**C1 — Hand-off lädt Inquiry sofort, aber Auto-Save kann pending sein (P2)**
`handHandoffToEditor` macht `flushAutoSave()` vor dem Hand-off-Update. ✓ OK. Aber: der Hand-off-Update überschreibt mit denselben Werten aus dem aktuellen `formData`-State — also redundant aber sicher.

**C2 — Default-Option beim ersten Öffnen des Editors (P3)**
`useMultiOfferState` legt automatisch eine Option A an (Zeile 156–162), wenn keine existiert. Wenn der User in OfferCreate keine Pakete ausgewählt hat (`selected_packages=[]`), entsteht eine leere Option A ohne Paket. Das ist OK als Start, aber: Auto-Save schreibt diese sofort in `inquiry_offer_options` rein → DB-Pollution mit "leeren Optionen".

**C3 — Kein Übergangs-Indikator zwischen Wizards (P3)**
Nach Hand-off navigiert man zu `/admin/events/:id/edit`. Der User landet dort im Default-Tab, der nicht zwingend "Angebot" ist. Toast sagt "wechsle zur Angebotskonfiguration" — UI navigiert aber nur zur Edit-Seite.

---

## Priorisierte Empfehlungen

**P0 (kritisch — sofort)**
1. **B13 verifizieren + fixen**: Wird `send-offer-email` wirklich nirgends aufgerufen? Wenn ja, MultiOfferComposer.handleSendOffer um Email-Send ergänzen, BEVOR History/Version geschrieben werden.

**P1 (wichtig — diese Woche)**
2. **B1**: Draft-Leak verhindern (lazy create oder Cleanup).
3. **B7**: Mutex/Sequenz für Auto-Save in `useMultiOfferState.performSave`.

**P2 (mittel — nächste Iteration)**
4. **B2**: `event_end_date` in Auto-Save aufnehmen.
5. **B8**: Inquiry-ID im Save-Closure capturen (Cross-Inquiry-Drift).
6. **B9**: `selectedPackages` memoizen in MultiOfferComposer.
7. **B12**: Reihenfolge in `handleSendOffer` umdrehen — Email-Send als erstes, History/Version erst nach Erfolg.

**P3 (Polish)**
8. **B3, B4, B5, B6, B11, B14, C2, C3**.
9. **UX**: LiveCalculation Mobile-Fallback (Sticky Bottom Bar).
10. **UX**: Summary in Step 4 mit Pricing-Transparenz (Paket × Gäste = Total).
11. **UX**: "Manuell eingeben" prominenter, "Speichern & schließen" auf Step 2.

---

## Empfohlenes Vorgehen

1. **Sofort**: B13 verifizieren via `code--search_files` nach `send-offer-email` calls — dann entscheiden, ob P0-Fix oder False Alarm.
2. **Danach**: P0+P1 in einem Batch implementieren (~150 LOC, 4 Files).
3. **Live-Test mit `antoine@monot.com`**: Komplett-Flow OfferCreate → Edit → WizardConfigurator → Send → Inquiry-Status prüfen, LexOffice-PDF prüfen, Email-Eingang prüfen.
4. **Spätere Runde**: P2/P3 als Quality-Sprint.

---

## Was ich brauche

**Bestätigung zum Vorgehen**:
1. Soll ich zuerst **B13 verifizieren** (1 Tool-Call) und dir das Ergebnis melden, bevor wir entscheiden was implementiert wird?
2. Oder gleich **P0+P1 in einem Plan zusammenfassen** zur Approval und Umsetzung?

