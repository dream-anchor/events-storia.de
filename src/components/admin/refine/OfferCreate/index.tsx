import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "../AdminLayout";
import { SourcePanel } from "./SourcePanel";
import { DraftPanel } from "./DraftPanel";
import { DraftFormData, ParsedInquiry, SuggestedPackage, SuggestedItem } from "./types";
import type { ExtendedInquiry, Package, EmailTemplate } from "../InquiryEditor/types";

const initialFormData: DraftFormData = {
  contact_name: "",
  company_name: "",
  email: "",
  phone: "",
  preferred_date: "",
  preferred_time: "",
  guest_count: "",
  event_type: "",
  message: "",
  selected_packages: [],
};

export const AdminOfferCreate = () => {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState("");
  const [formData, setFormData] = useState<DraftFormData>(initialFormData);
  const [suggestions, setSuggestions] = useState<SuggestedPackage[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<SuggestedItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);

  // Draft inquiry created on mount — gives OfferBuilder a real DB ID to auto-save into
  const [draftInquiryId, setDraftInquiryId] = useState<string | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  useEffect(() => {
    const createDraft = async () => {
      const { data, error } = await supabase
        .from("event_inquiries")
        .insert({
          contact_name: "",
          email: "",
          source: "manual_entry",
          status: "draft",
          inquiry_type: "event",
        })
        .select("id")
        .single();

      if (error) {
        console.error("[AdminOfferCreate] Draft creation error:", error);
        toast.error("Fehler beim Initialisieren des Formulars");
        return;
      }
      setDraftInquiryId(data.id);
    };

    const fetchPackages = async () => {
      const { data } = await supabase
        .from("packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setPackages((data || []) as Package[]);
    };

    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setTemplates((data || []) as EmailTemplate[]);
    };

    createDraft();
    fetchPackages();
    fetchTemplates();
  }, []);

  // Minimal ExtendedInquiry object for OfferBuilder — kept in sync with formData
  const draftInquiry = useMemo((): ExtendedInquiry | null => {
    if (!draftInquiryId) return null;
    return {
      id: draftInquiryId,
      contact_name: formData.contact_name,
      company_name: formData.company_name || null,
      email: formData.email,
      phone: formData.phone || null,
      guest_count: formData.guest_count || null,
      event_type: formData.event_type || null,
      preferred_date: formData.preferred_date || null,
      message: formData.message || null,
      time_slot: formData.preferred_time || null,
      source: "manual_entry",
      status: "new",
      internal_notes: null,
      notification_sent: false,
      created_at: new Date().toISOString(),
      updated_at: null,
      inquiry_type: "event",
      room_selection: null,
      delivery_street: null,
      delivery_zip: null,
      delivery_city: null,
      delivery_time_slot: null,
      selected_items: [],
      selected_packages: [],
      quote_items: [],
      quote_notes: null,
      email_draft: null,
      lexoffice_quotation_id: null,
      lexoffice_invoice_id: null,
      lexoffice_document_type: null,
      lexoffice_contact_id: null,
      offer_sent_at: null,
      offer_sent_by: null,
      current_offer_version: null,
      last_edited_by: null,
      last_edited_at: null,
    };
  }, [draftInquiryId, formData]);

  const handleFormChange = useCallback((updates: Partial<DraftFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleExtract = async () => {
    if (!rawText.trim()) return;

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-inquiry-text', {
        body: {
          rawText,
          existingPackageNames: [
            'Business Dinner – Exclusive',
            'Network Aperitivo',
            'Full Buyout'
          ]
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Analyse fehlgeschlagen');

      const parsed: ParsedInquiry = data.data;

      setFormData(prev => ({
        ...prev,
        contact_name: parsed.contact_name || prev.contact_name,
        company_name: parsed.company_name || prev.company_name,
        email: parsed.email || prev.email,
        phone: parsed.phone || prev.phone,
        preferred_date: parsed.preferred_date || prev.preferred_date,
        preferred_time: parsed.preferred_time || prev.preferred_time,
        guest_count: parsed.guest_count || prev.guest_count,
        event_type: parsed.event_type?.toLowerCase().replace(/\s+/g, '-') || prev.event_type,
        message: parsed.original_message_summary || prev.message,
      }));

      setSuggestions(parsed.suggested_packages || []);
      setSuggestedItems(parsed.suggested_items || []);
      setHasExtracted(true);

      toast.success("Daten erfolgreich extrahiert!");
    } catch (err) {
      console.error('Extraction error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler bei der Analyse');
    } finally {
      setIsExtracting(false);
    }
  };

  // UPDATE the draft inquiry with final form data
  const saveInquiry = async (status: 'new' | 'offer_sent') => {
    if (!draftInquiryId) throw new Error('Draft nicht initialisiert');

    const { data, error } = await supabase
      .from('event_inquiries')
      .update({
        contact_name: formData.contact_name,
        company_name: formData.company_name || null,
        email: formData.email,
        phone: formData.phone || null,
        preferred_date: formData.preferred_date || null,
        time_slot: formData.preferred_time || null,
        guest_count: formData.guest_count || null,
        event_type: formData.event_type || null,
        message: formData.message || null,
        status,
      })
      .eq('id', draftInquiryId)
      .select()
      .single();

    if (error) throw error;

    // Kunden-Benachrichtigung nur bei Entwurf (nicht bei offer_sent — Angebots-Mail folgt separat)
    if (status === 'new') supabase.functions.invoke('receive-event-inquiry', {
      body: {
        contactName: formData.contact_name,
        email: formData.email,
        companyName: formData.company_name || undefined,
        phone: formData.phone || undefined,
        guestCount: formData.guest_count || undefined,
        eventType: formData.event_type || undefined,
        preferredDate: formData.preferred_date || undefined,
        timeSlot: formData.preferred_time || undefined,
        message: formData.message || undefined,
        source: 'manual_entry',
        skipInsert: true,
        existingInquiryId: data.id,
      },
    }).then(res => {
      if (res.error) console.error('Notification error:', res.error);
    });

    return data;

  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const inquiry = await saveInquiry('new');
      toast.success("Anfrage gespeichert!");
      navigate(`/admin/events/${inquiry.id}/edit`);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndSend = async () => {
    setIsSending(true);
    try {
      // 1. Anfrage in DB finalisieren
      const inquiry = await saveInquiry('offer_sent');

      // 2. LexOffice Angebot erstellen (non-blocking bei Fehler)
      const { data: lexData, error: lexError } = await supabase.functions.invoke(
        'create-event-quotation',
        { body: { inquiryId: inquiry.id } },
      );

      if (lexError || !lexData?.success) {
        const msg = lexData?.error || lexError?.message || 'Unbekannter Fehler';
        console.error('[LexOffice] Quotation error:', msg);
        toast.warning(`Anfrage gespeichert, aber LexOffice-Angebot fehlgeschlagen: ${msg}`);
      } else if (lexData?.quotationId) {
        // 3. quotation_id zurückschreiben
        await supabase
          .from('event_inquiries')
          .update({ lexoffice_quotation_id: lexData.quotationId })
          .eq('id', inquiry.id);
        toast.success('Anfrage gespeichert & LexOffice-Angebot erstellt!');
      }

      navigate(`/admin/events/${inquiry.id}/edit`);
    } catch (err) {
      console.error('Save and send error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AdminLayout activeTab="events">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/events')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück
          </Button>
          <div>
            <h1 className="text-3xl font-serif font-semibold">Manuelle Anfrage erfassen</h1>
            <p className="text-base text-muted-foreground">
              Kunden-E-Mail analysieren und Angebot erstellen
            </p>
          </div>
        </div>

        {/* Split-screen layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left: Source Panel */}
          <div className="h-full min-h-[400px] lg:min-h-0">
            <SourcePanel
              rawText={rawText}
              onRawTextChange={setRawText}
              onExtract={handleExtract}
              isExtracting={isExtracting}
            />
          </div>

          {/* Right: Draft Panel */}
          <div className="h-full overflow-hidden">
            <DraftPanel
              formData={formData}
              onFormChange={handleFormChange}
              suggestions={suggestions}
              suggestedItems={suggestedItems}
              onSaveDraft={handleSaveDraft}
              onSaveAndSend={handleSaveAndSend}
              isSaving={isSaving}
              isSending={isSending}
              hasExtracted={hasExtracted}
              draftInquiry={draftInquiry}
              packages={packages}
              templates={templates}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
