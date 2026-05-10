import type { InquiryRecord } from "@/types/inquiryRecord";
import type { EventInquiry } from "@/types/refine";

export type ActionState = "respond" | "in_progress" | "won" | "done";

export interface ActionStateMeta {
  state: ActionState;
  label: string;
  dotClass: string;
  borderClass: string;
  textClass: string;
  chipClass: string;
}

const RESPOND: ActionStateMeta = {
  state: "respond",
  label: "Kunde wartet",
  dotClass: "bg-red-500",
  borderClass: "border-l-red-500",
  textClass: "text-red-700",
  chipClass: "bg-red-50 text-red-700 ring-1 ring-red-200",
};
const WON: ActionStateMeta = {
  state: "won",
  label: "Gebucht",
  dotClass: "bg-emerald-500",
  borderClass: "border-l-emerald-500",
  textClass: "text-emerald-700",
  chipClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};
const DONE: ActionStateMeta = {
  state: "done",
  label: "Archiviert",
  dotClass: "bg-slate-300",
  borderClass: "border-l-slate-300",
  textClass: "text-slate-500",
  chipClass: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};
function inProgress(label = "In Bearbeitung"): ActionStateMeta {
  return {
    state: "in_progress",
    label,
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    textClass: "text-amber-700",
    chipClass: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
}

/**
 * Unified "what do I need to do?" derivation for any InquiryRecord
 * (v2 events + catering orders). Used by Kanban and Table.
 */
export function getRecordActionState(r: InquiryRecord): ActionStateMeta {
  const archived = !!r.archivedAt || !!r.archived;

  if (r.kind === "event") {
    if (archived) return { ...DONE, label: "Archiviert" };
    if (r.status === "cancelled") return { ...DONE, label: "Abgesagt" };
    if (r.offerPhase === "customer_responded")
      return { ...RESPOND, label: "Kunde wartet" };
    if (r.status === "inquiry") return { ...RESPOND, label: "Neu" };
    if (r.status === "paid" || r.status === "completed") return WON;
    if (r.status === "offer_sent") return inProgress("Angebot offen");
    if (r.status === "offer_chosen") return inProgress("Option gewählt");
    if (r.status === "offer_draft") return inProgress("Angebot in Arbeit");
    return inProgress();
  }

  // catering_order
  if (r.status === "cancelled") return { ...DONE, label: "Storniert" };
  if (r.status === "pending") return { ...RESPOND, label: "Neu" };
  if (r.status === "completed") return { ...WON, label: "Erledigt" };
  if (r.status === "confirmed") return inProgress("Bestätigt");
  return inProgress();
}

/**
 * Legacy adapter for the old `event_inquiries` rows still rendered by
 * `EventsList` / `KanbanView`. Maps the legacy status vocabulary to the
 * unified action state.
 */
export function getInquiryActionState(event: EventInquiry): ActionStateMeta {
  const archived = !!event.archived_at;
  if (archived) return { ...DONE, label: "Archiviert" };
  if (event.offer_phase === "customer_responded")
    return { ...RESPOND, label: "Kunde wartet" };
  if (event.status === "new") return { ...RESPOND, label: "Neu" };
  if (event.status === "confirmed") return WON;
  if (event.status === "declined") return { ...DONE, label: "Abgelehnt" };
  if (event.status === "cancelled") return { ...DONE, label: "Abgesagt" };
  if (event.status === "offer_sent") return inProgress("Angebot offen");
  if (event.status === "contacted") return inProgress("In Bearbeitung");
  return inProgress();
}