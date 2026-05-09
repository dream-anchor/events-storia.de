## Ziel
Events und Catering in der Sidebar zu einem Menüpunkt **„Anfragen"** zusammenlegen. Tabelle und Kanban zeigen beide Quellen gemischt mit einem klaren **Typ-Badge** „Event" / „Catering". Klick auf eine Zeile öffnet weiterhin den passenden Editor (`/admin/events/:id/edit` bzw. `/admin/orders/:id/edit`).

## Architektur

```text
event_inquiries  ─┐
                  ├──►  useUnifiedInquiries()  ──►  InquiryRecord[]  ──►  UnifiedList  +  UnifiedKanban
catering_orders  ─┘                                     │
                                                        └──►  Klick → /admin/events|orders/:id/edit
```

Beide Editoren, Detailseiten und Routen bleiben unverändert. Wir bauen nur die **Sammelseite** vor.

### 1. Normalisiertes Modell (`src/types/inquiryRecord.ts`)
```ts
type InquiryKind = "event" | "catering";
type UnifiedColumn = "lead" | "proposal" | "pending" | "won" | "lost" | "closed";

interface InquiryRecord {
  id: string;
  kind: InquiryKind;
  number: string;          // order_number / offer_slug
  customerName: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  date: string | null;     // preferred_date | desired_date
  time?: string | null;
  guestCount?: number | null;     // events
  itemsCount?: number | null;     // catering (items.length)
  totalAmount: number | null;
  status: string;          // raw status
  column: UnifiedColumn;   // gemappt
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  isPickup?: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  raw: EventInquiry | CateringOrder;
}
```

### 2. Hook `src/hooks/useUnifiedInquiries.ts`
- Zwei `useList`-Aufrufe (`resource: "events"` und `resource: "orders"`, je `pageSize: 100`).
- Mapper-Funktionen `mapEvent → InquiryRecord` und `mapOrder → InquiryRecord`.
- **Status-Mapping zu `UnifiedColumn`:**
  - Events: `new→lead`, `contacted→proposal`, `offer_sent→pending`, `confirmed→won`, `declined→lost`, `cancelled→closed`.
  - Catering: `pending→lead`, `confirmed→pending` (wartet auf Lieferung/Abholung), `completed→won`, `cancelled→closed`.
- Kombinierte, sortierbare Liste; Realtime-Subscriptions bleiben in den Edit-Seiten.

### 3. Neue Seite `src/components/admin/refine/UnifiedInquiriesList.tsx`
- Routen-Pfad: **`/admin/inquiries`** (neu); `/admin/events` und `/admin/orders` bleiben für Deeplinks bestehen (interne Weiterleitung optional, nicht in v1).
- Header: Titel „Anfragen", Subtitle „X aktive · Y archiviert".
- Filter-Pills: **Alle · Events · Catering** + Status-Filter („Eingang / Erledigt / Storniert / Alle"), als zwei unabhängige Filter-Reihen.
- View-Toggle (segmented control) **Tabelle / Kanban** (lokaler State, persisted in `localStorage`).
- Tabellenspalten: `Status`, `Typ` (Badge), `Nr.`, `Datum`, `Kunde`, `Kontakt`, `Betrag`, `Bearbeitet`. „Typ"-Badge in Light-Mode-Pill: `bg-foreground/5 ring-1 ring-foreground/15` mit Icon (`CalendarDays` für Event, `UtensilsCrossed` für Catering) + Text — monochrom, keine Farben.
- Mobile: bestehende `MobileCardList`-Logik wiederverwenden, mit Typ-Badge oben rechts.
- Klick auf Zeile/Karte: `navigate(record.kind === 'event' ? \`/admin/events/${id}/edit\` : \`/admin/orders/${id}/edit\`)`.

### 4. Generischer Kanban `src/components/admin/refine/UnifiedKanbanView.tsx`
- Refactor: nimmt **`InquiryRecord[]`** statt `EventInquiry[]`.
- Spalten unverändert (Lead / Proposal / Pending / Won + Archive Lost / Closed).
- Karte zeigt **Typ-Badge** links neben dem Status-Dot, danach Name, darunter Datum + Gäste/Items.
- Drag&Drop **deaktiviert für Catering** in v1 (Statusübergänge sind dort anders), aber Drag-Handler erlaubt nur Events. Tooltip auf Catering-Karten: „Status nur im Detail änderbar."
  - Implementierung: `draggable={item.kind === 'event'}` und beim Drop `if (kind !== 'event') return;`.
- Bestehende `KanbanView.tsx` bleibt vorerst unverändert — die alte Route `/admin/events` nutzt sie weiterhin, bis sie deprecated ist.

### 5. Sidebar (`AdminLayout.tsx`)
- Nav-Eintrag „Events" (Zeile 113) **und** „Catering" (Zeile 114) entfernen.
- Neuer Eintrag: `{ name: 'Anfragen', href: '/admin/inquiries', icon: Inbox, key: 'inquiries' }`.
- Badge-Count = `newInquiriesCount + pendingBookingsCount + pendingOrdersCount`.
- `isActive`-Logik anpassen (`location.pathname.startsWith('/admin/inquiries')` und Fallback auf alte Pfade `/admin/events`, `/admin/orders`, `/admin/bookings`).
- Logo-Subtitle bleibt „Event & Catering".

### 6. Routing (`src/pages/RefineAdmin.tsx`)
- Neue Route `/admin/inquiries` (`index → UnifiedInquiriesList`).
- Refine-Resource hinzufügen: `{ name: "inquiries", list: "/admin/inquiries" }` (für Breadcrumbs).
- Bestehende Routen `/admin/events`, `/admin/bookings`, `/admin/orders` und alle Edit-Routen bleiben **unverändert**.

### 7. Out of scope (bewusst)
- Bulk-Update-Aktionen (heute nur in `EventsList`) — nicht im UnifiedList v1.
- Catering-spezifische Spalten wie Lieferadresse/Bezahlung-bei-Abholung — als Mini-Indikatoren am Status-Dot/Typ-Badge zeigen, aber keine eigene Spalte.
- Drag&Drop für Catering im Kanban.
- Auto-Redirect von `/admin/events` → `/admin/inquiries`. Beide Seiten existieren parallel; SmartInquiryEditor und CateringOrderEditor sind unverändert erreichbar.

## Geänderte / neue Dateien
| Datei | Status | Inhalt |
|---|---|---|
| `src/types/inquiryRecord.ts` | NEU | `InquiryRecord`-Typ, `UnifiedColumn`, Mapper-Helfer |
| `src/hooks/useUnifiedInquiries.ts` | NEU | Lädt + mergt `events` + `orders`, mapped, sortiert |
| `src/components/admin/refine/UnifiedInquiriesList.tsx` | NEU | Tabelle + View-Toggle + Filter-Pills + Typ-Badge |
| `src/components/admin/refine/UnifiedKanbanView.tsx` | NEU | Generischer Kanban auf `InquiryRecord` |
| `src/components/admin/refine/AdminLayout.tsx` | EDIT | Nav: Events+Catering → ein Eintrag „Anfragen" |
| `src/pages/RefineAdmin.tsx` | EDIT | Neue Route + Resource `inquiries` |

## Risiko & Aufwand
- Mittlere Komplexität: vor allem Kanban-Refactor und Status-Mapping. Beide Editoren bleiben unangetastet.
- Wenn das UnifiedKanban die alte `KanbanView` 1:1 ersetzen soll (für Events allein gibt es heute auch noch eine Kanban-Sicht im Events-Tab), kann sie später auf den generischen Kanban umgestellt werden.
