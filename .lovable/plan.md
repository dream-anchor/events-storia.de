# Plan: Public-Offer-Parität, Anschreiben-Fix, Kostenübernahme-Logik

Drei zusammenhängende Baustellen aus dem Review:

---

## 1. „Public Offer öffnen" = identisch zu „Vorschau anzeigen"

**Problem:** Aus dem Kostenübernahme-Block und anderen Stellen öffnet „Public Offer öffnen" die Live-Phase (z. B. `proposal_sent`). Die Vorschau aus dem Editor (`/preview?send=proposal|final`) zeigt aber das komplette gerenderte Angebot inkl. Anschreiben-Override, Preisbox, Buchungs-Karte und (im final-Fall) Kostenübernahme. Benchmark = Vorschau.

**Fix:**
- Alle internen Admin-Links auf Public Offer setzen denselben Mode wie das `OfferSendPreview`:
  - Vor dem ersten Versand → `?preview=1&send=proposal`
  - Nach Versand / wenn Kostenübernahme-Kontext → `?preview=1&send=final`
- Zentraler Helper `buildAdminPublicOfferUrl(inquiry, { phase })` ersetzt die heutigen direkten Slug-Links in `CostAcceptanceCard`, `SmartInquiryEditor`, evtl. Activity-Log-Links.
- `PublicOffer.tsx` interpretiert `?preview=1` zusätzlich zum bestehenden `previewSend`-Override und blendet konsistent denselben Header-Hinweis ein („Vorschau — Kunde sieht diese Ansicht").
- Verifikation: Screenshot-Vergleich „Vorschau anzeigen" vs. „Public Offer öffnen" → muss pixelidentisch sein (außer Vorschau-Banner).

---

## 2. Anschreiben sagt „keine Menü-/Paketkonfiguration vor", obwohl Paket gewählt ist

**Ursache** (in `supabase/functions/generate-inquiry-email/index.ts`):

```text
Zeile 547: packageName = (offer_mode === 'menu') ? 'Individuell' : (pkgNames[package_id] || 'Individuell')
Zeile 204: hasPackage = options.some(o => o.packageName && o.packageName !== 'Individuell' && ...)
```

Wenn `package_id` leer ist oder nicht in `pkgNames` aufgelöst werden kann (z. B. weil das Paket aus dem Maestro-Katalog ohne Eintrag in der gefetchten Liste kommt, oder weil die Option ein Paket per Freitext trägt), wird `packageName='Individuell'` → `hasPackage=false` → KI bekommt „HINWEIS: noch KEINE Menüs oder Pakete konfiguriert" → generiert den Fallback-Satz.

**Fix:**
- `hasPackage` und der Paket-Block dürfen sich nicht ausschließlich auf den Namen verlassen. Neue Erkennung:
  ```text
  isPackageOpt(o) = o.offerMode === 'paket'
                 || (o.offerMode !== 'menu' && o.offerMode !== 'email' && (o.packageName ?? '') !== '' && o.packageName !== 'Individuell')
  ```
- `packageName`-Fallback im Loader (Z. 547) ergänzen: wenn `pkgNames[id]` fehlt, den auf der Option gespeicherten `option_label` oder den ersten Menüpunkt-Titel verwenden statt blind „Individuell".
- Zusätzlich: Wenn `offer_mode === 'email'` (reines Anschreiben), den Fallback-Satz nur dann zulassen, wenn **alle** Optionen `email` sind. Sonst (gemischt: A=Menü leer, B=Paket gefüllt) → Hinweis weglassen, weil mindestens eine Option konfiguriert ist.
- Im AI-Prompt zusätzlich harte Regel: „Wenn mindestens eine Option ein Paket oder Menü enthält, ist die Formulierung ‚noch keine Menü- oder Paketkonfiguration' verboten."
- Test: Vor Deploy mit Original-Inquiry `9d1722e5-…` einmal `generate-inquiry-email` neu auslösen und Anschreiben prüfen.

---

## 3. Kostenübernahme als Funktion der Zahlungsmodalität (Full Audit)

**Heutiger Stand:**
- Kostenübernahme-Section wird im Public Offer nur bei `final_sent | confirmed | order_confirmed` gerendert (`PublicOffer.tsx:632–636`).
- Sie ist immer „optional" — der Kunde sieht keinen Hinweis, ob sie nötig ist oder nicht.
- Admin-Editor zeigt sie auch im `draft`/`proposal_sent`-Zustand, das passt nicht zur Public-Seite.

**Logik, die wir einführen wollen — Kostenübernahme als Vertragsschluss-Anker:**

| Anzahlung | Restzahlung | Kostenübernahme |
|---|---|---|
| Stripe sofort | beliebig | **optional** (Zahlung = Vertragsschluss) |
| Keine / Vor Ort / Rechnung vorab / Rechnung nach Event | Rechnung nach Event · Vor Ort · Rechnung vor Event | **PFLICHT vor Event** — sonst kein verbindlicher Vertrag |
| Keine | Stripe vorab | **PFLICHT**, da Zahlung erst kurz vor Event greift |
| Stripe sofort | Stripe vorab | optional |

Regel in einer Funktion `requiresSignedCostAcceptance(payment_conditions): boolean`:
```text
required = !(payment_conditions.deposit.kind === 'stripe_immediate')
```

**Sichtbarkeit & UI im Public Offer:**

1. **Immer rendern**, sobald das Angebot mindestens `proposal_sent` ist und `requiresSignedCostAcceptance === true`. Bei optional darf der Block ebenfalls gerendert werden, aber als „freiwillig"-Variante.
2. **Position:** prominent direkt unter der Buchungs-Karte (vor dem PDF-Download), nicht ganz unten. Wenn Pflicht → roter/warnender Badge „Verbindlich vor dem Event erforderlich".
3. **Frist:** Anzeige des spätesten Datums = `event_date − restzahlung_frist_tage` (bzw. + Anzahlungs-Frist), abgeleitet aus den `payment_conditions`-Feldern (siehe Bild „Zahlungs-Konditionen").
4. **Kopplung an Buchungs-Karte:** Wenn `requiresSignedCostAcceptance && !signed`, dann beim Stripe-Button im Public Offer Hinweis „Alternativ verbindlich per digitaler Kostenübernahme bestätigen". Wenn `signed`, Stripe-Buttons bleiben sichtbar (Kunde kann trotzdem zahlen), aber mit Badge „Vertrag bereits unterschrieben".
5. **Admin-Editor:** Kostenübernahme-Karte zeigt Pflicht/optional-Status anhand derselben Regel; bei „Pflicht" gelber Hinweis „Ohne unterschriebene Kostenübernahme entsteht aus diesem Angebot kein verbindlicher Vertrag."

**Backend:**
- Neue util `lib/costAcceptanceRequirement.ts` (Frontend) + spiegelbildlich in `supabase/functions/_shared/cost-acceptance-required.ts` (Edge), gespeist aus den `payment_conditions`-Feldern, die schon auf `v2_events` liegen.
- Reminder-System (vorhandenes `automated-reminder-system`) bekommt einen neuen Rule-Typ `cost_acceptance_required` → Mailing an Kunden + Slack/WA-Alert an Staff X Tage vor Event, wenn `required && !signed`.
- Activity-Log-Eintrag „Kostenübernahme als Pflicht eingestuft" beim Versand des Final-Angebots.

**Tests / Cases zum Durchspielen** (ergänzen den bestehenden `docs/cost-acceptance-testplan.md`):
- C1: Anzahlung Stripe sofort + Restzahlung Rechnung nach Event → Block optional sichtbar.
- C2: Keine Anzahlung + Restzahlung Rechnung nach Event → Block Pflicht, gelber Banner, Reminder T-14/T-7/T-3.
- C3: Anzahlung Stripe sofort, Anzahlung bezahlt → Block optional bleibt sichtbar, kein Reminder.
- C4: Pflicht-Block, Kunde unterschreibt → Reminder stoppen, Status-Badge „unterschrieben am …" auch im Admin sichtbar.
- C5: Admin ändert Zahlungs-Konditionen nach Versand → neue Version nötig (Immutability), Logik neu evaluiert.

---

## Technische Details (für die Umsetzung)

- **Files (vermutlich) angefasst:**
  - `src/components/admin/refine/InquiryEditor/CostAcceptanceCard.tsx` (Link-Helper, Pflicht-Badge)
  - `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (Pflicht-Hinweis-Banner)
  - `src/pages/PublicOffer.tsx` (Render-Regel + Position der Section)
  - `src/pages/public-offer/CostAcceptanceSection.tsx` (Pflicht/optional-Variante, Frist-Anzeige)
  - `src/lib/costAcceptanceRequirement.ts` *(neu)*
  - `supabase/functions/generate-inquiry-email/index.ts` (hasPackage-Fix, packageName-Fallback, Prompt-Regel)
  - `supabase/functions/_shared/cost-acceptance-required.ts` *(neu)*
  - `supabase/functions/send-cost-acceptance-email/index.ts` (Frist in DE+EN-Mail)
  - `supabase/functions/automated-reminder-system/*` (neue Rule)
  - `docs/cost-acceptance-testplan.md` (Cases C1–C5 ergänzen)

- **Reihenfolge der Implementierung:**
  1. Anschreiben-Bug (Nr. 2) — kleinster Eingriff, sofort verifizierbar.
  2. Public-Offer-Parität (Nr. 1) — UI-Helper + Render-Regel.
  3. Kostenübernahme-Requirement-Logik (Nr. 3) — größter Brocken, baut auf 1 auf.

- **Datenmigration:** keine Schema-Änderung nötig. Alle Felder (`payment_conditions`, `cost_acceptances.status`, `signed_at`, `locked_after_signature`) existieren bereits.

---

Sag Bescheid, ob ich in dieser Reihenfolge bauen soll — oder ob du Nr. 3 (Pflicht-Logik) zuerst willst.
