import { BaseRecord } from "@refinedev/core";

export interface ExtendedInquiry extends BaseRecord {
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
  // New fields
  inquiry_type: 'event' | 'catering';
  room_selection: string | null;
  time_slot: string | null;
  delivery_street: string | null;
  delivery_zip: string | null;
  delivery_city: string | null;
  delivery_time_slot: string | null;
  selected_items: QuoteItem[];
  selected_packages: SelectedPackage[];
  quote_items: QuoteItem[];
  quote_notes: string | null;
  email_draft: string | null;
  lexoffice_quotation_id: string | null;
  // LexOffice invoice/quotation fields
  lexoffice_invoice_id: string | null;
  lexoffice_document_type: 'invoice' | 'quotation' | null;
  lexoffice_contact_id: string | null;
  // Offer tracking fields
  offer_sent_at: string | null;
  offer_sent_by: string | null;
  current_offer_version: number | null;
  last_edited_by: string | null;
  last_edited_at: string | null;
}

export interface QuoteItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  isCustom?: boolean;
  isPackage?: boolean;
}

export interface SelectedPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  pricePerPerson: boolean;
  quantity: number;
  minGuests?: number;
  requiresPrepayment?: boolean;
  prepaymentPercentage?: number;
}

export interface Package {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  package_type: string;
  price: number;
  price_per_person: boolean;
  min_guests: number | null;
  max_guests: number | null;
  includes: string[];
  is_active: boolean;
  sort_order: number;
  requires_prepayment: boolean;
  prepayment_percentage: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  variables: string[];
  is_active: boolean;
  // Legacy compatibility
  content?: string;
  content_en?: string | null;
  sort_order?: number;
}

export type InquiryStatus = 'new' | 'contacted' | 'offer_sent' | 'confirmed' | 'declined';
