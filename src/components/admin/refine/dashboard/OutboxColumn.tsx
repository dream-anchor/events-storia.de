import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bell, Mail, Truck, CreditCard, ListTodo, ChevronDown, History, Check, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpcomingReminders, type UpcomingReminder } from "@/hooks/useUpcomingReminders";
import { useOperationActions } from "@/hooks/useOperationActions";

function kindIcon(kind: UpcomingReminder["kind"]) {
  switch (kind) {
    case "follow_up_task": return <ListTodo className="h-3.5 w-3.5" />;
    case "catering_customer_reminder": return <Truck className="h-3.5 w-3.5" />;
    case "catering_kitchen": return <Truck className="h-3.5 w-3.5" />;
    case "payment_overdue": return <CreditCard className="h-3.5 w-3.5" />;
    case "offer_reminder": return <Mail className="h-3.5 w-3.5" />;
  }
}

function kindGroupLabel(kind: UpcomingReminder["kind"]): string {
  switch (kind) {
    case "follow_up_task": return "Follow-ups";
    case "catering_customer_reminder": return "Liefererinnerungen";
    case "catering_kitchen": return "Küche";
    case "payment_overdue": return "Zahlungserinnerungen";
    case "offer_reminder": return "Angebotserinnerungen";
  }
}

function initials(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function OutboxColumn() {
  const navigate = useNavigate();
  const { data, isLoading } = useUpcomingReminders();
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { skipReminder } = useOperationActions();

  const upcoming = data?.upcoming || [];
  const recent = data?.recent || [];

  // Group by kind + scheduledLabel — produces compact stacks like
  // "Angebotserinnerungen · 8 Empfänger · Fr 10:00"
  const stacks = upcoming.reduce<Record<string, { kind: UpcomingReminder["kind"]; label: string; items: UpcomingReminder[] }>>((acc, r) => {
    const key = `${r.kind}__${r.scheduledLabel}`;
    if (!acc[key]) acc[key] = { kind: r.kind, label: r.scheduledLabel, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});
  const stackEntries = Object.entries(stacks);

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Automatik</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {upcoming.length > 0
              ? `${upcoming.length} geplant in 24h`
              : "Keine geplanten Aktionen"}
          </p>
        </div>
        {upcoming.length > 0 && (
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {upcoming.length}
          </span>
        )}
      </header>

      {isLoading && <div className="h-32 bg-muted/40 rounded-2xl animate-pulse" />}

      {!isLoading && upcoming.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Keine geplanten Erinnerungen
        </div>
      )}

      {stackEntries.length > 0 && (
        <div className="divide-y divide-border/40">
          {stackEntries.map(([key, stack]) => {
            const isOpen = expanded.has(key);
            const single = stack.items.length === 1;
            return (
              <section key={key} className="py-1">
                <button
                  onClick={() => !single && toggle(key)}
                  disabled={single}
                  className={cn(
                    "w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg text-left transition-colors min-h-[44px] min-w-0",
                    !single && "hover:bg-muted/60 cursor-pointer",
                    single && "cursor-default"
                  )}
                >
                  <span className="text-muted-foreground flex-shrink-0">{kindIcon(stack.kind)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {kindGroupLabel(stack.kind)}
                      {!single && <span className="text-muted-foreground font-normal"> · {stack.items.length} Empfänger</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {single ? (stack.items[0].recipient ? `an ${stack.items[0].recipient} · ${stack.label}` : stack.label) : stack.label}
                    </p>
                  </div>
                  {!single && (
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", isOpen && "rotate-90")} />
                  )}
                  {single && (
                    <button
                      onClick={(e) => { e.stopPropagation(); skipReminder.mutate({ kind: stack.items[0].kind, id: stack.items[0].id }); }}
                      disabled={skipReminder.isPending}
                      title="Heute überspringen"
                      className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </button>
                {!single && isOpen && (
                  <div className="pl-7 pr-2 pb-2 divide-y divide-border/40">
                    {stack.items.map(r => (
                      <div key={r.id} className="group flex items-center gap-2 min-h-[44px] min-w-0">
                        <span className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-[10px] font-semibold text-foreground tabular-nums">
                          {initials(r.recipient)}
                        </span>
                        <button
                          onClick={() => r.navigateTo && navigate(r.navigateTo)}
                          disabled={!r.navigateTo}
                          className="flex-1 min-w-0 py-2 text-left disabled:cursor-default"
                        >
                          <p className="text-sm text-foreground truncate">{r.recipient || r.title}</p>
                        </button>
                        <button
                          onClick={() => skipReminder.mutate({ kind: r.kind, id: r.id })}
                          disabled={skipReminder.isPending}
                          title="Heute überspringen"
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors min-h-[44px]"
      >
        <History className="h-3.5 w-3.5" />
        <span>Bereits raus (letzte 7 Tage)</span>
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
          {recent.length}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showHistory && "rotate-180")} />
        </span>
      </button>

      {showHistory && (
        <div className="bg-muted/30 rounded-2xl p-3 space-y-1 max-h-80 overflow-y-auto">
          {recent.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Erinnerungen versendet</p>
          ) : (
            recent.map(r => (
              <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <Check className="h-3 w-3 text-foreground/60 flex-shrink-0" />
                <span className="text-foreground truncate flex-1">{r.subject}</span>
                <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                  {new Date(r.sentAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
