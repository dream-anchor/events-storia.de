// Shared Types for StoriaMaestro Admin

export type EntityType = 'event_inquiry' | 'catering_order' | 'event_booking';

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
