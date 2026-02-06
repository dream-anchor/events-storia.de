import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { ArrowLeft, Loader2, CalendarDays, Truck, Check, Activity, Receipt } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { useEditorShortcuts } from "../CommandPalette";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EventModules } from "./EventModules";
import { CateringModules } from "./CateringModules";
import { CalculationSummary } from "./CalculationSummary";
import { MultiOfferComposer } from "./MultiOffer";
import { InquiryDetailsPanel } from "./InquiryDetailsPanel";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Timeline } from "@/components/admin/shared/Timeline";
import { CreateManualInvoiceDialog } from "../CreateManualInvoiceDialog";

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("kalkulation");
  const [isSending, setIsSending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

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

  // Note: Menu items are now fetched internally by CateringModules via useCombinedMenuItems

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
      
      // Parse JSON fields
      try {
        if (inquiry.selected_packages && Array.isArray(inquiry.selected_packages)) {
          setSelectedPackages(inquiry.selected_packages);
        }
        if (inquiry.quote_items && Array.isArray(inquiry.quote_items)) {
          setQuoteItems(inquiry.quote_items);
        }
        // Parse menu_selection if available
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

  // Handlers
  const handlePackageToggle = useCallback((pkg: Package) => {
    setSelectedPackages(prev => {
      const exists = prev.find(p => p.id === pkg.id);
      if (exists) {
        return prev.filter(p => p.id !== pkg.id);
      }
      return [...prev, {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        pricePerPerson: pkg.price_per_person,
        quantity: 1,
        minGuests: pkg.min_guests ?? undefined,
        requiresPrepayment: pkg.requires_prepayment,
        prepaymentPercentage: pkg.prepayment_percentage,
      }];
    });
  }, []);

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
    }, 800); // 800ms debounce
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, menuSelection, performSave]);

  // Mark as initialized after first load
  useEffect(() => {
    if (inquiry && !isInitializedRef.current) {
      // Small delay to ensure state is set before enabling auto-save
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [inquiry]);

  // Send to LexOffice with email
  const handleSendOffer = useCallback(async () => {
    if (!inquiry || !id || !emailDraft) {
      toast.error("Bitte erst einen E-Mail-Text erstellen");
      return;
    }

    setIsSending(true);

    try {
      // First save current state
      await performSave();

      // Build line items from packages and quote items
      const lineItems = [
        ...selectedPackages.map(pkg => ({
          type: 'custom',
          name: pkg.name,
          description: pkg.description || '',
          quantity: pkg.pricePerPerson ? guestCount : pkg.quantity,
          unitName: pkg.pricePerPerson ? 'Person' : 'Stück',
          unitPrice: {
            currency: 'EUR',
            netAmount: pkg.price,
            taxRatePercentage: 7,
          },
        })),
        ...quoteItems.map(item => ({
          type: 'custom',
          name: item.name,
          description: item.description || '',
          quantity: item.quantity,
          unitName: 'Stück',
          unitPrice: {
            currency: 'EUR',
            netAmount: item.price,
            taxRatePercentage: 7,
          },
        })),
      ];

      // Call edge function to create LexOffice quotation
      const { data, error } = await supabase.functions.invoke('create-event-quotation', {
        body: {
          eventId: id,
          event: {
            contact_name: mergedInquiry.contact_name,
            company_name: mergedInquiry.company_name,
            email: mergedInquiry.email,
            phone: mergedInquiry.phone,
            preferred_date: mergedInquiry.preferred_date,
            guest_count: mergedInquiry.guest_count,
            event_type: mergedInquiry.event_type,
          },
          items: lineItems,
          notes: quoteNotes,
          emailBody: emailDraft,
          menuSelection: menuSelection,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update inquiry status
      updateInquiry({
        resource: "events",
        id,
        values: {
          status: 'offer_sent',
          lexoffice_quotation_id: data?.quotationId,
        },
      });

      toast.success("Angebot wurde erstellt und per E-Mail versendet!");

    } catch (err) {
      console.error('Send offer error:', err);
      toast.error(err instanceof Error ? err.message : "Fehler beim Senden");
    } finally {
      setIsSending(false);
    }
  }, [inquiry, id, emailDraft, performSave, selectedPackages, quoteItems, quoteNotes, guestCount, mergedInquiry, updateInquiry, menuSelection]);

  // Keyboard shortcuts for editor
  useEditorShortcuts({
    onSave: () => {
      performSave();
      toast.success("Gespeichert");
    },
    onSendOffer: () => {
      // Only trigger if we have an email draft ready
      if (emailDraft && inquiry?.status !== 'offer_sent') {
        handleSendOffer();
      }
    },
    onGenerateEmail: () => {
      // Switch to Kalkulation tab where email is composed
      setActiveTab("kalkulation");
      toast.info("Nutze den E-Mail-Editor im Kalkulation-Tab");
    },
    onNextInquiry: () => {
      // Navigate to events list for now - could be enhanced with actual navigation
      toast.info("Tipp: Nutze ⌘K für schnelle Navigation");
    },
    onPreviousInquiry: () => {
      toast.info("Tipp: Nutze ⌘K für schnelle Navigation");
    },
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/events')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {mergedInquiry.company_name || mergedInquiry.contact_name}
                </h1>
                <Badge variant={inquiryType === 'event' ? 'default' : 'secondary'}>
                  {inquiryType === 'event' ? (
                    <><CalendarDays className="h-3 w-3 mr-1" /> Event</>
                  ) : (
                    <><Truck className="h-3 w-3 mr-1" /> Catering</>
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {mergedInquiry.email} • {mergedInquiry.event_type || 'Anfrage'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateInvoiceOpen(true)}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Rechnung erstellen
            </Button>
          </div>
        </div>

        {/* Inquiry Details Panel - shows original customer message and key info */}
        <InquiryDetailsPanel
          inquiry={mergedInquiry}
          onInternalNotesChange={(notes) => handleLocalFieldChange('internal_notes', notes)}
        />

        {/* Tabbed Interface - simplified to 2 tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="kalkulation">Kalkulation</TabsTrigger>
            <TabsTrigger value="aktivitaeten" className="gap-1.5">
              <Activity className="h-4 w-4" />
              Aktivitäten
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Kalkulation */}
          <TabsContent value="kalkulation" className="space-y-6">
            {/* Event inquiries use MultiOfferComposer (works for single & multi options) */}
            {inquiryType === 'event' ? (
              <MultiOfferComposer
                inquiry={mergedInquiry}
                packages={packages}
                templates={templates}
                onSave={performSave}
              />
            ) : (
              /* Catering inquiries use existing flow */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Catering modules */}
                <div className="lg:col-span-2">
                  <CateringModules
                    inquiry={mergedInquiry}
                    selectedItems={quoteItems}
                    onItemAdd={handleItemAdd}
                    onItemQuantityChange={handleItemQuantityChange}
                    onItemRemove={handleItemRemove}
                    onDeliveryChange={(field, value) => handleLocalFieldChange(field, value)}
                  />
                </div>

                {/* Right: Calculation Summary */}
                <div>
                  <CalculationSummary
                    quoteItems={quoteItems}
                    selectedPackages={selectedPackages}
                    guestCount={guestCount}
                    notes={quoteNotes}
                    onNotesChange={setQuoteNotes}
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Aktivitäten */}
          <TabsContent value="aktivitaeten">
            <div className="max-w-3xl">
              <Timeline entityType="event_inquiry" entityId={id!} />
            </div>
          </TabsContent>
        </Tabs>
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
