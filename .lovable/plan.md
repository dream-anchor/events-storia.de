# Bestelldetail v2 — Bugs, UX, Mobile-Audit

Sechs Themen, geordnet nach Impact (Critical → UX → Mobile).

---

## 1. CRITICAL — „Neu berechnen" wirft non-2xx

**Ursache:** Frontend (`CateringOrderEditor.recalcDelivery`) sendet `{ delivery_address, subtotal }`, die Edge Function `calculate-delivery` erwartet aber `{ address, isPizzaOnly }` und gibt `deliveryCostGross` / `minimumOrder` zurück — nicht `delivery_cost` / `minimum_order_surcharge`.

**Fix in `CateringOrderEditor.tsx`:**
- Request: `{ address: \`${street}, ${zip} ${city}\`, isPizzaOnly: false }` (Pizza-only-Heuristik vorerst weglassen, Standard Hin+Rück).
- Response: `setDeliveryCost(data.deliveryCostGross)`; `minimumOrderSurcharge` = `Math.max(0, data.minimumOrder − itemsSubtotal) > 0 ? Aufschlag : 0` (gleiche Logik wie Checkout) — oder einfach Minimum-Hinweis in einen Toast packen, Aufschlag bleibt unverändert (er entstand aus dem ursprünglichen Checkout, keine automatische Nachberechnung).
- Toast inkl. Distanz + ggf. „Mindestbestellwert ${minimumOrder} € — aktuell ${itemsSubtotal} €".

---

## 2. CRITICAL — Status „Neu / offen" wird übersprungen

**Ursache:** `handle-stripe-webhook` setzt nach erfolgreicher Zahlung sofort `status: "confirmed"`. Da fast alle Bestellungen über Stripe laufen, landet nichts mehr in „Neu / offen". Spalte ist faktisch tot.

**Fix (Domänen-Entscheidung, dokumentiert):**
- Spaltentitel umbenennen: **„Neu / offen"** → **„Eingegangen, unbezahlt"**, beschreibt was wirklich drin landet (Rechnungs-/Abholzahlung wartet auf manuelle Bestätigung).
- Tooltip am Spaltenkopf: „Bestellung wurde aufgegeben, aber noch nicht bezahlt oder vom Team bestätigt."
- Optional: zweite Spalte **„Neu (bezahlt, ungeprüft)"** zwischen „Eingegangen" und „Bestätigt" — eingeführt durch neues Feld `reviewed_at` auf `catering_orders` (default `null`, setzt sich auf `now()` sobald jemand „Speichern" oder „Bestätigt" drückt). **Optional, nur wenn gewünscht** — frage ich Punkt-für-Punkt nach Build.
- **Minimaler Scope dieser Runde:** nur Umbenennung + Tooltip. Schema-Erweiterung später.

---

## 3. UX — Vollständige E-Mail-Adresse überall sichtbar

**Stellen:**
- `src/components/admin/shared/EmailStatusCard.tsx` Z. 177: `truncate max-w-[220px]` entfernen → `break-all` + `whitespace-normal`; Format immer `Name <email@host>` ausschreiben.
- `src/components/admin/shared/Timeline.tsx` Z. 359: aktuell `recipient_name || recipient_email` — auf `recipient_name ? \`${name} <${email}>\` : email` ändern.

---

## 4. UX — Layout-Redesign Bestelldetail (Mitte leer, rechts überfüllt)

**Problem (siehe Screenshots):** Linke Spalte zeigt nur „Bestellte Artikel" (1 Zeile) + leeres Notizfeld → riesige Lücke. Rechte Spalte stapelt Status, Kunde, Abholung, Zahlung, Rechnungsadresse, E-Mail-Verlauf → Scroll nötig, schlechte Hierarchie.

**Neuer Aufbau (Senior CX + Grafik):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Nummer · Status-Pill · Bezahl-Pill · Speichern / Storno │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: Bestellung │ Aktivitäten                                  │
├─────────────────────────────┬───────────────────────────────────┤
│  HAUPTSPALTE (≈60%)          │  KUNDEN-RAIL (≈40%, sticky top)   │
│                              │                                   │
│  ① Bestellte Artikel + ＋    │  Kunde (Name, Firma, E-Mail, Tel) │
│     Summen-Tabelle           │  ─────────────                    │
│                              │  Termin & Fulfillment             │
│  ② Termin & Fulfillment      │  (Abholung-Toggle, Datum,         │
│     (Datum/Zeit, Abholung↔   │   Uhrzeit, Adresse falls Liefer.) │
│     Lieferung, Adresse,      │  ─────────────                    │
│     „Neu berechnen")         │  Zahlung & Rechnung               │
│                              │  (Methode, Status, Rechnung erst.)│
│  ③ Rechnungsadresse          │                                   │
│                              │                                   │
│  ④ Interne Notizen           │                                   │
│                              │                                   │
│  ⑤ E-Mail-Verlauf            │                                   │
└──────────────────────────────┴───────────────────────────────────┘
```

**Konkret im Code:**
- Bisher: `grid-cols-3` mit `lg:col-span-2` links + 1 Spalte rechts.
- Neu: `lg:grid-cols-5` mit Haupt = `lg:col-span-3` und Rail = `lg:col-span-2`.
- Rail-Container: `lg:sticky lg:top-4 self-start max-h-[calc(100dvh-2rem)] overflow-y-auto`.
- „Termin & Fulfillment" wandert in die Rail (kompakter Block — Datum, Uhrzeit, Pickup-Toggle, Mini-Adressblock + „Neu berechnen"-Link).
- „Rechnungsadresse" + „Interne Notizen" wandern in die Hauptspalte (füllt die Mitte).
- „E-Mail-Verlauf" bleibt in Hauptspalte unten (volle Breite für lange Subjects + Adressen aus Punkt 3).
- Status- und Bezahl-Pill aus dem Rail-Status-Block in den Page-Header (oben rechts neben „Speichern / Stornieren") — der separate „Status"-Block in der Rail verschwindet.

---

## 5. UX — Warnhinweis vor Änderungen + Nachberechnungs-Logik

**Geänderte Felder mit Warnung (per `useEffect` + Dirty-State + AlertDialog auf „Speichern"):**

| Bereich              | Warnung                                                                                  |
|----------------------|------------------------------------------------------------------------------------------|
| Artikel (Menge/Preis/+/−) | „Du änderst die bestellten Speisen. Eventuelle Rechnung wird **nicht automatisch** neu erstellt — bitte ggf. neu generieren." |
| Lieferung ↔ Abholung      | „Wechsel ändert die Liefergebühr. Bitte **‚Neu berechnen'** drücken und neu speichern." |
| Adresse                   | „Neue Lieferadresse — bitte ‚Neu berechnen' drücken."                                  |
| Rechnungsadresse          | „Rechnung existiert bereits in LexOffice — neue Adresse betrifft nur künftige Rechnungen." (nur falls `lexoffice_invoice_id` gesetzt) |

**Nachberechnungs-Logik (transparent):**
- **Items:** `Gesamtsumme = Σ(qty × price) + minimumOrderSurcharge + deliveryCost` — live im UI sichtbar bei jeder Änderung. Kein Server-Roundtrip.
- **Lieferung:** Manuell über „Neu berechnen"-Button (Edge Function aus Punkt 1) — nie automatisch, damit der Operator entscheidet.
- **Mindestbestellwert-Aufschlag:** wird beim „Neu berechnen" mit aktualisiert (Differenz minimumOrder − itemsSubtotal, mind. 0).
- **Speichern:** schreibt `items[]` (JSONB), `total_amount = grandTotal`, `delivery_cost`, `minimum_order_surcharge`, `is_pickup`, Adresse, Datum, Zeit, Rechnungsadresse in `catering_orders`. Kein automatischer Rechnungs-Neuversand, kein automatisches Storno der alten LexOffice-Rechnung.
- Banner oben in der Bestellung wenn `dirty && hasInvoice`: „⚠️ Diese Bestellung hat bereits eine Rechnung — Änderungen ggf. manuell in LexOffice nachziehen."

---

## 6. CRITICAL — Mobile-Audit (Red Team, alle Seiten)

**Vorgehen:** Browser-Automation mit Viewport 375×812 durch jede Admin-Route + jede Public-Route. Pro Seite Screenshot, Klick-/Sichtbarkeitscheck der Primär-CTAs.

**Routenliste (geplant zu prüfen):**

*Public:* `/`, `/catering`, `/catering/*` (Pizza, Buffet, Fingerfood, Pasta, BBQ, Antipasti), `/events`, `/events/*`, `/checkout`, `/checkout/erfolgreich`, `/agb`, `/datenschutz`, `/impressum`, `/kontakt`, `/anfrage/:token`, `/zahlung/:token`.

*Admin:* `/admin` (Dashboard), `/admin/anfragen`, `/admin/anfragen/:id`, `/admin/bestellungen`, `/admin/bestellungen/:id/edit`, `/admin/events`, `/admin/events/:id/edit`, `/admin/posteingang`, `/admin/angebote`, `/admin/rechnungen`, `/admin/system-health`, `/admin/einstellungen`.

**Pro Seite geprüft:**
- Sind alle Primär-CTAs sichtbar ohne horizontalen Scroll?
- Sind sie tap-bar (≥ 44×44 px)?
- Werden Tabellen scrollbar dargestellt (oder als Karten umgebrochen)?
- Funktionieren Dialoge/Drawer auf 375 px Breite?
- Werden Texte abgeschnitten (`truncate` ohne Tooltip)?

**Deliverable:** Tabellarischer Bericht je Seite mit Severity (Critical / Warn / Info) + sofort-Fixes für Critical-Findings in dieser Runde (Mobile-Header, Bottom-Bar, Drawer-Höhe etc.). Größere Refactors (z. B. komplette Tabellen-Karten-Variante) werden gelistet, aber als Folge-Ticket vorgeschlagen.

---

## Reihenfolge der Umsetzung

1. **Bug-Fix Punkt 1** (Liefergebühr) — sofort, Edge-Function-Aufruf reparieren.
2. **Punkt 3** (E-Mail-Truncate) — 2-Zeilen-Patch.
3. **Punkt 2** (Spalten-Umbenennung) — Klarheit im Kanban.
4. **Punkt 4** (Layout-Redesign) — größte UX-Wirkung.
5. **Punkt 5** (Warnhinweise) — auf neues Layout aufgesetzt.
6. **Punkt 6** (Mobile-Audit) — Browser-Sweep + Critical-Fixes.

## Out of Scope (diese Runde)
- Automatische LexOffice-Neuausstellung bei Item-Änderungen.
- Neues `reviewed_at`-Feld + dritte Kanban-Spalte (Punkt 2 Variante B) — nur wenn explizit gewünscht.
- Komplettumbau der Public-Catering-Seiten auf Mobile (nur Critical-Fixes).
- Event-Booking-Editor-Redesign (analog, aber in eigener Runde).
