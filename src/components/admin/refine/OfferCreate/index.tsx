import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "../AdminLayout";
import { SourcePanel } from "./SourcePanel";
import { DraftPanel } from "./DraftPanel";
import { DraftFormData, ParsedInquiry, SuggestedPackage, SuggestedItem } from "./types";

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

      // Update form with extracted data
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

      // Set AI suggestions
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

  const saveInquiry = async (status: 'new' | 'offer_sent') => {
    // Prepare data for event_inquiries table
    const inquiryData = {
      contact_name: formData.contact_name,
      company_name: formData.company_name || null,
      email: formData.email,
      phone: formData.phone || null,
      preferred_date: formData.preferred_date || null,
      time_slot: formData.preferred_time || null,
      guest_count: formData.guest_count || null,
      event_type: formData.event_type || null,
      message: formData.message || null,
      source: 'manual_entry',
      status,
      inquiry_type: 'event' as const,
      selected_packages: formData.selected_packages.length > 0 
        ? formData.selected_packages.map(p => ({ id: p.id, name: p.name, price: p.price }))
        : null,
    };

    const { data, error } = await supabase
      .from('event_inquiries')
      .insert(inquiryData)
      .select()
      .single();

    if (error) throw error;
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
      // First save the inquiry
      const inquiry = await saveInquiry('offer_sent');
      
      // TODO: Trigger email sending via edge function
      // For now, we just save and redirect to the editor where email can be composed
      
      toast.success(`Anfrage gespeichert! Weiterleitung zum Angebots-Editor...`);
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
            <h1 className="text-2xl font-serif font-semibold">Manuelle Anfrage erfassen</h1>
            <p className="text-sm text-muted-foreground">
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
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};
