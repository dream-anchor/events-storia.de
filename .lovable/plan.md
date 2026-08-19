# Formulare wieder funktionsfähig machen (Live-Notfall)

## Befund (geprüft)
Das eingebundene Widget-Skript `https://api.maestro.cloud/api/public/widgets/v1/maestro.js` ist **nicht erreichbar** — der Host `api.maestro.cloud` löst nicht auf (DNS existiert nicht). Deshalb bleiben Event-Kontaktformular und Paket-Anfrage-Dialog leer (siehe Screenshot: leerer Dialog "Angebot anfragen").

Betroffen:
- Event-Kontaktformular (`/events#contact`, `/en/events#contact`)
- Paket-Anfrage-Dialog ("Angebot erhalten" auf allen Paket-Karten, DE + EN)

Die alten, funktionierenden Formulare liegen unverändert in der Git-Historie (Commit vor "Formulare auf MAESTRO umgeschaltet") und sind vollständig wiederherstellbar.

## Sofortmaßnahme
1. Native Formulare aus der Historie zurückholen:
   - `EventContactForm.tsx` (vollständiges Formular, Absenden an `receive-event-inquiry`)
   - `EventPackageInquiryDialog.tsx` (Paket-Anfrage inkl. Gästezahl/Preis)
2. Danke-Seite (`/danke`, `/en/thank-you`) bleibt bestehen; die Formulare leiten nach erfolgreichem Absenden dorthin weiter und feuern weiterhin das GA4-Lead-Event — kein Tracking-Verlust.
3. `MaestroInquiryBridge` bleibt global registriert (hört nur auf ein Event, stört nicht).

## Absicherung gegen Wiederholung
`MaestroWidget` wird resilient statt gelöscht: Skript-Ladefehler und "Widget nach 4 s nicht gerendert" werden erkannt und fallen automatisch auf das native Formular zurück. Damit kann später jederzeit risikofrei wieder auf ein Widget umgeschaltet werden.

Bis eine funktionierende Embed-URL vorliegt, ist das Widget per Flag **deaktiviert**.

## Verifikation vor Abschluss
- Browser-Test (Playwright) auf `/events` und `/en/events`: beide Formulare sichtbar, ausfüllbar, Validierung greift, Absenden erzeugt Anfrage und Redirect auf die Danke-Seite.
- Konsole ohne Fehler.

## Technisch
- Dateien: `src/components/events/EventContactForm.tsx`, `src/components/events/EventPackageInquiryDialog.tsx`, `src/components/maestro/MaestroWidget.tsx`
- Wiederherstellung via `git show f9291271:<pfad>`
- Backend/Edge Functions unverändert (`receive-event-inquiry`)

## Offene Frage
Falls du die korrekte MAESTRO-Embed-URL hast (der aktuelle Host existiert nicht), schick sie mir — dann schalte ich nach der Absicherung sauber und getestet darauf um.