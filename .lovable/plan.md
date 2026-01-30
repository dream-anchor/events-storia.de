

# Plan: Automatische Status-Kategorisierung reparieren

## Problemanalyse

Die Datenbankabfrage zeigt, dass Anfragen wie "Test3" einen `email_draft` haben und `last_edited_at` gesetzt ist, aber `offer_sent_at` ist NULL. Die Dashboard-Kategorisierung:

| Spalte | Aktuelle Logik | Problem |
|--------|----------------|---------|
| Neue Anfragen | `status === 'new' && !last_edited_at` | OK |
| In Bearbeitung | `last_edited_at && !offer_sent_at` | Anfragen mit generiertem Entwurf bleiben hier hängen |
| Angebot versendet | `offer_sent_at !== null` | Wird nie erreicht, wenn nur generiert |

## Ursache

Der Workflow erfordert zwei separate Aktionen:
1. "Anschreiben generieren" → setzt `email_draft`
2. "Angebot senden" → setzt `offer_sent_at` und `status: 'offer_sent'`

Wenn der Nutzer nur Schritt 1 macht, bleibt die Anfrage in "In Bearbeitung".

## Lösung

Die Kategorisierungslogik muss die `status`-Spalte als primären Indikator nutzen (statt nur der Tracking-Timestamps):

### Neue Kategorisierungslogik

```text
Dashboard.tsx & EventsList.tsx:

1. Neue Anfragen:
   status === 'new' && !last_edited_at

2. In Bearbeitung:
   (last_edited_at || status === 'contacted') && 
   status !== 'offer_sent' && 
   status !== 'confirmed' && 
   status !== 'declined'

3. Angebot versendet:
   status === 'offer_sent' || offer_sent_at !== null
   (Beide Bedingungen berücksichtigen für Rückwärtskompatibilität)
```

### Technische Änderungen

1. `src/components/admin/refine/Dashboard.tsx` (Zeilen 40-51):
   - `offerSentInquiries`: Filter auf `status === 'offer_sent'` ODER `offer_sent_at`
   - Dies stellt sicher, dass der explizite Status-Wert aus `handleSendOffer` erkannt wird

2. `src/components/admin/refine/EventsList.tsx` (Zeilen 54-62):
   - Identische Anpassung der Filterlogik

### Zu ändernde Dateien

1. `src/components/admin/refine/Dashboard.tsx`
2. `src/components/admin/refine/EventsList.tsx`

