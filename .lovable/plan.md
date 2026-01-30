
# Plan: Paket-Vorauswahl, Uhrzeit-Anzeige und größere Admin-Schrift

## Identifizierte Probleme

1. **Paket nicht vorausgewählt**: Der Dialog übermittelt `eventType: displayName` (z.B. "Business Dinner"), aber keine `package_id`. Im StoriaMaestro fehlt daher die Zuordnung zum Paket.

2. **Uhrzeit nicht übermittelt/angezeigt**: Der Dialog sammelt die `time` ("19:00"), sendet sie aber nicht an die Edge-Function. Das Feld `time_slot` in der Datenbank bleibt leer.

3. **Admin-Schriftgröße zu klein**: Der Admin-Bereich nutzt die globale `font-size: 18px`, aber UI-Elemente (buttons, labels) sind aufgrund von Tailwind-Klassen wie `text-sm` und `text-xs` zu klein für Pro-Nutzung.

---

## Lösung 1: Paket-ID und Uhrzeit korrekt übermitteln

### Datei: `src/components/events/EventPackageInquiryDialog.tsx`

Das `receive-event-inquiry`-Edge-Function erwartet bisher kein `packageId` oder `time`. Diese werden hinzugefügt:

```tsx
// Änderung in handleSubmit (Zeile ~146-161)
const { error } = await supabase.functions.invoke("receive-event-inquiry", {
  body: {
    companyName: formData.company,
    contactName: formData.name,
    email: formData.email,
    phone: formData.phone || undefined,
    guestCount: formData.guestCount.toString(),
    preferredDate: formData.date ? format(formData.date, "yyyy-MM-dd") : undefined,
    timeSlot: formData.time,         // NEU: Uhrzeit übermitteln
    packageId: packageId,             // NEU: Paket-ID übermitteln
    eventType: displayName,
    message: formData.message || undefined,
    source: `package_inquiry_${packageId}`,
  },
});
```

### Datei: `supabase/functions/receive-event-inquiry/index.ts`

Die Edge-Function muss die neuen Felder akzeptieren und speichern:

```typescript
// Erweitertes Interface (Zeile ~10-19)
interface EventInquiryRequest {
  companyName?: string;
  contactName: string;
  email: string;
  phone?: string;
  guestCount?: string;
  eventType?: string;
  preferredDate?: string;
  timeSlot?: string;       // NEU
  packageId?: string;      // NEU
  message?: string;
  source?: string;
}

// Erweiterte Datenbank-Insertion (Zeile ~188-204)
const { data: inquiry, error: insertError } = await supabase
  .from('event_inquiries')
  .insert({
    // ... bestehende Felder ...
    time_slot: data.timeSlot || null,              // NEU
    selected_packages: data.packageId              // NEU: Als JSON-Array
      ? JSON.stringify([{ id: data.packageId, name: data.eventType }])
      : null,
  })
  .select()
  .single();
```

### E-Mail-Inhalt erweitern

In beiden E-Mail-Templates die Uhrzeit hinzufügen:

```typescript
// generateCustomerEmailText + generateRestaurantEmailText
const timeText = data.timeSlot || 'Nicht angegeben';

// Im Text hinzufügen:
Wunschtermin: ${dateText}
Uhrzeit: ${timeText}
```

---

## Lösung 2: Uhrzeit in Admin-Detail-Ansicht anzeigen

### Datei: `src/components/admin/inbox/DetailPane/DetailHeader.tsx`

Die Uhrzeit aus `item.raw` extrahieren und anzeigen:

```tsx
// In der Customer Info Bar (Zeile ~114-136)
<div className="px-4 py-2 bg-muted/30 border-t border-border/50 flex items-center gap-4 text-sm">
  <div>
    <span className="text-muted-foreground">Kunde:</span>{' '}
    <span className="font-medium">{item.customerName}</span>
  </div>
  <div>
    <span className="text-muted-foreground">E-Mail:</span>{' '}
    <a href={`mailto:${item.customerEmail}`} className="text-primary hover:underline">
      {item.customerEmail}
    </a>
  </div>
  {/* NEU: Datum und Uhrzeit */}
  {item.date && (
    <div>
      <span className="text-muted-foreground">Termin:</span>{' '}
      <span className="font-medium">{item.date}</span>
      {(item.raw as any)?.time_slot && (
        <span className="ml-1">um {(item.raw as any).time_slot} Uhr</span>
      )}
    </div>
  )}
  {/* NEU: Paket anzeigen */}
  {item.entityType === 'event_inquiry' && (
    <div>
      <span className="text-muted-foreground">Paket:</span>{' '}
      <Badge variant="secondary" className="ml-1">
        {(item.raw as any)?.event_type || 'Kein Paket'}
      </Badge>
    </div>
  )}
  {item.companyName && (
    <div>
      <span className="text-muted-foreground">Firma:</span>{' '}
      <span>{item.companyName}</span>
    </div>
  )}
  {item.amount && (
    <div className="ml-auto font-medium">
      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(item.amount)}
    </div>
  )}
</div>
```

---

## Lösung 3: Größere Schrift im Admin-Bereich

### Datei: `src/index.css`

Einen Admin-spezifischen Scope hinzufügen, der größere Schriftgrößen für alle UI-Elemente erzwingt:

```css
/* Nach Zeile ~118: Admin-Bereich mit größerer Schrift */
.admin-layout {
  font-size: 16px;
}

.admin-layout .text-sm {
  font-size: 0.9375rem; /* 15px statt 14px */
}

.admin-layout .text-xs {
  font-size: 0.8125rem; /* 13px statt 12px */
}

.admin-layout .text-base {
  font-size: 1.0625rem; /* 17px statt 16px */
}

.admin-layout .text-lg {
  font-size: 1.1875rem; /* 19px statt 18px */
}
```

### Datei: `src/components/admin/refine/AdminLayout.tsx`

Die `.admin-layout` Klasse auf den Container anwenden:

```tsx
// Zeile ~52: className hinzufügen
return (
  <div className="min-h-screen bg-muted/30 admin-layout">
    {/* ... */}
  </div>
);
```

---

## Zusammenfassung der Änderungen

| Datei | Änderung |
|-------|----------|
| `EventPackageInquiryDialog.tsx` | `timeSlot` und `packageId` an Edge-Function senden |
| `receive-event-inquiry/index.ts` | Neue Felder akzeptieren, in DB speichern, in E-Mails anzeigen |
| `DetailHeader.tsx` | Termin, Uhrzeit und Paket-Badge anzeigen |
| `src/index.css` | `.admin-layout` Scope mit größeren Schriftgrößen |
| `AdminLayout.tsx` | `admin-layout` Klasse anwenden |

### Technische Details

- Die `selected_packages` Spalte ist bereits als JSONB in der DB vorhanden
- Die `time_slot` Spalte existiert bereits in `event_inquiries`
- Keine Datenbankmigrationen erforderlich
