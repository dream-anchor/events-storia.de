# Checkpoint 2026-07-06 — Angebots-Builder (Spec 02, F1–F3)

> Dritte umgesetzte Modul-Stufe. Der Angebots-Builder ist der **Kern des Abschluss-Flows**
> (Nordstern-Metrik). F1–F3 (Engine + Datenmodell + API) sind gebaut und live gegen Neon
> verifiziert. Die Builder-**Oberfläche (F4)** ist der nächste Schritt.

## Was gebaut wurde

| Ebene | Datei(en) | Inhalt |
|---|---|---|
| Engine | `packages/pricing` | Deterministische **Cents-Engine** — EINE Quelle für UI, Public-Offer, LexOffice, Stripe |
| DB | `packages/db` · `sql/40_offer_builder.sql` | `offer_items` + `offer_option_days` + Kopf-/Rabatt-/Versions-/Summenfelder auf `offer_options` |
| API | `apps/api/src/routes/offer-items.ts` | Items-Upsert (Optimistic Locking), Rabatt, Zielpreis, Duplizieren |

### Behebt gezielt die Alt-System-Geld-Bugs (Spec 02 A)
- **Float-Euro → Integer-Cents** durchgängig; Mengen als Tausendstel (`qty_milli`), Division
  erst nach der Multiplikation, Rundung pro Zeile.
- **Faktor-N-Bug** (per_event × Gästezahl) strukturell unmöglich: Preismodus ist Zeilen-
  eigenschaft (`per_person`/`per_unit`/`flat`), keine überschreibbare Heuristik.
- **USt nie rückwärts geraten:** je Satz aus Brutto `vat = gross − round(gross/(1+rate))`,
  dieselbe Formel später im LexOffice-Export.
- **Eine Engine statt drei:** Totals sind **ausschließlich servergerechnet** — ein direkter
  Schreibzugriff auf `amount_total_cents` existiert nicht (API-Gate).

### Sicherheit & Nebenläufigkeit
- **Optimistic Locking:** `PUT items` verlangt `If-Match: <items_version>`; Option wird per
  `SELECT … FOR UPDATE` gesperrt, Konflikt → `409` + Serverstand (kein stiller Datenverlust).
- **Composite-FKs** `(tenant_id, option_id)` / `(option_id, day_no)` / `(tenant_id, catalog_item_id)`
  schließen Cross-Tenant-Referenzen aus (FKs laufen als Owner und umgehen RLS).
- Nebenbei repariert: `catalog_items`-Kategorie-FK auf die Spalten-Liste-Form
  `ON DELETE SET NULL (category_id)` — die plain-Form scheiterte am `NOT NULL tenant_id`
  (Löschen einer Kategorie mit Artikeln war vorher kaputt).

## Verifikation (gegen LIVE Neon)
- **Pricing-Engine: 20 Tests** inkl. 400-Fall-Property-Test (USt-Buckets summieren immer
  cent-exakt auf den Endpreis; nie Float).
- **API: 8 e2e-Tests** — server-autoritative Totals, `If-Match`/`428`/`409`, Tages-Gästezahl,
  Zielpreis-Anpassung, Rabatt-USt-Split (7 %+19 %), Duplizieren, Tenant-Isolation.
- **RLS-/Composite-FK-Isolation** separat live bewiesen (Fremd-Tenant 0 Zeilen, Forged-Insert
  blockiert, Cross-Tenant-Option-FK blockiert, ungültiger `day_no` blockiert, max. 1 Anpassung).
- **Volle Suite: 83/83 grün.** Migration `sql/40` auf Neon angewendet.

## Anwenden (im lokalen `maestro-cloud`-Checkout)
Bundle `maestro-katalog-speisekarten-builder.bundle` (**3 Commits** — Katalog +
Speisekarten-Import + Angebots-Builder, Basis `5efc2b2`):
```bash
git fetch ./maestro-katalog-speisekarten-builder.bundle HEAD && git merge FETCH_HEAD && git push
```
Alle DB-Migrationen (`30`, `31`, `40`) sind bereits live; für frische Umgebungen idempotent.

## Nächster Schritt: F4 Positions-Editor (UI, XL)
Sektionen (Menü/Getränke/Equipment/Personal/Sonstiges), Zeilen mit Menge/Einheit/EP/
Preismodus/MwSt-Chip, Summenpanel (live vom Server), Autosave mit Konflikt-Dialog,
Mehrtags-Tabs, Katalog-Picker. Danach: Public-Offer-Seite + LexOffice-Export auf
`offer_items` umstellen (F7/F8), KI-Vorschlag/Freitext-Import (F9).
