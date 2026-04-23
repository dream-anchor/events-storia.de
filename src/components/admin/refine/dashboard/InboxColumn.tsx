import { useNavigate } from "react-router-dom";
import { Inbox, AlertTriangle, Mail, Truck, Users2, Bell, ArrowRight } from "lucide-react";
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
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Posteingang</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Letzte 48h
            {stale.length > 0 ? ` · ${stale.length} liegen geblieben` : ""}
            {overduePayments.length > 0 ? ` · ${overduePayments.length} überfällig` : ""}
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/events")}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-md hover:bg-muted inline-flex items-center gap-1"
        >
          Alle Anfragen <ArrowRight className="h-3 w-3" />
        </button>
      </header>

      {/* Overdue payments — actionable list, top */}
      {overduePayments.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">
              Überfällige Zahlungen
              <span className="text-muted-foreground font-normal"> · {overduePayments.length}</span>
            </h3>
            <span className="ml-auto text-sm font-semibold text-destructive tabular-nums">
              {formatEUR(overduePayments.reduce((s, p) => s + p.amountCents, 0))}
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {overduePayments.slice(0, 5).map(p => {
              const init = (p.customerName || "—").trim().split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase() || "—";
              return (
                <div key={p.id} className="group flex items-center gap-3 py-2.5 min-h-[44px] min-w-0">
                  <span className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted text-[11px] font-semibold text-foreground">
                    {init}
                  </span>
                  <button
                    onClick={() => navigate(`/admin/events/${p.inquiryId}/edit`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium text-foreground truncate group-hover:underline">{p.customerName}</p>
                    <p className="text-[11px] text-muted-foreground truncate tabular-nums">
                      {formatEUR(p.amountCents)} · seit {p.daysOverdue} T
                    </p>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/admin/events/${p.inquiryId}/edit`)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted px-2 py-1 rounded-md min-h-[32px]"
                    >
                      <Bell className="h-3 w-3" /> Erinnern
                    </button>
                    <button
                      onClick={() => navigate(`/admin/events/${p.inquiryId}/edit`)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground bg-muted hover:bg-muted/70 px-2 py-1 rounded-md min-h-[32px]"
                    >
                      Öffnen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* New inbox 48h — collapses to 1-line hint when empty */}
      {inbox.length === 0 ? (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
          <Inbox className="h-3.5 w-3.5 opacity-60" />
          Keine neuen Anfragen seit 48h
        </p>
      ) : (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Neue Eingänge</h3>
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{inbox.length}</span>
          </div>
          <div className="divide-y divide-border/40">
            {inbox.slice(0, 8).map(i => (
              <button
                key={`${i.kind}-${i.id}`}
                onClick={() => navigate(i.navigateTo)}
                className="w-full flex items-center gap-3 px-2 py-3 -mx-2 rounded-lg hover:bg-muted/60 transition-colors text-left min-h-[44px] min-w-0"
              >
                <KindIcon kind={i.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{i.customerName}</p>
                  {i.subtitle && <p className="text-[11px] text-muted-foreground truncate">{i.subtitle}</p>}
                </div>
                <span className="text-[11px] text-muted-foreground flex-shrink-0 tabular-nums">
                  {i.ageDays === 0 ? "heute" : `${i.ageDays}T`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Stale */}
      {stale.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Liegen geblieben</h3>
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{stale.length}</span>
          </div>
          <div className="divide-y divide-border/40">
            {stale.slice(0, 5).map(s => (
              <button
                key={s.id}
                onClick={() => navigate(s.navigateTo)}
                className="w-full flex items-center justify-between px-2 py-3 -mx-2 rounded-lg hover:bg-muted/60 transition-colors min-h-[44px] min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{s.customerName}</p>
                  {s.subtitle && <p className="text-[11px] text-muted-foreground truncate">{s.subtitle}</p>}
                </div>
                <span className={cn(
                  "text-xs font-semibold flex-shrink-0 ml-3 tabular-nums",
                  s.ageDays >= 10 ? "text-destructive" : "text-foreground"
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
