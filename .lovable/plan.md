## Zwei Bugs auf der Public-Offer-Seite

### 1. „Private" statt Kundenname in der H1

`HeroSection` verwendet `company_name || contact_name`. Im Funnel wird für private Events `company_name = "Private"` gesetzt — dadurch erscheint statt „Jonathan Starke" der Platzhalter „Private".

**Fix:** `displayName` in `src/pages/public-offer/HeroSection.tsx` so anpassen, dass „Private" (case-insensitive, mit/ohne Whitespace) wie eine leere Firma behandelt wird → Fallback auf `contact_name`.

```ts
const company = (inquiry.company_name ?? '').trim();
const isPlaceholderCompany = !company || company.toLowerCase() === 'private';
const displayName = isPlaceholderCompany ? inquiry.contact_name : company;
```

Keine DB-Migration, kein Daten-Backfill — der Funnel darf weiterhin „Private" speichern (interne Kategorisierung), aber die öffentliche Hero zeigt den Namen.

### 2. Public Offer zeigt alten Anschreiben-Text trotz „Angebot bearbeiten"

**Root-Cause (verifiziert):**

Die Public-Offer-RPC `get_public_offer` liefert `email_content` aus:
```sql
COALESCE(
  (SELECT ioh.email_content FROM inquiry_offer_history ioh
   WHERE ioh.inquiry_id = offer_id ORDER BY version DESC LIMIT 1),
  ei.email_draft
)
```

Sie liest also **immer zuerst aus `inquiry_offer_history.email_content`** der höchsten Version. `event_inquiries.email_draft` ist nur Fallback.

Status der Beispiel-Anfrage:
- `email_draft` enthält den **neuen** Anschreiben-Text (regeneriert via „Angebot bearbeiten").
- `inquiry_offer_history` v7 enthält den **alten** Text → Public Offer zeigt diesen.

Zusätzliches Problem aus dem vorherigen Loop: OfferBuilder und SmartInquiryEditor schreiben auf eine Spalte `email_content` von `event_inquiries`/`v2_events`, die **gar nicht existiert**. Der Update schlägt fehl (Spalte nicht gefunden) und bricht im SmartInquiryEditor-Versand sogar den gesamten Send-Flow ab (Zeile 762–776 → frühzeitiger `return` mit Toast „Phase-Update fehlgeschlagen").

**Fix in drei Schritten:**

#### A) Bad-Write entfernen (`event_inquiries.email_content` existiert nicht)

In `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx` (Zeile 174–178):
```diff
- email_draft: data.email,
- email_content: data.email,
- email_content_translations: {},
+ email_draft: data.email,
```
und parallel `v2_events.email_content_translations: {}` als zweiten Update lassen (gültige Spalte).

In `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (Zeile 753–764):
```diff
const updatePayload = {
  current_offer_version: newVersion,
  offer_sent_at: nowIso,
  offer_sent_by: user?.email || null,
  status: 'offer_sent',
  offer_phase: phaseTarget,
- email_content: draft,
- email_content_translations: {},
};
```
Den zugehörigen `email_content_translations`-Reset stattdessen direkt auf `v2_events` schreiben (eigener Update auf gültige Spalte).

Das behebt zugleich den fehlgeschlagenen Send-Flow.

#### B) Regenerate-Pfad: aktuelle History-Version aktualisieren

Im OfferBuilder-Regenerate (`handleGenerateEmail`, nach erfolgreichem AI-Call und `email_draft`-Update):

```ts
const { data: histRow } = await supabase
  .from('inquiry_offer_history')
  .select('id, version')
  .eq('inquiry_id', inquiry.id)
  .order('version', { ascending: false })
  .limit(1)
  .maybeSingle();

if (histRow?.id) {
  await supabase
    .from('inquiry_offer_history')
    .update({ email_content: data.email })
    .eq('id', histRow.id);
}

await supabase
  .from('v2_events')
  .update({ email_content_translations: {} })
  .eq('id', inquiry.id);
```

Dadurch reflektiert die Public-Offer-Seite den neu generierten Text sofort (RPC liest latest history zuerst) und EN/IT/FR werden neu übersetzt.

Hinweis zur Immutability: „Angebot bearbeiten" erzeugt im Hintergrund bereits eine neue Version (versioniertes Verhalten bleibt erhalten); hier wird genau diese aktuelle Version mit dem zugehörigen Anschreiben in Sync gebracht. Ältere Versionen bleiben unverändert.

#### C) Send-Pfad: bestehender History-Insert ist korrekt

`SmartInquiryEditor` Zeile 786–792 fügt bereits einen neuen `inquiry_offer_history`-Eintrag mit `email_content: draft` ein. Nach Entfernen des falschen `event_inquiries.email_content`-Updates aus (A) läuft der Send wieder durch und legt eine neue History-Version mit aktuellem Text an. Translations werden separat über das neue `v2_events.email_content_translations: {}`-Update geleert.

### Geänderte Dateien

- `src/pages/public-offer/HeroSection.tsx` (Display-Name-Fallback)
- `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx` (Regenerate-Sync: aktuelle History-Version aktualisieren, kein write auf nicht-existente Spalte)
- `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` (Send-Pfad: kein write auf nicht-existente Spalte; Translations-Reset auf `v2_events` umziehen)

Keine Migration, keine Edge-Function-Änderung, keine RPC-Änderung.
