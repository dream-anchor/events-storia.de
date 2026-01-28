import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { ArrowLeft, Loader2, Save, CalendarDays, Truck } from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EventModules } from "./EventModules";
import { CateringModules } from "./CateringModules";
import { AIComposer } from "./AIComposer";
import { CalculationSummary } from "./CalculationSummary";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("kalkulation");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Local state for editable fields
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [localInquiry, setLocalInquiry] = useState<Partial<ExtendedInquiry>>({});

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

  // Fetch menu items for catering
  const menuItemsQuery = useList({
    resource: "menu_items",
    pagination: { pageSize: 200 },
    sorters: [{ field: "sort_order", order: "asc" }],
  });
  const menuItems = menuItemsQuery.result?.data || [];

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
  } as ExtendedInquiry), [inquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft]);

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

  // Save handler
  const handleSave = useCallback(async () => {
    if (!id) return;
    setIsSaving(true);

    try {
      updateInquiry({
        resource: "events",
        id,
        values: {
          ...localInquiry,
          selected_packages: selectedPackages,
          quote_items: quoteItems,
          quote_notes: quoteNotes,
          email_draft: emailDraft,
        },
      }, {
        onSuccess: () => {
          toast.success("Änderungen gespeichert");
        },
        onError: (error) => {
          toast.error("Fehler beim Speichern");
          console.error(error);
        },
      });
    } finally {
      setIsSaving(false);
    }
  }, [id, updateInquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft]);

  // Send to LexOffice with email
  const handleSendOffer = useCallback(async () => {
    if (!inquiry || !id || !emailDraft) {
      toast.error("Bitte erst einen E-Mail-Text erstellen");
      return;
    }

    setIsSending(true);

    try {
      // First save current state
      await handleSave();

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
  }, [inquiry, id, emailDraft, handleSave, selectedPackages, quoteItems, quoteNotes, guestCount, mergedInquiry, updateInquiry]);

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
                <h1 className="text-2xl font-serif font-semibold">
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
          
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="kalkulation">Kalkulation</TabsTrigger>
            <TabsTrigger value="kommunikation">Kommunikation</TabsTrigger>
          </TabsList>

          {/* Tab 1: Kalkulation */}
          <TabsContent value="kalkulation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: Type-specific modules */}
              <div className="lg:col-span-2">
                {inquiryType === 'event' ? (
                  <EventModules
                    inquiry={mergedInquiry}
                    packages={packages}
                    selectedPackages={selectedPackages}
                    onPackageToggle={handlePackageToggle}
                    onRoomChange={(v) => handleLocalFieldChange('room_selection', v)}
                    onTimeSlotChange={(v) => handleLocalFieldChange('time_slot', v)}
                    onGuestCountChange={(v) => handleLocalFieldChange('guest_count', v)}
                  />
                ) : (
                  <CateringModules
                    inquiry={mergedInquiry}
                    menuItems={menuItems as never[]}
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
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};
