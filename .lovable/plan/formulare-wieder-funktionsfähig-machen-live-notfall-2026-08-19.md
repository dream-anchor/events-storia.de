# Formulare wieder funktionsfähig machen (Live-Notfall)

## Befund (geprüft)
Das eingebundene Widget-Skript `https://api.maestro.cloud/api/public/widgets/v1/maestro.js` ist **nicht erreichbar** — der Host löst nicht auf (DNS existiert nicht). Deshalb bleiben Event-Kontaktformular und Paket-Anfrage-Dialog leer (siehe Screenshot: leerer Dialog "Angebot anfragen").

Die vom Betreiber genannte korrekte URL `https://storia.schrittmacher.ai/api/public/widgets/v1/maestro.js` wurde geprüft: **HTTP 200, 27 KB Widget-Loader** — funktioniert.

Betroffen:
- Event-Kontaktformular (`/events#contact`, `/en/events#contact`)
- Paket-Anfrage-Dialog ("Angebot erhalten" auf allen Paket-Karten, DE + EN)

Die alten, funktionierenden Formulare liegen unverändert in der Git-Historie (Commit vor "Formulare auf MAESTRO umgeschaltet") und sind vollständig wiederherstellbar.

## Maßnahme
1. **Korrekte Skript-URL eintragen**: `https://storia.schrittmacher.ai/api/public/widgets/v1/maestro.js` (defer), Widget bleibt **aktiv**.
2. **Native Formulare als Fallback zurückholen** (aus der Git-Historie, Commit `f9291271`):
   - `EventContactForm.tsx` (vollständiges Formular, Absenden an `receive-event-inquiry`)
   - `EventPackageInquiryDialog.tsx` (Paket-Anfrage inkl. Gästezahl/Preis)
   Sie werden nicht mehr direkt gerendert, sondern nur, wenn das Widget nicht lädt.
3. **`MaestroWidget` resilient machen**: Skript-`onerror` sowie "Widget nach 4 s nicht gerendert" (leerer Container) lösen automatisch den Fallback auf das native Formular aus. Damit kann nie wieder ein leeres Formular live gehen.
4. Danke-Seite (`/danke`, `/en/thank-you`) und `MaestroInquiryBridge` bleiben unverändert; der native Fallback leitet nach Absenden ebenfalls dorthin weiter und feuert das GA4-Lead-Event — kein Tracking-Verlust.

## Verifikation vor Abschluss
- Browser-Test (Playwright) auf `/events` und `/en/events`: Widget-Kontaktformular rendert Felder, Paket-Dialog ("Angebot erhalten") rendert Felder, beide ausfüllbar.
- Fallback-Test: mit blockierter Skript-URL erscheint das native Formular.
- Konsole ohne Fehler.

## Technisch
- Dateien: `src/components/events/EventContactForm.tsx`, `src/components/events/EventPackageInquiryDialog.tsx`, `src/components/maestro/MaestroWidget.tsx`
- Fallback-Komponenten via `git show f9291271:<pfad>` wiederherstellen
- Backend/Edge Functions unverändert (`receive-event-inquiry`)
- Danach empfiehlt sich ein Publish, damit die Korrektur live greift.