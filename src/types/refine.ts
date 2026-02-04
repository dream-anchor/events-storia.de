import { BaseRecord } from "@refinedev/core";

export interface MenuItem extends BaseRecord {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  price_display: string | null;
  category_id: string;
  image_url: string | null;
  allergens: string | null;
  is_vegetarian: boolean;
  is_vegan: boolean;
  serving_info: string | null;
  serving_info_en: string | null;
  min_order: string | null;
  min_order_en: string | null;
  sort_order: number;
  created_at: string;
}

export interface EventInquiry extends BaseRecord {
  id: string;
  company_name: string | null;
  contact_name: string;
  email: string;
  phone: string | null;
  guest_count: string | null;
  event_type: string | null;
  preferred_date: string | null;
  message: string | null;
  source: string | null;
  status: 'new' | 'contacted' | 'offer_sent' | 'confirmed' | 'declined';
  internal_notes: string | null;
  notification_sent: boolean;
  created_at: string;
  updated_at: string | null;
  // Editor tracking fields
  last_edited_by: string | null;
  last_edited_at: string | null;
  offer_sent_at: string | null;
  offer_sent_by: string | null;
  // Assignment fields (Phase 2)
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  // Priority field (Phase 2)
  priority: InquiryPriority;
}

export type InquiryPriority = 'normal' | 'high' | 'urgent';

export interface CateringOrder extends BaseRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company_name: string | null;
  delivery_street: string | null;
  delivery_zip: string | null;
  delivery_city: string | null;
  delivery_floor: string | null;
  has_elevator: boolean;
  is_pickup: boolean;
  desired_date: string | null;
  desired_time: string | null;
  items: any[];
  total_amount: number | null;
  delivery_cost: number | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  internal_notes: string | null;
  lexoffice_invoice_id: string | null;
  created_at: string;
}

export interface QuoteItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  isCustom?: boolean;
}

export interface Quote {
  id: string;
  eventId: string;
  items: QuoteItem[];
  customItems: QuoteItem[];
  subtotal: number;
  vat: number;
  total: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type InquiryStatus = 'new' | 'contacted' | 'offer_sent' | 'confirmed' | 'declined';
export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
