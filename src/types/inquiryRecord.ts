import type { CateringOrder } from "@/types/refine";

export type InquiryKind = "event" | "catering";
export type ServiceType = "restaurant" | "catering" | "catering_order";

export type UnifiedColumn =
  | "lead"
  | "proposal"
  | "pending"
  | "won"
  | "lost"
  | "closed";

export interface V2EventRow {
  id: string;
  customer_id: string | null;
  number: string | null;
  status: string | null;
  offer_phase: string | null;
  service_type: "restaurant" | "catering" | null;
  date: string | null;
  date_end: string | null;
  time_from: string | null;
  time_to: string | null;
  guest_count: number | null;
  occasion: string | null;
  amount_total: number | null;
  is_test: boolean | null;
  archived: boolean | null;
  archived_at: string | null;
  offer_slug: string | null;
  booking_number: string | null;
  created_at: string;
  updated_at: string | null;
  v2_customers?: {
    id: string;
    name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface InquiryRecord {
  id: string;
  kind: InquiryKind;
  serviceType: ServiceType;
  number: string;
  customerName: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  date: string | null;
  time?: string | null;
  guestCount?: number | null;
  itemsCount?: number | null;
  totalAmount: number | null;
  status: string;
  offerPhase?: string | null;
  column: UnifiedColumn;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  isPickup?: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  archived?: boolean;
  raw: V2EventRow | CateringOrder;
}

export function mapV2EventToColumn(
  status: string | null | undefined,
  archived: boolean | null | undefined,
): UnifiedColumn {
  if (archived) return "closed";
  switch (status) {
    case "inquiry":
      return "lead";
    case "offer_draft":
      return "proposal";
    case "offer_sent":
    case "offer_chosen":
      return "pending";
    case "paid":
    case "completed":
      return "won";
    case "cancelled":
      return "closed";
    default:
      return "lead";
  }
}

export function mapCateringToColumn(
  status: string | null | undefined,
): UnifiedColumn {
  switch (status) {
    case "pending":
      return "lead";
    case "confirmed":
      return "pending";
    case "completed":
      return "won";
    case "cancelled":
      return "closed";
    default:
      return "lead";
  }
}

export function mapV2Event(e: V2EventRow): InquiryRecord {
  const cust = e.v2_customers ?? null;
  const rawCompany = (cust?.company ?? "").trim();
  const isPlaceholderCompany = /^(private|privat)$/i.test(rawCompany);
  const serviceType: ServiceType =
    e.service_type === "catering" ? "catering" : "restaurant";
  return {
    id: e.id,
    kind: "event",
    serviceType,
    number: e.booking_number || e.offer_slug || e.id.slice(0, 8),
    customerName: cust?.name?.trim() || "—",
    companyName: isPlaceholderCompany ? null : rawCompany || null,
    email: cust?.email ?? "",
    phone: cust?.phone ?? null,
    date: e.date ?? null,
    time: e.time_from ?? null,
    guestCount: e.guest_count ?? null,
    itemsCount: null,
    totalAmount: e.amount_total ?? null,
    status: e.status ?? "inquiry",
    offerPhase: e.offer_phase,
    column: mapV2EventToColumn(e.status, e.archived),
    archived: !!e.archived,
    archivedAt: e.archived_at,
    createdAt: e.created_at,
    updatedAt: e.updated_at || e.created_at,
    raw: e,
  };
}

export function mapOrder(o: CateringOrder): InquiryRecord {
  return {
    id: o.id as string,
    kind: "catering",
    serviceType: "catering_order",
    number: o.order_number,
    customerName: o.customer_name,
    companyName: o.company_name,
    email: o.customer_email,
    phone: o.customer_phone,
    date: o.desired_date ?? null,
    time: o.desired_time ?? null,
    guestCount: null,
    itemsCount: Array.isArray(o.items) ? o.items.length : null,
    totalAmount: o.total_amount ?? null,
    status: o.status,
    offerPhase: null,
    column: mapCateringToColumn(o.status),
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    isPickup: o.is_pickup,
    createdAt: o.created_at,
    updatedAt: (o as any).updated_at || o.created_at,
    archivedAt: null,
    archived: false,
    raw: o,
  };
}

/**
 * Vergangenes Event = Datum liegt vor heute UND es wurde gebucht/bezahlt/abgeschlossen.
 * Wird zur automatischen Einsortierung in den "Erledigt"-Bereich verwendet.
 */
export function isPastEvent(r: InquiryRecord): boolean {
  if (!r.date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(r.date);
  if (Number.isNaN(eventDate.getTime())) return false;
  if (eventDate >= today) return false;
  if (r.kind === "event") {
    return ["paid", "completed", "offer_chosen"].includes(r.status);
  }
  return ["confirmed", "completed"].includes(r.status);
}

/**
 * Lifecycle-Bucket = die EINE Wahrheit, in welchem Bereich eine Anfrage angezeigt wird.
 * Genau ein Bucket pro Anfrage. Kanban und Tabelle teilen sich diese Logik.
 */
export type LifecycleBucket = "inbox" | "won" | "done" | "archive";

const ARCHIVE_EVENT_STATUSES = new Set([
  "cancelled",
  "offer_declined",
  "payment_failed",
  "no_response",
]);
const ARCHIVE_CATERING_STATUSES = new Set(["cancelled"]);

const WON_EVENT_STATUSES = new Set(["offer_chosen", "paid"]);
const WON_CATERING_STATUSES = new Set(["confirmed"]);

const ACTIVE_EVENT_STATUSES = new Set(["inquiry", "offer_draft", "offer_sent"]);
const ACTIVE_CATERING_STATUSES = new Set(["pending"]);

export function getLifecycleBucket(r: InquiryRecord): LifecycleBucket {
  // 1) Manuell archiviert ODER terminaler Status → Archiv
  if (r.archived) return "archive";
  const archiveSet =
    r.kind === "event" ? ARCHIVE_EVENT_STATUSES : ARCHIVE_CATERING_STATUSES;
  if (archiveSet.has(r.status)) return "archive";

  // 2) Explizit completed → Erledigt
  if (r.status === "completed") return "done";

  // 3) Gebuchte Events: nach Eventdatum entscheiden
  const wonSet = r.kind === "event" ? WON_EVENT_STATUSES : WON_CATERING_STATUSES;
  if (wonSet.has(r.status)) {
    if (r.date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = new Date(r.date);
      if (!Number.isNaN(eventDate.getTime()) && eventDate < today) {
        return "done";
      }
    }
    return "won";
  }

  // 4) Aktive Pipeline → Eingang
  const activeSet =
    r.kind === "event" ? ACTIVE_EVENT_STATUSES : ACTIVE_CATERING_STATUSES;
  if (activeSet.has(r.status)) return "inbox";

  // Fallback: lieber im Eingang anzeigen als verstecken
  return "inbox";
}