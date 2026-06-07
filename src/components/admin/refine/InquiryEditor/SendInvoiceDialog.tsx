import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, FileText, Send, FilePlus2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import type { CustomerLang } from "./CustomerLanguageSelector";

const LANGS: { value: CustomerLang; label: string; flag: string }[] = [
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "en", label: "Englisch", flag: "🇬🇧" },
  { value: "it", label: "Italienisch", flag: "🇮🇹" },
  { value: "fr", label: "Französisch", flag: "🇫🇷" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inquiryId: string;
  defaultEmail: string;
  defaultLanguage: CustomerLang;
  invoiceNumber?: string | null;
  hasInvoice?: boolean;
  onSent?: () => void;
}

interface PreviewState {
  loading: boolean;
  html: string | null;
  subject: string | null;
  error: string | null;
}

export const SendInvoiceDialog = ({
  open, onOpenChange, inquiryId, defaultEmail, defaultLanguage, invoiceNumber, hasInvoice: hasInvoiceProp, onSent,
}: Props) => {
  const [recipient, setRecipient] = useState(defaultEmail);
  const [language, setLanguage] = useState<CustomerLang>(defaultLanguage);
  const [extraNote, setExtraNote] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ loading: false, html: null, subject: null, error: null });
  const [sending, setSending] = useState(false);
  const [invoiceExists, setInvoiceExists] = useState<boolean>(!!hasInvoiceProp);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [balanceOnSite, setBalanceOnSite] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => { setInvoiceExists(!!hasInvoiceProp); }, [hasInvoiceProp]);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setRecipient(defaultEmail);
      setLanguage(defaultLanguage);
      setExtraNote("");
      setCreateError(null);
      setBalanceOnSite(false);
      // Re-check live ob aktive Rechnung verknüpft ist (nach evtl. Storno).
      // Wenn bereits eine Schlussrechnung existiert, erzeugen wir bei jedem
      // Öffnen automatisch eine NEUE mit den aktuellen Maestro-Werten
      // (Anzahlung %, Restzahlungs-Frist, Methode, Preise). Die alte Rechnung
      // bleibt in der Belege-Liste stehen und kann dort manuell storniert werden.
      (async () => {
        const { data } = await (supabase as any)
          .from('v2_events')
          .select('final_lexoffice_invoice_id, invoice_lexoffice_id, balance_method')
          .eq('id', inquiryId)
          .maybeSingle();
        const existingId: string | null =
          data?.final_lexoffice_invoice_id || data?.invoice_lexoffice_id || null;

        const onSite = ['on_site', 'onsite', 'cash', 'card_onsite']
          .includes(String(data?.balance_method || ''));
        setBalanceOnSite(onSite);

        // Bei „Restzahlung vor Ort" KEINE Schlussrechnung erzeugen oder regenerieren.
        if (onSite) {
          setActiveInvoiceId(existingId);
          setInvoiceExists(!!existingId);
          return;
        }

        if (!existingId) {
          setActiveInvoiceId(null);
          setInvoiceExists(false);
          return;
        }

        // Auto-Regenerate mit aktuellen Werten
        setRegenerating(true);
        try {
          const { data: regen, error } = await supabase.functions.invoke(
            "create-lexoffice-final-invoice",
            { body: { inquiryId, force: true } },
          );
          if (error) throw error;
          if ((regen as any)?.error) throw new Error((regen as any).error);
          // Neue ID aus DB nachladen
          const { data: ev } = await (supabase as any)
            .from('v2_events')
            .select('final_lexoffice_invoice_id, invoice_lexoffice_id')
            .eq('id', inquiryId)
            .maybeSingle();
          const newId: string | null =
            ev?.final_lexoffice_invoice_id || ev?.invoice_lexoffice_id || existingId;
          setActiveInvoiceId(newId);
          setInvoiceExists(true);
          // Belege-Liste invalidieren, damit alte Rechnung mit Storno-Symbol
          // weiterhin sichtbar bleibt und die neue erscheint
          queryClient.invalidateQueries({ queryKey: ['order-lex-docs', inquiryId] });
        } catch (e: any) {
          console.warn("[SendInvoiceDialog] Regenerate failed, fallback to existing:", e);
          toast.error(e?.message || "Neue Rechnung konnte nicht erzeugt werden — vorhandene wird angezeigt");
          setActiveInvoiceId(existingId);
          setInvoiceExists(true);
        } finally {
          setRegenerating(false);
        }
      })();
    } else {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfError(null);
      setPreview({ loading: false, html: null, subject: null, error: null });
      setActiveInvoiceId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inquiryId]);

  // Load PDF preview when invoice exists
  useEffect(() => {
    if (!open || !invoiceExists || !activeInvoiceId || regenerating) return;
    let cancelled = false;
    (async () => {
      setPdfLoading(true);
      setPdfError(null);
      try {
        // Direkt über aktive Rechnung-ID (kein Quotation-Fallback)
        const { data, error } = await supabase.functions.invoke("get-lexoffice-document-by-id", {
          body: { voucherId: activeInvoiceId, voucherType: "invoice" },
        });
        if (cancelled) return;
        if (error) throw error;
        // get-lexoffice-document returns base64 OR direct binary; try to handle both
        if (data instanceof Blob) {
          setPdfUrl(URL.createObjectURL(data));
        } else if (data && typeof data === "object") {
          const errMsg = (data as any).error;
          if (errMsg) throw new Error(String(errMsg));
          const b64 =
            (data as any).pdf ??
            (data as any).pdf_base64 ??
            null;
          if (typeof b64 === "string" && b64.length > 0) {
            const bin = atob(b64);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            setPdfUrl(URL.createObjectURL(new Blob([arr], { type: "application/pdf" })));
          } else {
            throw new Error("Kein PDF in der Antwort");
          }
        }
      } catch (e) {
        console.warn("[SendInvoiceDialog] PDF preview unavailable:", e);
        const msg = (e as any)?.message || String(e);
        const stale = /not available|does not exist|not found|404/i.test(msg);
        setPdfError(
          stale
            ? "Diese Rechnung existiert nicht mehr in LexOffice (möglicherweise storniert). Bitte neu erzeugen."
            : "Rechnungs-PDF konnte nicht geladen werden. Bitte neu erzeugen."
        );
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, inquiryId, invoiceExists, activeInvoiceId, regenerating]);

  const handleCreateInvoice = async (force = false) => {
    setCreatingInvoice(true);
    setCreateError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-lexoffice-final-invoice", {
        body: { inquiryId, force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(force ? "Endrechnung neu erzeugt" : "Endrechnung in LexOffice erzeugt");
      // Frisch aus DB nachladen (neue Invoice-ID)
      const { data: ev } = await (supabase as any)
        .from('v2_events')
        .select('final_lexoffice_invoice_id, invoice_lexoffice_id')
        .eq('id', inquiryId)
        .maybeSingle();
      const newId: string | null =
        ev?.final_lexoffice_invoice_id || ev?.invoice_lexoffice_id || null;
      setPdfError(null);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setActiveInvoiceId(newId);
      setInvoiceExists(!!newId);
    } catch (e: any) {
      const msg = e?.message || "Erzeugung fehlgeschlagen";
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setCreatingInvoice(false);
    }
  };

  // Re-render email preview when language / note changes
  useEffect(() => {
    if (!open || !activeInvoiceId || pdfError) return;
    let cancelled = false;
    setPreview({ loading: true, html: null, subject: null, error: null });
    const handle = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("send-invoice-email", {
          body: {
            inquiry_id: inquiryId,
            language,
            extra_note: extraNote || undefined,
            dry_run: true,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        const html = (data as any)?.html || null;
        const subj = (data as any)?.subject || null;
        const err = (data as any)?.error || null;
        setPreview({
          loading: false,
          html,
          subject: subj,
          error: !html ? (err || "Vorschau konnte nicht erzeugt werden") : null,
        });
      } catch (e: any) {
        if (cancelled) return;
        setPreview({ loading: false, html: null, subject: null, error: e?.message || "Vorschau fehlgeschlagen" });
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, language, extraNote, inquiryId, activeInvoiceId, pdfError]);

  const canSend = useMemo(() =>
    !sending && !regenerating && invoiceExists && !pdfError && recipient.trim().length > 3 && recipient.includes("@") && !!preview.html,
  [sending, regenerating, invoiceExists, pdfError, recipient, preview.html]);

  const handleSend = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const senderEmail = session?.user?.email;
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          inquiry_id: inquiryId,
          recipient_email: recipient.trim(),
          language,
          extra_note: extraNote || undefined,
          sender_email: senderEmail,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Rechnung an ${recipient.trim()} gesendet`);
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Versand fehlgeschlagen");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-3 shrink-0 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Rechnung an Kunden senden
            {invoiceNumber && <span className="text-sm font-normal text-muted-foreground ml-2">· {invoiceNumber}</span>}
          </DialogTitle>
          <DialogDescription>
            Vorschau prüfen, ggf. anpassen und versenden. Eine Kopie geht automatisch an info@events-storia.de (BCC).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-0 min-h-0 overflow-hidden">
          {/* Linke Spalte: Form */}
          <div className="p-6 space-y-4 overflow-y-auto border-r border-border/60 bg-muted/20">
            <div className="space-y-1.5">
              <Label htmlFor="invoice-recipient">Empfänger</Label>
              <Input
                id="invoice-recipient"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="kunde@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-lang">Sprache</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as CustomerLang)}>
                <SelectTrigger id="invoice-lang"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {language !== "de" && language !== "en" && (
                <p className="text-xs text-muted-foreground">Bilingual: {language.toUpperCase()} + EN</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invoice-note">Zusatztext (optional)</Label>
              <Textarea
                id="invoice-note"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="z.B. Hinweis zur Zahlungsfrist…"
                rows={5}
                className="resize-none"
              />
            </div>

            <div className="text-xs text-muted-foreground border-t border-border/60 pt-3 space-y-1">
              <div><strong>Betreff:</strong> {preview.subject || "—"}</div>
              <div><strong>Anhang:</strong> Rechnungs-PDF aus LexOffice</div>
              <div><strong>BCC:</strong> info@events-storia.de</div>
            </div>
          </div>

          {/* Rechte Spalte: Vorschau */}
          <div className="flex flex-col min-h-0 min-w-0">
            <Tabs defaultValue="email" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-6 mt-4 self-start">
                <TabsTrigger value="email" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> E-Mail</TabsTrigger>
                <TabsTrigger value="pdf" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Rechnung PDF</TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="flex-1 m-0 mt-3 mx-6 mb-6 min-h-0">
                <div className="h-full rounded-2xl border border-border/60 bg-white overflow-hidden relative">
                  {!invoiceExists ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                      <div className="h-12 w-12 rounded-2xl bg-muted border border-border/60 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">E-Mail-Vorschau verfügbar, sobald die Rechnung existiert</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Wechsle in den Tab „Rechnung PDF“ und erzeuge zuerst die Endrechnung.
                      </p>
                    </div>
                  ) : (
                  <>
                  {preview.loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {preview.error && !preview.html && (
                    <div className="p-6 text-sm text-destructive">{preview.error}</div>
                  )}
                  {preview.html && (
                    <iframe
                      srcDoc={preview.html}
                      title="E-Mail Vorschau"
                      className="w-full h-full border-0"
                    />
                  )}
                  {!preview.loading && !preview.error && !preview.html && (
                    <div className="p-6 text-sm text-muted-foreground">Vorschau wird vorbereitet…</div>
                  )}
                  </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="flex-1 m-0 mt-3 mx-6 mb-6 min-h-0">
                <div className="h-full rounded-2xl border border-border/60 bg-muted/30 overflow-hidden relative">
                  {regenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm z-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Rechnung wird mit aktuellen Werten neu erzeugt…</p>
                    </div>
                  ) : !invoiceExists ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                      <div className="h-12 w-12 rounded-2xl bg-background border border-border/60 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="space-y-1 max-w-sm">
                        <p className="text-sm font-medium">Noch keine Rechnung in LexOffice vorhanden</p>
                        <p className="text-xs text-muted-foreground">
                          Erzeuge jetzt die Endrechnung — danach kannst du die Vorschau prüfen und an den Kunden senden.
                        </p>
                      </div>
                      <Button
                        onClick={() => handleCreateInvoice(false)}
                        disabled={creatingInvoice}
                        className="gap-2"
                      >
                        {creatingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                        {creatingInvoice ? "Erzeuge…" : "Endrechnung jetzt erzeugen"}
                      </Button>
                      {createError && (
                        <p className="text-xs text-destructive max-w-sm">{createError}</p>
                      )}
                    </div>
                  ) : pdfLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : pdfUrl ? (
                    <iframe src={pdfUrl} title="Rechnung PDF" className="w-full h-full border-0" />
                  ) : pdfError ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                      <div className="h-12 w-12 rounded-2xl bg-background border border-border/60 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="space-y-1 max-w-md">
                        <p className="text-sm font-medium">PDF nicht verfügbar</p>
                        <p className="text-xs text-muted-foreground">{pdfError}</p>
                      </div>
                      <Button
                        onClick={() => handleCreateInvoice(true)}
                        disabled={creatingInvoice}
                        className="gap-2"
                      >
                        {creatingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                        {creatingInvoice ? "Erzeuge…" : "Endrechnung neu erzeugen"}
                      </Button>
                      {createError && (
                        <p className="text-xs text-destructive max-w-sm">{createError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">
                      Rechnungs-PDF konnte nicht geladen werden. Versand ist trotzdem möglich — das PDF wird beim Senden direkt von LexOffice abgerufen.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border/60 shrink-0 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="gap-2"
            title={!invoiceExists ? "Bitte zuerst Endrechnung erzeugen" : undefined}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sende…" : `Senden an ${recipient || "Kunden"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};