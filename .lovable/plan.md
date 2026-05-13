## Bewertung als Senior CX Engineer

Das Vorgehen ist richtig: Die Pipeline muss den tatsächlichen Kunden-/Sales-Zustand abbilden, nicht technische Zwischenzustände. Entscheidend ist, dass es eine eindeutige Status-Logik gibt, die sowohl automatisch als auch bei manueller Verschiebung dieselben Zustände setzt.

Die Zieldefinition ist stimmig:

```text
Neu                 = neue, noch nie bearbeitete Anfrage
In Bearbeitung      = bearbeitet / Angebot wird erstellt / versendetes Angebot wird überarbeitet
Angebot verschickt  = Angebot wurde aktiv an Kunden verschickt
Gebucht             = verbindliche Buchung
```

Wichtig: „Angebot verschickt“ darf nur gelten, solange nicht wieder daran gearbeitet wird. Sobald ein bereits verschicktes Angebot bearbeitet/entsperrt wird, gehört es wieder in „In Bearbeitung“.

## Gefundene Ursache Public Offer Archiv

In `OfferArchivePreview` wird der Archiv-iframe so geöffnet:

```text
/offer/:id?archive_version=N
```

`PublicOffer.tsx` liest diesen Parameter aktuell aber nicht aus. Dadurch lädt die Vorschau immer das aktuelle Live-Angebot über `get_public_offer`, nicht den archivierten Snapshot aus `inquiry_offer_history.options_snapshot`.

Wenn das Live-Angebot inzwischen wieder auf Entwurf/Bearbeitung steht, Optionen deaktiviert wurden oder `offer_phase` nicht mehr zum alten Angebot passt, verschwinden in der Archivansicht Menü-Optionen und Zahlungsbuttons. Das ist falsch, weil Archiv-Versionen immutable sein müssen.

## Plan

### 1. Public Offer Archiv wirklich als Snapshot anzeigen

- `PublicOffer.tsx` erkennt `archive_version`.
- Bei gesetztem `archive_version` wird nicht das aktuelle Live-Angebot als Quelle für Optionen verwendet.
- Stattdessen wird die passende Version aus `inquiry_offer_history` geladen.
- `options_snapshot` wird in das bestehende Public-Offer-Datenformat gemappt.
- Die öffentliche Angebotsseite rendert dann wieder:
  - archiviertes Anschreiben,
  - archivierte Menüoption(en),
  - Menüdetails,
  - die bestehenden Zahlungsbuttons unter den Optionen.

Falls im Snapshot kein Stripe-Link gespeichert ist, bleiben die Buttons trotzdem sichtbar und nutzen wie bisher die Payment-Session-Erstellung über Inquiry + Option.

### 2. Status-Labels vereinheitlichen

- Kanban-Spalte umbenennen:
  - von `Angebot raus`
  - zu `Angebot verschickt`
- Status-Badge in der Tabelle ebenfalls auf `Angebot verschickt` ausrichten, statt gemischter Begriffe wie „Angebot gesendet“/„Angebot“.

### 3. Status-Automatik an der CX-Logik ausrichten

Eine zentrale Mapping-Logik wird in den betroffenen UI-Flows konsistent angewendet:

```text
new        -> Neu
contacted  -> In Bearbeitung
offer_sent -> Angebot verschickt
confirmed  -> Gebucht
declined   -> Abgelehnt
cancelled  -> Abgesagt
```

Automatische Übergänge:

- Neue Anfrage bleibt `new`, solange keine Bearbeitung erfolgt.
- Beim ersten Bearbeiten/Speichern wird `new` automatisch zu `contacted`.
- Beim Versenden eines Angebots wird Status `offer_sent`.
- Wenn ein bereits verschicktes Angebot zur Bearbeitung geöffnet/entsperrt wird, wird Status `contacted` und `offer_sent_at` zurückgesetzt.
- Nach erneutem Versand wird wieder Status `offer_sent`.
- Bei verbindlicher Buchung wird Status `confirmed`.

### 4. Sortierung in allen Spalten korrekt setzen

Kanban-Sortierung wird so angepasst:

- `Neu`: neueste Anfrage oben (`created_at desc`)
- `In Bearbeitung`: letzte Bearbeitung oben (`last_edited_at` / `updated_at desc`)
- `Angebot verschickt`: letzter Versand oben (`offer_sent_at desc`)
- `Gebucht`: Buchungs-/Statusänderung oben, fallback auf `updated_at` / Eventdatum

Damit steht in jeder Spalte die aktuell relevanteste Anfrage oben.

### 5. Manuelle Verschiebung bleibt erhalten

Drag & Drop sowie das Karten-Menü bleiben möglich. Sie setzen weiterhin denselben Datenstatus wie die Automatik:

- nach `Neu` → `new`
- nach `In Bearbeitung` → `contacted`
- nach `Angebot verschickt` → `offer_sent`
- nach `Gebucht` → `confirmed`

Damit widersprechen manuelle und automatische Steuerung sich nicht mehr.

## Technische Hinweise

- Keine Schemaänderung nötig, weil die benötigten Felder (`status`, `offer_phase`, `offer_sent_at`, `last_edited_at`, `current_offer_version`, `options_snapshot`) bereits existieren.
- Die wichtigste Reparatur ist frontendseitig: `archive_version` muss in `PublicOffer.tsx` ausgewertet werden.
- Zusätzlich wird die bestehende Entsperr-/Bearbeitungslogik korrigiert, weil dort aktuell teils `status: 'offer_sent'` beibehalten wird, obwohl das Angebot wieder in Bearbeitung ist.