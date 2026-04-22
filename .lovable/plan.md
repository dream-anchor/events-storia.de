# UX/CX/Engineering-Audit: Multi-Offer-Wizard

Vollständiger Durchgang aller Wizard-Schritte und Übergänge. Befund nach Schweregrad sortiert. Reine Analyse — kein Code geändert. Am Ende ein Vorschlag zum Beheben.

## Schritt 1 — Paket auswählen (`activeStep = 1`)

**Was gut ist**

- Klare Karten-Auswahl mit Hover/Active-States, Preis + p.P./pauschal-Badge sichtbar.
- Auto-Skip auf Step 2, wenn Option bereits ein Paket hat (Zeile 62–64).

**Probleme**

1. **Gästezahl ist im Wizard nicht editierbar.** `option.guestCount` wird angezeigt (Zeile 343, 634) und steuert die Preiskalkulation, aber nirgends im Wizard kann der Admin sie ändern. Wenn der Anfrage-Wert falsch ist, muss er den Wizard verlassen, in `OptionsOverview` zurück und … auch dort kein Stepper. Die Zahl ist nur über die Inquiry-Detail-Felder änderbar. **CX-Bruch:** Der Wizard suggeriert "alles hier konfigurieren", aber genau das preistreibende Feld fehlt.
2. **Paket-Wechsel löscht stillschweigend die Menü-Auswahl** (Zeile 248: `menuSelection: { courses: [], drinks: [] }`). Kein Confirm-Dialog, kein Toast. Nach 10 Min Konfiguration ist alles weg, wenn man versehentlich auf das falsche Paket klickt.
3. **Min-Guests-Hinweis ohne Validierung:** Badge "ab X Gäste" ist informativ, aber bei `option.guestCount < pkg.min_guests` gibt es keinen Warnhinweis. Admin kann ein 50-Pers-Paket für 8 Gäste konfigurieren.
4. **„Restaurant-Menü laden" oben rechts** (`MenuImporter` Zeile 346): Wenn der Admin im Step 1 auf Import klickt und die Funktion `onUpdateOption({ packageId: null, ... })` setzt (Zeile 353), springt der Wizard zurück zur Übersicht. Das ist überraschend — der Button im Wizard-Header hätte den Wizard erst gar nicht zeigen müssen.

## Schritt 2 — Gänge

**Was gut ist**

- `CourseProgress` zeigt Status pro Gang, klickbar zum Hin- und Herspringen.
- Multi-Select via Toggle-Logik korrekt (Zeile 176–190).
- Source-Tabs mit sauberem Default aus `allowed_sources`.

**Probleme**
5. **Pflicht-vs-Optional-Gänge nicht visuell getrennt.** Stepper-Label heißt "Gänge (Pflicht)", aber die Course-Liste mischt Required und Optional ohne sichtbare Trennung. Admin weiß erst beim "Weiter"-Versuch, dass ein Pflicht-Gang fehlt.
6. `**coursesComplete` reagiert auch auf optionale Gänge sichtbar nicht.** Logik (Zeile 138–147) prüft nur Required — korrekt — aber die UI gibt **kein Feedback**, welche Required noch fehlen. Der "Weiter"-Button erscheint einfach nicht, ohne Erklärung warum.
7. `**isLastCourse`-Auto-Advance (CourseSelector) + manueller "Weiter"-Button = Doppelaktion.** Auto-Advance via `setTimeout` (autoAdvanceRef) plus expliziter Button kann zu Race-Conditions führen, wenn der Admin schnell klickt. Bei aktivem Auto-Advance kann der manuelle Klick auf "Weiter zu Getränke" einen bereits gesetzten Course-Index überspringen.
8. **Kein "letzte Gang-Auswahl entfernen" UI bei Multi-Select.** Toggle-Logik per Re-Klick auf die Karte funktioniert technisch, ist aber für Admin nicht selbsterklärend (kein Hinweis "Klick zum Entfernen").

## Schritt 3 — Getränke

**Was gut ist**

- `DrinkPackageSelector` mit Choice-Logik.
- Saubere Empty-State-Card wenn Paket keine Drinks hat.

**Probleme**
9. **Stepper-Klickbarkeit für Step 3 ist `!!option.packageId**` (Zeile 375), nicht `coursesComplete`. Admin kann Gänge überspringen, später beim "Zur Zusammenfassung"-Versuch hängen. Inkonsistent mit Step 4 (`coursesComplete && drinksComplete`, Zeile 376).
10. `**drinksComplete` ist `true` wenn `drinkConfigs.length === 0**` (Zeile 151). Korrekt, aber Step 3 zeigt dann nur eine Empty-State-Card und der "Zur Zusammenfassung"-Button **erscheint nicht** (Zeile 594: `drinksComplete && ...`). Tatsächlich ist `drinksComplete=true`, also sollte der Button da sein. Bug: Der Button rendert zwar (true && ...), aber der Empty-State suggeriert "hier ist nichts zu tun" — visuell erscheint dann nur die leere Card mit dem Button darunter. CX-Schwäche, kein direkter Bug.
11. **Keine Mengen-Logik für Drinks.** `quantityLabel` wird in der LiveCalculation angezeigt, aber im DrinkPackageSelector gibt es (vermutlich) keine Mengensteuerung pro Choice. Zu prüfen.

## Schritt 4 — Zusammenfassung

**Was gut ist**

- Saubere `SummarySection`-Karten mit Edit-Buttons, die zurück zum richtigen Step navigieren.
- Currency-Formatierung sauber via `Intl.NumberFormat`.

**Probleme**
12. **„Bearbeiten" für Paket fehlt.** Courses und Drinks haben Edit-Buttons (Zeile 654, 689), aber die Paket-Section nicht. Inkonsistent.
13. `**handleFinish` macht nur `onBack()**` (Zeile 256). Es gibt **kein** `saveOptions()` oder Persistenz-Trigger. Das ist nur OK, wenn `useMultiOfferState` Auto-Save hat — sonst gehen Änderungen verloren bei Page-Reload vor dem nächsten Save. Zu verifizieren.
14. **„Fertig — zurück zur Übersicht"** ist semantisch schwach. Der Admin erwartet nach Step 4 eine Aktion (z.B. "Anschreiben generieren"). Tatsächlich landet er in der Overview und muss nochmal scrollen/klicken.

## Querschnitt-Themen

15. **Stepper-Status-Inkonsistenz:** Step 4 (`isComplete: false` immer, Zeile 319) zeigt nie einen Check, auch wenn die Zusammenfassung "durchgeklickt" wurde. Step 4 ist konzeptionell ein Endpunkt — Status-Konzept fehlt.
16. `**MenuImporter` im Wizard-Header** (Zeile 346) hat `currentOptionCount={0}` hartcodiert, ignoriert das tatsächliche Limit von 5 Optionen. Über den Wizard kann ein 6. Import erfolgen, der dann von `addImportedOptions` evtl. abgelehnt wird (zu prüfen) — silent failure-Risiko.
17. `**useEffect` Price-Sync (Zeile 76–96)** hat `option.totalAmount` UND `onUpdateOption` in den Dependencies. Bei jedem `onUpdateOption`-Re-Create (kein `useCallback` beim Aufrufer?) kann der Effect erneut feuern → potenzielle Update-Loop, durch Rounding-Vergleich aber abgefangen. Solider Defensiv-Code, aber `onUpdateOption` sollte memoiert sein.
18. **LiveCalculation** zeigt Total = `calculateEventPackagePrice(...)`, NICHT `option.totalAmount`. Bei Out-of-Sync (Race) divergieren Sidebar-Total und Summary-Total. Single Source of Truth fehlt.
19. **„Konfigurieren"-Button in `OptionsOverview**` öffnet den Wizard immer auf Step 2 (wenn Paket vorhanden) — keine Möglichkeit, gezielt zu Step 3 oder 4 zu springen. Edit-Pattern unvollständig.
20. **Mobile-UX:** Stepper-Labels sind `hidden md:inline` — auf Mobile sieht der Admin nur Icons, ohne Tooltip. Welcher Step gerade aktiv ist, erkennt er nur am Amber-Background. Schwach für Touch-Workflow.
21. **Locked-State im Wizard:** Wenn `isLocked` (Angebot versendet), wird der Konfigurier-Button in Overview ausgeblendet (Zeile 378), aber wenn der Admin den Wizard direkt via URL/State erreicht, gibt es keine Read-Only-Anzeige. `WizardConfigurator` selbst kennt `isLocked` gar nicht — alle Edit-Aktionen wären weiterhin live.
22. **Keine Tastatur-Navigation zwischen Steps.** Cmd+K für Global-Search ist da, aber kein Cmd+→/← oder Tab-Sequence für die Stepper-Pills.

## Empfehlungen — priorisiert

**P0 (Bugs / Datenintegrität)**

- #2 Confirm-Dialog vor Paketwechsel mit existierender Menü-Auswahl
- #9 Stepper-Klickbarkeit Step 3 an `coursesComplete` koppeln
- #16 `currentOptionCount` korrekt durchreichen
- #18 LiveCalculation auf `option.totalAmount` umstellen (Single Source of Truth)
- #21 `isLocked` an `WizardConfigurator` durchreichen, alle Inputs disablen

**P1 (CX-Brüche)**

- #1 Gäste-Stepper im Wizard-Header (editierbar, mit `min_guests`-Validierung → behebt auch #3)
- #5/#6 Pflicht-Gänge visuell markieren + bei `coursesComplete=false` Banner "Es fehlen noch: …"
- #13 Auto-Save am `handleFinish` triggern, oder explizit mit Save-Indicator
- #14 Step 4 abschließen mit primärer CTA "Zurück zur Übersicht & Anschreiben generieren"

**P2 (Polish)**

- #4 `MenuImporter` aus Wizard-Header entfernen (gehört nur in Overview)
- #7 Auto-Advance entfernen oder Button verstecken solange Auto-Advance läuft
- #8 Hint "Klick zum Entfernen" bei selektierten Karten
- #12 Edit-Button auch für Paket-Section in Step 4
- #15 Stepper Step 4 mit „abgeschlossen"-State versehen
- #17 `onUpdateOption` mit `useCallback` im Parent
- #19 Optionale Step-Parameter beim Öffnen des Wizards
- #20 Stepper-Labels auf Mobile: kürzere 1-Wort-Labels statt komplett ausblenden
- #22 Keyboard-Shortcuts für Step-Navigation

## Offene Fragen vor Implementierung

- Hat `useMultiOfferState` bereits Auto-Save (debounced) oder muss `handleFinish` explizit speichern?
- Soll der Gäste-Stepper im Wizard nur diese Option oder die Inquiry-globale `guest_count` ändern?
- P0-Block (#2, #9, #16, #18, #21) zuerst beheben oder kompletter P0+P1-Sweep in einem Rutsch?

Wenn du die offenen Fragen beantwortest, baue ich einen konkreten Implementierungs-Plan mit Diff-Skizzen pro Datei.  
  
Ich verstehe deine Fragen nicht.  
Benatworte du sie als Senior CX Engineer immer in unserem Sinn. Du siehst ja, wie das Tool gebaut ist.