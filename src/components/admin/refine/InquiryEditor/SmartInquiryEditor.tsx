import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate, useList } from "@refinedev/core";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Send,
  Calendar,
  Users,
  MapPin,
  Phone,
  Mail,
  Plus,
  Eye,
  Info,
  History,
  Calculator,
  Fingerprint,
  Trash2,
} from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ExtendedInquiry, Package, QuoteItem, SelectedPackage, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Timeline } from "@/components/admin/shared/Timeline";
import { cn } from "@/lib/utils";

// Status badge configuration
const STATUS_CONFIG = {
  new: { label: "Neu", class: "bg-blue-100 text-blue-700" },
  contacted: { label: "In Bearbeitung", class: "bg-orange-100 text-orange-700" },
  offer_sent: { label: "Angebot versendet", class: "bg-purple-100 text-purple-700" },
  confirmed: { label: "Bestätigt", class: "bg-green-100 text-green-700" },
  declined: { label: "Abgelehnt", class: "bg-red-100 text-red-700" },
};

export const SmartInquiryEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
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
  const [staffNote, setStaffNote] = useState("");

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

  // Update mutation
  const { mutate: updateInquiry } = useUpdate();

  // Initialize local state from inquiry
  useEffect(() => {
    if (inquiry) {
      setLocalInquiry(inquiry);
      setQuoteNotes(inquiry.quote_notes || "");
      setEmailDraft(inquiry.email_draft || "");
      setStaffNote(inquiry.internal_notes || "");

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
    internal_notes: staffNote,
    menu_selection: menuSelection,
  } as ExtendedInquiry), [inquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, staffNote, menuSelection]);

  const guestCount = parseInt(mergedInquiry?.guest_count || '1') || 1;

  // Field change handler
  const handleFieldChange = useCallback((field: keyof ExtendedInquiry, value: unknown) => {
    setLocalInquiry(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-save function
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
        internal_notes: staffNote,
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
  }, [id, updateInquiry, localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, staffNote, menuSelection]);

  // Auto-save on changes
  useEffect(() => {
    if (!isInitializedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localInquiry, selectedPackages, quoteItems, quoteNotes, emailDraft, staffNote, menuSelection, performSave]);

  // Mark as initialized after first load
  useEffect(() => {
    if (inquiry && !isInitializedRef.current) {
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [inquiry]);

  // Quote item handlers
  const handleAddItem = useCallback(() => {
    const newItem: QuoteItem = {
      id: `custom-${Date.now()}`,
      name: "Neue Position",
      description: null,
      price: 0,
      quantity: 1,
    };
    setQuoteItems(prev => [...prev, newItem]);
  }, []);

  const handleItemChange = useCallback((itemId: string, field: keyof QuoteItem, value: unknown) => {
    setQuoteItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setQuoteItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  // Calculate totals
  const calculations = useMemo(() => {
    const itemsTotal = quoteItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const packagesTotal = selectedPackages.reduce((sum, pkg) => {
      const qty = pkg.pricePerPerson ? guestCount : pkg.quantity;
      return sum + (pkg.price * qty);
    }, 0);
    const subtotal = itemsTotal + packagesTotal;
    const serviceFee = subtotal * 0.10;
    const grandTotal = subtotal + serviceFee;

    return { subtotal, serviceFee, grandTotal };
  }, [quoteItems, selectedPackages, guestCount]);

  // Send offer handler
  const handleSendOffer = useCallback(async () => {
    if (!inquiry || !id) return;
    setIsSending(true);

    try {
      await performSave();
      toast.success("Angebot wurde versendet!");

      updateInquiry({
        resource: "events",
        id,
        values: { status: 'offer_sent' },
      });
    } catch (err) {
      toast.error("Fehler beim Senden");
    } finally {
      setIsSending(false);
    }
  }, [inquiry, id, performSave, updateInquiry]);

  // Generate PDF handler
  const handleGeneratePDF = useCallback(() => {
    toast.info("PDF-Generierung wird vorbereitet...");
  }, []);

  if (isLoading) {
    return (
      <AdminLayout activeTab="events" title="Lädt...">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!inquiry) {
    return (
      <AdminLayout activeTab="events" title="Nicht gefunden">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Anfrage nicht gefunden</p>
          <Button variant="outline" onClick={() => navigate('/admin/events')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const status = STATUS_CONFIG[mergedInquiry.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
  const inquiryNumber = id?.slice(-4).toUpperCase() || '';

  return (
    <AdminLayout
      activeTab="events"
      title={`Anfrage #${inquiryNumber}`}
      showSearch={false}
      showCreateButton={false}
    >
      {/* Sub-header with status and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/events')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                {mergedInquiry.company_name || mergedInquiry.contact_name}
              </h1>
              <Badge className={cn("text-xs", status.class)}>
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Erstellt am {mergedInquiry.created_at && format(parseISO(mergedInquiry.created_at), "d. MMM yyyy", { locale: de })}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGeneratePDF}>
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button size="sm" onClick={handleSendOffer} disabled={isSending}>
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            E-Mail senden
          </Button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Event DNA + Timeline */}
        <div className="lg:col-span-7 space-y-6">
          {/* Event DNA Card */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Fingerprint className="h-5 w-5 text-primary" />
                Event DNA
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Event Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Eventdatum</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={mergedInquiry.preferred_date ? format(parseISO(mergedInquiry.preferred_date), "d. MMMM yyyy", { locale: de }) : ""}
                      onChange={(e) => handleFieldChange('preferred_date', e.target.value)}
                      className="pl-10 bg-muted/50"
                      placeholder="Datum auswählen"
                    />
                  </div>
                </div>

                {/* Guest Count */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Gästeanzahl</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={mergedInquiry.guest_count || ""}
                      onChange={(e) => handleFieldChange('guest_count', e.target.value)}
                      className="pl-10 bg-muted/50"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Veranstaltungsort</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={mergedInquiry.location || ""}
                      onChange={(e) => handleFieldChange('location', e.target.value)}
                      className="pl-10 bg-muted/50"
                      placeholder="Adresse oder Venue eingeben"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Kontaktinformationen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Kundenname</label>
                    <Input
                      type="text"
                      value={mergedInquiry.contact_name || ""}
                      onChange={(e) => handleFieldChange('contact_name', e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Telefon</label>
                    <Input
                      type="tel"
                      value={mergedInquiry.phone || ""}
                      onChange={(e) => handleFieldChange('phone', e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">E-Mail-Adresse</label>
                    <Input
                      type="email"
                      value={mergedInquiry.email || ""}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      className="bg-muted/50"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline & Activity */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-primary" />
                Timeline & Aktivität
              </CardTitle>
              <Button variant="link" size="sm" className="text-xs text-primary">
                Alle anzeigen
              </Button>
            </CardHeader>
            <CardContent>
              <Timeline entityType="event_inquiry" entityId={id!} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Calculator & Preview */}
        <div className="lg:col-span-5 space-y-6">
          {/* Cost Calculator */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-primary" />
                Kalkulation
              </CardTitle>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleAddItem}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Quote Items */}
                {quoteItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center group">
                    <div className="col-span-5">
                      <Input
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Position"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className="h-9 text-sm text-center"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm text-right"
                        placeholder="0,00"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}

                {quoteItems.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Noch keine Positionen</p>
                    <Button variant="link" size="sm" onClick={handleAddItem} className="mt-1">
                      Position hinzufügen
                    </Button>
                  </div>
                )}
              </div>

              {/* Totals */}
              {quoteItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Zwischensumme</span>
                    <span className="font-medium">
                      {calculations.subtotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Servicegebühr (10%)</span>
                    <span className="font-medium">
                      {calculations.serviceFee.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <span className="text-lg font-bold">Gesamtsumme</span>
                    <span className="text-2xl font-black text-primary">
                      {calculations.grandTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Preview Card */}
          <Card>
            <CardHeader className="bg-muted/50 border-b border-border py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Kundenvorschau
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px]">v1.0</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="aspect-[4/3] rounded-lg border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center p-6 text-center">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-bold mb-1 text-sm">Interaktives Angebot</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  So sieht der Kunde das Angebot.
                </p>
                <Button variant="outline" size="sm">
                  Vorschau öffnen
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Staff Note */}
          <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-primary mb-2">Interne Notiz</p>
                <Textarea
                  value={staffNote}
                  onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="Notizen für das Team..."
                  className="min-h-[60px] text-xs bg-transparent border-0 p-0 focus-visible:ring-0 resize-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
