export interface SuggestedPackage {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  matched_keywords: string[];
}

export interface SuggestedItem {
  search_term: string;
  context: string;
}

export interface ParsedInquiry {
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  guest_count: string | null;
  event_type: string | null;
  suggested_packages: SuggestedPackage[];
  suggested_items: SuggestedItem[];
  original_message_summary: string;
}

export interface DraftFormData {
  contact_name: string;
  company_name: string;
  email: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  guest_count: string;
  event_type: string;
  message: string;
  selected_packages: { id: string; name: string; price: number }[];
}
