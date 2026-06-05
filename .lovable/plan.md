## Problem

Wenn im Admin die Zahlungskonditionen (Anzahlung, Restzahlung, Gültigkeit) geändert werden, aber der **Gesamtbetrag gleich bleibt**, behält LexOffice den alten Footer-Satz („Anzahlung 20% innerhalb von 5 Tagen …").

Ursache: Der Freshness-Check in `create-event-quotation/index.ts` (Zeile 845–893) vergleicht **nur den Brutto-Gesamtbetrag**. Stimmt der überein, wird mit `reused: true` abgebrochen — das LexOffice-PDF wird nicht neu erzeugt, obwohl `buildOfferRemark()` jetzt einen anderen Text liefern würde.

## Lösung

Den Freshness-Check um einen **Remark-Vergleich** erweitern. Wenn der erwartete Remark-Text (aus den aktuellen Zahlungsfeldern des Inquiry) sich vom `remark` im LexOffice-Dokument unterscheidet, wird das alte Draft-Angebot gelöscht und neu erzeugt — exakt wie heute bei Preis-Drift.

### Änderungen in `supabase/functions/create-event-quotation/index.ts`

1. **Vor dem Freshness-Check** den erwarteten Remark einmal berechnen (gleiche Argumente wie der spätere Aufruf in Zeile 1083 — `depositMethod`, `balanceMethod`, `depositPercent`, `depositAmount`, `depositDueDays`, `balanceDueDaysBeforeEvent`, `invoiceDueDays`, `offerValidityDays`, mit `legacyMethodPair()` als Fallback).

2. **Freshness-Bedingung erweitern** (Zeile 859):
   ```ts
   const lexRemark = String(doc?.remark ?? '').trim();
   const expectedRemark = expectedRemarkText.trim();
   const totalsMatch = lexTotal > 0 && Math.abs(lexTotal - dbTotal) <= 0.01;
   const remarkMatches = lexRemark === expectedRemark;
   if (totalsMatch && remarkMatches) {
     return reused;
   }
   ```

3. **Activity-Log-Eintrag** um `reason: 'remark_drift_detected'` ergänzen, wenn nur der Remark abweicht (zur Nachvollziehbarkeit).

4. Restliche Logik (Draft löschen, neu erzeugen, `lexoffice_quotation_id` aktualisieren) bleibt unverändert — sie greift automatisch.

### Was passiert dadurch

- Admin ändert Anzahlung von 20 % auf 30 % → beim nächsten Öffnen / PDF-Refresh erkennt der Check die Remark-Differenz → altes Draft in LexOffice gelöscht → neues Angebot mit korrektem Footer-Satz, neuer `lexoffice_quotation_id` im Inquiry.
- Bei finalisierten (nicht-Draft) LexOffice-Angeboten greift wie heute der bestehende Schutz: löschen schlägt fehl, ein neues Dokument wird zusätzlich erzeugt.
- Reine Kontaktdaten- oder Menü-Änderungen ohne Preis- und Remark-Drift triggern weiterhin **kein** unnötiges Re-Issue.

### Trigger-Punkte (bestehen bereits)

- Klick auf „Angebot bearbeiten" / Re-Send aus dem OfferBuilder
- Aufruf von `create-event-quotation` aus dem CRM-Detail
- Public-Offer-Refresh-Pfad

Kein Frontend-Change, keine Migration, keine LexOffice-API-Änderung über das bereits genutzte `DELETE /quotations/{id}` hinaus.

### Datei

- `supabase/functions/create-event-quotation/index.ts` (~15 Zeilen Diff, ein Helper-Aufruf hochgezogen)

### Risiko

Gering: Die einzige Verhaltensänderung ist, dass bei Remark-Drift ein **bereits vorgesehener** Refresh-Pfad zusätzlich ausgelöst wird. Bestehende Drafts werden über denselben Mechanismus wie bei Preis-Drift sauber ersetzt.
