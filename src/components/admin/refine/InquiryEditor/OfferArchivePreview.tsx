/**
 * OfferArchivePreview — STRIKT READ-ONLY Detail-Ansicht einer
 * versendeten Angebots-Version.
 *
 * Liest ausschließlich aus inquiry_offer_history.options_snapshot +
 * email_content + pdf_url. Kein Kontakt zur Live-Tabelle
 * inquiry_offer_options — die archivierte Version ist immutable.
 *
 * Drei Blöcke (Layout 1:1 wie OfferSendPreview):
 *   1. E-Mail an den Kunden (Header + iframe srcDoc)
 *   2. Öffentliche Angebots-Seite (iframe auf /offer/:id?archive_version=N)
 *   3. LexOffice-Angebots-PDF (falls pdf_url archiviert)
 *
 * Top-Banner statt Senden-Buttons. Einzige primäre Aktion:
 * „Als neues Angebot kopieren".
 *
 * Route: /admin/events/:id/archive/:version
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import {
  ArrowLeft,
  Mail,
  Globe,
  FileText,
  Loader2,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { AdminLayout } from "../AdminLayout";
import { useOfferHistoryVersion } from "@/hooks/useOfferHistory";
import { useCloneOfferVersion } from "@/hooks/useCloneOfferVersion";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";

export function OfferArchivePreview() {
  const { id, version } = useParams<{ id: string; version: string }>();
  const navigate = useNavigate();
  const versionNum = version ? parseInt(version, 10) : null;

  const { data: entry, isLoading } = useOfferHistoryVersion(id || "", versionNum);
  const cloneMutation = useCloneOfferVersion(id || "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [versionNum]);

  const handleClone = async () => {
    if (versionNum == null) return;
    await cloneMutation.mutateAsync(versionNum);
    setConfirmOpen(false);
    navigate(`/admin/events/${id}/edit`);
  };

  if (isLoading) {
    return (
      <AdminLayout activeTab="events" title="Archiv-Ansicht">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!entry || versionNum == null) {
    return (
      <AdminLayout activeTab="events" title="Archiv-Ansicht">
        <div className="max-w-3xl mx-auto p-6 text-center space-y-4">
          <p className="text-muted-foreground">
            Diese Angebots-Version wurde nicht gefunden.
          </p>
          <Button variant="outline" onClick={() => navigate(`/admin/events/${id}/edit`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zum Angebot
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const sentAtLabel = (() => {
    try {
      return format(parseISO(entry.sent_at), "dd.MM.yyyy 'um' HH:mm", { locale: de });
    } catch {
      return entry.sent_at;
    }
  })();

  const publicArchiveUrl = `/offer/${id}?archive_version=${versionNum}`;

  // Wähle die beste Quelle für die Mail-Anzeige:
  //   1) email_html (1:1 wie versendet — seit April 2026 archiviert)
  //   2) Fallback: email_content im Plain-Text-Layout (für Alt-Versionen)
  const sanitizedEmailHtml = entry.email_html
    ? DOMPurify.sanitize(entry.email_html, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style"] })
    : null;

  const fallbackPlainTextDoc = entry.email_content
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
             padding:24px;color:#1f2937;line-height:1.6;font-size:14px;
             white-space:pre-wrap;background:#fff;}
      </style></head><body>${entry.email_content
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</body></html>`
    : null;

  const iframeSrc = sanitizedEmailHtml ?? fallbackPlainTextDoc;

  return (
    <AdminLayout activeTab="events" title={`Archiv · v${versionNum}`}>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Top-Banner statt Senden-Buttons */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 md:p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/admin/events/${id}/edit`)}
                className="gap-2 -ml-2 -mt-1 shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück zum Angebot
              </Button>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200 border-amber-300 font-mono">
                    ARCHIV · v{versionNum}
                  </Badge>
                  <ShieldCheck className="h-4 w-4 text-amber-700" />
                  <span className="text-xs font-medium text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                    Schreibgeschützt
                  </span>
                </div>
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Gesendet am <strong>{sentAtLabel}</strong>
                  {entry.sent_by && (
                    <> von <strong>{getAdminDisplayName(entry.sent_by)}</strong></>
                  )}
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
                  Diese Ansicht zeigt das Angebot exakt so, wie es zur Sendezeit
                  an den Kunden ging. Es kann nicht bearbeitet werden.
                </p>
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setConfirmOpen(true)}
              disabled={cloneMutation.isPending}
            >
              <Copy className="h-4 w-4" />
              Als neues Angebot kopieren
            </Button>
          </div>
        </div>

        {/* Block 1: E-Mail an den Kunden */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">1. E-Mail an den Kunden</h2>
            {!entry.email_html && entry.email_content && (
              <Badge variant="outline" className="ml-auto text-[10px] font-normal">
                Plain-Text-Archiv (vor HTML-Archivierung)
              </Badge>
            )}
          </div>
          <div className="p-4 space-y-3">
            {iframeSrc ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Inhalt (1:1 wie der Kunde sie damals erhalten hat)
                </div>
                <iframe
                  srcDoc={iframeSrc}
                  title={`Email Archiv v${versionNum}`}
                  sandbox="allow-same-origin"
                  className="w-full h-[600px] border rounded-lg bg-white"
                />
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  Anhang zur damaligen Sendung: Angebots-PDF v{versionNum}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Für diese Version wurde kein Anschreiben-Text archiviert.
              </p>
            )}
          </div>
        </section>

        {/* Block 2: Öffentliche Angebots-Seite (Snapshot via ?archive_version) */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">2. Öffentliche Angebots-Seite</h2>
            </div>
            <a
              href={publicArchiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              In neuem Tab öffnen ↗
            </a>
          </div>
          <div className="bg-muted/20">
            <iframe
              src={publicArchiveUrl}
              title={`Public Offer Archiv v${versionNum}`}
              className="w-full h-[800px] border-0 bg-white"
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </div>
        </section>

        {/* Block 3: LexOffice-PDF (nur wenn archiviert) */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">3. LexOffice-Angebot (PDF)</h2>
          </div>
          <div className="bg-muted/20 min-h-[400px] flex items-center justify-center">
            {entry.pdf_url ? (
              <iframe
                src={entry.pdf_url}
                title={`PDF Archiv v${versionNum}`}
                className="w-full h-[800px] border-0 bg-white"
              />
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground max-w-md space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p>Für diese Version wurde kein PDF archiviert.</p>
                <p className="text-xs text-muted-foreground/70">
                  Die ursprüngliche LexOffice-Quotation kann weiterhin über den
                  „Angebot PDF"-Button im Editor abgerufen werden.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Skeleton-Loader fallback when nothing else fits */}
        {!entry.email_content && (entry.options_snapshot?.length ?? 0) === 0 && (
          <Skeleton className="h-32 w-full" />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Neues Angebot auf Basis von v{versionNum} erstellen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Optionen aus dieser Version werden als bearbeitbarer Entwurf für
              die nächste Version übernommen. Die archivierte v{versionNum} bleibt
              unverändert. Aktuelle, noch nicht versendete Optionen werden dabei
              deaktiviert.
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
    </AdminLayout>
  );
}