## „Vorschau anzeigen" muss alles sofort syncen

### Was passiert beim Klick
`SendControls.goToPreview` navigiert auf `/admin/inquiries/:id/preview?send=proposal|final` → `OfferSendPreview` mountet.

Aktuell wird beim Mount:
- ✅ `create-event-quotation` aufgerufen (regeneriert LexOffice-Quotation bei Preis-/Remark-Drift, neue PDF) — Drift-Check seit letzter Iteration scharf
- ❌ Die letzte `inquiry_offer_history.email_content` wird **nicht** mit dem neuen `email_draft` aktualisiert → Public Offer zeigt weiterhin alten Text
- ❌ `v2_events.email_content_translations` wird **nicht** geleert → EN/IT/FR auf Public Offer bleiben veraltet
- ✅ „Private"-Fix in `HeroSection` ist bereits live (vorherige Iteration); nach Reload greift er sowohl im Admin-Iframe als auch auf der echten Public-Offer-URL

### Fix

In `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` direkt nach dem erfolgreichen Laden des Inquiry (im bestehenden Inquiry-Lade-`useEffect` oder als neuer `useEffect` auf `inquiry?.id` und `inquiry?.email_draft`) einmaligen Sync ausführen:

```ts
useEffect(() => {
  if (!inquiry?.id) return;
  const draft = (inquiry.email_draft ?? '').trim();
  if (!draft) return;

  (async () => {
    try {
      // 1) Letzte History-Version mit aktuellem Anschreiben in Sync bringen.
      //    Die Public-Offer-RPC liest IMMER zuerst aus inquiry_offer_history.
      const { data: hist } = await supabase
        .from('inquiry_offer_history')
        .select('id, email_content, version')
        .eq('inquiry_id', inquiry.id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hist?.id && (hist.email_content ?? '') !== draft) {
        await supabase
          .from('inquiry_offer_history')
          .update({ email_content: draft } as Record<string, unknown>)
          .eq('id', hist.id);
      }

      // 2) Übersetzungs-Cache leeren → EN/IT/FR werden neu erzeugt.
      await supabase
        .from('v2_events')
        .update({ email_content_translations: {} } as Record<string, unknown>)
        .eq('id', inquiry.id);
    } catch (e) {
      console.warn('[OfferSendPreview] public-offer sync failed (non-blocking):', e);
    }
  })();
}, [inquiry?.id, inquiry?.email_draft]);
```

- Non-blocking (kein `await` im Render-Pfad) — falls Sync scheitert, läuft die Preview trotzdem.
- Wird sowohl beim ersten Öffnen als auch nach jedem `refreshKey`-Trigger (via `inquiry`-State, dessen `email_draft` sich beim Reload aktualisieren kann) ausgeführt.
- LexOffice-Sync läuft bereits über das bestehende `loadLexofficePdf` → `create-event-quotation` mit Drift-Detection.
- „Private"-Problem ist bereits durch die `HeroSection`-Änderung gelöst; ein Hard-Reload des Browsers macht den Fix sichtbar.

### Geänderte Datei
- `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx` (ein neuer `useEffect`, ca. 30 Zeilen)

Keine Migration, keine Edge-Function-Änderung.
