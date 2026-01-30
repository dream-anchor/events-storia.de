// Unified Inbox Types for StoriaMaestro 2026

export type EntityType = 'event_inquiry' | 'catering_order' | 'event_booking';

export type InboxItemStatus = 
  | 'new' 
  | 'in_progress' 
  | 'offer_sent' 
  | 'confirmed' 
  | 'ready' 
  | 'completed' 
  | 'cancelled';

export interface InboxItem {
  id: string;
  entityType: EntityType;
  title: string;
  subtitle: string;
  status: InboxItemStatus;
  date: string;
  amount?: number;
  customerName: string;
  customerEmail: string;
  companyName?: string;
  isNew: boolean;
  createdAt: string;
  updatedAt?: string;
  // Original entity data
  raw: Record<string, unknown>;
}

export interface InboxFilter {
  entityTypes?: EntityType[];
  statuses?: InboxItemStatus[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ActivityLog {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  action: string;
  actor_id?: string;
  actor_email?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  metadata?: {
    subject?: string;
    recipient?: string;
    html_content?: string;
    pdf_url?: string;
    itemName?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface Viewer {
  user_id: string;
  email: string;
  joined_at: string;
  is_editing?: boolean;
}

export interface PresenceState {
  viewers: Viewer[];
  isBeingEdited: boolean;
  editingBy?: Viewer;
}

// Status mapping for different entity types
export const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  pending: 'Neu',
  in_progress: 'In Bearbeitung',
  offer_sent: 'Angebot gesendet',
  confirmed: 'Bestätigt',
  ready: 'Bereit',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  menu_pending: 'Menü ausstehend',
  menu_confirmed: 'Menü bestätigt',
  paid: 'Bezahlt',
};

export const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  new: 'default',
  pending: 'default',
  in_progress: 'secondary',
  offer_sent: 'secondary',
  confirmed: 'outline',
  ready: 'outline',
  completed: 'outline',
  cancelled: 'destructive',
  menu_pending: 'secondary',
  menu_confirmed: 'outline',
  paid: 'outline',
};

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  event_inquiry: 'Anfrage',
  catering_order: 'Catering',
  event_booking: 'Event',
};

export const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
  event_inquiry: 'CalendarDays',
  catering_order: 'FileText',
  event_booking: 'CheckCircle2',
};
