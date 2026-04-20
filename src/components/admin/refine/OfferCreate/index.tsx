import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Send, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "../AdminLayout";
import { ContactDataCard } from "./ContactDataCard";
import { EventDetailsCard } from "./EventDetailsCard";
import { AISuggestionsCard } from "./AISuggestionsCard";
import { OfferBuilder } from "../InquiryEditor/OfferBuilder";
import type { OfferBuilderHandle } from "../InquiryEditor/OfferBuilder";
import { OfferSendPreview } from "../InquiryEditor/OfferSendPreview";
import { DraftFormData, ParsedInquiry, SuggestedPackage, SuggestedItem } from "./types";
import type { ExtendedInquiry, Package, EmailTemplate } from "../InquiryEditor/types";
import { useRegisterSaveStatus, type SaveStatus } from "@/components/admin/shared/SaveStatusContext";

// ─── Email Safety ──────────────────────────────────────────────────────────────
// Test emails are NEVER sent to real customers — only to system users
const SYSTEM_EMAILS = [
  "antoine@monot.com",
  "info@ristorantestoria.de",
  "info@events-storia.de",
];
const TEST_REDIRECT_EMAIL = "antoine@monot.com";

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Eingang", icon: FileText },
  { id: 2, label: "Kontakt & Event", icon: PenLine },
  { id: 3, label: "Angebot", icon: Sparkles },
  { id: 4, label: "Prüfen & Senden", icon: Send },
] as const;

// ─── Initial form data ───────────────────────────────────────────────────────

const initialFormData: DraftFormData = {
  contact_name: "",
  company_name: "",
  email: "",
  phone: "",
  preferred_date: "",
  event_end_date: "",
  preferred_time: "",
  guest_count: "",
  event_type: "",
  message: "",
  selected_packages: [],
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const ProgressBar = ({ currentStep }: { currentStep: number }) => (
  <div className="space-y-2">
    {/* Bar segments */}
    <div className="flex gap-1">
      {STEPS.map((s) => (
        <div
          key={s.id}
          className={cn(
            "flex-1 h-1.5 rounded-full transition-colors duration-300",
            s.id <= currentStep ? "bg-amber-500" : "bg-muted"
          )}
        />
      ))}
    </div>
    {/* Step labels — visible on desktop, hidden on mobile */}
    <div className="hidden sm:flex justify-between">
      {STEPS.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium transition-colors",
              s.id <= currentStep ? "text-amber-700" : "text-muted-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
            {s.label}
          </div>
        );
      })}
    </div>
    {/* Mobile: only current step */}
    <div className="sm:hidden flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700">
      {(() => { const S = STEPS[currentStep - 1]; const Icon = S.icon; return <><Icon className="h-3 w-3" /> Schritt {S.id}: {S.label}</>; })()}
    </div>
  </div>
);

// ─── Step 1: Eingang ──────────────────────────────────────────────────────────

interface Step1Props {
  rawText: string;
  onRawTextChange: (text: string) => void;
  onExtract: () => void;
  isExtracting: boolean;
  onSkipToManual: () => void;
  isTest: boolean;
  onIsTestChange: (v: boolean) => void;
}

const Step1Eingang = ({ rawText, onRawTextChange, onExtract, isExtracting, onSkipToManual, isTest, onIsTestChange }: Step1Props) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Kunden-E-Mail einfügen</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Füge die E-Mail oder Anfrage ein — die KI extrahiert automatisch alle relevanten Daten.
      </p>
    </div>

    {/* Test-Mode Toggle */}
    <button
      type="button"
      onClick={() => onIsTestChange(!isTest)}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-sm transition-colors",
        isTest
          ? "bg-amber-50 border-amber-300 text-amber-800"
          : "bg-transparent border-neutral-200 text-neutral-500 hover:border-neutral-300"
      )}
    >
      <div className={cn(
        "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
        isTest ? "bg-amber-500 border-amber-500" : "border-neutral-300"
      )}>
        {isTest && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
      </div>
      <span className="font-medium">Testbestellung</span>
      {isTest && <span className="text-xs text-amber-600 ml-auto">E-Mails gehen nur an System-User</span>}
    </button>

    <Textarea
      placeholder={`Kunden-E-Mail hier einfügen...

z.B. "Sehr geehrtes STORIA-Team,
wir möchten am 15. März mit ca. 40 Personen
unser Firmenjubiläum bei Ihnen feiern..."`}
      value={rawText}
      onChange={(e) => onRawTextChange(e.target.value)}
      className="min-h-[200px] sm:min-h-[280px] resize-none text-sm"
    />

    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        onClick={onExtract}
        disabled={!rawText.trim() || isExtracting}
        size="lg"
        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
      >
        {isExtracting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysiere...</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-2" /> Daten extrahieren</>
        )}
      </Button>
      <Button
        variant="ghost"
        size="lg"
        onClick={onSkipToManual}
        className="text-muted-foreground"
      >
        <PenLine className="h-4 w-4 mr-2" />
        Manuell eingeben
      </Button>
    </div>
  </div>
);

// ─── Step 2: Kontakt & Event ──────────────────────────────────────────────────

interface Step2Props {
  formData: DraftFormData;
  onFormChange: (updates: Partial<DraftFormData>) => void;
  suggestions: SuggestedPackage[];
  suggestedItems: SuggestedItem[];
  hasExtracted: boolean;
  aiSummary: string;
}

const Step2KontaktEvent = ({ formData, onFormChange, suggestions, suggestedItems, hasExtracted, aiSummary }: Step2Props) => {
  const addedPackageNames = formData.selected_packages.map(p => p.name);

  return (
    <div className="space-y-4">
      {/* AI Summary banner */}
      {hasExtracted && aiSummary && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-900 leading-relaxed">{aiSummary}</p>
          </div>
        </div>
      )}

      <ContactDataCard
        contactName={formData.contact_name}
        companyName={formData.company_name}
        email={formData.email}
        phone={formData.phone}
        onContactNameChange={(v) => onFormChange({ contact_name: v })}
        onCompanyNameChange={(v) => onFormChange({ company_name: v })}
        onEmailChange={(v) => onFormChange({ email: v })}
        onPhoneChange={(v) => onFormChange({ phone: v })}
      />

      <EventDetailsCard
        preferredDate={formData.preferred_date}
        eventEndDate={formData.event_end_date}
        preferredTime={formData.preferred_time}
        guestCount={formData.guest_count}
        eventType={formData.event_type}
        onPreferredDateChange={(v) => onFormChange({ preferred_date: v })}
        onEventEndDateChange={(v) => onFormChange({ event_end_date: v })}
        onPreferredTimeChange={(v) => onFormChange({ preferred_time: v })}
        onGuestCountChange={(v) => onFormChange({ guest_count: v })}
        onEventTypeChange={(v) => onFormChange({ event_type: v })}
      />

      {hasExtracted && (
        <AISuggestionsCard
          suggestions={suggestions}
          suggestedItems={suggestedItems}
          addedPackages={addedPackageNames}
          onAddPackage={(name) => {
            if (!addedPackageNames.includes(name)) {
              onFormChange({
                selected_packages: [
                  ...formData.selected_packages,
                  { id: `suggested-${Date.now()}`, name, price: 0 }
                ]
              });
            }
          }}
          onSearch={() => {}}
        />
      )}
    </div>
  );
};

// ─── Step 4: Prüfen & Senden ──────────────────────────────────────────────────
// Step 4 nutzt komplett die zentrale OfferSendPreview-Komponente
// (gleiche WYSIWYG-Vorschau wie auf der Edit-Seite). Kein eigener Send-Code mehr.

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdminOfferCreate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState("");
  const [formData, setFormData] = useState<DraftFormData>(initialFormData);
  const [suggestions, setSuggestions] = useState<SuggestedPackage[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<SuggestedItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const offerBuilderRef = useRef<OfferBuilderHandle>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailDraftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Draft inquiry created on mount
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
          status: "new",
          offer_phase: "draft",
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
      setTemplates((data || []) as unknown as EmailTemplate[]);
    };

    createDraft();
    fetchPackages();
    fetchTemplates();
  }, []);

  const hydrateEmailDraftFromDb = useCallback(async () => {
    if (!draftInquiryId) return;

    const { data, error } = await supabase
      .from('event_inquiries')
      .select('email_draft')
      .eq('id', draftInquiryId)
      .maybeSingle();

    if (error) {
      console.error('[OfferCreate] email_draft hydration error:', error);
      return;
    }

    setEmailContent(typeof data?.email_draft === 'string' ? data.email_draft : '');
  }, [draftInquiryId]);

  const persistEmailDraft = useCallback(async (content: string) => {
    if (!draftInquiryId) return;

    const { error } = await supabase
      .from('event_inquiries')
      .update({ email_draft: content || null })
      .eq('id', draftInquiryId);

    if (error) {
      console.error('[OfferCreate] email_draft persist error:', error);
    }
  }, [draftInquiryId]);

  const flushEmailDraftSave = useCallback(async () => {
    if (emailDraftSaveTimeoutRef.current) {
      clearTimeout(emailDraftSaveTimeoutRef.current);
      emailDraftSaveTimeoutRef.current = null;
    }

    await persistEmailDraft(emailContent);
  }, [emailContent, persistEmailDraft]);

  const handleEmailContentChange = useCallback((content: string) => {
    setEmailContent(content);

    if (!draftInquiryId) return;

    if (emailDraftSaveTimeoutRef.current) {
      clearTimeout(emailDraftSaveTimeoutRef.current);
    }

    emailDraftSaveTimeoutRef.current = setTimeout(() => {
      void persistEmailDraft(content);
      emailDraftSaveTimeoutRef.current = null;
    }, 400);
  }, [draftInquiryId, persistEmailDraft]);

  useEffect(() => {
    if (step === 3 && draftInquiryId) {
      void hydrateEmailDraftFromDb();
    }
  }, [step, draftInquiryId, hydrateEmailDraftFromDb]);

  useEffect(() => {
    return () => {
      if (emailDraftSaveTimeoutRef.current) {
        clearTimeout(emailDraftSaveTimeoutRef.current);
      }
    };
  }, []);

  // Minimal ExtendedInquiry for OfferBuilder
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
      event_end_date: formData.event_end_date || null,
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
      email_draft: emailContent || null,
      lexoffice_quotation_id: null,
      lexoffice_invoice_id: null,
      lexoffice_document_type: null,
      lexoffice_contact_id: null,
      offer_sent_at: null,
      offer_sent_by: null,
      current_offer_version: null,
      last_edited_by: null,
      last_edited_at: null,
      venue: null,
      location_type: 'storia',
      location_name: null,
      location_street: null,
      location_postal_code: null,
      location_city: null,
      location_country: 'Deutschland',
      company_street: null,
      company_postal_code: null,
      company_city: null,
      company_country: 'Deutschland',
      billing_address_different: false,
      billing_company_name: null,
      billing_street: null,
      billing_postal_code: null,
      billing_city: null,
      billing_country: 'Deutschland',
      deposit_percent: null,
      deposit_due_days: null,
      offer_validity_days: null,
    };
  }, [draftInquiryId, emailContent, formData]);

  const handleFormChange = useCallback((updates: Partial<DraftFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Auto-Save ────────────────────────────────────────────────────────────────
  // Debounced Auto-Save: bei jeder formData-Änderung 800ms warten, dann speichern.
  // Ersetzt den alten Nur speichern (Entwurf)-Button. Status geht über den
  // zentralen SaveStatus-Context an das Badge im Admin-Header.
  const performAutoSave = useCallback(async () => {
    if (!draftInquiryId) return;
    // Nur speichern wenn mindestens ein Feld befüllt ist (sonst leerer Draft-Flush)
    const hasContent = formData.contact_name.trim() || formData.email.trim() || formData.message.trim();
    if (!hasContent) {
      setSaveStatus('idle');
      return;
    }
    setSaveStatus('saving');
    const { error } = await supabase
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
        is_test: isTest || undefined,
      })
      .eq('id', draftInquiryId);
    if (error) {
      console.error('[OfferCreate] Auto-save error:', error);
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [draftInquiryId, formData, isTest]);

  // Cmd+S / Navigation-Flush
  const flushAutoSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    await performAutoSave();
  }, [performAutoSave]);

  // Auto-Save trigger: wenn formData sich ändert, 800ms warten, dann speichern
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (!draftInquiryId) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 800);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [formData, isTest, draftInquiryId, performAutoSave]);

  // Zentralen SaveStatus-Context mit lokalem saveStatus synchronisieren
  useRegisterSaveStatus('offer-create', saveStatus, flushAutoSave);

  // ── Extract ──────────────────────────────────────────────────────────────────
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
        event_end_date: parsed.event_end_date || prev.event_end_date,
        preferred_time: parsed.preferred_time || prev.preferred_time,
        guest_count: parsed.guest_count || prev.guest_count,
        event_type: parsed.event_type?.toLowerCase().replace(/\s+/g, '-') || prev.event_type,
        message: parsed.original_message_summary || prev.message,
      }));

      setSuggestions(
        (parsed.suggested_packages || []).map(p => ({
          ...p,
          matched_keywords: p.matched_keywords || [],
        }))
      );
      setSuggestedItems(parsed.suggested_items || []);
      setAiSummary(parsed.original_message_summary || "");
      setHasExtracted(true);
      toast.success("Daten extrahiert!");

      // Auto-advance to step 2
      setStep(2);
    } catch (err) {
      console.error('Extraction error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler bei der Analyse');
      // On error: stay on step 1, don't crash
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const saveInquiry = async (status: 'new' | 'offer_sent') => {
    if (!draftInquiryId) throw new Error('Draft nicht initialisiert');

    const updatePayload: Record<string, unknown> = {
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
      is_test: isTest || undefined,
    };

    const { data, error } = await supabase
      .from('event_inquiries')
      .update(updatePayload)
      .eq('id', draftInquiryId)
      .select()
      .single();

    if (error) {
      console.error("saveInquiry error:", JSON.stringify(error, null, 2));
      throw new Error(error.message || JSON.stringify(error));
    }

    if (status === 'new') supabase.functions.invoke('receive-event-inquiry', {
      body: {
        contactName: formData.contact_name,
        email: isTest ? TEST_REDIRECT_EMAIL : formData.email,
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

    // ALWAYS notify team — regardless of status (auch bei offer_sent)
    if (status === 'offer_sent') {
      supabase.functions.invoke('receive-event-inquiry', {
        body: {
          contactName: formData.contact_name,
          email: isTest ? TEST_REDIRECT_EMAIL : formData.email,
          companyName: formData.company_name || undefined,
          phone: formData.phone || undefined,
          guestCount: formData.guest_count || undefined,
          eventType: formData.event_type || undefined,
          preferredDate: formData.preferred_date || undefined,
          timeSlot: formData.preferred_time || undefined,
          message: `[Angebot erstellt] ${formData.message || ''}`.trim(),
          source: 'manual_entry',
          skipInsert: true,
          existingInquiryId: data.id,
        },
      }).then(res => {
        if (res.error) console.error('Notification error (offer_sent):', res.error);
      });
    }

    return data;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      // Auto-Save ist bereits aktiv. Wir flushen jeden ausstehenden Save
      // und navigieren dann zum vollen Editor — der User will hier vermutlich
      // weiterarbeiten, nicht nur speichern.
      await flushAutoSave();
      // Falls noch kein Status auf new gesetzt ist (z.B. frischer Draft), einmal saveInquiry triggern
      const inquiry = await saveInquiry('new');
      toast.success("Entwurf gespeichert — wechsle zum vollen Editor");
      navigate(`/admin/events/${inquiry.id}/edit`);
    } catch (err) {
      console.error('Save error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = !!(formData.contact_name.trim() && formData.email.trim());

  // Scroll to top on every step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Auto-save when navigating between steps
  const goToStep = useCallback(async (targetStep: number) => {
    // Flush OfferBuilder save before navigating away from Step 3
    if (step === 3) {
      offerBuilderRef.current?.flushSave();
      await flushEmailDraftSave();
    }
    if (draftInquiryId && formData.contact_name.trim()) {
      supabase
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
          is_test: isTest || undefined,
        })
        .eq('id', draftInquiryId)
        .then(({ error }) => {
          if (error) console.error('Auto-save on step change error:', error);
        });
    }
    setStep(targetStep);
  }, [draftInquiryId, flushEmailDraftSave, formData, isTest, step]);

  // Can advance from step 2 only if contact_name is filled
  const canAdvanceFromStep2 = !!formData.contact_name.trim();

  return (
    <AdminLayout activeTab="events">
      <div className="max-w-2xl mx-auto pb-32 sm:pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step > 1 ? goToStep(step - 1) : navigate('/admin/events')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Neue Anfrage</h1>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground flex-shrink-0">
            Entwurf
          </Badge>
          {isTest && (
            <Badge className="text-xs bg-amber-500 text-white flex-shrink-0">
              TEST
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <ProgressBar currentStep={step} />
        </div>

        {/* Step content */}
        <div className="min-h-[60vh]">
          {step === 1 && (
            <Step1Eingang
              rawText={rawText}
              onRawTextChange={setRawText}
              onExtract={handleExtract}
              isExtracting={isExtracting}
              onSkipToManual={() => goToStep(2)}
              isTest={isTest}
              onIsTestChange={setIsTest}
            />
          )}

          {step === 2 && (
            <Step2KontaktEvent
              formData={formData}
              onFormChange={handleFormChange}
              suggestions={suggestions}
              suggestedItems={suggestedItems}
              hasExtracted={hasExtracted}
              aiSummary={aiSummary}
            />
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Angebot erstellen</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Stelle das Menü zusammen oder wähle ein Paket.
                </p>
              </div>
              {draftInquiry ? (
                <OfferBuilder
                  ref={offerBuilderRef}
                  inquiry={draftInquiry}
                  packages={packages}
                  templates={templates}
                  onSave={async () => {}}
                  isCreateMode={true}
                  onEmailContentChange={handleEmailContentChange}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Angebots-Editor wird geladen...</span>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 4 && (
            <>
              {draftInquiryId ? (
                <OfferSendPreview
                  inquiryId={draftInquiryId}
                  onBack={() => goToStep(3)}
                  onAfterSend={(inquiryId, query) => {
                    // Wizard-Versand → Edit-Seite mit confirmed-Trigger,
                    // gleicher Pfad wie aus dem Edit-Flow
                    navigate(`/admin/events/${inquiryId}/edit?${query}`);
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Vorschau wird geladen...</span>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Sticky bottom navigation — Step 2 + 3 (Step 1 hat eigene Action-Buttons, Step 4 hat OfferSendPreview-Buttons) */}
        {step > 1 && step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 backdrop-blur-sm border-t border-border px-4 py-3 z-30" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => goToStep(step - 1)}
                  className="h-12 sm:h-11 px-4"
                >
                  <ArrowLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Zurück</span>
                </Button>
              )}
              <div className="flex-1" />
              {step === 3 && (
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={!canSave || isSaving}
                  className="h-12 sm:h-11 px-4"
                  title="Inquiry als Entwurf speichern und zum vollen Editor wechseln (kein Versand)"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">Nur als Entwurf</span>
                </Button>
              )}
              <Button
                onClick={() => goToStep(step + 1)}
                disabled={(step === 2 && !canAdvanceFromStep2) || (step === 3 && !canSave)}
                className="h-12 sm:h-11 px-8 bg-amber-600 hover:bg-amber-700 text-white text-base sm:text-sm"
              >
                {step === 3 ? (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    Vorschau & Senden
                  </>
                ) : (
                  <>
                    Weiter
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
