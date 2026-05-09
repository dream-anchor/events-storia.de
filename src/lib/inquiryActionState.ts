import type { EventInquiry } from "@/types/refine";

export type ActionState = "respond" | "in_progress" | "won" | "done";

export interface ActionStateMeta {
  state: ActionState;
  label: string;
  /** Tailwind background class for the 8px traffic-light dot */
  dotClass: string;
  /** Tailwind class for left-border accent (3px) */
  borderClass: string;
  /** Tailwind text color */
  textClass: string;
  /** Soft background tint for chips */
  chipClass: string;
}

/**
 * Unified "what do I need to do?" derivation. Used by both Kanban and Table
 * so the visual signal is identical in both views.
 *
 * Priority order:
 *   1. respond    — Customer answered OR new inquiry > 24h with no reaction
 *   2. won        — confirmed booking
 *   3. done       — declined / cancelled / archived
 *   4. in_progress — everything else (active work)
 */
export function getInquiryActionState(event: EventInquiry): ActionStateMeta {
  const archived = !!event.archived_at;
  const customerResponded = event.offer_phase === "customer_responded";

  // 1. RESPOND — highest priority, requires immediate human action
  if (!archived && customerResponded) {
    return {
      state: "respond",
      label: "Kunde wartet",
      dotClass: "bg-red-500",
      borderClass: "border-l-red-500",
      textClass: "text-red-700",
      chipClass: "bg-red-50 text-red-700 ring-1 ring-red-200",
    };
  }
  if (!archived && event.status === "new") {
    return {
      state: "respond",
      label: "Neu",
      dotClass: "bg-red-500",
      borderClass: "border-l-red-500",
      textClass: "text-red-700",
      chipClass: "bg-red-50 text-red-700 ring-1 ring-red-200",
    };
  }

  // 2. WON — confirmed booking
  if (event.status === "confirmed") {
    return {
      state: "won",
      label: "Gebucht",
      dotClass: "bg-emerald-500",
      borderClass: "border-l-emerald-500",
      textClass: "text-emerald-700",
      chipClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    };
  }

  // 3. DONE — declined / cancelled / archived
  if (archived) {
    return {
      state: "done",
      label: "Archiviert",
      dotClass: "bg-slate-300",
      borderClass: "border-l-slate-300",
      textClass: "text-slate-500",
      chipClass: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    };
  }
  if (event.status === "declined") {
    return {
      state: "done",
      label: "Abgelehnt",
      dotClass: "bg-slate-300",
      borderClass: "border-l-slate-300",
      textClass: "text-slate-500",
      chipClass: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    };
  }
  if (event.status === "cancelled") {
    return {
      state: "done",
      label: "Abgesagt",
      dotClass: "bg-slate-300",
      borderClass: "border-l-slate-300",
      textClass: "text-slate-500",
      chipClass: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
    };
  }

  // 4. IN PROGRESS — everything else (new ≤ 24h, contacted, offer_sent without response)
  let label = "In Bearbeitung";
  if (event.status === "offer_sent") label = "Angebot offen";
  else if (event.status === "contacted") label = "In Bearbeitung";

  return {
    state: "in_progress",
    label,
    dotClass: "bg-amber-500",
    borderClass: "border-l-amber-500",
    textClass: "text-amber-700",
    chipClass: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  };
}