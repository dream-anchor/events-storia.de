import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, FileText, Send } from "lucide-react";
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
  onSent?: () => void;
}

interface PreviewState {
  loading: boolean;
  html: string | null;
  subject: string | null;
  error: string | null;
}

export const SendInvoiceDialog = ({
  open, onOpenChange, inquiryId, defaultEmail, defaultLanguage, invoiceNumber, onSent,
}: Props) => {
  const [recipient, setRecipient] = useState(defaultEmail);
  const [language, setLanguage] = useState<CustomerLang>(defaultLanguage);
  const [extraNote, setExtraNote] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ loading: false, html: null, subject: null, error: null });
  const [sending, setSending] = useState(false);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setRecipient(defaultEmail);
      setLanguage(defaultLanguage);
      setExtraNote("");
    } else {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPreview({ loading: false, html: null, subject: null, error: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load PDF preview once when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPdfLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-lexoffice-document", {
          body: { orderId: inquiryId, voucherType: "invoice" },
        });
        if (cancelled) return;
        if (error) throw error;
        // get-lexoffice-document returns base64 OR direct binary; try to handle both
        if (data instanceof Blob) {
          setPdfUrl(URL.createObjectURL(data));
        } else if (data && typeof data === "object" && "pdf_base64" in (data as any)) {
          const bin = atob((data as any).pdf_base64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          setPdfUrl(URL.createObjectURL(new Blob([arr], { type: "application/pdf" })));
        }
      } catch (e) {
        console.warn("[SendInvoiceDialog] PDF preview unavailable:", e);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, inquiryId]);

  // Re-render email preview when language / note changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setPreview((p) => ({ ...p, loading: true, error: null }));
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
        setPreview({ loading: false, html: (data as any)?.html || null, subject: (data as any)?.subject || null, error: null });
      } catch (e: any) {
        if (cancelled) return;
        setPreview({ loading: false, html: null, subject: null, error: e?.message || "Vorschau fehlgeschlagen" });
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, language, extraNote, inquiryId]);

  const canSend = useMemo(() =>
    !sending && recipient.trim().length > 3 && recipient.includes("@") && !!preview.html,
  [sending, recipient, preview.html]);

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
                  {preview.loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {preview.error && (
                    <div className="p-6 text-sm text-destructive">{preview.error}</div>
                  )}
                  {preview.html && (
                    <iframe
                      srcDoc={preview.html}
                      title="E-Mail Vorschau"
                      className="w-full h-full border-0"
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pdf" className="flex-1 m-0 mt-3 mx-6 mb-6 min-h-0">
                <div className="h-full rounded-2xl border border-border/60 bg-muted/30 overflow-hidden relative">
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!pdfLoading && pdfUrl && (
                    <iframe src={pdfUrl} title="Rechnung PDF" className="w-full h-full border-0" />
                  )}
                  {!pdfLoading && !pdfUrl && (
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
          <Button onClick={handleSend} disabled={!canSend} className="gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sende…" : `Senden an ${recipient || "Kunden"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};