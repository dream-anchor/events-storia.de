## Ziel
Finale Vorschau beider Restzahlungs-Mails neu generieren.

## Vorgehen
1. **`/mnt/documents/vorschau-rigshospitalet-restzahlung.html`** aktualisieren – Christina Byrne Windfeld, Stripe-Link mit angepasstem Produktnamen ("⚠️ MENGE = finale Gästeanzahl anpassen!"). Hinweisbox in der Mail klarer formulieren, dass auf der Stripe-Seite links bei "Menge" die finale Gästezahl eingetragen werden muss.
2. **`/mnt/documents/vorschau-cyim-restzahlung.html`** neu erstellen – Restzahlungs-Mail für CYIM mit Zahlungsdaten/Frist (10 Tage vor Event). Klärung nötig: zahlt CYIM auch per Stripe oder per Überweisung? Aus Kontext bisher: CYIM-Vorschau war "bestaetigung", nicht Restzahlung – ich gehe davon aus, dass für CYIM die bereits bestehende `vorschau-cyim-bestaetigung.html` gemeint ist (mit Überweisungs-Restzahlung).

## Output
Beide HTML-Dateien in `/mnt/documents/` als `<presentation-artifact>` zur Vorschau ausgeben.