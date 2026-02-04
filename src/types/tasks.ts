/**
 * Task types for the Follow-Up System
 */

export type TaskStatus = "pending" | "completed" | "cancelled";
export type TaskPriority = "normal" | "high" | "urgent";

export interface InquiryTask {
  id: string;
  inquiry_id: string | null;
  title: string;
  description?: string | null;
  due_date: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskWithInquiry extends InquiryTask {
  inquiry?: {
    id: string;
    contact_name: string;
    company_name?: string;
    event_type?: string;
  };
}

// Quick task presets for common follow-up actions
export interface QuickTaskPreset {
  label: string;
  title: string;
  dueInDays: number;
  priority: TaskPriority;
}

export const QUICK_TASK_PRESETS: QuickTaskPreset[] = [
  {
    label: "Morgen anrufen",
    title: "Telefonat mit Kunde",
    dueInDays: 1,
    priority: "high",
  },
  {
    label: "In 3 Tagen nachfassen",
    title: "Nachfassen zu Angebot",
    dueInDays: 3,
    priority: "normal",
  },
  {
    label: "Nächste Woche",
    title: "Follow-up",
    dueInDays: 7,
    priority: "normal",
  },
  {
    label: "Dringend heute",
    title: "Dringende Rückmeldung",
    dueInDays: 0,
    priority: "urgent",
  },
];
