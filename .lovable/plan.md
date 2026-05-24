## Ziel

1. **Globale Regel** im Memory verankern: Preise/Summen/Anzahlungen IMMER 1:1 aus Maestro übernehmen – für alle Kunden, alle Mails, alle Dokumente.
2. **Restzahlungs-Mail Christina Byrne Windfeld** auf Maestro-Preis (70 €/Person) umstellen, neuer Stripe-Link mit 70 €/Stück, Anzahlung transparent verrechnen.

## Schritte

### 1. Globale Memory-Regel (Core, gilt für alle Kunden/Mails)
In `mem://index.md` Core-Sektion eintragen:
> **Preise, Summen und Anzahlungen IMMER 1:1 aus Maestro übernehmen.** Niemals eigene Kalkulationen, Umrechnungen, Aufteilungen oder Rundungen vornehmen – weder in Mails, Angeboten noch in der Kommunikation. Gilt für alle Kunden.

Zusätzlich Detail-Memory `mem://business/maestro-as-single-source-of-truth` mit kurzer Begründung anlegen und in der Index-Liste verlinken.

### 2. Neuen Stripe-Payment-Link für Christina erstellen
- Produkt: „Restzahlung Event Christina Byrne Windfeld – 28.08.2026"
- Preis: **70,00 €** pro Stück (Brutto, EUR), Maestro-Wert 1:1
- Mengen-Auswahl im Checkout aktiv (Default 70, anpassbar nach oben)
- Alten Link (`buy.stripe.com/cNicN41EOfxw06R2dN43S03`) deaktivieren

### 3. Mail `vorschau-rigshospitalet-restzahlung.html` umbauen (DE + EN)

Werte exakt aus Maestro:
- Angebotspreis: **70,00 €/Person**
- Mindestpersonen: **70** (aktueller Stand, finale Zahl 10 Tage vor Event)
- Anzahlung: **490,00 €**
- Restbetrag Stand heute: **4.410,00 €** (= 70 × 70 − 490)

Transparente Rechnung im Mailtext anzeigen:
```
Angebotspreis      70,00 € × 70 Pers. = 4.900,00 €
abzgl. Anzahlung                       −  490,00 €
─────────────────────────────────────────────────
Restbetrag (Stand 70 Pers.)             4.410,00 €
```

**Empfohlene Stripe-Logik (Variante B):**
Kundin gibt die **finale Gästezahl** im Stripe-Checkout ein → Stripe rechnet `70 € × Gäste`. Die bereits gezahlten 490 € werden intern als Anzahlung verbucht und in der **finalen Schlussabrechnung nach dem Event** verrechnet (Rückerstattung oder Gutschrift). Vorteil: keine Rechenarbeit für die Kundin, kein Fehlerrisiko.

Hinweisbox in der Mail formuliert:
> Bitte geben Sie im Bezahlfenster die **aktuelle finale Gästezahl** (mind. 70) ein. Stripe berechnet `70,00 € × Anzahl Gäste`. Ihre bereits geleistete Anzahlung von 490,00 € wird in der Schlussabrechnung nach der Veranstaltung gutgeschrieben/verrechnet.

### 4. Finale Mail ausgeben
Aktualisierte HTML-Datei als Vorschau bereitstellen.

## Offene Frage
→ Variante B (Stripe rechnet 70 € × Gäste, Anzahlung wird intern in Schlussabrechnung verrechnet) bestätigen? Oder doch Variante A (Kundin gibt Gästezahl − 7 ein)?
