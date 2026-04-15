import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Send, FileText, PenLine, CheckCircle2, AlertCircle } from "lucide-react";
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
import { DraftFormData, ParsedInquiry, SuggestedPackage, SuggestedItem } from "./types";
import type { ExtendedInquiry, Package, EmailTemplate } from "../InquiryEditor/types";

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

interface Step4Props {
  formData: DraftFormData;
  onFormChange: (updates: Partial<DraftFormData>) => void;
  onSaveAndSend: () => void;
  onSaveDraft: () => void;
  isSaving: boolean;
  isSending: boolean;
  canSave: boolean;
  draftInquiry: ExtendedInquiry | null;
  emailContent: string;
  isTest: boolean;
  onGoToStep: (step: number) => void;
}

const Step4Review = ({ formData, onFormChange, onSaveAndSend, onSaveDraft, isSaving, isSending, canSave, draftInquiry, emailContent, isTest, onGoToStep }: Step4Props) => (
  <div className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold">Zusammenfassung</h2>
      <p className="text-sm text-muted-foreground mt-1">Prüfe die Daten und sende das Angebot.</p>
    </div>

    {/* Test warning */}
    {isTest && (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Testbestellung — E-Mails gehen an <span className="font-medium">{TEST_REDIRECT_EMAIL}</span>
        </p>
      </div>
    )}

    {/* Summary card */}
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Kontakt</span>
            <p className="font-medium">{formData.contact_name || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Firma</span>
            <p className="font-medium">{formData.company_name || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">E-Mail</span>
            <p className="font-medium truncate">{formData.email || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Telefon</span>
            <p className="font-medium">{formData.phone || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Datum</span>
            <p className="font-medium">
              {formData.preferred_date || "—"}
              {formData.event_end_date ? ` – ${formData.event_end_date}` : ""}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Uhrzeit</span>
            <p className="font-medium">{formData.preferred_time || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Gäste</span>
            <p className="font-medium">{formData.guest_count || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Event-Art</span>
            <p className="font-medium">{formData.event_type || "—"}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Email draft preview */}
    {emailContent ? (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Anschreiben</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-amber-700" onClick={() => onGoToStep(3)}>
              Bearbeiten
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-neutral-50 rounded-lg p-3 max-h-40 overflow-y-auto">
            {emailContent.slice(0, 500)}{emailContent.length > 500 ? '…' : ''}
          </div>
        </CardContent>
      </Card>
    ) : (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Kein Anschreiben erstellt</p>
          <Button variant="outline" size="sm" onClick={() => onGoToStep(3)} className="text-xs">
            Zurück zum Angebot um Anschreiben zu erstellen
          </Button>
        </CardContent>
      </Card>
    )}

    {/* Notes */}
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Notizen / Kundenwünsche</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Besondere Wünsche, Anmerkungen des Kunden..."
          value={formData.message}
          onChange={(e) => onFormChange({ message: e.target.value })}
          className="min-h-[80px]"
        />
      </CardContent>
    </Card>

    {/* Validation warnings */}
    {!canSave && (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
        <p className="text-sm text-destructive">
          {!formData.contact_name?.trim() && "Kontaktname fehlt. "}
          {!formData.email?.trim() && "E-Mail-Adresse fehlt."}
        </p>
      </div>
    )}

    {/* Autosave indicator */}
    {draftInquiry && (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        Angebot wird automatisch gespeichert
      </div>
    )}

    {/* Action buttons — mobile-optimized */}
    <div className="flex flex-col gap-3 pt-2">
      <Button
        onClick={onSaveAndSend}
        disabled={!canSave || isSaving || isSending || !draftInquiry}
        size="lg"
        className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white text-base"
      >
        {isSending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sende...</>
        ) : (
          <><Send className="h-4 w-4 mr-2" /> Speichern & Senden</>
        )}
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={onSaveDraft}
        disabled={!canSave || isSaving || isSending}
        className="w-full h-12"
      >
        {isSaving ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Speichert...</>
        ) : (
          "Nur speichern (Entwurf)"
        )}
      </Button>
      <Button
        variant="ghost"
        onClick={() => onGoToStep(3)}
        className="w-full h-11 text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Zurück zum Angebot
      </Button>
    </div>
  </div>
);

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
  const [isSending, setIsSending] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [emailContent, setEmailContent] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [isTest, setIsTest] = useState(false);

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
      setTemplates((data || []) as unknown as EmailTemplate[]);
    };

    createDraft();
    fetchPackages();
    fetchTemplates();
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
      const inquiry = await saveInquiry('offer_sent');

      let lexofficeQuotationId: string | null = null;
      const { data: lexData, error: lexError } = await supabase.functions.invoke(
        'create-event-quotation',
        { body: { inquiryId: inquiry.id } },
      );
      if (lexError || !lexData?.success) {
        const msg = lexData?.error || lexError?.message || 'Unbekannter Fehler';
        console.error('[LexOffice] Quotation error:', msg);
        toast.warning(`LexOffice-Angebot fehlgeschlagen: ${msg}`);
      } else if (lexData?.quotationId) {
        lexofficeQuotationId = lexData.quotationId;
        await supabase
          .from('event_inquiries')
          .update({ lexoffice_quotation_id: lexofficeQuotationId })
          .eq('id', inquiry.id);
      }

      if (formData.email && emailContent) {
        // EMAIL SAFETY: Test orders NEVER reach real customers
        const safeEmail = isTest ? TEST_REDIRECT_EMAIL : formData.email;
        if (isTest) {
          console.log(`[TEST MODE] Email redirected: ${formData.email} → ${safeEmail}`);
        }

        const { data: { user } } = await supabase.auth.getUser();
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-offer-email',
          {
            body: {
              inquiryId: inquiry.id,
              emailContent: isTest ? `[TEST] ${emailContent}` : emailContent,
              customerEmail: safeEmail,
              customerName: formData.contact_name,
              senderEmail: user?.email,
              lexofficeQuotationId,
            },
          },
        );
        if (emailError || !emailResult?.emailSent) {
          toast.warning('Anfrage gespeichert, aber E-Mail konnte nicht versendet werden');
        } else {
          const pdfHint = emailResult.hasPdfAttachment ? ' (mit PDF-Anhang)' : '';
          if (emailResult.warnings?.length) {
            toast.warning(`E-Mail gesendet${pdfHint} — ${emailResult.warnings.join(', ')}`);
          } else {
            toast.success(`Angebot gespeichert & E-Mail versendet${pdfHint}`);
          }
        }
      } else if (!emailContent) {
        toast.success('Angebot gespeichert — kein Anschreiben vorhanden, E-Mail nicht versendet');
      } else {
        toast.success('Angebot gespeichert');
      }

      navigate(`/admin/events/${inquiry.id}/edit`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('Save and send error:', msg, err);
      toast.error(`Fehler: ${msg}`);
    } finally {
      setIsSending(false);
    }
  };

  const canSave = !!(formData.contact_name.trim() && formData.email.trim());

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
            onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/admin/events')}
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
              onSkipToManual={() => setStep(2)}
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
                  inquiry={draftInquiry}
                  packages={packages}
                  templates={templates}
                  onSave={async () => {}}
                  isCreateMode={true}
                  onEmailContentChange={setEmailContent}
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
            <Step4Review
              formData={formData}
              onFormChange={handleFormChange}
              onSaveAndSend={handleSaveAndSend}
              onSaveDraft={handleSaveDraft}
              isSaving={isSaving}
              isSending={isSending}
              canSave={canSave}
              draftInquiry={draftInquiry}
              emailContent={emailContent}
              isTest={isTest}
              onGoToStep={setStep}
            />
          )}
        </div>

        {/* Sticky bottom navigation — not shown on step 4 (has its own buttons) */}
        {step < 4 && (
          <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 backdrop-blur-sm border-t border-border px-4 py-3 z-30" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(s => s - 1)}
                  className="h-12 sm:h-11 px-4"
                >
                  <ArrowLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Zurück</span>
                </Button>
              )}
              <div className="flex-1" />
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 2 && !canAdvanceFromStep2}
                className="h-12 sm:h-11 px-8 bg-amber-600 hover:bg-amber-700 text-white text-base sm:text-sm"
              >
                Weiter
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
