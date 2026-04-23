

# Angebots-Versionen Archiv: Liste + Detail-Ansicht (read-only) + „Kopieren als neues Angebot"

## Vision

Im Inquiry-Editor gibt es einen neuen Bereich **„Versendete Angebote (Versionsverlauf)"**. Pro versendeter Mail eine Karte (neueste oben). Klick → Detail-Ansicht im exakten Look der bestehenden `OfferSendPreview` — aber mit **Archiv-Banner**, **ohne Senden-/Bearbeiten-Buttons**, alles read-only. Aus jeder Karte und aus der Detail-Ansicht heraus: **„Als neues Angebot kopieren"** (Optionen werden geklont, neue Version wird vorbereitet, Editor öffnet sich) — und natürlich bleibt der bestehende Weg „Neues Angebot von Grund auf" erhalten.

## Datenlage (vorhanden, kein Migration)

Die Tabelle `inquiry_offer_history` enthält bereits alles:
- `version` (1, 2, 3, …) — neueste oben
- `sent_at`, `sent_by` (E-Mail des Admins)
- `email_content` (HTML der versendeten Anschreiben-Mail)
- `options_snapshot` (vollständige Optionen mit `menu_selection`, `total_amount`, `guest_count`, `package_id`, `offer_mode`, `option_label`, `stripe_payment_link_url` etc. — exakt wie zur Sendezeit)
- `pdf_url` (optional, falls archiviert)

Damit lässt sich jede vergangene Version zu 100 % rekonstruieren — ohne dass die Live-Optionen das beeinflussen können. Wichtig: **Das Archiv liest ausschließlich aus `options_snapshot`**, nie aus `inquiry_offer_options`.

## Neue UI

### 1. Liste „Versendete Angebote" — im SmartInquiryEditor

Position: direkt unter dem Kalkulations-/Aktivitäten-Bereich des Editors (an der Stelle, wo heute die History minimal/versteckt erwähnt wird). Nur sichtbar wenn `version >= 1` existiert.

```text
┌──────────────────────────────────────────────────────────┐
│ Versendete Angebote                       [Kopie → Neu] │ (Header-Action: kopiert die NEUESTE Version)
├──────────────────────────────────────────────────────────┤
│ v3 · 22.04.2026, 14:32 · Antoine Monot                   │
│ 3 Optionen · Network-Aperitivo, Business Lunch, Menü C   │
│ Summe: 4.544 € / 4.108 € / 3.890 €                       │
│ [Ansehen] [Als neues Angebot kopieren]                   │
├──────────────────────────────────────────────────────────┤
│ v2 · 20.04.2026, 09:15 · Mimmo                           │
│ 2 Optionen · Tasting Menu, Business Dinner               │
│ [Ansehen] [Als neues Angebot kopieren]                   │
├──────────────────────────────────────────────────────────┤
│ v1 · 18.04.2026, 16:02 · Antoine Monot                   │
│ 1 Option · Tasting Menu Auriga                           │
│ [Ansehen] [Als neues Angebot kopieren]                   │
└──────────────────────────────────────────────────────────┘
```

Design: Premium UI 2026, monochrome Cards, rounded-2xl, Inter, dezente `shadow-subtle`. Empty-State falls keine Versendung („Es wurde noch kein Angebot versendet").

### 2. Detail-Ansicht — `OfferArchivePreview`

Neue Route: `/admin/events/:id/archive/:version`

Aufbau **1:1 wie `OfferSendPreview`**, drei Blöcke:

1. **E-Mail an den Kunden** — Header (Von/An/BCC/Betreff aus heutiger Konfiguration), Body via iframe mit `srcDoc={history.email_content}`. Anhang-Hinweis „Angebots-PDF v{version}".
2. **Öffentliche Angebots-Seite** — iframe auf `/offer/:id?archive_version={version}` (siehe Backend-Anpassung unten). Damit sieht der Admin die exakte Version, die der Kunde damals bekommen hat.
3. **LexOffice-Angebots-PDF** — falls `pdf_url` gesetzt: direkt im iframe; sonst: Hinweis „Für diese Version kein PDF archiviert" plus Button „Aus Snapshot regenerieren" (Phase 2, nicht im Scope).

**Top-Banner statt Senden-Buttons:**
```
┌──────────────────────────────────────────────────────────┐
│ ◀ Zurück zum Angebot                                     │
│ ARCHIV · v3 · gesendet am 22.04.2026 um 14:32 von        │
│ Antoine Monot · Diese Ansicht ist schreibgeschützt       │
│                          [Als neues Angebot kopieren]    │
└──────────────────────────────────────────────────────────┘
```

Keine `Send`-Buttons, kein „Bearbeiten", kein Test-Versand. Die einzige primäre Aktion ist **„Als neues Angebot kopieren"**.

### 3. „Als neues Angebot kopieren" — Workflow

Klick (Liste oder Detail) öffnet einen `AlertDialog`:

> **Neues Angebot auf Basis von v3 erstellen?**
> Die Optionen aus dieser Version werden als bearbeitbarer Entwurf für die nächste Version übernommen. Das archivierte v3 bleibt unverändert.
> [Abbrechen] [Kopieren & bearbeiten]

Beim Bestätigen:

1. **Optionen klonen** — `options_snapshot` wird in `inquiry_offer_options` geschrieben (alle alten aktiven Options vorher auf `is_active = false` setzen, damit die Anzeige im Editor sauber ist). Neue IDs, `stripe_payment_link_url/id` zurücksetzen, `created_in_version = max_version + 1`.
2. **Inquiry zurücksetzen** — `offer_phase = 'draft_revision'` (neue Phase, semantisch klar: „Entwurf nach vorhandenem Versand"). Falls die Phase bestehende Logik bricht, mappen wir intern auf `draft` und merken uns über `current_offer_version` (bleibt stehen) plus `last_edited_at` den Revisions-Status.
3. **Editor öffnen** mit Toast „v3 als Entwurf geladen — bitte prüfen und versenden". `email_draft` wird mit dem alten `email_content` vorbefüllt (als Ausgangspunkt).

Wichtig: **Das alte v3 in `inquiry_offer_history` bleibt unangetastet** — Immutability-Regel des Projekts (Memory `business/offer-immutability-and-versioning-principle`).

### 4. Bestehender Weg „Neues Angebot von Grund auf"

Bleibt 1:1 erhalten. Im Editor-Header: zwei Pfade
- **„Neue Version (leer)"** — heutiger Knopf
- **„Letztes Angebot kopieren"** — Shortcut für die häufigste Aktion (kopiert v_max)

## Backend-Anpassungen

### Public-Offer-Page: optionaler `archive_version`-Param

`PublicOffer.tsx` lädt heute `inquiry_offer_options`. Neuer Modus: wenn `?archive_version=N` gesetzt **und** der Aufrufer authentifiziert (Admin-Session vorhanden) ist, wird stattdessen `options_snapshot` aus `inquiry_offer_history` geladen und damit gerendert. Banner oben: „Archiv-Ansicht v{N} — schreibgeschützt". Alle interaktiven Elemente (Quantity-Inputs, „Jetzt zahlen", „Auswahl absenden") werden in diesem Modus deaktiviert / ausgeblendet.

Sicherheit: Wenn unauthenticated User den Link mit `?archive_version=…` aufruft → Param wird ignoriert, normaler Live-Modus greift. Damit kann kein Kunde versehentlich auf eine alte Version geleitet werden.

### Hook-Erweiterung

`useOfferHistory` bleibt bestehen, nur `OfferHistoryEntry.options_snapshot` wird typgenauer (Match auf das echte `inquiry_offer_options`-Schema mit `package_id`, `offer_mode`, `menu_selection`, `total_amount`, `guest_count`, `option_label`, `stripe_payment_link_url`).

Neuer Hook `useCloneOfferVersion(inquiryId, version)`:
- liest History-Eintrag
- deaktiviert aktive Options
- inserted Options aus Snapshot mit neuen IDs
- updated Inquiry (Phase + Draft-Body)
- invalidiert Queries

## Geänderte / neue Dateien

**Neu:**
- `src/components/admin/refine/InquiryEditor/OfferHistoryList.tsx` — Versions-Liste mit Cards
- `src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx` — Detail-Ansicht (extrahierte Read-only-Variante von `OfferSendPreview`)
- `src/hooks/useCloneOfferVersion.ts` — Klon-Logik

**Erweitert:**
- `src/hooks/useOfferHistory.ts` — Typ-Schärfung, vollständige Snapshot-Spalten
- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` — `OfferHistoryList` einbinden, „Letztes Angebot kopieren"-Button im Header
- `src/pages/PublicOffer.tsx` — `?archive_version`-Modus (read-only Banner, Snapshot statt Live-Options, keine Interaktion)
- `src/App.tsx` — neue Route `/admin/events/:id/archive/:version`

Keine DB-Migration. Keine neuen Edge Functions.

## Verifikation

1. **Liste sichtbar:** Test-Anfrage `ade7e81f` (3 Optionen, draft) → noch keine Version → Empty-State. Nach dem nächsten Versand → v1 erscheint.
2. **Mehrere Versionen:** v1 mit 1 Option senden → Editor → „Letztes kopieren" → 2. Option ergänzen → senden = v2. Liste zeigt v2 oben, v1 darunter.
3. **Detail-Ansicht v1:** Klick → URL `/admin/events/{id}/archive/1` → drei Blöcke, Banner sichtbar, keine Send-Buttons. iframe Block 2 zeigt die alte Single-Option-Auswahl, nicht die aktuelle v2.
4. **Read-only Public-Offer:** `/offer/{id}?archive_version=1` (in Admin-Session) → Quantity-Inputs disabled, „Jetzt zahlen" weg, Banner „Archiv-Ansicht v1". Ohne Login: zeigt Live-v2 wie immer.
5. **Kopieren:** „Als neues Angebot kopieren" auf v1 → Dialog → Bestätigen → Editor öffnet, alte aktive Options inaktiv, Snapshot-Options als neue Drafts sichtbar, `email_draft` vorbefüllt. v1 in History unverändert.
6. **Immutability:** Versuch v1 zu „bearbeiten" → kein UI-Pfad existiert. Versuch via direkter URL `/admin/events/:id/edit?archive=1` → Route greift nicht, Editor öffnet immer den Live-Stand.

