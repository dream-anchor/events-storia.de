

## Problem

Es gibt eine Lücke bei Email-Benachrichtigungen für **manuell im Admin erfasste Anfragen** (`OfferCreate`):

| Flow | Notification | Status |
|---|---|---|
| Event-Anfrage via Website-Formular | `receive-event-inquiry` sendet Kunden- + Restaurant-Email | ✅ OK |
| Catering-Bestellung via Checkout | `send-order-notification` nach DB-Insert | ✅ Gerade gefixt |
| **Manuelle Anfrage via Admin (OfferCreate)** | Direkt `.insert()` → keine Email | ❌ Lücke |

## Lösung

In `src/components/admin/refine/OfferCreate/index.tsx` nach dem erfolgreichen `saveInquiry()` die Edge Function `receive-event-inquiry` aufrufen, damit sowohl die **Kunden-Bestätigung** als auch die **Restaurant-Benachrichtigung** versendet werden.

### Konkret

Nach dem `.insert()` in `saveInquiry()` einen fire-and-forget Call an `receive-event-inquiry` hinzufügen mit den gleichen Daten (contactName, email, etc.). Dabei `source: 'manual_entry'` beibehalten, damit die Restaurant-Email korrekt als "Manuell erfasst" angezeigt wird.

**Alternativ** (besser): Da die Anfrage bereits in der DB gespeichert ist und `receive-event-inquiry` selbst auch insertet, sollte stattdessen **nur der Email-Teil** getriggert werden. Dafür die `receive-event-inquiry` Edge Function so erweitern, dass sie einen `skipInsert: true` Parameter akzeptiert — oder eine eigene kleine Edge Function `send-inquiry-notification` erstellen, die nur Emails sendet.

### Empfohlener Ansatz: `skipInsert`-Flag in `receive-event-inquiry`

1. **`receive-event-inquiry/index.ts`**: Neuen optionalen Parameter `skipInsert` akzeptieren. Wenn `true`, den DB-Insert überspringen und nur die Emails senden.

2. **`OfferCreate/index.tsx`**: Nach dem `saveInquiry()` Call:
```typescript
supabase.functions.invoke('receive-event-inquiry', {
  body: {
    contactName: formData.contact_name,
    email: formData.email,
    companyName: formData.company_name,
    phone: formData.phone,
    guestCount: formData.guest_count,
    eventType: formData.event_type,
    preferredDate: formData.preferred_date,
    timeSlot: formData.preferred_time,
    message: formData.message,
    source: 'manual_entry',
    skipInsert: true,
    existingInquiryId: inquiry.id,
  },
}).catch(err => console.error('Notification error:', err));
```

### Änderungen

| Datei | Änderung |
|---|---|
| `supabase/functions/receive-event-inquiry/index.ts` | `skipInsert` + `existingInquiryId` Parameter; bei `skipInsert=true` DB-Insert überspringen, nur Emails senden + Logs mit existingInquiryId |
| `src/components/admin/refine/OfferCreate/index.tsx` | Nach `saveInquiry()` → `receive-event-inquiry` mit `skipInsert: true` aufrufen |

