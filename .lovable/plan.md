

# StoriaMaestro 2026: Collaborative Inbox/CRM Architecture

## Executive Summary

This plan transforms the StoriaMaestro Admin Dashboard from a traditional table-based CRUD interface into a **modern Collaborative Inbox/CRM** with Master-Detail layout, real-time collaboration, and full audit trails.

---

## 1. Tech Stack Decision

### Recommendation: Pure React + TanStack Query + Shadcn/ui

**Rationale:**
- **Refine** is currently used for data fetching (`useList`, `useOne`, `useUpdate`) and routing, but it adds unnecessary abstraction for a highly custom, app-like interface
- The existing `refine-data-provider.ts` is essentially a wrapper around Supabase queries that TanStack Query can handle directly
- Current hooks (`useCateringOrders`, `useEventBookings`, `useEventInquiries`) already use pure TanStack Query
- Shadcn/ui + Resizable Panels + Radix primitives provide all needed UI components

**Migration Path:**
- Phase 1: Build new Master-Detail components alongside existing code
- Phase 2: Gradually migrate routes from Refine to pure React Router
- Phase 3: Remove Refine dependencies once complete

---

## 2. Architecture: Master-Detail Layout

### New Component Structure

```text
src/components/admin/inbox/
├── InboxLayout.tsx              # Main layout with resizable panels
├── InboxSidebar/
│   ├── index.tsx                # Left sidebar container
│   ├── InboxFeed.tsx            # Scrollable list of items
│   ├── InboxItem.tsx            # Individual item card
│   ├── InboxFilters.tsx         # Status/type filter pills
│   └── InboxSearch.tsx          # Global search
├── DetailPane/
│   ├── index.tsx                # Right pane container
│   ├── DetailHeader.tsx         # Entity header with actions
│   ├── Timeline.tsx             # Activity feed
│   ├── TimelineEntry.tsx        # Single activity entry
│   ├── DocumentViewer.tsx       # PDF/Email preview
│   └── PresenceIndicator.tsx    # "Jonas is viewing this"
├── hooks/
│   ├── useInboxRealtime.ts      # Supabase Realtime subscription
│   ├── usePresence.ts           # User presence tracking
│   └── useActivityLog.ts        # Timeline data
└── types.ts                     # Shared types
```

### Layout Implementation

The layout uses `react-resizable-panels` (already installed) with keyboard navigation:

```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
    <InboxSidebar />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={70}>
    <DetailPane />
  </ResizablePanel>
</ResizablePanelGroup>
```

---

## 3. Database Schema Changes

### New Table: `activity_logs`

```sql
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,  -- 'event_inquiry', 'catering_order', 'event_booking'
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,       -- 'status_changed', 'price_updated', 'email_sent', 'note_added'
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,             -- Additional context (e.g., email subject)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast entity lookups
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage
CREATE POLICY "Admins can manage activity_logs"
    ON activity_logs FOR ALL
    USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
```

### New Table: `admin_presence`

```sql
CREATE TABLE public.admin_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT,
    entity_id UUID,
    last_seen TIMESTAMPTZ DEFAULT now(),
    is_editing BOOLEAN DEFAULT false,
    UNIQUE(user_id, entity_type, entity_id)
);

-- Enable realtime for presence
ALTER PUBLICATION supabase_realtime ADD TABLE admin_presence;
```

---

## 4. Feature: The "Inbox" Workflow

### 4.1 Left Sidebar (The Feed)

**Data Model:**
- Unified feed combining `event_inquiries`, `catering_orders`, and `event_bookings`
- Sorted by urgency (new items first, then by date)

**Visual Indicators:**

| Status | Badge Style |
|--------|------------|
| New | `variant="default"` (primary color) |
| In Progress | `variant="secondary"` |
| Ready/Confirmed | `variant="outline"` with checkmark |
| Cancelled | `variant="destructive"` |

**Implementation:**
```tsx
// useUnifiedInbox.ts
export const useUnifiedInbox = (filter: InboxFilter) => {
  return useQuery({
    queryKey: ['inbox', filter],
    queryFn: async () => {
      const [inquiries, orders, bookings] = await Promise.all([
        supabase.from('event_inquiries').select('*'),
        supabase.from('catering_orders').select('*'),
        supabase.from('event_bookings').select('*'),
      ]);
      return unifyAndSort([...inquiries, ...orders, ...bookings]);
    }
  });
};
```

### 4.2 Live Updates (Supabase Realtime)

```tsx
// useInboxRealtime.ts
export const useInboxRealtime = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const channel = supabase
      .channel('inbox-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'event_inquiries' },
        () => queryClient.invalidateQueries({ queryKey: ['inbox'] })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'catering_orders' },
        () => queryClient.invalidateQueries({ queryKey: ['inbox'] })
      )
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);
};
```

### 4.3 Presence & Collision Detection

**Presence Tracking:**
```tsx
// usePresence.ts
export const usePresence = (entityType: string, entityId: string) => {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  
  useEffect(() => {
    const channel = supabase.channel(`presence:${entityType}:${entityId}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewers(Object.values(state).flat());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: currentUser.id,
            email: currentUser.email,
            joined_at: new Date().toISOString(),
          });
        }
      });
      
    return () => { supabase.removeChannel(channel); };
  }, [entityType, entityId]);
  
  return viewers;
};
```

**Collision Detection UI:**
```tsx
{viewers.length > 0 && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <div className="flex -space-x-2">
      {viewers.map(v => (
        <Avatar key={v.user_id} className="h-6 w-6 border-2 border-background">
          <AvatarFallback>{v.email[0].toUpperCase()}</AvatarFallback>
        </Avatar>
      ))}
    </div>
    <span>{viewers[0].email.split('@')[0]} is viewing</span>
  </div>
)}
```

---

## 5. Feature: The Timeline (Audit Trail)

### Automatic Logging

Create a reusable hook that wraps mutations with activity logging:

```tsx
// useTrackedMutation.ts
export const useTrackedMutation = <T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options: {
    entityType: string;
    getEntityId: (variables: V) => string;
    action: string;
    getOldValue?: (variables: V) => any;
    getNewValue?: (variables: V) => any;
  }
) => {
  return useMutation({
    mutationFn: async (variables: V) => {
      const result = await mutationFn(variables);
      
      // Log activity
      await supabase.from('activity_logs').insert({
        entity_type: options.entityType,
        entity_id: options.getEntityId(variables),
        action: options.action,
        actor_id: currentUser?.id,
        actor_email: currentUser?.email,
        old_value: options.getOldValue?.(variables),
        new_value: options.getNewValue?.(variables),
      });
      
      return result;
    },
  });
};
```

### Timeline Component

```tsx
// Timeline.tsx
export const Timeline = ({ entityType, entityId }: Props) => {
  const { data: logs } = useActivityLogs(entityType, entityId);
  
  return (
    <div className="relative pl-6 space-y-6">
      {/* Vertical connector line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
      
      {logs.map(log => (
        <TimelineEntry key={log.id} log={log} />
      ))}
    </div>
  );
};

const TimelineEntry = ({ log }: { log: ActivityLog }) => (
  <div className="relative">
    {/* Dot on the timeline */}
    <div className="absolute -left-4 w-2 h-2 rounded-full bg-primary mt-2" />
    
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">{log.actor_email}</span>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(log.created_at), { locale: de, addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {formatAction(log)}
      </p>
    </div>
  </div>
);
```

### Action Formatting

```tsx
const formatAction = (log: ActivityLog): string => {
  const actions: Record<string, string> = {
    'status_changed': `Status geändert: ${log.old_value?.status} → ${log.new_value?.status}`,
    'price_updated': `Preis von "${log.metadata?.itemName}" geändert`,
    'email_sent': `E-Mail "${log.metadata?.subject}" versendet`,
    'note_added': 'Interne Notiz hinzugefügt',
    'offer_created': 'Angebot erstellt',
    'payment_received': 'Zahlung eingegangen',
  };
  return actions[log.action] || log.action;
};
```

---

## 6. Feature: Document & Communication History

### Email Log Integration

Modify existing edge functions to log sent emails:

```typescript
// In create-event-quotation/index.ts after sending email:
await supabaseAdmin.from('activity_logs').insert({
  entity_type: 'event_inquiry',
  entity_id: eventId,
  action: 'email_sent',
  actor_email: 'system',
  metadata: {
    subject: `Angebot ${quotationId}`,
    recipient: event.email,
    html_content: emailBody,
    pdf_url: pdfUrl,
  }
});
```

### Email Preview Component

```tsx
// EmailPreview.tsx
export const EmailPreview = ({ log }: { log: ActivityLog }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (log.action !== 'email_sent') return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          E-Mail anzeigen
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div 
          className="rounded-lg border bg-white p-4 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: log.metadata?.html_content }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};
```

### PDF Viewer Integration

Using an iframe for simplicity (react-pdf has heavy dependencies):

```tsx
// DocumentViewer.tsx
export const DocumentViewer = ({ url, type }: Props) => {
  if (!url) return null;
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          PDF anzeigen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh]">
        <iframe 
          src={`${url}#toolbar=0`}
          className="w-full h-full rounded-lg"
          title="PDF Preview"
        />
      </DialogContent>
    </Dialog>
  );
};
```

---

## 7. UI/UX: State of the Art 2026

### 7.1 Keyboard Shortcuts

```tsx
// useInboxKeyboard.ts
export const useInboxKeyboard = (items: InboxItem[], selectedId: string | null) => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = items.findIndex(i => i.id === selectedId);
      
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            navigate(`/admin/inbox/${items[currentIndex + 1].id}`);
          }
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          if (currentIndex > 0) {
            navigate(`/admin/inbox/${items[currentIndex - 1].id}`);
          }
          break;
        case 'Enter':
          e.preventDefault();
          // Open detail/edit mode
          break;
        case 'Escape':
          e.preventDefault();
          // Close detail pane
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, selectedId, navigate]);
};
```

### 7.2 Split View with Resizable Panels

Already have `react-resizable-panels` installed. The `ResizablePanelGroup` component provides:
- Drag-to-resize with handles
- Keyboard resize with arrow keys
- Persisted sizes in localStorage

### 7.3 Dark Mode

**Already Implemented:** The project has full dark mode CSS variables in `src/index.css`. To enable toggle:

```tsx
// Add to AdminLayout header
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();

<Button 
  variant="ghost" 
  size="icon"
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
>
  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
</Button>
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create `activity_logs` and `admin_presence` tables
2. Build `InboxLayout` with resizable panels
3. Implement `useUnifiedInbox` hook
4. Create `InboxSidebar` with feed and filters

### Phase 2: Real-time & Presence (Week 2)
1. Enable Supabase Realtime on relevant tables
2. Implement `useInboxRealtime` hook
3. Build presence tracking with `usePresence`
4. Add collision detection UI

### Phase 3: Timeline & Documents (Week 3)
1. Build `Timeline` component
2. Create `useTrackedMutation` for automatic logging
3. Update edge functions to log emails/actions
4. Integrate PDF viewer and email preview

### Phase 4: Polish & Keyboard (Week 4)
1. Add keyboard navigation
2. Implement dark mode toggle
3. Optimize performance (virtualized lists)
4. Mobile responsive adjustments

---

## 9. Files to Create/Modify

### New Files
| Path | Purpose |
|------|---------|
| `src/components/admin/inbox/InboxLayout.tsx` | Master-detail container |
| `src/components/admin/inbox/InboxSidebar/` | Sidebar components |
| `src/components/admin/inbox/DetailPane/` | Detail view components |
| `src/components/admin/inbox/Timeline.tsx` | Activity timeline |
| `src/hooks/useUnifiedInbox.ts` | Combined inbox data |
| `src/hooks/useInboxRealtime.ts` | Realtime subscriptions |
| `src/hooks/usePresence.ts` | User presence tracking |
| `src/hooks/useActivityLog.ts` | Timeline data |
| `src/hooks/useTrackedMutation.ts` | Auto-logging wrapper |

### Modified Files
| Path | Changes |
|------|---------|
| `src/pages/RefineAdmin.tsx` | Add inbox route |
| `src/components/admin/refine/AdminLayout.tsx` | Add dark mode toggle |
| `supabase/functions/create-event-quotation/index.ts` | Log email sends |
| `supabase/functions/send-order-notification/index.ts` | Log notifications |

### Database Migrations
| Purpose | SQL |
|---------|-----|
| Activity logs table | Create `activity_logs` with RLS |
| Presence table | Create `admin_presence` for tracking |
| Realtime | Enable on new tables + existing |

