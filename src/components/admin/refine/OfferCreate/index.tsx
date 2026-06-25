import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, FileText, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/typed-client";
import { AdminLayout } from "../AdminLayout";
import { ContactDataCard } from "./ContactDataCard";
import { EventDetailsCard } from "./EventDetailsCard";
import { AISuggestionsCard } from "./AISuggestionsCard";
import { DraftFormData, ParsedInquiry, SuggestedPackage, SuggestedItem } from "./types";
import { useRegisterSaveStatus, type SaveStatus } from "@/components/admin/shared/SaveStatusContext";

// ─── Email Safety ──────────────────────────────────────────────────────────────
const TEST_REDIRECT_EMAIL = "antoine@monot.com";

// ─── Date Sanitizer ───────────────────────────────────────────────────────────
// KI/Parser können Strings wie "Nicht angegeben" oder "TBD" zurückgeben, die
// Postgres' date-Spalte mit "invalid input syntax for type date" ablehnen.
// Nur echte ISO YYYY-MM-DD durchlassen, sonst null.
const sanitizeDate = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
};

// ─── Steps ────────────────────────────────────────────────────────────────────
// Wizard ist auf 2 Schritte reduziert: Eingang + Kontakt/Event-Details.
// Angebotskonfiguration, E-Mail-Entwurf, Zahlungsbedingungen, Versand laufen
// alle auf der vollen Edit-Seite (/admin/inquiries/:id/edit), nicht hier.
const STEPS = [
  { id: 1, label: "Eingang", icon: FileText },
  { id: 2, label: "Kontakt & Event", icon: PenLine },
] as const;

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

const ProgressBar = ({ currentStep }: { currentStep: number }) => (
  <div className="space-y-2">
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
    <div className="sm:hidden flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700">
      {(() => { const S = STEPS[currentStep - 1]; const Icon = S.icon; return <><Icon className="h-3 w-3" /> Schritt {S.id}: {S.label}</>; })()}
    </div>
  </div>
);

// ─── Step 1 ───────────────────────────────────────────────────────────────────
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

// ─── Step 2 ───────────────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────

export const AdminOfferCreate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [rawText, setRawText] = useState("");
  const [formData, setFormData] = useState<DraftFormData>(initialFormData);
  const [suggestions, setSuggestions] = useState<SuggestedPackage[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<SuggestedItem[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);
  const savedToIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCreatingDraftRef = useRef(false);

  const [draftInquiryId, setDraftInquiryId] = useState<string | null>(null);

  // B1-Fix: Draft NICHT mehr beim Mount erzeugen — erst wenn der User Inhalte
  // eingibt (Lazy-Create im Auto-Save). Verhindert "Empty-Draft-Leak" wenn
  // der User die Seite öffnet und sofort wieder schließt.
  const ensureDraft = useCallback(async (): Promise<string | null> => {
    if (draftInquiryId) return draftInquiryId;
    if (isCreatingDraftRef.current) return null;
    isCreatingDraftRef.current = true;
    try {
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
        return null;
      }
      setDraftInquiryId(data.id);
      return data.id;
    } finally {
      isCreatingDraftRef.current = false;
    }
  }, [draftInquiryId]);

  // Cleanup: beim Unmount alle Timeouts killen — kein "state update on unmounted"
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (savedToIdleTimeoutRef.current) clearTimeout(savedToIdleTimeoutRef.current);
    };
  }, []);

  const handleFormChange = useCallback((updates: Partial<DraftFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // ── Auto-Save ────────────────────────────────────────────────────────────────
  const performAutoSave = useCallback(async () => {
    const hasContent = formData.contact_name.trim() || formData.email.trim() || formData.message.trim();
    if (!hasContent) {
      setSaveStatus('idle');
      return;
    }
    // B1-Fix: Draft erst hier (lazy) anlegen — sobald wirklich Inhalte da sind.
    const id = await ensureDraft();
    if (!id) return;
    setSaveStatus('saving');
    const { error } = await supabase
      .from('event_inquiries')
      .update({
        contact_name: formData.contact_name,
        company_name: formData.company_name || null,
        email: formData.email,
        phone: formData.phone || null,
        preferred_date: formData.preferred_date || null,
        // B2-Fix: event_end_date war im Auto-Save vergessen — bei mehrtägigen
        // Events ging das End-Datum verloren wenn der User vor Step 2 schließt.
        event_end_date: formData.event_end_date || null,
        time_slot: formData.preferred_time || null,
        guest_count: formData.guest_count || null,
        event_type: formData.event_type || null,
        message: formData.message || null,
        is_test: isTest || undefined,
      })
      .eq('id', id);
    if (error) {
      console.error('[OfferCreate] Auto-save error:', error);
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      // B3-Fix: Timeout in Ref tracken, damit Cleanup beim Unmount funktioniert.
      if (savedToIdleTimeoutRef.current) clearTimeout(savedToIdleTimeoutRef.current);
      savedToIdleTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [ensureDraft, formData, isTest]);

  const flushAutoSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    await performAutoSave();
  }, [performAutoSave]);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 800);
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [formData, isTest, performAutoSave]);

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

      setStep(2);
    } catch (err) {
      console.error('Extraction error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler bei der Analyse');
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Hand-off zur vollen Edit-Seite ───────────────────────────────────────────
  // Persistiert die Inquiry final mit status=new/offer_phase=draft, feuert die
  // Team-Notification (wie früher saveInquiry('new')) und navigiert.
  const handHandoffToEditor = async () => {
    if (!draftInquiryId) {
      toast.error('Draft nicht initialisiert');
      return;
    }
    if (!formData.contact_name.trim() || !formData.email.trim()) {
      toast.error('Kontaktname und E-Mail werden benötigt');
      return;
    }

    setIsHandingOff(true);
    try {
      await flushAutoSave();

      const { data, error } = await supabase
        .from('event_inquiries')
        .update({
          contact_name: formData.contact_name,
          company_name: formData.company_name || null,
          email: formData.email,
          phone: formData.phone || null,
          preferred_date: formData.preferred_date || null,
          event_end_date: formData.event_end_date || null,
          time_slot: formData.preferred_time || null,
          guest_count: formData.guest_count || null,
          event_type: formData.event_type || null,
          message: formData.message || null,
          status: 'new',
          offer_phase: 'draft',
          is_test: isTest || undefined,
        })
        .eq('id', draftInquiryId)
        .select()
        .single();

      if (error) {
        console.error('[OfferCreate] Handoff update error:', error);
        throw new Error(error.message || 'Speichern fehlgeschlagen');
      }

      // Team-Notification (asynchron, blockiert Navigation nicht)
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
          message: formData.message || undefined,
          source: 'manual_entry',
          skipInsert: true,
          existingInquiryId: data.id,
        },
      }).then((res: any) => {
        if (res.error) console.error('Notification error:', res.error);
      });

      toast.success('Anfrage angelegt — wechsle zur Angebotskonfiguration');
      navigate(`/admin/inquiries/${data.id}/edit`);
    } catch (err) {
      console.error('Handoff error:', err);
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setIsHandingOff(false);
    }
  };

  const canAdvanceFromStep2 = !!formData.contact_name.trim() && !!formData.email.trim();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  return (
    <AdminLayout activeTab="events">
      <div className="max-w-2xl mx-auto pb-32 sm:pb-24">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/admin/inquiries')}
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

        <div className="mb-6">
          <ProgressBar currentStep={step} />
        </div>

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
        </div>

        {/* Sticky bottom: nur Step 2 (Step 1 hat eigene Action-Buttons) */}
        {step === 2 && (
          <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-white/95 backdrop-blur-sm border-t border-border px-4 py-3 z-30" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            <div className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-12 sm:h-11 px-4"
                disabled={isHandingOff}
              >
                <ArrowLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Zurück</span>
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handHandoffToEditor}
                disabled={!canAdvanceFromStep2 || isHandingOff}
                className="h-12 sm:h-11 px-6 bg-amber-600 hover:bg-amber-700 text-white text-base sm:text-sm"
              >
                {isHandingOff ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Lege an...</>
                ) : (
                  <>
                    Zur Angebotskonfiguration
                    <ArrowRight className="h-4 w-4 ml-1.5" />
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
