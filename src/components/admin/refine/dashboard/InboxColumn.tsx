import { useNavigate } from "react-router-dom";
import { Inbox, AlertTriangle, Mail, Truck, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashInbox } from "@/hooks/useDashboardData";

function formatEUR(cents: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

function KindIcon({ kind }: { kind: DashInbox["kind"] }) {
  if (kind === "catering") return <Truck className="h-3.5 w-3.5 text-muted-foreground" />;
  if (kind === "group") return <Users2 className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Mail className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function InboxColumn({
  inbox,
  stale,
  overduePayments,
}: {
  inbox: DashInbox[];
  stale: DashInbox[];
  overduePayments: Array<{ id: string; inquiryId: string; customerName: string; amountCents: number; daysOverdue: number }>;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">Kommt rein</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Letzte 48h · Stale · Überfällig</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {inbox.length}
        </span>
      </header>

      {/* Overdue payments — accent red, top */}
      {overduePayments.length > 0 && (
        <section className="bg-destructive/5 border border-destructive/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">
              {overduePayments.length} überfällige Zahlung{overduePayments.length > 1 ? "en" : ""}
            </h3>
            <span className="ml-auto text-sm font-bold text-destructive">
              {formatEUR(overduePayments.reduce((s, p) => s + p.amountCents, 0))}
            </span>
          </div>
          <div className="space-y-1">
            {overduePayments.slice(0, 5).map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/admin/events/${p.inquiryId}/edit`)}
                className="w-full flex items-center justify-between px-2 py-1.5 -mx-2 rounded-lg hover:bg-destructive/10 transition-colors text-sm"
              >
                <span className="font-medium text-foreground truncate">{p.customerName}</span>
                <span className="text-xs text-destructive flex-shrink-0 ml-3">
                  {formatEUR(p.amountCents)} · {p.daysOverdue}T
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* New inbox 48h */}
      <section className="bg-card rounded-2xl border border-border/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Neue Eingänge (48h)</h3>
          <span className="ml-auto text-xs text-muted-foreground">{inbox.length}</span>
        </div>
        {inbox.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Keine neuen Eingänge</p>
        ) : (
          <div className="space-y-1">
            {inbox.slice(0, 8).map(i => (
              <button
                key={`${i.kind}-${i.id}`}
                onClick={() => navigate(i.navigateTo)}
                className="w-full flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left"
              >
                <KindIcon kind={i.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{i.customerName}</p>
                  {i.subtitle && <p className="text-[11px] text-muted-foreground truncate">{i.subtitle}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                  {i.ageDays === 0 ? "heute" : `${i.ageDays}T`}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Stale */}
      {stale.length > 0 && (
        <section className="bg-card rounded-2xl border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-foreground">Liegen geblieben</h3>
            <span className="ml-auto text-xs text-muted-foreground">{stale.length}</span>
          </div>
          <div className="space-y-1">
            {stale.slice(0, 5).map(s => (
              <button
                key={s.id}
                onClick={() => navigate(s.navigateTo)}
                className="w-full flex items-center justify-between px-2 py-1.5 -mx-2 rounded-lg hover:bg-muted/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.customerName}</p>
                  {s.subtitle && <p className="text-[11px] text-muted-foreground truncate">{s.subtitle}</p>}
                </div>
                <span className={cn(
                  "text-xs font-semibold flex-shrink-0 ml-3",
                  s.ageDays >= 10 ? "text-destructive" : "text-amber-600"
                )}>
                  {s.ageDays}T
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}