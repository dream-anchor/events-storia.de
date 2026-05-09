/**
 * OfferHistoryList — Versions-Verlauf der versendeten Angebote.
 *
 * Zeigt alle Einträge aus `inquiry_offer_history` (neueste oben).
 * Pro Karte: Version, Sendezeit, Absender, Anzahl Optionen, Pakete + Summen.
 * Aktionen: „Ansehen" (öffnet read-only Detail-Ansicht) und „Als neues
 * Angebot kopieren" (klont die Snapshot-Options als bearbeitbaren Entwurf).
 *
 * Immutability: liest ausschließlich aus options_snapshot, modifiziert nichts
 * im History-Eintrag.
 */
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Eye, Copy, Mail, ScrollText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOfferHistory, type OfferHistoryEntry, type OfferOptionSnapshot } from "@/hooks/useOfferHistory";
import { useCloneOfferVersion } from "@/hooks/useCloneOfferVersion";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";

function formatEur(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function summarizeOption(opt: OfferOptionSnapshot): string {
  const menu = (opt.menu_selection || {}) as { packageNameOverride?: string };
  if (menu.packageNameOverride) return menu.packageNameOverride;
  if (opt.package_id) return `Paket ${opt.option_label}`;
  return `Option ${opt.option_label}`;
}

interface OfferHistoryListProps {
  inquiryId: string;
}

export function OfferHistoryList({ inquiryId }: OfferHistoryListProps) {
  const navigate = useNavigate();
  const { data: history = [], isLoading } = useOfferHistory(inquiryId);
  const cloneMutation = useCloneOfferVersion(inquiryId);
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);

  const latestVersion = history[0]?.version ?? null;

  const handleClone = async () => {
    if (confirmVersion == null) return;
    await cloneMutation.mutateAsync(confirmVersion);
    setConfirmVersion(null);
  };

  return (
    <Card className="rounded-2xl border border-border/60 bg-white dark:bg-neutral-900">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Versendete Angebote
            {history.length > 0 && (
              <Badge variant="outline" className="ml-1 font-normal">
                {history.length} Version{history.length !== 1 ? "en" : ""}
              </Badge>
            )}
          </CardTitle>
          {latestVersion != null && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setConfirmVersion(latestVersion)}
              disabled={cloneMutation.isPending}
            >
              <Copy className="h-3.5 w-3.5" />
              Letztes Angebot kopieren
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Lade Versionsverlauf …
          </div>
        )}

        {!isLoading && history.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
            <Mail className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Es wurde noch kein Angebot versendet.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Sobald Sie ein Angebot abschicken, erscheint es hier in der
              Versionshistorie.
            </p>
          </div>
        )}

        {history.map((entry: OfferHistoryEntry) => {
          const opts = (entry.options_snapshot || []).filter(
            (o: OfferOptionSnapshot & { isActive?: boolean }) =>
              o.is_active !== false && (o as { isActive?: boolean }).isActive !== false,
          );
          const isLatest = entry.version === latestVersion;
          return (
            <div
              key={entry.id}
              className="rounded-xl border border-border/60 bg-neutral-50/50 dark:bg-neutral-800/40 p-4 hover:border-border transition-colors"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="font-mono font-semibold text-xs bg-white dark:bg-neutral-900"
                    >
                      v{entry.version}
                    </Badge>
                    {isLatest && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase tracking-wide">
                        Aktuell
                      </Badge>
                    )}
                    <span className="text-sm font-medium">
                      {(() => {
                        try {
                          return format(
                            parseISO(entry.sent_at),
                            "dd.MM.yyyy 'um' HH:mm",
                            { locale: de },
                          );
                        } catch {
                          return entry.sent_at;
                        }
                      })()}
                    </span>
                    {entry.sent_by && (
                      <span className="text-xs text-muted-foreground">
                        · {getAdminDisplayName(entry.sent_by)}
                      </span>
                    )}
                  </div>

                  {entry.recipient_email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>An:</span>
                      <span className="font-mono text-foreground/80 break-all">
                        {entry.recipient_email}
                      </span>
                    </div>
                  )}

                  {entry.cc_email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 opacity-60" />
                      <span>CC:</span>
                      <span className="font-mono text-foreground/80 break-all">
                        {entry.cc_email}
                      </span>
                    </div>
                  )}

                  {entry.bcc_email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 opacity-60" />
                      <span>BCC:</span>
                      <span className="font-mono text-foreground/80 break-all">
                        {entry.bcc_email}
                      </span>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    {opts.length === 0 ? (
                      <span>Keine Optionen archiviert</span>
                    ) : (
                      <span>
                        {opts.length} Option{opts.length !== 1 ? "en" : ""} ·{" "}
                        {opts
                          .map((o) => summarizeOption(o))
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>

                  {opts.length > 0 && (
                    <div className="text-xs text-foreground/80 font-mono">
                      {opts
                        .map((o) => `${o.option_label}: ${formatEur(Number(o.total_amount) || 0)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() =>
                      navigate(`/admin/events/${inquiryId}/archive/${entry.version}`)
                    }
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ansehen
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setConfirmVersion(entry.version)}
                    disabled={cloneMutation.isPending}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Als neues kopieren
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>

      <AlertDialog
        open={confirmVersion != null}
        onOpenChange={(open) => {
          if (!open) setConfirmVersion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Neues Angebot auf Basis von v{confirmVersion} erstellen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Optionen aus dieser Version werden als bearbeitbarer Entwurf für
              die nächste Version übernommen. Die archivierte v{confirmVersion}{" "}
              bleibt unverändert. Aktuelle, noch nicht versendete Optionen werden
              dabei deaktiviert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cloneMutation.isPending}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleClone();
              }}
              disabled={cloneMutation.isPending}
            >
              {cloneMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Kopiere …
                </>
              ) : (
                "Kopieren & bearbeiten"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}