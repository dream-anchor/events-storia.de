## Ziel
Beim manuellen Annehmen eines Angebots (telefonisch/E-Mail/vor Ort) soll der Betreiber das **Menü der gewählten Option noch anpassen** können — z.B. weil am Telefon "statt Tiramisu nehmen wir Panna Cotta" besprochen wurde — **bevor** die Annahme final gespeichert und Rechnung/Bestätigung versendet werden.

## Lösungsansatz

### 1. „Menü anpassen" direkt im OfferAcceptanceDrawer
Im Block der gewählten Option (`OfferAcceptanceDrawer.tsx`) erscheint neben der Option ein dezenter Button **„Menü anpassen"**. Klick öffnet den bestehenden Menü-Editor (gleiche Komponente wie im OfferBuilder, `MenuComposer` / `PackageMenuEditor`) — vorausgefüllt mit dem aktuellen `menu_selection` der Option.

Auch für Pakete (offer_mode = `paket`) wird derselbe Pfad genutzt — bei Bedarf kann der Editor sowohl Menü-Composition als auch Paket-Items bearbeiten.

### 2. Versionierung bleibt sauber (Immutability-Prinzip)
Wir respektieren die Regel „Angebote sind nach Versand unveränderlich". Speichern erzeugt deshalb **automatisch eine neue interne Version** der Option (`v2_offer_options`), markiert mit:
- `version` = letzte + 1
- `post_acceptance_adjustment = true` (neue Spalte, boolean)
- `adjustment_reason` (z.B. „telefonisch besprochen")

Die alte Version bleibt erhalten (Audit-Trail). Im PublicOffer wird die neue Version **nicht** automatisch an den Kunden gesendet — sie ist eine interne Korrektur basierend auf der mündlichen Annahme.

### 3. Gäste & Total werden automatisch nachgezogen
Nach Save aus dem Menü-Editor:
- Drawer-State lädt Option neu
- `guest_count` und `amount_total` (aus Maestro-Prinzip: Preis × Gäste) werden in die Felder „Gästezahl final" / „Gesamtbetrag" übernommen
- Banner: „Menü angepasst — neue Version V{n} angelegt"
- Interne Notiz wird ergänzt mit „Menü angepasst: {summary}"

### 4. Aktivitäts-Log
Eintrag in `activity_logs`:
- `action`: `offer_menu_adjusted_at_acceptance`
- `metadata`: { option_id, old_version, new_version, reason, diff_summary }

### 5. Confirm-Order Edge Function
`confirm-order` braucht keine Änderungen — sie nutzt automatisch die aktuelle (= angepasste) Option-Version, da `selected_option_id` auf die neueste Version zeigt.

## Technische Details

### Geänderte/neue Dateien
- `src/components/admin/refine/InquiryEditor/OfferAcceptanceDrawer.tsx` — Button „Menü anpassen" pro Option, Inline-Dialog mit Menü-Editor, Reload-Logik nach Save
- `src/components/admin/refine/OfferAcceptanceMenuEditor.tsx` (neu) — Wrapper um bestehenden `MenuComposer`, der Versionierung beim Save handhabt
- Migration: `v2_offer_options` erhält `post_acceptance_adjustment boolean default false` und `adjustment_reason text`

### Wiederverwendete Komponenten
- Bestehender `MenuComposer` / `PackageMenuEditor` aus OfferBuilder
- Bestehende Versionierungs-Logik (gleicher Pfad wie „Angebot bearbeiten")

### Edge Cases
- **Mehrere Optionen**: Nur die im Drawer **gewählte** Option ist anpassbar; andere bleiben sichtbar, aber readonly.
- **Abbruch**: Schließen des Menü-Editors ohne Save erzeugt **keine** neue Version.
- **Nach erfolgter Annahme**: Wenn die Annahme schon gespeichert wurde, ist das ein separater Flow („nachträgliche Korrektur" — heute schon möglich über InquiryEditor). Dieser Plan deckt nur den Pfad **vor** Klick auf „Angebot annehmen" ab.

### Kompatibilität
Keine Breaking Changes — bestehende Annahme funktioniert weiter, „Menü anpassen" ist optional.
