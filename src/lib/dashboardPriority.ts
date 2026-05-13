import type { DashOperation, DashInbox, DashboardData } from "@/hooks/useDashboardData";

export type TaskBucket = "now" | "sla" | "today" | "week" | "open";
export type TaskSourceKind = "operation" | "inquiry" | "payment" | "stale";
export type TaskServiceType = "restaurant" | "catering" | "payment" | "inquiry" | "group";

export interface DashTask {
  id: string;
  sourceKind: TaskSourceKind;
  serviceType: TaskServiceType;
  title: string;
  subtitle: string | null;
  customerName: string;
  dueAt: Date | null;
  reasons: string[];
  navigateTo: string;
  score: number;
  bucket: TaskBucket;
}

const BUCKET_LABEL: Record<TaskBucket, string> = {
  now: "Jetzt",
  sla: "SLA-kritisch",
  today: "Heute",
  week: "Diese Woche",
  open: "Offen",
};

export function bucketLabel(b: TaskBucket): string {
  return BUCKET_LABEL[b];
}

export function bucketDotClass(b: TaskBucket): string {
  switch (b) {
    case "now": return "bg-foreground";
    case "sla": return "bg-foreground/70";
    case "today": return "bg-foreground/40";
    case "week": return "bg-foreground/20";
    default: return "bg-foreground/10";
  }
}

function parseOpDate(op: DashOperation): Date {
  const [y, m, d] = op.date.split("-").map(Number);
  const [hh, mm] = (op.time || "12:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

function bucketForDueAt(dueAt: Date | null, now: Date): TaskBucket {
  if (!dueAt) return "open";
  const diffMs = dueAt.getTime() - now.getTime();
  if (diffMs > -2 * 3600_000 && diffMs < 2 * 3600_000) return "now";
  const sameDay =
    dueAt.getFullYear() === now.getFullYear() &&
    dueAt.getMonth() === now.getMonth() &&
    dueAt.getDate() === now.getDate();
  if (sameDay) return "today";
  const days = (dueAt.getTime() - now.setHours(0, 0, 0, 0)) / 86400_000;
  if (days >= 0 && days <= 7) return "week";
  return "open";
}

function operationToTask(op: DashOperation, now: Date): DashTask {
  const dueAt = parseOpDate(op);
  const reasons: string[] = [];
  if (op.menuConfirmed === false) {
    const hoursUntil = (dueAt.getTime() - now.getTime()) / 3600_000;
    if (hoursUntil < 48) reasons.push("Menü unbestätigt");
  }
  if (op.paymentStatus && ["overdue", "unpaid", "pending"].includes(op.paymentStatus) && (dueAt.getTime() - now.getTime()) < 7 * 86400_000) {
    if (op.paymentStatus === "overdue") reasons.push("Zahlung überfällig");
  }

  let bucket = bucketForDueAt(dueAt, new Date(now));
  if (reasons.length > 0 && (bucket === "today" || bucket === "week")) bucket = "sla";

  let score = 0;
  if (bucket === "now") score = 1000;
  else if (bucket === "sla") score = 800;
  else if (bucket === "today") score = 500;
  else if (bucket === "week") score = 200;
  if (op.menuConfirmed === false) score += 50;
  if (op.paymentStatus === "overdue") score += 80;
  // earlier = higher
  score += Math.max(0, 200 - Math.floor((dueAt.getTime() - now.getTime()) / 3600_000));

  const guestStr = op.guestCount ? `${op.guestCount} P.` : null;
  const placeStr = op.isPickup ? "Abholung" : op.address;
  const subtitle = [guestStr, placeStr].filter(Boolean).join(" · ") || null;

  const title =
    op.kind === "catering"
      ? `Catering-${op.isPickup ? "Abholung" : "Lieferung"} · ${op.customerName}`
      : op.kind === "booking"
      ? `Event · ${op.customerName}`
      : `Event · ${op.customerName}`;

  return {
    id: `op-${op.kind}-${op.id}`,
    sourceKind: "operation",
    serviceType: op.kind === "catering" ? "catering" : "restaurant",
    title,
    subtitle,
    customerName: op.customerName,
    dueAt,
    reasons,
    navigateTo: op.navigateTo,
    score,
    bucket,
  };
}

function inquiryInboxToTask(item: DashInbox, now: Date): DashTask {
  const created = new Date(item.createdAt);
  const hours = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 3600_000));
  const reasons: string[] = [];
  let bucket: TaskBucket = "today";
  let score = 400;

  if (item.unanswered && hours >= 24) {
    reasons.push(`${hours}h ohne Antwort`);
    bucket = "sla";
    score = 800 + hours;
  } else if (item.unanswered && hours >= 4) {
    reasons.push(`${hours}h offen`);
    bucket = "today";
    score = 500 + hours;
  } else {
    reasons.push("Neue Anfrage");
    bucket = "today";
    score = 600;
  }

  return {
    id: `inb-${item.kind}-${item.id}`,
    sourceKind: "inquiry",
    serviceType: item.kind === "catering" ? "catering" : item.kind === "group" ? "group" : "inquiry",
    title: `Anfrage · ${item.customerName}`,
    subtitle: item.subtitle,
    customerName: item.customerName,
    dueAt: created,
    reasons,
    navigateTo: item.navigateTo,
    score,
    bucket,
  };
}

function staleToTask(item: DashInbox, now: Date): DashTask {
  const reasons = [`Stale · ${item.ageDays} Tage`];
  return {
    id: `stale-${item.id}`,
    sourceKind: "stale",
    serviceType: "inquiry",
    title: `Stale · ${item.customerName}`,
    subtitle: item.subtitle,
    customerName: item.customerName,
    dueAt: new Date(item.createdAt),
    reasons,
    navigateTo: item.navigateTo,
    score: 700 + item.ageDays * 5,
    bucket: "sla",
  };
}

function paymentToTask(p: DashboardData["overduePayments"][number]): DashTask {
  return {
    id: `pay-${p.id}`,
    sourceKind: "payment",
    serviceType: "payment",
    title: `Zahlung überfällig · ${p.customerName}`,
    subtitle: `${(p.amountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} · ${p.daysOverdue} Tage`,
    customerName: p.customerName,
    dueAt: null,
    reasons: [`${p.daysOverdue} Tage überfällig`],
    navigateTo: p.inquiryId ? `/admin/inquiries/${p.inquiryId}/edit` : `/admin`,
    score: 850 + p.daysOverdue * 5,
    bucket: "sla",
  };
}

function isSnoozed(taskId: string, now: Date): boolean {
  try {
    const raw = localStorage.getItem(`pinnwand:snooze:${taskId}`);
    if (!raw) return false;
    const expiry = Number(raw);
    if (!expiry || isNaN(expiry)) return false;
    return expiry > now.getTime();
  } catch {
    return false;
  }
}

export function buildTasks(data: DashboardData | undefined, now: Date): DashTask[] {
  if (!data) return [];
  const tasks: DashTask[] = [];
  data.operations.forEach(op => tasks.push(operationToTask(op, now)));
  data.inbox.forEach(i => tasks.push(inquiryInboxToTask(i, now)));
  data.staleInquiries.forEach(s => tasks.push(staleToTask(s, now)));
  data.overduePayments.forEach(p => tasks.push(paymentToTask(p)));

  // Dedup by id (operations may collide with stale by inquiry id; we already prefix differently).
  const seen = new Set<string>();
  const deduped: DashTask[] = [];
  for (const t of tasks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if (isSnoozed(t.id, now)) {
      deduped.push({ ...t, bucket: "open", score: t.score - 1000, reasons: [...t.reasons, "Snoozed"] });
    } else {
      deduped.push(t);
    }
  }
  deduped.sort((a, b) => b.score - a.score);
  return deduped;
}

export function snoozeTask(taskId: string, hours: number = 24) {
  try {
    const expiry = Date.now() + hours * 3600_000;
    localStorage.setItem(`pinnwand:snooze:${taskId}`, String(expiry));
  } catch { /* ignore */ }
}

export function unsnoozeTask(taskId: string) {
  try { localStorage.removeItem(`pinnwand:snooze:${taskId}`); } catch { /* ignore */ }
}

export function bucketCounts(tasks: DashTask[]): Record<TaskBucket, number> {
  const counts: Record<TaskBucket, number> = { now: 0, sla: 0, today: 0, week: 0, open: 0 };
  tasks.forEach(t => { counts[t.bucket] += 1; });
  return counts;
}