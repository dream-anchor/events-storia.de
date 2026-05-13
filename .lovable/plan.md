## Ziel

Die Druckliste soll auf einen Blick zeigen *was los ist*: Wer kommt wann, mit wie vielen Leuten, was ist gebucht (Paket/Menü), wo findet es statt und wer ist verantwortlich.

## Was sich pro Zeile ändert

Aktuell (zu dünn):
```
Mi 13.05  18:30  Müller GmbH         24 P   Karlstr. 47a    bezahlt
```

Neu (zweizeilig, kompakt):
```
Mi 13.05  18:30  │ 24 Pers │ Müller GmbH                              AM · bezahlt
                 │         │ Firmenfeier · Paket „Tartuferia" 4-Gang  · Hauptraum
```

Felder pro Auftrag:
- **Datum + Wochentag + Uhrzeit** (links, fix)
- **Personenzahl** prominent in eigener Spalte mit Rahmen (vorher zu klein, teils leer)
- **Kunde/Firma** fett
- **Kurzbeschreibung** (zweite Zeile, grau): `Anlass · Paket-/Menüname · Raum oder Stadt`
- **Verantwortliche/r** (2-Letter-Initialen) + **Status** rechts

Bei mehrtägigen Events: Datum als `Mi 13.–Fr 15.05.` darstellen.

## Datenbeschaffung

Im `UpcomingOrdersPrintDialog` zusätzlich folgendes laden, sobald der Dialog öffnet:

1. Für alle gefilterten Events mit `selected_option_id`: einmaliger Batch-Select auf `offer_options` (oder die korrekte Tabelle) → liefert `package_name`, `option_label`, ggf. Kurzfassung des Menüs (z. B. erste Course-Namen, kommagetrennt, max. 60 Zeichen).
2. Für `assigned_to` → Anzeige der Initialen via vorhandenem `getAdminInitials()`.

Adapter `eventToInquiryRecord` in `EventsList.tsx` und `mapV2Event` in `types/inquiryRecord.ts` werden um optionale Felder erweitert (alle nullable, keine Breaking Changes):
- `occasion: string | null`
- `packageLabel: string | null` (z. B. „Paket Tartuferia 4-Gang")
- `menuSummary: string | null`
- `roomOrCityShort: string | null`
- `assignedInitials: string | null`
- `dateEnd: string | null` für mehrtägige Events

Der Adapter parst `guest_count` robust (`Number(e.guest_count) || null` statt `parseInt`-Pfad, der aktuell bei manchen Datensätzen `null` liefert — das ist die Ursache des fehlenden „24 P").

## Layout `UpcomingOrdersSheet.tsx`

- Zwei-Zeilen-Row, Spaltenbreiten neu justiert.
- Personenspalte erhält dünnen Rahmen und zentrierte 11pt-Zahl, damit sie als „Headline" lesbar ist.
- Unterzeile in 8pt grau (`printColors.muted`), max. eine Zeile, mit Ellipsis.
- Gruppen-Header bleiben (KW / Monat). Sub-Header „In Haus / Außer Haus" bleiben.
- Zusatz in der Gruppen-Summenzeile: `∑ 3 Aufträge · 64 Personen · 2 In Haus / 1 Außer Haus`.

## Out of scope

- Keine Backend-/DB-Änderung.
- Keine neuen Filter (Mitarbeiter, Kategorie) — bleibt für v2.
- Keine Änderung an Bildschirm-UI der Anfragen-Liste, nur am Druckdokument und am Dialog-Datenladen.

## Betroffene Dateien

- `src/components/admin/refine/print/UpcomingOrdersSheet.tsx` — neues Row-Layout, Summenzeile.
- `src/components/admin/refine/print/UpcomingOrdersPrintDialog.tsx` — Batch-Query für Paket-/Menünamen, Anreicherung der Records vor Render.
- `src/components/admin/refine/EventsList.tsx` — Adapter `eventToInquiryRecord` um neue Felder erweitern, robustes Guest-Count-Parsing.
- `src/types/inquiryRecord.ts` — neue optionale Felder im Typ.
- `src/hooks/useUnifiedInquiries.ts` / `mapV2Event` — gleiche Felder befüllen, damit der Druck auch aus der Unified-Liste konsistent funktioniert.
