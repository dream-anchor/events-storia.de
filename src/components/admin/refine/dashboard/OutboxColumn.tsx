import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bell, Mail, Truck, CreditCard, ListTodo, ChevronDown, History, Check, X } from "lucide-react";
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

export function OutboxColumn() {
  const navigate = useNavigate();
  const { data, isLoading } = useUpcomingReminders();
  const [showHistory, setShowHistory] = useState(false);
  const { skipReminder } = useOperationActions();

  const upcoming = data?.upcoming || [];
  const recent = data?.recent || [];

  // Group by scheduledLabel
  const grouped = upcoming.reduce<Record<string, UpcomingReminder[]>>((acc, r) => {
    if (!acc[r.scheduledLabel]) acc[r.scheduledLabel] = [];
    acc[r.scheduledLabel].push(r);
    return acc;
  }, {});

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

      {Object.entries(grouped).map(([label, items]) => (
        <section key={label}>
          <div className="flex items-center gap-2 mb-2">
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground capitalize">{label}</h3>
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {items.length}
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {items.map(r => (
              <div key={r.id} className="group flex items-center gap-2 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors min-h-[44px]">
                <button
                  onClick={() => r.navigateTo && navigate(r.navigateTo)}
                  disabled={!r.navigateTo}
                  className="flex items-center gap-3 flex-1 py-3 text-left disabled:cursor-default"
                >
                  <span className="text-muted-foreground flex-shrink-0">{kindIcon(r.kind)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{r.title}</p>
                    {r.recipient && <p className="text-[11px] text-muted-foreground truncate">an {r.recipient}</p>}
                  </div>
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
        </section>
      ))}

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
