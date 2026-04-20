/**
 * OfferSendPreview — STRIKT READ-ONLY WYSIWYG.
 *
 * Was der Admin hier sieht ist 1:1 was der Kunde bekommt.
 * Es gibt KEINE Edit-Möglichkeiten auf dieser Seite.
 * Wenn was geändert werden muss → "Zurück & bearbeiten".
 *
 * Datenfluss:
 *   - Beim Mount: send-offer-email mit dryRun=true aufrufen
 *   - Edge Function rendert die Mail GENAU wie beim echten Versand
 *     und liefert { from, to, bcc, subject, htmlBody, attachment }
 *   - Wir zeigen diese Werte direkt an, htmlBody in einem iframe via srcDoc.
 *
 * Route: /admin/events/:id/preview?send=proposal|final
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Mail, FileText, Globe, Loader2, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminLayout } from "../AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SendType = 'proposal' | 'final';

interface PreviewInquiry {
  id: string;
  contact_name: string;
  email: string | null;
  company_name: string | null;
  email_draft: string | null;
  offer_phase: string;
  lexoffice_quotation_id: string | null;
  is_test: boolean | null;
}

interface DryRunPreview {
  from: string;
  to: string[];
  bcc: string[];
  subject: string;
  htmlBody: string;
  attachment: { filename: string; available: boolean };
}

interface OfferSendPreviewProps {
  /** When provided, uses this id instead of route params. Used by the create-wizard. */
  inquiryId?: string;
  /** When provided, replaces the default "Zurück & bearbeiten" navigation. */
  onBack?: () => void;
  /** When provided, called after the user clicks "Senden" instead of navigating to /edit. */
  onAfterSend?: (inquiryId: string, query: string) => void;
}

export function OfferSendPreview({
  inquiryId: embeddedInquiryId,
  onBack,
  onAfterSend,
}: OfferSendPreviewProps = {}) {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sendType = (searchParams.get('send') as SendType) || 'proposal';

  // Allow embedding via props (Wizard) — fall back to route params (standalone /admin/events/:id/preview)
  const id = embeddedInquiryId ?? params.id;
  const handleBack = onBack
    ? onBack
    : () => id && navigate(`/admin/events/${id}/edit`);
  const handleAfterSend = onAfterSend
    ? onAfterSend
    : (inquiryId: string, query: string) =>
        navigate(`/admin/events/${inquiryId}/edit?${query}`);

  const [inquiry, setInquiry] = useState<PreviewInquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DryRunPreview | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);

  // Inquiry laden
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('event_inquiries')
        .select('id, contact_name, email, company_name, email_draft, offer_phase, lexoffice_quotation_id, is_test')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        toast.error('Anfrage konnte nicht geladen werden');
        setLoading(false);
        return;
      }
      setInquiry(data as PreviewInquiry);
      setLoading(false);
    })();
  }, [id]);

  // Scroll-to-top damit der iframe nicht den Fokus klaut
  useEffect(() => {
    if (inquiry) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [inquiry?.id]);

  // Dry-Run der Edge Function — liefert das exakte Mail-Objekt
  useEffect(() => {
    if (!inquiry) return;
    let cancelled = false;
    (async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const { data, error } = await supabase.functions.invoke('send-offer-email', {
          body: {
            inquiryId: inquiry.id,
            emailContent: inquiry.email_draft || '',
            customerEmail: inquiry.email || '',
            customerName: inquiry.contact_name || 'Kunde',
            lexofficeQuotationId: inquiry.lexoffice_quotation_id,
            dryRun: true,
          },
        });
        if (cancelled) return;
        // Bei FunctionsHttpError liefert Supabase die JSON-Antwort der Funktion
        // im error.context.body bzw. error.context.json mit. Wir versuchen
        // das error-Feld der Edge-Function zu extrahieren bevor wir auf
        // den generischen "non-2xx"-Text fallback'en.
        if (error) {
          let detailed: string | null = null;
          try {
            const ctx = (error as { context?: Response }).context;
            if (ctx && typeof ctx.json === 'function') {
              const cloned = ctx.clone ? ctx.clone() : ctx;
              const body = await cloned.json().catch(() => null);
              if (body && typeof body.error === 'string') detailed = body.error;
            }
          } catch {
            // Body schon konsumiert oder nicht JSON — egal, wir nehmen error.message
          }
          throw new Error(detailed || error.message || 'Vorschau konnte nicht erzeugt werden');
        }
        if (!data?.success || !data?.preview) {
          throw new Error(data?.error || 'Vorschau konnte nicht erzeugt werden');
        }
        setPreview(data.preview as DryRunPreview);
        setPreviewWarnings(Array.isArray(data.warnings) ? data.warnings as string[] : []);
      } catch (err) {
        if (cancelled) return;
        console.error('[OfferSendPreview] dry-run failed:', err);
        setPreviewError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inquiry?.id, inquiry?.lexoffice_quotation_id]);

  // LexOffice-PDF laden (visueller Block 3)
  useEffect(() => {
    if (!inquiry?.lexoffice_quotation_id) return;
    let cancelled = false;
    (async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        const { data, error } = await supabase.functions.invoke('get-lexoffice-document', {
          body: { voucherId: inquiry.lexoffice_quotation_id, voucherType: 'quotation' },
        });
        if (cancelled) return;
        if (error || !data?.pdf) {
          throw new Error(data?.error || error?.message || 'PDF nicht verfügbar');
        }
        const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/pdf' });
        if (cancelled) return;
        setPdfBlobUrl(URL.createObjectURL(blob));
      } catch (err) {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [inquiry?.lexoffice_quotation_id]);

  // Senden = an Edit-Seite delegieren (oder onAfterSend-Callback im Embed)
  const handleSend = (isTest: boolean) => {
    if (!inquiry) return;
    if (isTest) setIsTestSending(true); else setIsSending(true);
    const query = new URLSearchParams({
      send: sendType,
      confirmed: isTest ? 'test' : '1',
    }).toString();
    setTimeout(() => {
      handleAfterSend(inquiry.id, query);
    }, 150);
  };

  // Im embedded-Modus (Wizard) liefert der Caller bereits den AdminLayout-Wrapper
  const embedded = !!embeddedInquiryId;
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    embedded ? (
      <>{children}</>
    ) : (
      <AdminLayout activeTab="events" title="Vorschau vor Versand">
        {children}
      </AdminLayout>
    );

  if (loading) {
    return (
      <Wrapper>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Wrapper>
    );
  }

  if (!inquiry) {
    return (
      <Wrapper>
        <div className="p-8 text-center text-muted-foreground">
          Anfrage nicht gefunden.
        </div>
      </Wrapper>
    );
  }

  const sendLabel = sendType === 'proposal' ? 'Vorschlag an Kunde senden' : 'Finales Angebot an Kunde senden';
  const publicOfferUrl = `/offer/${inquiry.id}`;
  // "Critical" warnings = solche die einen echten Versand blockieren wuerden
  // (leerer Anschreiben-Text, fehlende Empfaenger-Email). PDF-Warnung ist ok.
  const hasBlockingWarning = previewWarnings.some(
    (w) => w.toLowerCase().includes('anschreiben') || w.toLowerCase().includes('empfaenger') || w.toLowerCase().includes('empfänger')
  );
  const canSend = !!preview && !previewError && !hasBlockingWarning;

  return (
    <AdminLayout activeTab="events" title="Vorschau vor Versand">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/events/${inquiry.id}/edit`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück & bearbeiten
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Vorschau vor Versand</h1>
              <p className="text-sm text-muted-foreground">
                Das sieht der Kunde — exakt so. Zum Ändern: zurück zur Bearbeitung.
              </p>
            </div>
          </div>
          {inquiry.is_test && (
            <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300">
              Test-Anfrage
            </Badge>
          )}
        </div>

        {/* Block 1: E-Mail-Vorschau (read-only WYSIWYG via Edge-Function-Dry-Run) */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">1. E-Mail an den Kunden</h2>
          </div>

          {previewLoading && (
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-[600px] w-full mt-4" />
            </div>
          )}

          {previewError && !previewLoading && (
            <div className="p-6 space-y-3">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <div className="font-medium text-destructive mb-1">Vorschau fehlgeschlagen</div>
                <div className="text-destructive/80 text-xs">{previewError}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/events/${inquiry.id}/edit`)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück & bearbeiten
              </Button>
            </div>
          )}

          {preview && !previewLoading && (
            <div className="p-4 space-y-3">
              {previewWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm space-y-1">
                  <div className="font-medium text-amber-900">Hinweise vor dem Versand:</div>
                  <ul className="list-disc list-inside text-amber-800 text-xs space-y-0.5">
                    {previewWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                  {hasBlockingWarning && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/events/${inquiry.id}/edit`)}
                      className="gap-2 mt-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Zurück & bearbeiten
                    </Button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Von</span>
                <span className="font-mono">{preview.from}</span>

                <span className="text-muted-foreground">An</span>
                <span className="font-mono">{preview.to.join(', ')}</span>

                <span className="text-muted-foreground">Betreff</span>
                <span className="font-medium">{preview.subject}</span>
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Inhalt (1:1 wie der Kunde sie sieht)
                </div>
                <iframe
                  srcDoc={preview.htmlBody}
                  title="Email Preview"
                  sandbox="allow-same-origin"
                  className="w-full h-[600px] border rounded-lg bg-white"
                />
              </div>

              <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Anhang: {preview.attachment.filename}
                {!preview.attachment.available && (
                  <Badge variant="outline" className="ml-2 text-[10px] py-0 h-5">
                    PDF wird erst beim Senden generiert
                  </Badge>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Block 2: Public-Offer-Preview */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">2. Öffentliche Angebots-Seite</h2>
            </div>
            <a
              href={publicOfferUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              In neuem Tab öffnen ↗
            </a>
          </div>
          <div className="bg-muted/20">
            <iframe
              src={publicOfferUrl}
              title="Public Offer Preview"
              className="w-full h-[800px] border-0 bg-white"
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </div>
        </section>

        {/* Block 3: LexOffice-PDF */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">3. LexOffice-Angebot (PDF)</h2>
          </div>
          <div className="bg-muted/20 min-h-[400px] flex items-center justify-center">
            {!inquiry.lexoffice_quotation_id ? (
              <div className="p-8 text-center text-sm text-muted-foreground max-w-md">
                Kein LexOffice-Angebot verknüpft. Bitte zurück und Angebot erstellen.
              </div>
            ) : pdfLoading ? (
              <div className="p-8 flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                PDF wird geladen…
              </div>
            ) : pdfError ? (
              <div className="p-8 text-center text-sm max-w-md text-muted-foreground">
                PDF nicht verfügbar: {pdfError}
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title="LexOffice Quotation PDF"
                className="w-full h-[900px] border-0 bg-white"
              />
            ) : null}
          </div>
        </section>

        {/* Aktions-Buttons — sticky am unteren Rand */}
        <div className="sticky bottom-4 z-10">
          <div className="rounded-xl border bg-card/95 backdrop-blur shadow-lg p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(`/admin/events/${inquiry.id}/edit`)}
              disabled={isSending || isTestSending}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück & bearbeiten
            </Button>

            <div className="flex-1" />

            <div className="hidden sm:block w-px h-8 bg-border/60 mx-1" />

            <Button
              variant="outline"
              onClick={() => handleSend(true)}
              disabled={isSending || isTestSending || !canSend}
              className="gap-2"
              title="Sendet eine Kopie mit Betreff-Prefix 'VORSCHAU' an dich und an info@ristorantestoria.de"
            >
              {isTestSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4" />
              )}
              Vorschau-Mail an mich & Ristorante
            </Button>

            <Button
              onClick={() => handleSend(false)}
              disabled={isSending || isTestSending || !canSend}
              className={cn(
                "gap-2 font-semibold",
                sendType === 'final'
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              )}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendLabel}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
