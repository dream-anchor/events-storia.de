import { cn } from "@/lib/utils";
import type { TaskBucket, TaskServiceType } from "@/lib/dashboardPriority";
import { Search } from "lucide-react";

export interface WorklistFiltersValue {
  bucket: "all" | TaskBucket;
  types: TaskServiceType[];
  query: string;
}

interface Props {
  value: WorklistFiltersValue;
  onChange: (v: WorklistFiltersValue) => void;
  bucketCounts: Record<TaskBucket, number>;
  total: number;
}

const BUCKET_OPTIONS: Array<{ key: "all" | TaskBucket; label: string }> = [
  { key: "all", label: "Alle" },
  { key: "now", label: "Jetzt" },
  { key: "sla", label: "SLA" },
  { key: "today", label: "Heute" },
  { key: "week", label: "Woche" },
];

const TYPE_OPTIONS: Array<{ key: TaskServiceType; label: string }> = [
  { key: "inquiry", label: "Anfrage" },
  { key: "restaurant", label: "Event" },
  { key: "catering", label: "Catering" },
  { key: "payment", label: "Zahlung" },
];

export function WorklistFilters({ value, onChange, bucketCounts, total }: Props) {
  const toggleType = (t: TaskServiceType) => {
    const has = value.types.includes(t);
    onChange({ ...value, types: has ? value.types.filter(x => x !== t) : [...value.types, t] });
  };

  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap gap-2">
        {BUCKET_OPTIONS.map(opt => {
          const active = value.bucket === opt.key;
          const count = opt.key === "all" ? total : bucketCounts[opt.key as TaskBucket];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange({ ...value, bucket: opt.key })}
              className={cn(
                "h-8 px-3 rounded-full text-xs font-medium border transition-colors tabular-nums",
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
              )}
            >
              {opt.label}
              <span className={cn("ml-1.5 opacity-70", active ? "" : "")}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map(opt => {
            const active = value.types.includes(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleType(opt.key)}
                className={cn(
                  "h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors",
                  active
                    ? "bg-foreground/10 text-foreground border-foreground/30"
                    : "bg-background text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={value.query}
            onChange={e => onChange({ ...value, query: e.target.value })}
            placeholder="Suchen…"
            className="w-full h-8 pl-8 pr-2 rounded-full text-xs bg-background border border-border focus:outline-none focus:border-foreground/40"
          />
        </div>
      </div>
    </div>
  );
}