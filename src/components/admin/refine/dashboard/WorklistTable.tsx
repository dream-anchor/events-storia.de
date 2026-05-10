import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { Phone, MoreHorizontal, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bucketDotClass,
  bucketLabel,
  snoozeTask,
  type DashTask,
  type TaskBucket,
} from "@/lib/dashboardPriority";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatDue(dueAt: Date | null, now: Date): string {
  if (!dueAt) return "—";
  const sameDay =
    dueAt.getFullYear() === now.getFullYear() &&
    dueAt.getMonth() === now.getMonth() &&
    dueAt.getDate() === now.getDate();
  const time = dueAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Heute · ${time}`;
  const diffDays = Math.round((dueAt.getTime() - new Date(now).setHours(0, 0, 0, 0)) / 86400_000);
  if (diffDays === 1) return `Morgen · ${time}`;
  if (diffDays > 1 && diffDays < 7)
    return `${dueAt.toLocaleDateString("de-DE", { weekday: "short" })} · ${time}`;
  if (diffDays < 0) {
    const d = Math.abs(diffDays);
    return `vor ${d} ${d === 1 ? "Tag" : "Tagen"}`;
  }
  return dueAt.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

interface Props {
  tasks: DashTask[];
  now: Date;
  onChanged?: () => void;
}

export function WorklistTable({ tasks, now, onChanged }: Props) {
  const navigate = useNavigate();
  const [, setRevision] = useState(0);

  const handleSnooze = (id: string, hours: number) => {
    snoozeTask(id, hours);
    setRevision(r => r + 1);
    onChanged?.();
  };

  const columns = useMemo<ColumnDef<DashTask>[]>(() => [
    {
      id: "bucket",
      header: "",
      size: 12,
      cell: ({ row }) => (
        <span
          aria-label={bucketLabel(row.original.bucket)}
          className={cn("inline-block h-2 w-2 rounded-full", bucketDotClass(row.original.bucket))}
        />
      ),
    },
    {
      id: "due",
      header: "Fällig",
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-foreground/80 whitespace-nowrap">
          {formatDue(row.original.dueAt, now)}
        </span>
      ),
    },
    {
      id: "task",
      header: "Aufgabe",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{row.original.title}</div>
          {row.original.subtitle && (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5">{row.original.subtitle}</div>
          )}
        </div>
      ),
    },
    {
      id: "reasons",
      header: "Grund",
      cell: ({ row }) =>
        row.original.reasons.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.reasons.map((r, i) => (
              <span
                key={i}
                className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-md bg-foreground/5 text-foreground/70 border border-foreground/10"
              >
                {r}
              </span>
            ))}
          </div>
        ),
    },
    {
      id: "actions",
      header: "",
      size: 110,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => navigate(t.navigateTo)}
            >
              Öffnen
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {t.serviceType === "catering" || t.serviceType === "restaurant" ? (
                  <DropdownMenuItem onSelect={() => navigate(t.navigateTo)}>
                    <Phone className="h-3.5 w-3.5 mr-2" /> Details öffnen
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => handleSnooze(t.id, 4)}>
                  <BellOff className="h-3.5 w-3.5 mr-2" /> Snooze 4 Std.
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSnooze(t.id, 24)}>
                  <BellOff className="h-3.5 w-3.5 mr-2" /> Snooze 24 Std.
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [navigate, now]);

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Group rows by bucket label for visual grouping
  type Group = { bucket: TaskBucket; rows: Row<DashTask>[] };
  const groups = useMemo<Group[]>(() => {
    const map = new Map<TaskBucket, Group>();
    const order: TaskBucket[] = ["now", "sla", "today", "week", "open"];
    order.forEach(b => map.set(b, { bucket: b, rows: [] }));
    table.getRowModel().rows.forEach(r => {
      map.get(r.original.bucket)!.rows.push(r);
    });
    return order.map(b => map.get(b)!).filter(g => g.rows.length > 0);
  }, [table.getRowModel().rows]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 p-10 text-center bg-background">
        <p className="text-sm text-muted-foreground">
          Nichts offen. Alle Aufgaben sind erledigt — Pause verdient.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
      {groups.map((g, gi) => (
        <div key={g.bucket}>
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", bucketDotClass(g.bucket))} />
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-foreground/70">
                {bucketLabel(g.bucket)}
              </span>
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">{g.rows.length}</span>
          </div>
          {g.rows.map(row => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(row.original.navigateTo)}
              onKeyDown={e => {
                if (e.key === "Enter") navigate(row.original.navigateTo);
              }}
              className={cn(
                "grid grid-cols-[12px_minmax(90px,auto)_1fr_minmax(80px,auto)_auto] items-center gap-3 px-4 py-3 border-b border-border/40 last:border-b-0 cursor-pointer transition-colors",
                "hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
              )}
            >
              {row.getVisibleCells().map(cell => (
                <div key={cell.id} className="min-w-0">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          ))}
          {gi < groups.length - 1 && <div className="h-0" />}
        </div>
      ))}
    </div>
  );
}