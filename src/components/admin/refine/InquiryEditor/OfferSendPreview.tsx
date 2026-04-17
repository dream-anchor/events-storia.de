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
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send, Mail, FileText, Globe, Loader2, TestTube2, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  const [activeTotalAmount, setActiveTotalAmount] = useState<number | null>(null);
  const [publicOfferReloadKey, setPublicOfferReloadKey] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfAttempt, setPdfAttempt] = useState(0);
  const [pdfRetryTrigger, setPdfRetryTrigger] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);

  // Editierbarer Email-Body in der Preview.
  // Initial aus inquiry.email_draft uebernehmen (einmalig via Ref-Guard),
  // danach kann der User den Text hier direkt bearbeiten und speichern.
  const [editedBody, setEditedBody] = useState<string>('');
  const [savedBody, setSavedBody] = useState<string>(''); // letzter gespeicherter Stand
  const [isSavingBody, setIsSavingBody] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const bodyInitSyncedRef = useRef(false);

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

      // Aktive Options laden, um den aktuellen Gesamtpreis zu bestimmen.
      // Achtung: event_inquiries hat selbst KEIN total_amount — der Preis lebt
      // auf inquiry_offer_options.total_amount pro Option. Bei mehreren aktiven
      // Options summieren wir sie (was typisch 1 Option pro Inquiry ist).
      const { data: activeOpts } = await supabase
        .from('inquiry_offer_options')
        .select('total_amount')
        .eq('inquiry_id', id)
        .eq('is_active', true);
      if (activeOpts && activeOpts.length > 0) {
        const sum = activeOpts.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
        setActiveTotalAmount(sum > 0 ? sum : null);
      }
      setLoading(false);
    })();
  }, [id]);

  // Scroll zum Seitenanfang wenn die Inquiry geladen ist (verhindert dass der
  // iframe den Fokus greift und die Seite mitten im Content startet).
  useEffect(() => {
    if (inquiry) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [inquiry?.id]);

  // Body-State mit DB synchronisieren (einmalig beim ersten nicht-leeren Wert).
  useEffect(() => {
    if (bodyInitSyncedRef.current) return;
    const incoming = inquiry?.email_draft;
    if (typeof incoming === 'string' && incoming.length > 0) {
      setEditedBody(incoming);
      setSavedBody(incoming);
      bodyInitSyncedRef.current = true;
    }
  }, [inquiry?.email_draft]);

  // LexOffice-PDF laden — mit Retry-Loop, da LexOffice das PDF manchmal
  // erst einige Sekunden nach Finalisierung generiert. Bei jedem Fehlschlag
  // warten wir 2s, 4s, 6s und versuchen es erneut (max 4 Versuche).
  // pdfRetryTrigger-Bumping ermoeglicht auch manuellen "Erneut versuchen"-Click.
  useEffect(() => {
    if (!inquiry?.lexoffice_quotation_id) return;
    let cancelled = false;

    const fetchWithRetry = async () => {
      const delays = [0, 2000, 4000, 6000]; // ms zwischen Versuchen
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (cancelled) return;
        if (delays[attempt] > 0) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
          if (cancelled) return;
        }
        setPdfLoading(true);
        setPdfError(null);
        setPdfAttempt(attempt + 1);
        try {
          const { data, error } = await supabase.functions.invoke('get-lexoffice-document', {
            body: { voucherId: inquiry.lexoffice_quotation_id, voucherType: 'quotation' },
          });
          if (cancelled) return;
          if (error || !data?.pdf) {
            const msg = data?.error || error?.message || 'PDF nicht verfügbar';
            if (attempt < delays.length - 1) {
              // noch Versuche uebrig — still weiter retry
              continue;
            }
            setPdfError(msg);
            setPdfLoading(false);
            return;
          }
          const bytes = Uint8Array.from(atob(data.pdf), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/pdf' });
          if (cancelled) return;
          setPdfBlobUrl(URL.createObjectURL(blob));
          setPdfLoading(false);
          return;
        } catch (err) {
          if (cancelled) return;
          console.warn(`[OfferSendPreview] PDF fetch attempt ${attempt + 1} failed:`, err);
          if (attempt < delays.length - 1) continue;
          setPdfError(err instanceof Error ? err.message : 'Unbekannter Fehler');
          setPdfLoading(false);
        }
      }
    };

    fetchWithRetry();

    // Cleanup Blob-URL beim Unmount
    return () => {
      cancelled = true;
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry?.lexoffice_quotation_id, pdfRetryTrigger]);

  // Handler: Senden
  // Strategie: Die Preview macht keinen direkten Edge-Function-Call. Stattdessen
  // navigieren wir zurueck zur Edit-Seite mit einem URL-Query-Flag, das die
  // bestehende Send-Logik (useOfferBuilder.sendProposal / sendFinalOffer) direkt
  // triggert. Damit bleibt der bewaehrte Code-Pfad unveraendert — inkl.
  // createNewVersion, Phase-Update, LexOffice-Sync etc.
  const handleSend = async (isTest: boolean) => {
    if (!inquiry) return;

    // Vor Versand: unsaved changes automatisch speichern.
    // (Damit die Mail den Text sendet, den der User gerade gesehen hat.)
    if (isBodyDirty) {
      setIsSavingBody(true);
      try {
        const { error } = await supabase
          .from('event_inquiries')
          .update({ email_draft: editedBody })
          .eq('id', inquiry.id);
        if (error) throw error;
        setSavedBody(editedBody);
      } catch (err) {
        console.error('[OfferSendPreview] auto-save before send failed:', err);
        toast.error('Konnte Änderungen vor Versand nicht speichern. Abbruch.');
        setIsSavingBody(false);
        return;
      }
      setIsSavingBody(false);
    }

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
  const emailBody = editedBody;
  const isBodyDirty = editedBody !== savedBody;

  // Speichert den aktuellen editierten Body zurueck in event_inquiries.email_draft.
  // Kein Debounce: der User drueckt explizit Save, das ist sein commit-point.
  async function handleSaveBody() {
    if (!inquiry) return;
    if (!isBodyDirty) return;
    setIsSavingBody(true);
    try {
      const { error } = await supabase
        .from('event_inquiries')
        .update({ email_draft: editedBody })
        .eq('id', inquiry.id);
      if (error) throw error;
      setSavedBody(editedBody);
      toast.success('Änderungen gespeichert');
    } catch (err) {
      console.error('[OfferSendPreview] save body failed:', err);
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setIsSavingBody(false);
    }
  }

  // KI-Regeneration: erzeugt einen neuen Email-Draft-Text basierend auf dem
  // aktuellen Angebot (inquiry + aktive options) und schreibt ihn in
  // event_inquiries.email_draft.
  // B2-Strategie: Public-Offer-Seite bleibt auf der letzten versendeten Version,
  // email_content in inquiry_offer_history wird NICHT beruehrt.
  async function handleRegenerate() {
    if (!inquiry) return;
    if (isBodyDirty) {
      const ok = window.confirm(
        'Du hast nicht gespeicherte Änderungen im Text. Neu generieren wirft sie weg. Fortfahren?'
      );
      if (!ok) return;
    }
    setIsRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-inquiry-email', {
        body: {
          inquiryId: inquiry.id,
          phase: sendType === 'final' ? 'final' : 'proposal',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'KI-Generierung fehlgeschlagen');
      const newBody = data.emailDraft || data.email || '';
      if (!newBody) throw new Error('KI lieferte leeren Text');

      // Direkt in DB schreiben + lokalen State synchron halten
      const { error: updateError } = await supabase
        .from('event_inquiries')
        .update({ email_draft: newBody })
        .eq('id', inquiry.id);
      if (updateError) throw updateError;

      setEditedBody(newBody);
      setSavedBody(newBody);
      toast.success('E-Mail-Text neu generiert');
    } catch (err) {
      console.error('[OfferSendPreview] regenerate failed:', err);
      toast.error(err instanceof Error ? err.message : 'Neu-Generierung fehlgeschlagen');
    } finally {
      setIsRegenerating(false);
    }
  }

  // Price-Mismatch-Detection: prueft ob der E-Mail-Text Euro-Betraege enthaelt
  // die nicht mehr zum aktuellen total_amount passen.
  // Konservativ: matcht Betraege zwischen 100 und 99999, mit deutschem
  // Tausendertrennzeichen-Format (z.B. "1.204,25").
  const priceMismatch = (() => {
    if (!activeTotalAmount) return null;
    const text = editedBody || '';
    const current = Number(activeTotalAmount);
    if (!(current > 0)) return null;

    const matches: number[] = [];
    // Deutsch: 1.234,56 €  oder  1234,56 €  oder  123 €
    const re = /(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?\s*€/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const intPart = m[1].replace(/\./g, '');
      const frac = m[2] || '00';
      const n = Number(intPart) + Number(frac) / 100;
      if (n >= 100 && n <= 99999) matches.push(n);
    }
    if (matches.length === 0) return null;

    // Bei per_event: Text muss total_amount enthalten.
    // Bei per_person: Text kann total_amount ODER total_amount/guestCount enthalten
    //                 (wir pruefen nur ob einer der Betraege *in der Naehe* ist).
    const tolerance = 0.5; // halber Euro, fuer Rundungsspielraum
    const hasClose = matches.some((n) => Math.abs(n - current) < tolerance);
    if (hasClose) return null;

    // Kein passender Betrag gefunden — Mismatch.
    const firstFound = matches[0];
    return {
      foundAmount: firstFound,
      currentAmount: current,
    };
  })();
  const nextVersion = sendType === 'proposal' ? currentVersion + 1 : currentVersion + 1;
  const subject =
    sendType === 'proposal'
      ? `Ihr Angebot von STORIA Catering & Events${currentVersion > 0 ? ` (Version ${nextVersion})` : ''}`
      : `Ihr finales Angebot von STORIA Catering & Events`;
  // Preview-URL fuer den Public-Offer-iframe: reicht den aktuellen editedBody
  // als Query-Param mit, damit der iframe den AKTUELL editierten Text zeigt
  // (nicht den zuletzt versendeten email_content). Echte Kunden haben diesen
  // Param in ihrer URL nicht — siehe PublicOffer.tsx.
  // Encoding-Limit: URLs sind praktisch ca. 8KB, unser Text ist typisch 500-1500
  // Zeichen. Safety-Cap bei 6000 encoded-Zeichen, sonst fallback ohne Param.
  const publicOfferUrl = (() => {
    const base = `/offer/${inquiry.id}`;
    const body = editedBody?.trim();
    if (!body) return base;
    const encoded = encodeURIComponent(body);
    if (encoded.length > 6000) return base; // Text zu lang fuer URL
    return `${base}?preview_body=${encoded}`;
  })();

  const sendLabel = sendType === 'proposal'
    ? (currentVersion > 0 ? `Version ${nextVersion} an Kunde senden` : 'Vorschlag an Kunde senden')
    : 'Finales Angebot an Kunde senden';

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
              {priceMismatch && (
                <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-amber-900">E-Mail-Text ist vermutlich veraltet</div>
                    <div className="text-amber-800/90 text-xs mt-0.5">
                      Der Text erwähnt {priceMismatch.foundAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  € — das aktuelle Angebot hat {priceMismatch.currentAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  €.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="gap-2 h-8 text-xs bg-amber-700 hover:bg-amber-800 text-white shrink-0"
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Text neu generieren
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inhalt
                </div>
                <div className="flex items-center gap-2">
                  {!priceMismatch && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="gap-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                      title="Text neu aus dem aktuellen Angebot erzeugen (KI)"
                    >
                      {isRegenerating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Neu generieren
                    </Button>
                  )}
                  {isBodyDirty ? (
                    <span className="text-xs text-amber-700 font-medium">Nicht gespeicherte Änderungen</span>
                  ) : savedBody.length > 0 ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Gespeichert
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    variant={isBodyDirty ? 'default' : 'outline'}
                    onClick={handleSaveBody}
                    disabled={!isBodyDirty || isSavingBody}
                    className="gap-2 h-7 text-xs"
                  >
                    {isSavingBody ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    {isBodyDirty ? 'Änderungen speichern' : 'Gespeichert'}
                  </Button>
                </div>
              </div>
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                placeholder="Anschreiben fuer den Kunden …"
                className="min-h-[260px] font-serif text-sm bg-background resize-y"
              />
              {!emailBody && (
                <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900">
                  ⚠ Kein Anschreiben vorhanden. Bitte vor dem Versand einen Text eintragen.
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
              key={publicOfferUrl}
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
              <div className="p-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <div className="text-center">
                  <div>PDF wird geladen …</div>
                  {pdfAttempt > 1 && (
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Versuch {pdfAttempt} von 4 — LexOffice braucht manchmal ein paar Sekunden
                    </div>
                  )}
                </div>
              </div>
            ) : pdfError ? (
              <div className="p-8 text-center text-sm max-w-md">
                <div className="text-amber-900 mb-2 font-medium">
                  Das LexOffice-PDF ist noch nicht verfügbar.
                </div>
                <div className="text-muted-foreground text-xs mb-4">
                  LexOffice generiert das PDF beim ersten Zugriff. Das dauert
                  normalerweise ein paar Sekunden. Technisches Detail: {pdfError}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfRetryTrigger((n) => n + 1)}
                  className="gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Erneut versuchen
                </Button>
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

            {/* Visueller Trenner zwischen "Abbrechen-Zone" und "Sende-Zone" — CX-Schutz vor Tippfehlern */}
            <div className="hidden sm:block w-px h-8 bg-border/60 mx-1" />

            <Button
              variant="outline"
              onClick={() => handleSend(true)}
              disabled={isSending || isTestSending || !emailBody}
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
              {sendLabel}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
