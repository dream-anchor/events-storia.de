import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Loader2, FileText, Check, ListTodo, ExternalLink, ChevronDown, Mail, Plus, Users, Calendar, Euro, Building2, Eye, CreditCard, TestTube2 } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { useEditorShortcuts } from "../CommandPalette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventDNACard } from "./EventDNACard";
import { LocationBlock } from "./LocationBlock";
import { OfferBuilder } from "./OfferBuilder";
import type { OfferBuilderHandle } from "./OfferBuilder";
import { CateringModules } from "./CateringModules";
import { ClientPreview } from "./ClientPreview";
import { StaffNote } from "./StaffNote";
import { TaskManager } from "@/components/admin/shared/TaskManager";
import { Timeline } from "@/components/admin/shared/Timeline";
import { ConversationThread } from "@/components/admin/shared/ConversationThread";
import { PaymentCard } from "./PaymentCard";
import { PaymentStatusStrip } from "./PaymentStatusStrip";
import { useDownloadLexOfficeDocument } from "@/hooks/useLexOfficeVouchers";
import { InquiryPriority } from "@/types/refine";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRegisterSaveStatus } from "@/components/admin/shared/SaveStatusContext";
import { fetchLatestInquiryDocument } from "@/lib/lexofficeDocument";

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);
  // Dedizierter Ref fuer den Init-Effect (nicht verwechseln mit isInitializedRef,
  // der den Auto-Save-Gate kontrolliert). Dieser Ref verhindert dass der
  // lokale State nach jedem DB-Refetch neu aus inquiry ueberschrieben wird
  // — was zu Save-Endlosschleifen und blinkendem SaveStatusBadge fuehrte.
  const isInitializedFromDb = useRef(false);
  const latestValuesRef = useRef<Record<string, unknown>>({});
  const consecutiveSaveErrorsRef = useRef(0);
  const errorToastShownRef = useRef(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();

  // Zentralen SaveStatus-Context mit lokalem saveStatus synchronisieren
  useRegisterSaveStatus('smart-inquiry-editor', saveStatus);
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadDocument = useDownloadLexOfficeDocument();

  // Local state for editable fields
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [localInquiry, setLocalInquiry] = useState<Partial<ExtendedInquiry>>({});
  const [activeTab, setActiveTab] = useState('angebot');
  const [customerResponse, setCustomerResponse] = useState<{
    responded_at: string;
    selected_option_id: string | null;
    customer_notes: string | null;
  } | null>(null);
  const [menuSelection, setMenuSelection] = useState<MenuSelection>({ courses: [], drinks: [] });
  const offerBuilderRef = useRef<OfferBuilderHandle>(null);
  const [selectedOptionInfo, setSelectedOptionInfo] = useState<{ optionLabel: string; packageName: string } | null>(null);
  const [offerTotal, setOfferTotal] = useState<number | null>(null);

  const buildPersistableInquiryValues = useCallback((source: Record<string, unknown>) => {
    const {
      lexoffice_quotation_id: _lexofficeQuotationId,
      lexoffice_invoice_id: _lexofficeInvoiceId,
      lexoffice_document_type: _lexofficeDocumentType,
      lexoffice_contact_id: _lexofficeContactId,
      ...persistableValues
    } = source;
    return persistableValues;
  }, []);

  // Fetch inquiry data
  const inquiryQuery = useOne<ExtendedInquiry>({
    resource: "events",
    id: id!,
  });

  const inquiry = inquiryQuery.result;
  const isLoading = inquiryQuery.query.isLoading;

  // Fetch packages
  const packagesQuery = useList<Package>({
    resource: "packages" as never,
    pagination: { pageSize: 100 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  const packages = packagesQuery.result?.data || [];

  // Fetch email templates
  const templatesQuery = useList<EmailTemplate>({
    resource: "email_templates" as never,
    pagination: { pageSize: 50 },
    filters: [{ field: "is_active", operator: "eq", value: true }],
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  const templates = templatesQuery.result?.data || [];

  // Update mutation
  const { mutate: updateInquiry } = useUpdate();

  // Reset-Effect: Wenn die URL-ID wechselt (Navigation zu anderer Anfrage),
  // muessen wir erlauben dass der lokale State aus der neuen Inquiry
  // initialisiert wird. Muss VOR dem Init-Effect stehen.
  useEffect(() => {
    isInitializedFromDb.current = false;
  }, [id]);

  // Initialize local state from inquiry
  // WICHTIG: nur einmal pro geladener Inquiry-ID ausfuehren. Ohne diesen
  // Guard wird der lokale State bei jedem Refine-Refetch (nach jedem Save)
  // ueberschrieben, was eine Auto-Save-Endlosschleife ausloest.
  useEffect(() => {
    if (inquiry && !isInitializedFromDb.current) {
      setLocalInquiry(buildPersistableInquiryValues(inquiry as unknown as Record<string, unknown>) as Partial<ExtendedInquiry>);
      setQuoteNotes(inquiry.quote_notes || "");
      setEmailDraft(inquiry.email_draft || "");

      try {
        if (inquiry.selected_packages && Array.isArray(inquiry.selected_packages)) {
          setSelectedPackages(inquiry.selected_packages);
        }
        if (inquiry.quote_items && Array.isArray(inquiry.quote_items)) {
          setQuoteItems(inquiry.quote_items);
        }
        const storedMenuSelection = (inquiry as any).menu_selection;
        if (storedMenuSelection && typeof storedMenuSelection === 'object') {
          setMenuSelection({
            courses: storedMenuSelection.courses || [],
            drinks: storedMenuSelection.drinks || [],
          });
        }
      } catch {
        // JSON-Felder konnten nicht geparsed werden — ignorieren
      }

      // Markiere als initialisiert, damit kuenftige Refetches den State
      // unveraendert lassen. Das verhindert die Auto-Save-Endlosschleife.
      isInitializedFromDb.current = true;
    }
  }, [inquiry, buildPersistableInquiryValues]);

  // Merge local changes with inquiry
  const mergedInquiry = useMemo(() => ({
    ...inquiry,
    ...localInquiry,
    selected_packages: selectedPackages,
    quote_items: quoteItems,
    quote_notes: quoteNotes,
    email_draft: emailDraft,
    menu_selection: menuSelection,
  } as ExtendedInquiry), [inquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection]);

  // Guest count as number
  const guestCount = parseInt(mergedInquiry?.guest_count || '1') || 1;

  // Determine inquiry type
  const inquiryType = mergedInquiry?.inquiry_type || 'event';

  // Get status info
  const getStatusInfo = () => {
    if (inquiry?.status === 'confirmed') return { label: 'Bestätigt', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    if (inquiry?.status === 'offer_sent') return { label: 'Angebot gesendet', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
    if (inquiry?.status === 'declined') return { label: 'Abgelehnt', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    if (inquiry?.last_edited_at) return { label: 'In Bearbeitung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    return { label: 'Neu', color: 'bg-primary/10 text-primary' };
  };
  const statusInfo = getStatusInfo();

  // Handlers
  const handleLocalFieldChange = useCallback((field: keyof ExtendedInquiry, value: unknown) => {
    setLocalInquiry(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleItemAdd = useCallback((item: { id: string; name: string; description: string | null; price: number | null }) => {
    setQuoteItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price || 0,
        quantity: 1,
      }];
    });
  }, []);

  const handleItemQuantityChange = useCallback((itemId: string, quantity: number) => {
    setQuoteItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
  }, []);

  const handleItemRemove = useCallback((itemId: string) => {
    setQuoteItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  // Get current user email for assignee feature
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || undefined);
    });
    if (id) {
      supabase.from('offer_customer_responses' as never)
        .select('responded_at, selected_option_id, customer_notes')
        .eq('inquiry_id', id)
        .order('responded_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCustomerResponse(data as typeof customerResponse);
            const response = data as { selected_option_id: string | null };
            if (response.selected_option_id) {
              supabase.from('offer_builder_options' as never)
                .select('option_label, package_name')
                .eq('id', response.selected_option_id)
                .maybeSingle()
                .then(({ data: optData }) => {
                  if (optData) {
                    const opt = optData as { option_label: string; package_name: string };
                    setSelectedOptionInfo({ optionLabel: opt.option_label, packageName: opt.package_name });
                  }
                });
            }
          }
        });

      // Angebotssumme aus aktiver Option laden (für Betrag-Schnellwahl)
      supabase.from('inquiry_offer_options')
        .select('total_amount')
        .eq('inquiry_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.total_amount) setOfferTotal(data.total_amount);
        });
    }
  }, []);

  // LexOffice document handling
  const lexofficeDocId = (inquiry as any)?.lexoffice_invoice_id || inquiry?.lexoffice_quotation_id;
  const lexofficeDocType = (inquiry as any)?.lexoffice_document_type ||
    (inquiry?.lexoffice_quotation_id ? 'quotation' : null);

  const handleDownloadDocument = async () => {
    setIsDownloading(true);
    try {
      const latestDoc = id ? await fetchLatestInquiryDocument(id) : null;
      const voucherId = latestDoc?.documentId || lexofficeDocId;
      const voucherType = latestDoc?.documentType || lexofficeDocType;
      if (!voucherId || !voucherType) {
        toast.error("Kein aktuelles Dokument verknüpft");
        return;
      }
      const result = await downloadDocument.mutateAsync({
        voucherId,
        voucherType,
      });
      if (result?.pdf) {
        const byteChars = atob(result.pdf);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        toast.error("PDF konnte nicht geladen werden");
      }
    } catch {
      toast.error("Fehler beim Laden des Dokuments");
    } finally {
      setIsDownloading(false);
    }
  };

  // Ref hält immer die aktuellsten Werte — performSave liest daraus
  useEffect(() => {
    latestValuesRef.current = {
      localInquiry,
      selectedPackages,
      quoteItems,
      quoteNotes,
      emailDraft,
      menuSelection,
    };
  }, [localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection]);

  // Stabile Save-Funktion — ändert sich NIE, liest aus Ref
  const performSave = useCallback(async () => {
    if (!id || !isInitializedRef.current) return;

    // Retry-Stopp: nach 3 Fehlschlägen in Folge nicht mehr automatisch speichern
    if (consecutiveSaveErrorsRef.current >= 3) return;

    const vals = latestValuesRef.current;
    setSaveStatus('saving');

    updateInquiry({
      resource: "events",
      id,
      values: {
        ...buildPersistableInquiryValues(vals.localInquiry as Record<string, unknown>),
        selected_packages: vals.selectedPackages,
        quote_items: vals.quoteItems,
        quote_notes: vals.quoteNotes,
        email_draft: vals.emailDraft,
        menu_selection: vals.menuSelection,
      },
    }, {
      onSuccess: () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
        consecutiveSaveErrorsRef.current = 0;
        errorToastShownRef.current = false;
        // Bei Erfolg den persistenten Error-Toast dismiss'en falls vorhanden
        toast.dismiss('inquiry-save-error-permanent');
      },
      onError: (error: unknown) => {
        consecutiveSaveErrorsRef.current += 1;
        // Fehler-Details extrahieren für bessere UX
        let details = 'Unbekannter Fehler';
        if (error && typeof error === 'object') {
          const err = error as { message?: string; error?: string; details?: string };
          details = err.message || err.error || err.details || JSON.stringify(error).slice(0, 150);
        }
        console.error('[SmartInquiryEditor] Save error:', error);
        setSaveStatus('idle');

        // Nur EINMAL pro Fehler-Serie einen Toast anzeigen (kein Spam)
        if (!errorToastShownRef.current) {
          errorToastShownRef.current = true;
          if (consecutiveSaveErrorsRef.current >= 3) {
            toast.error(
              'Speichern dauerhaft fehlgeschlagen. Seite bitte neu laden.',
              { duration: Infinity, id: 'inquiry-save-error-permanent' }
            );
          } else {
            toast.error(`Fehler beim Speichern: ${details}`, { id: 'inquiry-save-error' });
          }
        }
      },
    });
  }, [buildPersistableInquiryValues, id, updateInquiry]);

  // Auto-save: Debounce auf 1.2s, performSave ist STABIL → kein Re-Trigger
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1200);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection, performSave]);

  // Mark as initialized after first load
  useEffect(() => {
    if (inquiry && !isInitializedRef.current) {
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [inquiry]);

  // --------------------------------------------------------------------
  // Preview-Rueckkehr: Send-Flow triggern wenn User auf "Jetzt senden"
  // in der Preview-Seite geklickt hat. URL-Query "?confirmed=1|test&send=proposal|final".
  //
  // Schutz gegen doppelten Trigger: Zwei Wege
  //   (a) sendTriggerHandledRef bleibt ueber Component-Lifetime true.
  //   (b) URL wird SYNCHRON bereinigt bevor irgendwas Asynchrones laeuft.
  // Ausserdem: sessionStorage-Schutz damit auch nach F5 nicht nochmal
  // gesendet wird (Ref ueberlebt Reload nicht).
  // --------------------------------------------------------------------
  const [searchParams, setSearchParams] = useSearchParams();
  const sendTriggerHandledRef = useRef(false);
  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    const sendType = searchParams.get('send');
    if (!confirmed || !sendType) return;
    if (!inquiry || !isInitializedRef.current) return;
    if (sendTriggerHandledRef.current) return;

    // F5-Schutz: einmal getriggerte Kombinationen werden pro Browser-Session
    // fuer 10 Sekunden als "schon erledigt" markiert (verhindert Doppel-Versand
    // bei F5 direkt nach Navigation, erlaubt aber spaeter erneute Vorschau).
    const triggerKey = `send-triggered:${inquiry.id}:${sendType}:${confirmed}`;
    const lastTrigger = sessionStorage.getItem(triggerKey);
    if (lastTrigger && Date.now() - parseInt(lastTrigger, 10) < 10_000) {
      // Innerhalb 10s schon ausgefuehrt — URL still saeubern und raus.
      sendTriggerHandledRef.current = true;
      setSearchParams({}, { replace: true });
      return;
    }

    sendTriggerHandledRef.current = true;
    sessionStorage.setItem(triggerKey, String(Date.now()));

    // URL SOFORT bereinigen — synchron, vor jedem await.
    // Das verhindert dass bei einem Re-Render waehrend des async-Calls
    // der Effect nochmal triggert.
    setSearchParams({}, { replace: true });

    (async () => {
      if (confirmed === 'test') {
        // Testmail: direkte Edge-Function-Call mit isTestPreview, KEINE Phase-Aenderung
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const { data, error } = await supabase.functions.invoke('send-offer-email', {
            body: {
              inquiryId: inquiry.id,
              emailContent: emailDraft || inquiry.email_draft || '',
              customerEmail: inquiry.email || user?.email || 'antoine@monot.com',
              customerName: inquiry.contact_name || '',
              senderEmail: user?.email,
              lexofficeQuotationId: inquiry.lexoffice_quotation_id,
              isTestPreview: true,
            },
          });
          if (error) throw error;
          // Edge-Function liefert die tatsaechlichen Empfaenger in response.recipients.
          // Wir zeigen diese Liste im Toast damit der User sieht was wirklich rausging.
          const recipients: string[] = Array.isArray(data?.recipients) ? data.recipients : [];
          const msgId = data?.messageId ? ` (Resend-ID ${String(data.messageId).slice(0, 8)}…)` : '';
          if (recipients.length > 0) {
            toast.success(`Vorschau-Mail gesendet an: ${recipients.join(', ')}${msgId}`, { duration: 8000 });
          } else {
            toast.success('Vorschau-Mail gesendet', { duration: 6000 });
          }
          if (data && data.emailSent === false) {
            toast.error(`Resend meldet Fehler: ${data.errorMessage || 'Unbekannt'}`, { duration: 10000 });
          }
        } catch (err) {
          console.error('[SmartInquiryEditor] Test-mail failed:', err);
          toast.error(err instanceof Error ? err.message : 'Vorschau-Mail fehlgeschlagen');
        }
        return;
      }

      // Echter Versand — ueber OfferBuilder-Handle (nutzt bewaehrten Code-Pfad)
      const handle = offerBuilderRef.current;
      if (!handle) {
        toast.error('OfferBuilder nicht bereit — bitte erneut versuchen');
        return;
      }
      try {
        if (sendType === 'final') {
          await handle.triggerSendFinalOffer();
        } else {
          await handle.triggerSendProposal();
        }
      } catch (err) {
        console.error('[SmartInquiryEditor] Send trigger failed:', err);
        toast.error(err instanceof Error ? err.message : 'Versand fehlgeschlagen');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry?.id, searchParams]);

  // Keyboard shortcuts
  useEditorShortcuts({
    onSave: () => {
      performSave();
      // Toast entfernt — zentrales SaveStatusBadge im Header zeigt den Status
    },
    onSendOffer: () => {},
    onGenerateEmail: () => {},
    onNextInquiry: () => toast.info("Tipp: Nutze ⌘K für schnelle Navigation"),
    onPreviousInquiry: () => toast.info("Tipp: Nutze ⌘K für schnelle Navigation"),
  });

  if (isLoading) {
    return (
      <AdminLayout activeTab="events">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!inquiry) {
    return (
      <AdminLayout activeTab="events">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Anfrage nicht gefunden</p>
          <Button variant="link" onClick={() => navigate('/admin/events')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="events">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 -mx-6 px-6 py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-border/40 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/events')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold text-sm">
                {(inquiry.contact_name || '??').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold tracking-tight">
                    {inquiry.contact_name || 'Unbekannt'}
                  </h1>
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inquiry.company_name && <><Building2 className="h-3 w-3 inline mr-1" />{inquiry.company_name} · </>}
                  {inquiry.preferred_date && <><Calendar className="h-3 w-3 inline mr-1" />{(() => { try { return format(parseISO(inquiry.preferred_date), 'dd.MM.yyyy', { locale: de }); } catch { return inquiry.preferred_date; } })()} · </>}
                  {inquiry.guest_count && <><Users className="h-3 w-3 inline mr-1" />{inquiry.guest_count} Gäste</>}
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Save Status — unsichtbar (speichert automatisch im Hintergrund) */}

            {/* LexOffice Document Button - Show if linked */}
            {lexofficeDocId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                onClick={handleDownloadDocument}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {lexofficeDocType === 'invoice' ? 'Rechnung' : 'Angebot'} PDF
                </span>
              </Button>
            )}

          </div>
        </div>
      </div>

      {/* Quick Actions + TEST Badge */}
      <div className="flex items-center gap-2 flex-wrap mb-4 -mt-2">
        {(inquiry as any).is_test && (
          <Badge className="bg-amber-500 text-white text-xs">
            <TestTube2 className="h-3 w-3 mr-1" />
            TEST
          </Badge>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => window.open(`/offer/${id}`, '_blank')}
          title="Öffnet das Angebot in der Kunden-Ansicht (neuer Tab)"
        >
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Kunden-Ansicht</span>
        </Button>
      </div>

      {/* Main Content — Tab-Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted/30 rounded-xl p-1 h-auto">
          <TabsTrigger value="angebot" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Angebot</TabsTrigger>
          <TabsTrigger value="kommunikation" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Kommunikation</TabsTrigger>
          <TabsTrigger value="aufgaben" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Aufgaben</TabsTrigger>
          <TabsTrigger value="details" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Details</TabsTrigger>
        </TabsList>

        {/* Tab: Angebot */}
        <TabsContent value="angebot" className="mt-6 space-y-6">
          {/* Payment-Status Strip — kompakt, klickbar → Details-Tab */}
          <PaymentStatusStrip
            inquiryId={id!}
            onNavigateToDetails={() => setActiveTab('details')}
          />

          {/* Multi-Package Offer Section */}
          {inquiryType === 'event' ? (
            <OfferBuilder
              ref={offerBuilderRef}
              inquiry={mergedInquiry}
              packages={packages}
              templates={templates}
              onSave={performSave}
              onFieldChange={handleLocalFieldChange}
            />
          ) : (
            /* Catering inquiries use existing flow */
            <CateringModules
              inquiry={mergedInquiry}
              selectedItems={quoteItems}
              onItemAdd={handleItemAdd}
              onItemQuantityChange={handleItemQuantityChange}
              onItemRemove={handleItemRemove}
              onDeliveryChange={(field, value) => handleLocalFieldChange(field, value)}
            />
          )}

        </TabsContent>

        {/* Tab: Kommunikation */}
        <TabsContent value="kommunikation" className="mt-6">
          <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                E-Mail Konversation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConversationThread
                inquiryId={id!}
                customerEmail={inquiry.email || undefined}
                onSendReply={async (content) => {
                  if (!inquiry?.email) {
                    toast.error('Keine E-Mail-Adresse hinterlegt');
                    return;
                  }
                  const { data: result } = await supabase.functions.invoke('send-offer-email', {
                    body: {
                      inquiryId: id,
                      emailContent: content,
                      customerEmail: inquiry.email,
                      customerName: inquiry.contact_name || '',
                      senderEmail: currentUserEmail,
                    },
                  });
                  if (!result?.emailSent) {
                    throw new Error(result?.error || 'Versand fehlgeschlagen');
                  }
                  toast.success('Antwort versendet');
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Aufgaben */}
        <TabsContent value="aufgaben" className="mt-6 space-y-6">
          <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-primary" />
                Aufgaben & Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskManager
                inquiryId={id!}
                currentUserEmail={currentUserEmail}
              />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Interne Notiz
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StaffNote
                note={inquiry.internal_notes || ''}
                onNoteChange={(note) => handleLocalFieldChange('internal_notes', note)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Details */}
        <TabsContent value="details" className="mt-6 space-y-6">
          {/* Event DNA + Location (slot) + Kontakt & Firma + Assignee + Originale Kundenanfrage */}
          <EventDNACard
            inquiry={mergedInquiry}
            onFieldChange={handleLocalFieldChange}
            isReadOnly={inquiry.status === 'confirmed'}
            currentUserEmail={currentUserEmail}
            onAssigneeChange={(email) => handleLocalFieldChange('assigned_to', email)}
            onPriorityChange={(priority) => handleLocalFieldChange('priority', priority)}
            locationSlot={
              <LocationBlock
                inquiry={mergedInquiry}
                onFieldChange={handleLocalFieldChange}
                isReadOnly={inquiry.status === 'confirmed'}
              />
            }
          />
          {/* Client Preview */}
          <ClientPreview
            inquiryId={id!}
            version={inquiry.current_offer_version || 1}
          />
          {/* Zahlungen */}
          <div data-payment-card>
            <PaymentCard
              inquiryId={id!}
              preferredDate={inquiry.preferred_date}
              offerTotal={offerTotal}
            />
          </div>
          {/* Timeline */}
          <Timeline entityType="event_inquiry" entityId={id!} />
        </TabsContent>

      </Tabs>

    </AdminLayout>
  );
};
