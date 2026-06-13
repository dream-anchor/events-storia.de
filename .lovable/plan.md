# Digitale Kostenübernahme (eSignatures.com)

Aus der Referenz-PDF `KOSTENÜBERNAHME.pdf` (nur inhaltliche Vorlage, niemals als Produktionsdokument verschickt) wird ein versionierbares **Markdown-Template** bei eSignatures.com erzeugt und nahtlos in den Public-Offer-Flow eingebettet.

## 1. Datenbank (Migration)

**Neue Tabelle `cost_acceptances`**
- `inquiry_id`, `offer_option_id`, `status` (`draft|pending_signature|signed|cancelled|expired`)
- Signer: `signer_name`, `signer_email`, `signer_mobile`, `signer_company_name`
- Event/Rechnung: `event_company`, `event_title`, `event_date`, `onsite_contact`, `guest_count`, `invoice_company`, `invoice_street`, `invoice_zip_city`, `invoice_reference`
- Checkboxen: `confirmations jsonb` (5 Felder)
- eSignatures: `esignatures_contract_id`, `esignatures_template_id`, `template_version`, `sign_page_url`, `sign_page_url_embedded`, `mfa_method` (`sms|photo_id|none`)
- Snapshot: `document_markdown_snapshot text`, `reference_pdf_name`, `reference_pdf_uploaded_at`
- Signiertes PDF: `signed_pdf_storage_path`, `signed_at`, `signed_pdf_sha256`
- Audit: `webhook_events jsonb[]`, `created_at`, `updated_at`
- RLS: nur admin/staff full; Public-Read über separate Edge Function (Token-basiert, kein direkter Anon-Read)

**Neue Tabelle `crm_settings`** (key/value) für `esignatures_cost_acceptance_template_id` + `template_version` (alternativ zu Secret).

**Private Storage Bucket** `cost-acceptances` (RLS: nur service_role + signed URLs für Admins).

**Erweiterung `v2_events`**: `cost_acceptance_id`, `locked_after_signature boolean default false`.

## 2. Markdown-Template (Code-versioniert)

Datei: `supabase/functions/_shared/cost-acceptance-template.ts`

Exportiert konstantes Markdown mit Platzhaltern (`{{offer_number}}`, `{{customer_number}}`, `{{offer_date}}`, `{{valid_until}}`, `{{amount_gross}}`, `{{currency}}`, `{{event_company}}`, `{{event_title}}`, `{{event_date}}`, `{{onsite_contact}}`, `{{guest_count}}`, `{{invoice_company}}`, `{{invoice_street}}`, `{{invoice_zip_city}}`, `{{invoice_reference}}`, `{{signer_name}}`, `{{signer_email}}`, `{{signer_mobile}}`, `{{signer_company_name}}`, `{{signature_date}}`, `{{additional_terms}}`) plus `TEMPLATE_VERSION` SemVer-String.

Struktur 1:1 wie PDF: Headline → Speranza/STORIA-Block → Angebotsbezug → Veranstaltungsangaben → Verbindliche Übernahme + Zahlungsziel 5 Werktage + Kontoverbindung → Zusatzleistungs-Klausel → Rechnungsanschrift → Bestätigungsblock mit Signer-Feldern (keine Leerlinien — alles Datenfelder / Signer-Fields).

## 3. Edge Functions

| Function | Zweck | verify_jwt |
|---|---|---|
| `create-esignatures-cost-acceptance-template` | Setup: POST `/api/templates` an eSignatures, speichert `template_id` + `version` in `crm_settings`. Idempotent. | true (Admin) |
| `sync-esignatures-template` | Vergleicht aktuellen Markdown-Hash mit gespeicherter Version; bei Diff: neues Template + neue `template_version`. | true (Admin) |
| `create-cost-acceptance-from-public-offer` | Erstellt `cost_acceptances`-Row, rendert Markdown-Snapshot, POST `/api/contracts` mit `template_id`, `locale="de"`, `metadata.cost_acceptance_id`, `custom_webhook_url`, `signature_request_delivery_methods=[]`, `signed_document_delivery_method="email"`, MFA-Regel siehe unten. Speichert `sign_page_url` + Embedded-Variante. | false (Public) |
| `esignatures-webhook` | HMAC-SHA256 prüfen, Event speichern, bei `contract-signed`: PDF von `contract_pdf_url` laden, in Storage `cost-acceptances/{id}/signed.pdf` ablegen, Status `signed`, Offer `accepted_signed` + lock, Timeline-Log. | false |
| `download-signed-cost-acceptance` | Admin-Download via signed URL. | true |

**MFA-Regel** (server-seitig, aus Betrag + B2B/B2C):
- B2C → SMS Pflicht
- B2B & Betrag ≥ 2.500 € → SMS
- Betrag ≥ 10.000 € → SMS Pflicht (überschreibt)
- Hook für künftiges `photo_id`-Flag (Admin manuell)

## 4. Public Offer Integration

Neue Section `CostAcceptanceSection.tsx` unterhalb der bestehenden Auswahl, sichtbar wenn Phase `confirmed`/`final_sent` und kein signiertes Doc existiert:

```text
┌─ Kostenübernahme verbindlich bestätigen ─┐
│ Angebot AGxxxx · 24.485,00 € brutto      │
│ Veranstaltung · Datum · Personen         │
│ Ansprechpartner vor Ort · Rechnungs-Adr. │
│ Hinweis: Zusatzleistungen/Mehrverbrauch  │
│                                          │
│ [Formular: fehlende Felder ergänzen]     │
│ [☐] 5 Pflicht-Checkboxen                 │
│                                          │
│  Kostenübernahme jetzt digital           │
│  unterschreiben →                        │
└──────────────────────────────────────────┘
```

Nach Klick:
1. Ruft `create-cost-acceptance-from-public-offer`
2. Bekommt `sign_page_url_embedded` zurück
3. Rendert iframe direkt in der Seite (`<iframe src=sign_page_url_embedded>`)
4. Auf Webhook-Erfolg (Realtime auf `cost_acceptances` subscribed) → Section wechselt zu Bestätigungs-State mit „Signiertes PDF herunterladen"

Bereits aus Angebot bekannte Werte werden vorausgefüllt; nur fehlende Felder müssen ergänzt werden. Pflicht-Checkboxen werden ins Markdown-Snapshot übernommen (sichtbar im signierten PDF).

5 Checkboxen wie spezifiziert; Checkbox 5 nur bei B2C (kein `company_name`).

## 5. Admin (InquiryEditor)

Neuer Tab/Card „Kostenübernahme":
- Status-Badge, Template-Version + Hinweis bei älterer Version
- Contract-ID, Signer-Daten, Signatur-Zeitpunkt, MFA-Methode
- Buttons: „Signiertes PDF herunterladen", „Audit-Events anzeigen" (Drawer mit `webhook_events`), „Kostenübernahme zurückziehen" (nur vor `signed`)
- Interner Hinweis: „Basiert inhaltlich auf Referenzdatei: KOSTENÜBERNAHME.pdf"
- Referenz-PDF wird im Kundenflow **nicht** angezeigt

## 6. Secrets / Setup

Neuer Secret: `ESIGNATURES_API_KEY`, `ESIGNATURES_WEBHOOK_SECRET`.
Setup-Reihenfolge nach Approval:
1. Migration ausführen
2. Bucket `cost-acceptances` (privat)
3. Secrets anfragen
4. `create-esignatures-cost-acceptance-template` einmalig aufrufen → `template_id` in `crm_settings`

## 7. Versionierung & Lock

- Jede Kostenübernahme speichert `esignatures_template_id` + `template_version` + `document_markdown_snapshot` → Audit-fest.
- Nach `signed`: `v2_events.locked_after_signature = true`. OfferBuilder respektiert Lock (zeigt Banner statt Edit; passt zur bestehenden Immutability-Regel).
- Bei Template-Update entsteht neue Version; alte Acceptances bleiben verknüpft mit alter Version.

## 8. Was NICHT im Scope ist

- Manuelles Nachbauen des Templates im eSignatures-Dashboard
- Direkte Verwendung der Original-PDF als Vertragsdokument
- Anzeigen der Referenz-PDF gegenüber dem Kunden
- Photo-ID-MFA-Implementierung (nur Schema-Hook)

## Reihenfolge der Umsetzung

1. Migration + Storage-Bucket (benötigt Approval)
2. Markdown-Template + Setup-Edge-Function
3. Secrets anfordern + Template anlegen
4. Public-Offer-Section + Edge Function `create-cost-acceptance-from-public-offer`
5. Webhook-Handler + PDF-Archivierung
6. Admin-UI im InquiryEditor
7. Lock-Mechanismus + Versionsanzeige

Bitte bestätige den Plan, danach starte ich mit Migration + Secret-Anfrage.
