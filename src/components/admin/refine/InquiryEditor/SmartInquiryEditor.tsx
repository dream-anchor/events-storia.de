import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Loader2, FileText, Check, ListTodo, ExternalLink, History, ChevronDown, Mail, Plus, Users, Calendar, Euro, Building2 } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { useEditorShortcuts } from "../CommandPalette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventDNACard } from "./EventDNACard";
import { OfferBuilder } from "./OfferBuilder";
import type { OfferBuilderHandle } from "./OfferBuilder";
import { CateringModules } from "./CateringModules";
import { ClientPreview } from "./ClientPreview";
import { StaffNote } from "./StaffNote";
import { TaskManager } from "@/components/admin/shared/TaskManager";
import { Timeline } from "@/components/admin/shared/Timeline";
import { EmailStatusCard } from "@/components/admin/shared/EmailStatusCard";
import { ConversationThread } from "@/components/admin/shared/ConversationThread";
import { PaymentCard } from "./PaymentCard";
import { useDownloadLexOfficeDocument } from "@/hooks/useLexOfficeVouchers";
import { InquiryPriority } from "@/types/refine";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);
  const latestValuesRef = useRef<Record<string, unknown>>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadDocument = useDownloadLexOfficeDocument();

  // Local state for editable fields
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [localInquiry, setLocalInquiry] = useState<Partial<ExtendedInquiry>>({});
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [customerResponse, setCustomerResponse] = useState<{
    responded_at: string;
    selected_option_id: string | null;
    customer_notes: string | null;
  } | null>(null);
  const [menuSelection, setMenuSelection] = useState<MenuSelection>({ courses: [], drinks: [] });
  const offerBuilderRef = useRef<OfferBuilderHandle>(null);
  const [selectedOptionInfo, setSelectedOptionInfo] = useState<{ optionLabel: string; packageName: string } | null>(null);
  const [offerTotal, setOfferTotal] = useState<number | null>(null);

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

  // Initialize local state from inquiry
  useEffect(() => {
    if (inquiry) {
      setLocalInquiry(inquiry);
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
    }
  }, [inquiry]);

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
    if (!lexofficeDocId || !lexofficeDocType) return;
    setIsDownloading(true);
    try {
      const result = await downloadDocument.mutateAsync({
        voucherId: lexofficeDocId,
        voucherType: lexofficeDocType
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
    const vals = latestValuesRef.current;
    setSaveStatus('saving');

    updateInquiry({
      resource: "events",
      id,
      values: {
        ...(vals.localInquiry as Record<string, unknown>),
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
      },
      onError: () => {
        toast.error("Fehler beim Speichern");
        setSaveStatus('idle');
      },
    });
  }, [id, updateInquiry]);

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

  // Keyboard shortcuts
  useEditorShortcuts({
    onSave: () => {
      performSave();
      toast.success("Gespeichert");
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
            {/* Save Status */}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Speichert...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <Check className="h-3 w-3" />
                Gespeichert
              </span>
            )}

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

      {/* Main Content - 12-column grid, 7/5 split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - 7 columns */}
        <div className="lg:col-span-7 space-y-8">
          {/* Event DNA Card */}
          <EventDNACard
            inquiry={mergedInquiry}
            onFieldChange={handleLocalFieldChange}
            isReadOnly={inquiry.status === 'confirmed'}
            currentUserEmail={currentUserEmail}
            onAssigneeChange={(email) => handleLocalFieldChange('assigned_to', email)}
            onPriorityChange={(priority) => handleLocalFieldChange('priority', priority)}
          />

          {/* Multi-Package Offer Section */}
          {inquiryType === 'event' ? (
            <OfferBuilder
              ref={offerBuilderRef}
              inquiry={mergedInquiry}
              packages={packages}
              templates={templates}
              onSave={performSave}
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

          {/* Timeline & Aktivitäten — einklappbar, default eingeklappt */}
          <div className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 shadow-sm">
            <button
              type="button"
              onClick={() => setTimelineOpen(v => !v)}
              className="w-full flex items-center justify-between p-6 cursor-pointer hover:bg-muted/30 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Timeline & Aktivitäten</h2>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${timelineOpen ? 'rotate-180' : ''}`} />
            </button>
            {timelineOpen && (
              <div className="px-6 pb-6">
                <Timeline entityType="event_inquiry" entityId={id!} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column - 5 columns */}
        <div className="lg:col-span-5 space-y-6">
          {/* Client Preview */}
          <ClientPreview
            inquiryId={id!}
            version={inquiry.current_offer_version || 1}
          />

          {/* Tasks & Follow-ups */}
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
              <div className="mt-4 pt-4 border-t border-border/60">
                <StaffNote
                  note={inquiry.internal_notes || ''}
                  onNoteChange={(note) => handleLocalFieldChange('internal_notes', note)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Kundenantwort */}
          {customerResponse && (
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  💬 Kundenantwort
                  <span className="text-xs text-muted-foreground font-normal">
                    {new Date(customerResponse.responded_at).toLocaleDateString('de-DE')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {customerResponse.selected_option_id && (
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Gewählt: Option{' '}
                    <strong>{selectedOptionInfo?.optionLabel ?? '…'}</strong>
                    {selectedOptionInfo?.packageName && (
                      <span className="text-blue-700 dark:text-blue-300 font-normal">
                        {' '}({selectedOptionInfo.packageName})
                      </span>
                    )}
                  </p>
                )}
                {customerResponse.customer_notes && (
                  <p className="text-sm italic text-muted-foreground">
                    „{customerResponse.customer_notes}"
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950"
                    onClick={() => offerBuilderRef.current?.scrollToEmail(true)}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Antwort per Mail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => offerBuilderRef.current?.triggerNewVersion()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Neues Angebot
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Zahlungen (Anzahlung / Vorauszahlung via Stripe) */}
          <PaymentCard
            inquiryId={id!}
            preferredDate={inquiry.preferred_date}
            offerTotal={offerTotal}
          />

          {/* Konversations-Thread */}
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

          {/* EmailStatusCard entfernt — redundant mit ConversationThread */}

        </div>
      </div>

    </AdminLayout>
  );
};
