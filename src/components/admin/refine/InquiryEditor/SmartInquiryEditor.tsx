import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { ArrowLeft, Loader2, CalendarDays, Truck, Layers, FileCheck, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EventModules } from "./EventModules";
import { CateringModules } from "./CateringModules";
import { AIComposer } from "./AIComposer";
import { CalculationSummary } from "./CalculationSummary";
import { MultiOfferComposer } from "./MultiOffer";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type OfferMode = 'simple' | 'multi';

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("kalkulation");
  const [isSending, setIsSending] = useState(false);
  const [offerMode, setOfferMode] = useState<OfferMode>('simple');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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
                <h1 className="text-3xl font-serif font-semibold">
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
          
          {/* Auto-save status indicator */}
          <div className="flex items-center gap-2 text-base text-muted-foreground">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Speichert...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Gespeichert</span>
              </>
            )}
          </div>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="kalkulation">Kalkulation</TabsTrigger>
            <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
          </TabsList>

          {/* Tab 1: Kalkulation */}
          <TabsContent value="kalkulation" className="space-y-6">
            {/* Mode Toggle for Event inquiries */}
            {inquiryType === 'event' && (
              <div className="flex items-center justify-between">
                <ToggleGroup
                  type="single"
                  value={offerMode}
                  onValueChange={(v) => v && setOfferMode(v as OfferMode)}
                  className="bg-muted p-1 rounded-lg"
                >
                  <ToggleGroupItem value="simple" aria-label="Einfaches Angebot" className="gap-2 px-4">
                    <FileCheck className="h-4 w-4" />
                    Einfaches Angebot
                  </ToggleGroupItem>
                  <ToggleGroupItem value="multi" aria-label="Multi-Optionen" className="gap-2 px-4">
                    <Layers className="h-4 w-4" />
                    Multi-Optionen
                  </ToggleGroupItem>
                </ToggleGroup>
                {offerMode === 'multi' && (
                  <Badge variant="secondary" className="text-xs">
                    Bis zu 5 Paket-Optionen mit Stripe-Links
                  </Badge>
                )}
              </div>
            )}

            {/* Content based on mode */}
            {inquiryType === 'event' && offerMode === 'multi' ? (
              <MultiOfferComposer
                inquiry={mergedInquiry}
                packages={packages}
                templates={templates}
                onSave={performSave}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Type-specific modules */}
                <div className="lg:col-span-2">
                  {inquiryType === 'event' ? (
                    <EventModules
                      inquiry={mergedInquiry}
                      packages={packages}
                      selectedPackages={selectedPackages}
                      quoteItems={quoteItems}
                      menuSelection={menuSelection}
                      onPackageToggle={handlePackageToggle}
                      onRoomChange={(v) => handleLocalFieldChange('room_selection', v)}
                      onTimeSlotChange={(v) => handleLocalFieldChange('time_slot', v)}
                      onGuestCountChange={(v) => handleLocalFieldChange('guest_count', v)}
                      onItemAdd={handleItemAdd}
                      onItemQuantityChange={handleItemQuantityChange}
                      onItemRemove={handleItemRemove}
                      onMenuSelectionChange={setMenuSelection}
                      emailDraft={emailDraft}
                      onEmailDraftChange={setEmailDraft}
                      onSendOffer={handleSendOffer}
                      isSending={isSending}
                      templates={templates}
                    />
                  ) : (
                    <CateringModules
                      inquiry={mergedInquiry}
                      selectedItems={quoteItems}
                      onItemAdd={handleItemAdd}
                      onItemQuantityChange={handleItemQuantityChange}
                      onItemRemove={handleItemRemove}
                      onDeliveryChange={(field, value) => handleLocalFieldChange(field, value)}
                    />
                  )}
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

          {/* Tab 2: Kommunikation */}
          <TabsContent value="kommunikation">
            <div className="max-w-2xl mx-auto">
              <AIComposer
                inquiry={mergedInquiry}
                quoteItems={[
                  ...quoteItems,
                  ...selectedPackages.map(pkg => ({
                    id: pkg.id,
                    name: pkg.name,
                    description: pkg.description,
                    price: pkg.pricePerPerson ? pkg.price * guestCount : pkg.price,
                    quantity: pkg.quantity,
                    isPackage: true,
                  })),
                ]}
                templates={templates}
                emailDraft={emailDraft}
                onEmailDraftChange={setEmailDraft}
                onSendEmail={handleSendOffer}
                isSending={isSending}
                menuSelection={menuSelection}
                packageName={selectedPackages.length > 0 ? selectedPackages[0].name : undefined}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};
