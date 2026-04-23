import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bell, Mail, Truck, CreditCard, ListTodo, ChevronDown, History, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpcomingReminders, type UpcomingReminder } from "@/hooks/useUpcomingReminders";

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

  const upcoming = data?.upcoming || [];
  const recent = data?.recent || [];

  // Group by scheduledLabel
  const grouped = upcoming.reduce<Record<string, UpcomingReminder[]>>((acc, r) => {
    if (!acc[r.scheduledLabel]) acc[r.scheduledLabel] = [];
    acc[r.scheduledLabel].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Geht raus</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Automatisch · nächste 24h</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {upcoming.length}
        </span>
      </header>

      {isLoading && <div className="h-32 bg-muted/40 rounded-2xl animate-pulse" />}

      {!isLoading && upcoming.length === 0 && (
        <div className="text-center py-10 text-sm text-muted-foreground bg-muted/30 rounded-2xl">
          <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Keine geplanten Erinnerungen
        </div>
      )}

      {Object.entries(grouped).map(([label, items]) => (
        <section key={label} className="bg-card rounded-2xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground capitalize">{label}</h3>
            <span className="ml-auto text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {items.length} geplant
            </span>
          </div>
          <div className="space-y-1">
            {items.map(r => (
              <button
                key={r.id}
                onClick={() => r.navigateTo && navigate(r.navigateTo)}
                disabled={!r.navigateTo}
                className="w-full flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left disabled:cursor-default"
              >
                <span className="text-muted-foreground flex-shrink-0">{kindIcon(r.kind)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{r.title}</p>
                  {r.recipient && <p className="text-[11px] text-muted-foreground truncate">an {r.recipient}</p>}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        <span>Bereits raus (letzte 7 Tage)</span>
        <span className="ml-auto inline-flex items-center gap-1">
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
                <Check className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                <span className="text-foreground truncate flex-1">{r.subject}</span>
                <span className="text-muted-foreground flex-shrink-0">
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