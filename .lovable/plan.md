## Antwort auf die Frage
**Nein — aktuell wird nichts davon übernommen.** Der Kostenübernahme-Vertragstext in `supabase/functions/_shared/cost-acceptance-template.ts` enthält den Zahlungsziel-Satz **fest verdrahtet**:

> „Der Rechnungsbetrag ist innerhalb von **5 Werktagen nach Rechnungserhalt** ohne Abzug auf folgendes Konto zu überweisen."

Die Function `admin-send-cost-acceptance` liest weder `invoice_due_days`, noch `balance_method`, `balance_due_days_before_event`, `payment_method` oder `deposit_*` aus `v2_events` — das Zahlungsziel im Vertrag ist also unabhängig von der Anfrage-Konfiguration und ändert sich nie, egal was im Admin unter „Zahlung" gewählt wurde.

## Was der Plan ändert
Die im Anfrage-Editor konfigurierten Zahlungskonditionen in den generierten Kostenübernahme-Vertrag übernehmen — dynamisch, sprachlich sauber, revisionssicher.

### Regeln (auf Basis der bestehenden Felder in `v2_events`)
- **`balance_method = invoice_after`** → „Zahlungsziel: **X Tage nach Event**", mit `X = balance_due_days_before_event` (bzw. Fallback `invoice_due_days`, sonst 5).
- **`balance_method = invoice_before`** → „Zahlungsziel: **X Tage vor Event**".
- **`balance_method = on_site`** → „Zahlung **vor Ort am Veranstaltungstag**".
- **`balance_method = stripe_prepay`** → „Zahlung **vor dem Event per Zahlungslink**".
- **Anzahlung**: falls `deposit_method` gesetzt und `deposit_percent > 0` oder `deposit_amount > 0`, wird zusätzlich ein Satz ergänzt (z. B. „**Anzahlung: 30 % / 500 €** — fällig `deposit_due_days` Tage nach Angebotsannahme, per `deposit_method`").

### Technische Umsetzung
1. **Template (`supabase/functions/_shared/cost-acceptance-template.ts`)**
   - Fester Satz mit „5 Werktagen" ersetzt durch Platzhalter `{{payment_terms}}` (Zahlungsziel-Kernsatz) und `{{deposit_terms}}` (optionaler Anzahlungssatz).
   - `TEMPLATE_VERSION` von `1.0.0` → `1.1.0` (revisionssicher, alte Verträge bleiben unangetastet).
   - `CostAcceptancePlaceholders`-Typ um beide Felder erweitert.

2. **Neuer Helper `buildPaymentTerms(event)`** im selben Shared-Modul
   - Nimmt Event-Row (`balance_method`, `balance_due_days_before_event`, `invoice_due_days`, `deposit_method`, `deposit_percent`, `deposit_amount`, `deposit_due_days`) und liefert `{ payment_terms, deposit_terms }` als fertige deutsche Textzeilen.
   - Reine, testbare Funktion — kein Fetch, keine Seiteneffekte.

3. **`supabase/functions/admin-send-cost-acceptance/index.ts`**
   - Selektiert die neuen Felder mit aus `v2_events`.
   - Ruft `buildPaymentTerms(...)` auf und übergibt die Ergebnisse an `renderCostAcceptanceMarkdown({ ..., payment_terms, deposit_terms })`.
   - `additional_terms` bleibt erhalten (der aktuelle Storia-Marker wird nicht überschrieben).

4. **Deploy** nur der beiden betroffenen Function-Artefakte:
   - `_shared/cost-acceptance-template.ts` (kein eigenständiger Deploy — kommt mit)
   - `admin-send-cost-acceptance`

### Was bewusst NICHT geändert wird
- Bereits versendete Kostenübernahmen: eSignatures-Verträge sind revisionssicher — die alte Version `1.0.0` bleibt so, wie sie beim Kunden liegt.
- Kontoverbindung, Absender, MFA-Regeln, Signer-Felder.
- Preis-/Maestro-Logik.
- Frontend (`CostAcceptanceCard.tsx`): keine UI-Änderung nötig — die Konditionen kommen ausschließlich aus den bereits im Anfrage-Editor eingegebenen Zahlungsfeldern.

### Verifikation nach Umsetzung
- Neue Anfrage: `balance_method=invoice_after`, `balance_due_days_before_event=5` → Kunde bekommt „Zahlungsziel: 5 Tage nach Event".
- Neue Anfrage: `balance_method=on_site`, `deposit_percent=0` → Kunde bekommt „Zahlung vor Ort am Veranstaltungstag", kein Anzahlungssatz.
- Alte bereits versendete Kostenübernahme bleibt unverändert (TEMPLATE_VERSION-Diff).