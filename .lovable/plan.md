
# Inbox-Entfernung & E-Mail-Optimierung

## Übersicht

Zwei Hauptaufgaben:
1. **Inbox komplett entfernen**, aber die Aktivitäts-Timeline und Presence-Indikatoren in die bestehenden Editoren übertragen
2. **E-Mail-Generierung überarbeiten**: Kürzer, prägnanter, weniger überschwänglich, keine Markdown-Formatierung

---

## Teil 1: Inbox entfernen & Features übertragen

### Was wird entfernt

| Datei/Ordner | Aktion |
|--------------|--------|
| `src/pages/admin/InboxPage.tsx` | Löschen |
| `src/components/admin/inbox/` (gesamter Ordner) | Löschen |
| `src/hooks/useUnifiedInbox.ts` | Löschen |
| `src/hooks/useInboxRealtime.ts` | Löschen |
| `src/hooks/useInboxKeyboard.ts` | Löschen |
| Route in `RefineAdmin.tsx` | Entfernen |
| Navigation in `FloatingPillNav.tsx` | Inbox-Eintrag entfernen |

### Was bleibt erhalten

Diese Komponenten und Hooks werden **nicht** gelöscht, da sie weiterhin benötigt werden:

| Komponente/Hook | Neue Verwendung |
|-----------------|-----------------|
| `Timeline.tsx` | → Verschoben nach `src/components/admin/shared/Timeline.tsx` |
| `PresenceIndicator.tsx` | → Verschoben nach `src/components/admin/shared/PresenceIndicator.tsx` |
| `useActivityLog.ts` | → Bleibt erhalten (unverändert) |
| `usePresence.ts` | → Bleibt erhalten (unverändert) |
| `activity_logs` Tabelle | → Bleibt erhalten |
| `admin_presence` Tabelle | → Bleibt erhalten |

### Integration in SmartInquiryEditor

Die Timeline und Presence werden direkt in die ContextBar und einen neuen Tab integriert:

**Datei: `src/components/admin/refine/ContextBar.tsx`**

Erweiterung um Presence-Anzeige:

```tsx
// Neue Props
interface ContextBarProps {
  // ... existing props
  entityType?: 'event_inquiry' | 'catering_order' | 'event_booking';
  entityId?: string;
}

// Im Return:
<div className="flex items-center gap-4 ...">
  {/* Zurück-Button & Titel (wie bisher) */}
  
  {/* NEU: Presence Indicator im Header */}
  {entityType && entityId && (
    <PresenceIndicator 
      viewers={viewers} 
      className="hidden md:flex"
    />
  )}
</div>
```

**Datei: `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`**

Neuer Tab "Aktivitäten" hinzufügen:

```tsx
<Tabs defaultValue="kalkulation">
  <TabsList>
    <TabsTrigger value="kalkulation">Kalkulation</TabsTrigger>
    <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
    <TabsTrigger value="aktivitaeten">Aktivitäten</TabsTrigger>  {/* NEU */}
  </TabsList>
  
  {/* ... existing TabsContent ... */}
  
  <TabsContent value="aktivitaeten">
    <Timeline entityType="event_inquiry" entityId={id!} />
  </TabsContent>
</Tabs>
```

### Navigation anpassen

**Datei: `src/components/admin/refine/FloatingPillNav.tsx`**

Inbox-Eintrag entfernen, Navigation vereinfachen:

```tsx
const navigationContexts: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/admin', 
    icon: LayoutDashboard, 
    key: 'dashboard' 
  },
  // INBOX ENTFERNT
  { 
    name: 'Anfragen', 
    href: '/admin/events', 
    icon: CalendarDays, 
    key: 'workflow',
    // ...
  },
  { 
    name: 'Stammdaten', 
    // ...
  },
];
```

---

## Teil 2: E-Mail-Generierung optimieren

### Problem

Der aktuelle System-Prompt erzeugt:
- Zu lange E-Mails (200-300 Wörter angefordert)
- Überschwängliche, anbiederische Formulierungen
- Markdown-Formatierung (unpassend für E-Mail-Clients)

### Lösung

**Datei: `supabase/functions/generate-inquiry-email/index.ts`**

Komplett überarbeiteter System-Prompt:

```typescript
const systemPrompt = `Du bist ein professioneller Mitarbeiter von STORIA München.

STIL:
- Freundlich, aber geschäftsmäßig und auf den Punkt
- Kurz und prägnant (max. 100-150 Wörter)
- Keine überschwänglichen Floskeln wie "wunderbar", "fantastisch", "herausragend"
- KEIN Markdown (keine **, keine #, keine Listen mit -)
- Normaler E-Mail-Fließtext mit Absätzen

STRUKTUR:
1. Kurze Begrüßung (1 Satz)
2. Bestätigung der Anfrage mit den wichtigsten Fakten (Datum, Gästeanzahl, Paket)
3. Hinweis auf beigefügtes Angebot
4. Kurze Info zu nächsten Schritten / Vorauszahlung
5. Signatur

VERBOTEN:
- "Wir freuen uns außerordentlich..."
- "Es ist uns eine große Ehre..."
- "Ihr exklusives Event wird unvergesslich..."
- Aufzählungslisten (stattdessen: Fließtext mit Kommas)
- Fettdruck oder andere Formatierung
- Mehr als 3 Absätze vor der Signatur

SIGNATUR (exakt so verwenden):
${personalizedSignature}

BEISPIEL-TON:
"Vielen Dank für Ihre Anfrage. Gerne bestätigen wir Ihnen folgende Details: Business Dinner für 45 Personen am 15.03.2026. Das detaillierte Angebot finden Sie im Anhang. Für Ihr gewähltes Paket ist eine Vorauszahlung von 100% erforderlich. Bei Fragen stehe ich Ihnen gerne zur Verfügung."
`;
```

### Änderungen im User-Prompt

```typescript
const userPrompt = inquiryType === 'event' 
  ? `Schreibe eine kurze, professionelle Bestätigungs-E-Mail für diese Event-Anfrage:
  
${context}

Wichtig: Maximal 150 Wörter. Keine Markdown-Formatierung. Sachlich und freundlich.`
  : `Schreibe eine kurze Bestätigungs-E-Mail für diese Catering-Bestellung:
  
${context}

Wichtig: Maximal 150 Wörter. Keine Markdown-Formatierung. Sachlich und freundlich.`;
```

---

## Zusammenfassung der Dateiänderungen

### Zu löschende Dateien
1. `src/pages/admin/InboxPage.tsx`
2. `src/components/admin/inbox/InboxLayout.tsx`
3. `src/components/admin/inbox/InboxSidebar/` (gesamter Ordner)
4. `src/components/admin/inbox/DetailPane/DetailHeader.tsx`
5. `src/components/admin/inbox/DetailPane/DocumentViewer.tsx`
6. `src/components/admin/inbox/DetailPane/index.tsx`
7. `src/components/admin/inbox/types.ts`
8. `src/components/admin/inbox/index.ts`
9. `src/hooks/useUnifiedInbox.ts`
10. `src/hooks/useInboxRealtime.ts`
11. `src/hooks/useInboxKeyboard.ts`

### Zu verschiebende Dateien
1. `src/components/admin/inbox/DetailPane/Timeline.tsx` → `src/components/admin/shared/Timeline.tsx`
2. `src/components/admin/inbox/DetailPane/PresenceIndicator.tsx` → `src/components/admin/shared/PresenceIndicator.tsx`

### Zu bearbeitende Dateien
1. `src/pages/RefineAdmin.tsx` - Inbox-Routes entfernen
2. `src/components/admin/refine/FloatingPillNav.tsx` - Inbox aus Navigation entfernen
3. `src/components/admin/refine/ContextBar.tsx` - Presence-Indicator hinzufügen
4. `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx` - Timeline-Tab hinzufügen, Presence-Hook einbinden
5. `src/components/admin/refine/CateringOrderEditor.tsx` - Timeline-Tab hinzufügen
6. `src/components/admin/refine/EventBookingEditor.tsx` - Timeline-Tab hinzufügen
7. `supabase/functions/generate-inquiry-email/index.ts` - System-Prompt komplett überarbeiten
8. `src/hooks/useActivityLog.ts` - Import-Pfad für Types anpassen

### Neue Dateien
1. `src/components/admin/shared/index.ts` - Barrel Export für shared Components

---

## Aktivitäts-Tracking bleibt erhalten

Die Activity-Logs werden weiterhin bei jeder Aktion erstellt:
- Status-Änderungen
- Preis-Updates  
- E-Mail-Versand (mit HTML-Content)
- Menü-Bestätigungen
- Angebots-Erstellung

Diese werden jetzt direkt im jeweiligen Editor-Tab "Aktivitäten" angezeigt, nicht mehr in der separaten Inbox.
