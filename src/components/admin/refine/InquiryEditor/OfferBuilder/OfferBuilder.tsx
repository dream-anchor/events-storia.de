import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Loader2, Plus, Clock, ChevronDown, Mail, ExternalLink, UtensilsCrossed, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useOfferBuilder } from "./useOfferBuilder";
import { ModeSelector } from "./ModeSelector";
import { OptionCardGrid } from "./OptionCardGrid";
import { EmailComposer } from "./EmailComposer";
import { SendControls } from "./SendControls";
import { CustomerFeedbackBanner } from "./CustomerFeedbackBanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OfferMode, ExtendedInquiry, Package, EmailTemplate, OfferHistoryEntry, OfferBuilderOption } from "./types";
import { OPTION_LABELS, createEmptyOption } from "./types";

export interface OfferBuilderHandle {
  /** Scrollt zum E-Mail-Composer und öffnet ihn; generiert optional KI-Text */
  scrollToEmail: (withGeneration?: boolean) => void;
  /** Entsperrt den OfferBuilder für eine neue Angebotsversion */
  triggerNewVersion: () => void;
  /** Sofort speichern — vor Navigation/Unmount aufrufen */
  flushSave: () => void;
}

interface OfferBuilderProps {
  inquiry: ExtendedInquiry;
  packages: Package[];
  templates: EmailTemplate[];
  onSave: () => Promise<void>;
  /** Create-Seite: SendControls ausblenden, da eigene Buttons vorhanden */
  isCreateMode?: boolean;
  /** Callback wenn E-Mail-Text geändert wird (für Create-Modus) */
  onEmailContentChange?: (content: string) => void;
}

export const OfferBuilder = forwardRef<OfferBuilderHandle, OfferBuilderProps>(function OfferBuilder({
  inquiry,
  packages,
  templates,
  onSave,
  isCreateMode = false,
  onEmailContentChange,
}: OfferBuilderProps, ref) {
  const guestCount = parseInt(inquiry.guest_count || "1") || 1;
  const selectedPackages = Array.isArray(inquiry.selected_packages)
    ? inquiry.selected_packages
    : [];

  const builder = useOfferBuilder({
    inquiryId: inquiry.id,
    guestCount,
    selectedPackages,
    inquiry,
    packages,
  });

  // --- Modus: abgeleitet aus Options (Single Source of Truth) ---
  // modeOverride wird nur gesetzt, wenn der User explizit klickt (z.B. 'email')
  const [modeOverride, setModeOverride] = useState<OfferMode | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [menuImporterOpen, setMenuImporterOpen] = useState(false);

  const defaultMode: OfferMode = useMemo(() => {
    const raw = modeOverride
      ?? (builder.options.length > 0 ? builder.options[0].offerMode : null)
      ?? (selectedPackages.length > 0 ? 'paket' : 'menu');
    return raw;
  }, [modeOverride, builder.options, selectedPackages.length]);

  // ModeSelector-Wechsel propagiert an alle bestehenden Optionen
  const handleModeChange = useCallback((mode: OfferMode) => {
    setModeOverride(mode);
    if (mode !== 'email') {
      builder.setOptions(prev => prev.map(opt => {
        if (opt.offerMode === mode) return opt;
        return {
          ...opt,
          offerMode: mode,
          ...(mode === 'paket' ? {
            menuSelection: { courses: [], drinks: [] },
            budgetPerPerson: null,
          } : {
            packageId: null,
            packageName: '',
          }),
        };
      }));
    }
  }, [builder.setOptions]);

  // --- Mehrere Restaurant-Menüs als neue Optionen anlegen ---
  const handleImportMultiple = useCallback((partials: Partial<OfferBuilderOption>[]) => {
    builder.importOptions(partials);
    toast.success(
      partials.length > 1
        ? `${partials.length} Menüs importiert`
        : 'Menü als Option angelegt'
    );
  }, [builder.importOptions]);

  // --- E-Mail Draft (lokal, nicht im Hook) ---
  const [emailDraft, setEmailDraft] = useState(inquiry.email_draft || "");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  const handleEmailDraftChange = useCallback((content: string) => {
    setEmailDraft(content);
    onEmailContentChange?.(content);
  }, [onEmailContentChange]);

  // E-Mail-Sektion: eingeklappt wenn noch kein Draft vorhanden
  const [emailSectionOpen, setEmailSectionOpen] = useState(!!inquiry.email_draft);
  const emailSectionRef = useRef<HTMLDivElement>(null);

  // Auto-open email section when email mode is selected
  useEffect(() => {
    if (defaultMode === 'email' && !emailSectionOpen) {
      setEmailSectionOpen(true);
    }
  }, [defaultMode]);

  // --- E-Mail generieren via Edge Function ---
  const handleGenerateEmail = useCallback(async () => {
    setIsGeneratingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-inquiry-email",
        {
          body: {
            inquiryId: inquiry.id,
            phase: builder.offerPhase === "draft" || builder.offerPhase === "proposal_sent"
              ? "proposal"
              : "final",
          },
        }
      );

      if (error) throw error;
      if (data?.email) {
        handleEmailDraftChange(data.email);
        toast.success("E-Mail generiert");
      }
    } catch (err) {
      console.error("Email generation error:", err);
      toast.error("Fehler beim Generieren der E-Mail");
    } finally {
      setIsGeneratingEmail(false);
    }
  }, [inquiry.id, builder.offerPhase]);

  // --- Neue Version erstellen ---
  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    await builder.unlockForNewVersion();
    setIsUnlocking(false);
  }, [builder.unlockForNewVersion]);

  // --- Exponierten Handle für Parent (SmartInquiryEditor) ---
  useImperativeHandle(ref, () => ({
    scrollToEmail: (withGeneration = true) => {
      setEmailSectionOpen(true);
      if (withGeneration && builder.activeOptions.length > 0) {
        handleGenerateEmail();
      }
      setTimeout(() => {
        emailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    },
    triggerNewVersion: () => {
      handleUnlock();
    },
    flushSave: () => {
      builder.flushSave();
    },
  }));

  // --- Loading ---
  if (builder.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Locked-Banner — Angebot wurde versendet */}
      {builder.isLocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800/40 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Angebot versendet (Version {builder.currentVersion})
                </span>
              </div>
              {inquiry.offer_sent_at && (
                <p className="text-xs text-amber-600/70 dark:text-amber-400/60 ml-4">
                  Gesendet am {format(parseISO(inquiry.offer_sent_at), "d. MMM yyyy 'um' HH:mm", { locale: de })}
                  {inquiry.offer_sent_by && ` von ${inquiry.offer_sent_by}`}
                </p>
              )}
            </div>
            <Button
              onClick={handleUnlock}
              disabled={isUnlocking}
              variant="outline"
              className="gap-2 rounded-xl border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950 shrink-0"
            >
              {isUnlocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Neues Angebot erstellen
            </Button>
          </div>
        </div>
      )}

      {/* Header — Save-Fehler nur bei Problemen anzeigen */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">
          Angebot konfigurieren
          {builder.currentVersion > 1 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Version {builder.currentVersion})
            </span>
          )}
        </h2>
      </div>

      {/* 1. Modus-Auswahl */}
      <ModeSelector
        selectedMode={defaultMode}
        onSelect={handleModeChange}
        onRequestImport={() => setMenuImporterOpen(true)}
        hasImportedMenu={builder.options.some(o => o.packageName && o.packageName.length > 0)}
        disabled={builder.isLocked}
      />

      {/* 2. Kunden-Feedback Banner (nur nach Antwort) */}
      {builder.offerPhase === "customer_responded" && builder.customerResponse && (
        <CustomerFeedbackBanner
          response={builder.customerResponse}
          options={builder.options}
        />
      )}

      {/* 3. Options-Grid (nur bei Menü/Paket — E-Mail zeigt nur den Composer) */}
      {defaultMode !== 'email' && (
        <OptionCardGrid
          options={builder.options}
          packages={packages}
          menuItems={builder.menuItems}
          packageConfigs={builder.packageConfigs}
          onUpdateOption={builder.updateOption}
          onRemoveOption={builder.removeOption}
          onToggleActive={builder.toggleOptionActive}
          onAddOption={builder.addOption}
          onImportMultiple={handleImportMultiple}
          defaultMode={defaultMode}
          isLocked={builder.isLocked}
          currentVersion={builder.currentVersion}
          guestCount={guestCount}
          menuImporterOpen={menuImporterOpen}
          onMenuImporterOpenChange={setMenuImporterOpen}
        />
      )}

      {/* 4. "Weiter zur E-Mail" Button — bei Menü/Paket, wenn E-Mail-Sektion noch zu */}
      {!emailSectionOpen && defaultMode !== 'email' && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            onClick={() => {
              setEmailSectionOpen(true);
              if (builder.activeOptions.length > 0) {
                handleGenerateEmail();
              }
              setTimeout(() => {
                emailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl h-12 text-base gap-2"
          >
            <Mail className="h-5 w-5" />
            Anschreiben erstellen
            <ArrowRight className="h-4 w-4" />
          </Button>
          <button
            onClick={() => {
              setEmailSectionOpen(true);
              setTimeout(() => {
                emailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Direkt E-Mail schreiben (ohne Konfiguration)
          </button>
        </div>
      )}

      {/* 4. E-Mail Composer — eingeklappt bis "Weiter" geklickt */}
      <div ref={emailSectionRef}>
        {emailSectionOpen && (
          <EmailComposer
            emailDraft={emailDraft}
            onChange={handleEmailDraftChange}
            templates={templates}
            isGenerating={isGeneratingEmail}
            onGenerate={handleGenerateEmail}
            activeOptionsCount={builder.activeOptions.length}
            customerName={inquiry.contact_name}
            eventDate={inquiry.preferred_date || undefined}
            guestCount={inquiry.guest_count || undefined}
            companyName={inquiry.company_name || undefined}
            eventType={inquiry.event_type || undefined}
            roomSelection={inquiry.room_selection || undefined}
            timeSlot={inquiry.time_slot || undefined}
            activeOptions={builder.activeOptions}
            menuItems={builder.menuItems}
            isLocked={builder.isLocked}
          />
        )}
      </div>

      {/* 5. Send Controls — nicht auf der Create-Seite (eigene Buttons im DraftPanel) */}
      {!isCreateMode && <SendControls
        offerPhase={builder.offerPhase}
        emailDraft={emailDraft}
        activeOptionsCount={defaultMode === 'email' ? 1 : builder.activeOptions.length}
        isSending={builder.isSaving}
        onSendProposal={builder.sendProposal}
        onSendFinalOffer={builder.sendFinalOffer}
        hasHistory={builder.history.length > 0}
      />}

      {/* Versionshistorie entfernt — wird in Timeline & Aktivitäten angezeigt */}
    </div>
  );
});
