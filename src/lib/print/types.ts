import type { OfferBuilderOption } from '@/components/admin/refine/InquiryEditor/OfferBuilder/types';

/** Voll geladene Daten einer Anfrage für alle Druckdokumente. */
export interface PrintInquiry {
  id: string;
  orderNumber: string;
  // Kunde
  contactName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  // Event
  eventType: string | null;
  preferredDate: string | null;
  eventEndDate: string | null;
  timeSlot: string | null;
  guestCount: number;
  // Location
  locationType: 'storia' | 'company' | 'custom' | null;
  locationName: string | null;
  locationAddress: string | null;
  roomSelection: string | null;
  isCatering: boolean;
  // Notizen
  internalNotes: string | null;
  customerMessage: string | null;
  // Status
  status: string;
  offerPhase: string | null;
  // Zahlung
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  depositAmount: number | null;
  paymentMethod: string | null;
  lexofficeInvoiceId: string | null;
  // Selected option (Menü/Paket/Equipment)
  selectedOption: OfferBuilderOption | null;
  selectedOptionLabel: string | null;
  // Allergens (aus internal_notes / message extrahiert oder separat)
  allergens: string | null;
  // Versionsstand
  currentVersion: number;
}