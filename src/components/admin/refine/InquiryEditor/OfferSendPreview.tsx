/**
 * OfferSendPreview
 *
 * Verpflichtende Vorschau bevor ein Angebot an den Kunden versendet wird.
 * Route: /admin/events/:id/preview?send=proposal|final
 *
 * Zeigt drei Bloecke:
 *   1. E-Mail — so wie sie beim Kunden ankommt (Absender, Empfaenger inkl. BCC,
 *      Betreff, HTML-Body)
 *   2. Public-Offer — eingebetteter iframe auf /offer/:id (was der Kunde auf
 *      der Webseite sieht wenn er den Link klickt)
 *   3. LexOffice-PDF — das angehaengte Angebot als eingebettetes PDF
 *
 * Aktionen:
 *   - "Jetzt endgueltig senden" → triggert send-offer-email
 *   - "Testmail an mich senden" → sendet identische Mail an antoine@monot.com
 *   - "Zurueck & bearbeiten" → navigate(-1)
 *
 * Datenfluss: alles kommt frisch aus der DB (event_inquiries + aktive options).
 * Deshalb ist auto-save vor Navigation Voraussetzung (ist bereits so).
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Mail, FileText, Globe, Loader2, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const SENDER_EMAIL = 'antoine@monot.com';
const SENDER_NAME = 'Antoine Monot';
const BCC_EMAIL = 'antoine@monot.com';

export function OfferSendPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sendType = (searchParams.get('send') as SendType) || 'proposal';

  const [inquiry, setInquiry] = useState<PreviewInquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<number>(1);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);

  // Inquiry laden + Version
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

      // Aktuelle Version aus history
      const { data: history } = await supabase
        .from('inquiry_offer_history')
        .select('version')
        .eq('inquiry_id', id)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (history) setCurrentVersion((history as { version: number }).version);
      setLoading(false);
    })();
  }, [id]);

  // LexOffice-PDF laden
  useEffect(() => {
    if (!inquiry?.lexoffice_quotation_id) return;
    setPdfLoading(true);
    setPdfError(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('download-lexoffice-document', {
          body: { voucherId: inquiry.lexoffice_quotation_id, voucherType: 'quotation' },
        });
        if (error || !data?.pdf) {
          setPdfError(data?.error || 'PDF nicht verfügbar');
          return;
        }
        const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/pdf' });
        setPdfBlobUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('[OfferSendPreview] PDF fetch failed:', err);
        setPdfError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        setPdfLoading(false);
      }
    })();

    // Cleanup Blob-URL beim Unmount
    return () => {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry?.lexoffice_quotation_id]);

  // Handler: Senden
  // Strategie: Die Preview macht keinen direkten Edge-Function-Call. Stattdessen
  // navigieren wir zurueck zur Edit-Seite mit einem URL-Query-Flag, das die
  // bestehende Send-Logik (useOfferBuilder.sendProposal / sendFinalOffer) direkt
  // triggert. Damit bleibt der bewaehrte Code-Pfad unveraendert — inkl.
  // createNewVersion, Phase-Update, LexOffice-Sync etc.
  const handleSend = (isTest: boolean) => {
    if (!inquiry) return;
    if (isTest) setIsTestSending(true); else setIsSending(true);
    const query = new URLSearchParams({
      send: sendType,
      confirmed: isTest ? 'test' : '1',
    }).toString();
    // Kurz visualisieren dass geladen wird, dann navigieren
    setTimeout(() => {
      navigate(`/admin/events/${inquiry.id}/edit?${query}`);
    }, 150);
  };

  if (loading) {
    return (
      <AdminLayout activeTab="events" title="Vorschau">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!inquiry) {
    return (
      <AdminLayout activeTab="events" title="Vorschau">
        <div className="p-8 text-center text-muted-foreground">
          Anfrage nicht gefunden.
        </div>
      </AdminLayout>
    );
  }

  const recipientName = inquiry.contact_name || inquiry.company_name || 'Unbekannt';
  const recipientEmail = inquiry.email || '(keine E-Mail hinterlegt)';
  const emailBody = inquiry.email_draft || '';
  const nextVersion = sendType === 'proposal' ? currentVersion + 1 : currentVersion + 1;
  const subject =
    sendType === 'proposal'
      ? `Ihr Angebot von STORIA Catering & Events${currentVersion > 0 ? ` (Version ${nextVersion})` : ''}`
      : `Ihr finales Angebot von STORIA Catering & Events`;
  const publicOfferUrl = `/offer/${inquiry.id}`;

  const sendLabel = sendType === 'proposal'
    ? (currentVersion > 0 ? `Version ${nextVersion} senden` : 'Vorschlag senden')
    : 'Finales Angebot senden';

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
                Das sieht der Kunde. Pruefen, dann senden.
              </p>
            </div>
          </div>
          {inquiry.is_test && (
            <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-300">
              Test-Anfrage
            </Badge>
          )}
        </div>

        {/* Block 1: E-Mail-Vorschau */}
        <section className="rounded-xl border bg-card overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold">1. E-Mail an den Kunden</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-[100px_1fr] gap-x-4 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Von</span>
              <span className="font-mono">{SENDER_NAME} &lt;{SENDER_EMAIL}&gt;</span>

              <span className="text-muted-foreground">An</span>
              <span className="font-mono">
                {recipientName} &lt;{recipientEmail}&gt;
              </span>

              <span className="text-muted-foreground">BCC</span>
              <span className="font-mono text-muted-foreground/80">&lt;{BCC_EMAIL}&gt;</span>

              <span className="text-muted-foreground">Betreff</span>
              <span className="font-medium">{subject}</span>
            </div>

            <div className="mt-4 border-t pt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Inhalt
              </div>
              {emailBody ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap font-serif text-foreground/90 bg-background rounded-lg p-4 border border-border/40">
                  {emailBody}
                </div>
              ) : (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-900">
                  ⚠ Kein Anschreiben vorhanden. Bitte zurück & im Editor einen Text schreiben, sonst geht die Mail ohne Text raus.
                </div>
              )}
            </div>

            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              <FileText className="h-3 w-3" />
              Anhang: STORIA_Angebot.pdf (LexOffice)
            </div>
          </div>
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
              <div className="p-8 text-center text-sm text-muted-foreground">
                Kein LexOffice-Angebot verknüpft. Bitte zurück und Angebot erstellen.
              </div>
            ) : pdfLoading ? (
              <div className="p-8 flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                PDF wird geladen …
              </div>
            ) : pdfError ? (
              <div className="p-8 text-center text-sm text-red-900">
                PDF konnte nicht geladen werden: {pdfError}
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

            <Button
              variant="outline"
              onClick={() => handleSend(true)}
              disabled={isSending || isTestSending || !emailBody}
              className="gap-2"
            >
              {isTestSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="h-4 w-4" />
              )}
              Testmail an mich
            </Button>

            <Button
              onClick={() => handleSend(false)}
              disabled={isSending || isTestSending || !emailBody}
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
              Jetzt endgültig senden: {sendLabel}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
