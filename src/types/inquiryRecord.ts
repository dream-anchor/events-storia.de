import type { EventInquiry, CateringOrder } from "@/types/refine";

export type InquiryKind = "event" | "catering";
export type UnifiedColumn =
  | "lead"
  | "proposal"
  | "pending"
  | "won"
  | "lost"
  | "closed";

export interface InquiryRecord {
  id: string;
  kind: InquiryKind;
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
  column: UnifiedColumn;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  isPickup?: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  raw: EventInquiry | CateringOrder;
}

export function mapEventToColumn(status: string | null | undefined): UnifiedColumn {
  switch (status) {
    case "new":
      return "lead";
    case "contacted":
      return "proposal";
    case "offer_sent":
      return "pending";
    case "confirmed":
      return "won";
    case "declined":
      return "lost";
    case "cancelled":
      return "closed";
    default:
      return "lead";
  }
}

export function mapCateringToColumn(status: string | null | undefined): UnifiedColumn {
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

export function mapEvent(e: EventInquiry): InquiryRecord {
  const guestNum = e.guest_count ? parseInt(String(e.guest_count), 10) : null;
  const rawCompany = e.company_name?.trim() ?? "";
  const isPlaceholderCompany = /^(private|privat)$/i.test(rawCompany);
  return {
    id: e.id as string,
    kind: "event",
    number: (e as any).offer_slug || (e.id as string).slice(0, 8),
    customerName: e.contact_name || "—",
    companyName: isPlaceholderCompany ? null : (e.company_name ?? null),
    email: e.email,
    phone: e.phone,
    date: e.preferred_date ?? null,
    time: null,
    guestCount: Number.isFinite(guestNum as number) ? (guestNum as number) : null,
    itemsCount: null,
    totalAmount: e.total_amount ?? null,
    status: e.status,
    column: mapEventToColumn(e.status),
    createdAt: e.created_at,
    updatedAt: e.updated_at || e.created_at,
    archivedAt: e.archived_at,
    raw: e,
  };
}

export function mapOrder(o: CateringOrder): InquiryRecord {
  return {
    id: o.id as string,
    kind: "catering",
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
    column: mapCateringToColumn(o.status),
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    isPickup: o.is_pickup,
    createdAt: o.created_at,
    updatedAt: (o as any).updated_at || o.created_at,
    archivedAt: null,
    raw: o,
  };
}
