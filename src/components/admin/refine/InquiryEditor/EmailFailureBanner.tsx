import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEmailFailuresForEntity, resolveEmailFailure, type EmailFailure } from "@/hooks/useEmailFailures";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const STATUS_LABEL: Record<string, string> = {
  failed: "Versand fehlgeschlagen",
  bounced: "Abgewiesen (Bounce)",
  complained: "Als Spam markiert",
  suppressed: "Empfänger unterdrückt",
};

export function EmailFailureBanner({ entityId }: { entityId: string | undefined }) {
  const { data, refetch } = useEmailFailuresForEntity(entityId);
  const [resolving, setResolving] = useState<string | null>(null);
  const qc = useQueryClient();

  if (!data || data.length === 0) return null;

  const handleResolve = async (f: EmailFailure) => {
    setResolving(f.id);
    try {
      // Optimistic: sofort aus beiden Caches entfernen, damit Karte/Banner verschwindet.
      qc.setQueryData<EmailFailure[] | undefined>(
        ["email-failures", "entity", entityId],
        (old) => (old ? old.filter((x) => x.id !== f.id) : old),
      );
      qc.setQueryData<EmailFailure[] | undefined>(
        ["email-failures", "global"],
        (old) => (old ? old.filter((x) => x.id !== f.id) : old),
      );
      await resolveEmailFailure(f);
      toast.success("Als erledigt markiert");
      refetch();
      qc.invalidateQueries({ queryKey: ["email-failures", "global"] });
      qc.invalidateQueries({ queryKey: ["activity-logs"] });
    } catch (err) {
      toast.error("Konnte nicht aktualisiert werden");
      console.error(err);
      refetch();
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-destructive bg-destructive/5 p-5 mb-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-destructive/15 p-2">
          <AlertOctagon className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-destructive text-sm uppercase tracking-wide">
              Dringend · Email-Zustellfehler
            </h3>
            <span className="text-xs text-muted-foreground">
              {data.length} {data.length === 1 ? "Vorfall" : "Vorfälle"}
            </span>
          </div>
          <p className="text-sm text-foreground/90 mb-4">
            Mindestens eine Email an den Kunden wurde <strong>nicht zugestellt</strong>. Bitte über
            einen alternativen Kanal (Telefon, WhatsApp) Kontakt aufnehmen.
          </p>

          <div className="space-y-2">
            {data.map((f) => (
              <div
                key={f.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-background border border-destructive/30 p-3"
              >
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-destructive/15 text-destructive text-[11px] font-semibold px-2 py-0.5">
                      {STATUS_LABEL[f.status] ?? f.status}
                    </span>
                    <span className="font-medium truncate">{f.recipient_email}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(f.sent_at), "dd.MM.yy HH:mm", { locale: de })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    Betreff: {f.subject || "—"}
                  </div>
                  {f.error_message ? (
                    <div className="text-xs font-mono text-destructive/80 mt-1 break-all">
                      {f.error_message}
                    </div>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl shrink-0"
                  disabled={resolving === f.id}
                  onClick={() => handleResolve(f)}
                >
                  {resolving === f.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Erledigt
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}