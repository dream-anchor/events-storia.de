import { useNavigate } from "react-router-dom";
import { AlertOctagon } from "lucide-react";
import { useGlobalEmailFailures } from "@/hooks/useEmailFailures";
import { cn } from "@/lib/utils";

export function EmailFailureTile() {
  const navigate = useNavigate();
  const { data, isLoading } = useGlobalEmailFailures();
  const count = data?.length ?? 0;

  if (isLoading) return null;

  const isAlert = count > 0;

  const distinctEntities = new Set((data || []).map((f) => f.entity_id)).size;

  return (
    <button
      type="button"
      onClick={() => {
        if (count === 0) return;
        // Spring to first failing inquiry
        const first = data?.[0];
        if (first?.entity_id) navigate(`/admin/inquiries/${first.entity_id}/edit`);
      }}
      className={cn(
        "w-full text-left rounded-2xl border p-4 transition-all",
        isAlert
          ? "border-destructive bg-destructive/5 hover:bg-destructive/10 cursor-pointer shadow-sm"
          : "border-border bg-muted/30 cursor-default"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "rounded-xl p-2",
            isAlert ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          <AlertOctagon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[10px] uppercase tracking-[0.18em] font-semibold",
              isAlert ? "text-destructive" : "text-muted-foreground"
            )}
          >
            Email-Fehler
          </div>
          <div className={cn("text-sm mt-0.5", isAlert ? "text-foreground font-medium" : "text-muted-foreground")}>
            {isAlert
              ? `${count} ${count === 1 ? "Vorfall" : "Vorfälle"} · ${distinctEntities} ${distinctEntities === 1 ? "Vorgang" : "Vorgänge"}`
              : "Keine offenen Zustellfehler"}
          </div>
        </div>
        {isAlert && (
          <span className="text-2xl font-bold text-destructive tabular-nums">{count}</span>
        )}
      </div>
    </button>
  );
}