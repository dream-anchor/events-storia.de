import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ArrowLeft, Loader2, FileText, Send, Receipt, Check, History, ListTodo, ExternalLink } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { useEditorShortcuts } from "../CommandPalette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventDNACard } from "./EventDNACard";
import { MultiOfferComposer } from "./MultiOffer";
import { CateringModules } from "./CateringModules";
import { CalculationSummary } from "./CalculationSummary";
import { ClientPreview } from "./ClientPreview";
import { StaffNote } from "./StaffNote";
import { Timeline } from "@/components/admin/shared/Timeline";
import { TaskManager } from "@/components/admin/shared/TaskManager";
import { CreateManualInvoiceDialog } from "../CreateManualInvoiceDialog";
import { useDownloadLexOfficeDocument } from "@/hooks/useLexOfficeVouchers";
import { InquiryPriority } from "@/types/refine";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadDocument = useDownloadLexOfficeDocument();

  // Local state for editable fields
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [localInquiry, setLocalInquiry] = useState<Partial<ExtendedInquiry>>({});
  const [menuSelection, setMenuSelection] = useState<MenuSelection>({ courses: [], drinks: [] });

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
        console.log("Could not parse inquiry JSON fields");
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
      if (result?.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
      } else {
        toast.error("PDF konnte nicht geladen werden");
      }
    } catch {
      toast.error("Fehler beim Laden des Dokuments");
    } finally {
      setIsDownloading(false);
    }
  };

  // Send offer handler
  const handleSendOffer = useCallback(async () => {
    if (!emailDraft || !inquiry?.email) {
      toast.error("E-Mail-Entwurf oder Empfänger fehlt");
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          to: inquiry.email,
          subject: `Ihr Angebot von Storia`,
          html: emailDraft,
          inquiryId: id,
        }
      });
      if (error) throw error;

      // Update inquiry status
      updateInquiry({
        resource: "events",
        id: id!,
        values: { status: 'offer_sent' }
      });

      toast.success("E-Mail wurde gesendet");
    } catch (error) {
      console.error(error);
      toast.error("Fehler beim Senden der E-Mail");
    } finally {
      setIsSending(false);
    }
  }, [emailDraft, inquiry?.email, id, updateInquiry]);

  // Auto-save function (debounced)
  const performSave = useCallback(async () => {
    if (!id || !isInitializedRef.current) return;
    setSaveStatus('saving');

    updateInquiry({
      resource: "events",
      id,
      values: {
        ...localInquiry,
        selected_packages: selectedPackages,
        quote_items: quoteItems,
        quote_notes: quoteNotes,
        email_draft: emailDraft,
        menu_selection: menuSelection,
      },
    }, {
      onSuccess: () => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      },
      onError: (error) => {
        toast.error("Fehler beim Speichern");
        console.error(error);
        setSaveStatus('idle');
      },
    });
  }, [id, updateInquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection]);

  // Auto-save on any change (debounced)
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 800);

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
    onSendOffer: handleSendOffer,
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
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight">
                    Anfrage #{id?.slice(0, 8)}
                  </h1>
                  <Badge className={statusInfo.color}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Erstellt am {inquiry.created_at ? format(parseISO(inquiry.created_at), "dd. MMM yyyy", { locale: de }) : "Unbekannt"}
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

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setCreateInvoiceOpen(true)}
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Rechnung</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>

            <Button
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90"
              disabled={!emailDraft || isSending}
              onClick={handleSendOffer}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">E-Mail senden</span>
            </Button>
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
            <MultiOfferComposer
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

          {/* Timeline & Activity */}
          <div className="rounded-xl border border-border/60 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Timeline & Aktivitäten</h2>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-primary">
                Alle anzeigen
              </Button>
            </div>
            <Timeline entityType="event_inquiry" entityId={id!} />
          </div>
        </div>

        {/* Right Column - 5 columns */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cost Calculator / Calculation Summary */}
          <CalculationSummary
            quoteItems={quoteItems}
            selectedPackages={selectedPackages}
            guestCount={guestCount}
            notes={quoteNotes}
            onNotesChange={setQuoteNotes}
          />

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
            </CardContent>
          </Card>

          {/* Staff Note */}
          <StaffNote
            note={inquiry.internal_notes || ''}
            onNoteChange={(note) => handleLocalFieldChange('internal_notes', note)}
          />
        </div>
      </div>

      {/* Manual Invoice Creation Dialog */}
      <CreateManualInvoiceDialog
        open={createInvoiceOpen}
        onOpenChange={setCreateInvoiceOpen}
        prefillData={{
          contactName: mergedInquiry.contact_name,
          companyName: mergedInquiry.company_name || undefined,
          email: mergedInquiry.email,
          phone: mergedInquiry.phone || undefined,
          eventInquiryId: id,
        }}
        onSuccess={() => inquiryQuery.query.refetch()}
      />
    </AdminLayout>
  );
};
