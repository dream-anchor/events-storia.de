## Reihenfolge & Scope

Reihenfolge nach Risk/Reward: erst die zwei kleinen Fixes (5 Min), dann der mittlere Auto-Rechnung-Hook (30 Min), zum Schluss der große Bestelldetail-Editor (Hauptteil).

---

### 1. Shop "Bestellen"-Button immer klickbar + AGB-Warnung

**Datei:** `src/components/checkout/StickyMobileCTA.tsx` + Desktop-Submit in `src/pages/Checkout.tsx`

**Heute:** Button ist enabled, aber wenn AGB nicht angehakt sind, blockiert `Checkout.handleSubmit` still mit einem Toast. User sieht keinen visuellen Hinweis am Häkchen.

**Änderung:**
- Button bleibt **immer aktiv** (bereits so für Mobile — Desktop angleichen).
- Beim Klick ohne AGB-Häkchen: AGB-Checkbox bekommt rot-pulsierende Border + Scroll-into-view + Toast "Bitte AGB akzeptieren".
- AGB-Checkbox-State global im Checkout-Form (existiert bereits), nur visuelles Feedback nachziehen.

---

### 2. Bounce-Adresse `d.speranza@storia-muenchen.de` entfernen

**Strategie:** Code grep nach `d.speranza` ergab 0 Treffer. Adresse liegt in DB (Admin-User-Tabelle / Notification-Empfänger-Config).

**Vorgehen:**
- Suche in `user_roles`, `admin_presence`, `notification_recipients` (falls existiert), und Edge-Function-Code für hartkodierte Empfängerlisten.
- Entferne den Eintrag bzw. ersetze durch `info@events-storia.de`.
- Bei `notify-customer-response`: Empfängerliste als Array statt komma-string an Resend übergeben (Bonus-Fix).

---

### 3. Auto-Rechnung + Bestätigungsmail bei manueller "bezahlt"-Markierung

**Dateien:**
- `src/components/admin/refine/InquiryEditor/AddPaymentDrawer.tsx` — neuer Switch
- `supabase/functions/handle-stripe-webhook/index.ts` — Logik extrahieren in shared helper
- (oder direkt) Trigger der `create-lexoffice-downpayment-invoice` / `create-lexoffice-final-invoice` Pipeline aus dem Drawer

**Änderung im AddPaymentDrawer:**
- Wenn `status` direkt als `paid` markiert wird (Zahlungsweg "manuell"), neuer Checkbox-Block:
  - ☑ "Rechnung über LexOffice erstellen" (Default EIN)
  - ☑ "Bestätigung an Kunde senden" (Default EIN)
- Nach Insert mit `status='paid'`:
  - LexOffice-Invoice-Edge-Function aufrufen (Anzahlung vs. Schlussrechnung anhand `payment_type`).
  - `send-payment-confirmation-email` (existiert ggf., sonst `send-payment-email` mit `is_confirmation: true`).
  - Beides in `email_delivery_logs` loggen.

---

### 4. Bestelldetail-Overhaul (Catering-Order / Event-Order)

**Datei:** Neue Komponente `src/components/admin/orders/OrderEditor.tsx` ersetzt aktuellen statischen View unter Route `/admin/orders/:id/edit`.

**Heute:** Mitte ist leer, nur "Bestellte Artikel" + "Interne Notizen". Rechts Status + Kunde + Abholung + Zahlung + Rechnungsadresse.

**Neu — alles editierbar in 4 Cards (mittlere Spalte gefüllt):**

| Card | Editierbar | Effekt |
|---|---|---|
| **Bestellte Artikel** | +/−/Menge ändern, Artikel hinzufügen aus Katalog | Zwischensumme + Gesamt live neu berechnen |
| **Termin & Fulfillment** | Datum, Zeit, Abholung↔Lieferung umschalten + Adresse | Bei Umschalten auf Lieferung: Liefergebühr per `calculate-delivery-cost` Edge Function neu kalkulieren; Mindestbestellzuschlag prüfen |
| **Rechnungsadresse** | Name, Straße, PLZ, Stadt, Land, Firma, USt-IdNr | Bei vorhandener LexOffice-Invoice: Hinweis "Adresse wird erst auf zukünftigen Belegen verwendet, bestehende Rechnung bleibt unverändert" |
| **Status & Zahlung** | Status-Dropdown, "Als bezahlt markieren" (siehe Punkt 3), Storno mit Grund | Bei Storno: LexOffice-Storno-Beleg optional |

**Layout (Desktop):**
```
[Header: Order-Nr • Status • Speichern/Storno]
[Tabs/Sections in mittlerer Spalte, Sidebar rechts mit Customer + Audit-Log]
```

**Validierung:**
- Jede Änderung → optimistic UI + Toast + Eintrag in `activity_logs`.
- "Speichern" zentral oben, Sticky.
- Bei kritischen Änderungen (Adresse nach Rechnungsstellung): Bestätigungsdialog.

**Audit:**
- Jede Änderung in `activity_logs` mit `old_value` / `new_value`.

---

## Technische Details

- Catering-Order liegt in `catering_orders` (aktuelle Tabelle, nicht `_legacy_…`).
- Items als JSONB (`items` Spalte) — UI braucht Item-Editor mit Katalog-Picker aus `equipment_catalog` und Standard-Menüs.
- Liefergebühr-Berechnung über vorhandene `calculate-delivery-cost` Edge Function (falls nicht da: neue Function mit Google-Maps-Distanz + Tarif-Tabelle).
- AGB-Validierung im Checkout bereits in `Checkout.tsx.handleSubmit` vorhanden — nur visuelles Feedback nachziehen.

## Out of Scope (separate Runden)

- Komplettes Rewrite der Event-Booking-Detailseite (nur Catering-Order in dieser Runde).
- Storno-Refund über Stripe API (manuelles Storno-Flag reicht für jetzt).
- Drag-and-Drop Item-Reordering.
- WhatsApp-Notification bei Order-Änderung an Kunde.
