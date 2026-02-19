import { useState, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOfferBuilder } from "./useOfferBuilder";
import { ModeSelector } from "./ModeSelector";
import { OptionCardGrid } from "./OptionCardGrid";
import { EmailComposer } from "./EmailComposer";
import { SendControls } from "./SendControls";
import { CustomerFeedbackBanner } from "./CustomerFeedbackBanner";
import type { OfferMode, ExtendedInquiry, Package, EmailTemplate } from "./types";

interface OfferBuilderProps {
  inquiry: ExtendedInquiry;
  packages: Package[];
  templates: EmailTemplate[];
  onSave: () => Promise<void>;
}

export function OfferBuilder({
  inquiry,
  packages,
  templates,
  onSave,
}: OfferBuilderProps) {
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

  // --- Default-Modus für neue Optionen ---
  const [defaultMode, setDefaultMode] = useState<OfferMode>("fest_menu");

  // --- E-Mail Draft (lokal, nicht im Hook) ---
  const [emailDraft, setEmailDraft] = useState(inquiry.email_draft || "");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

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
        setEmailDraft(data.email);
        toast.success("E-Mail generiert");
      }
    } catch (err) {
      console.error("Email generation error:", err);
      toast.error("Fehler beim Generieren der E-Mail");
    } finally {
      setIsGeneratingEmail(false);
    }
  }, [inquiry.id, builder.offerPhase]);

  // --- Finalize (nach Kunden-Feedback) ---
  const handleFinalize = useCallback(() => {
    // Scroll zum EmailComposer — Phase wechselt zu final_draft
    toast.info("Bitte finales Angebot zusammenstellen und senden");
  }, []);

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
      {/* Header — Save-Fehler nur bei Problemen anzeigen */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">Angebot konfigurieren</h2>
        {builder.saveStatus === "error" && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            <span>Speichern fehlgeschlagen</span>
          </div>
        )}
      </div>

      {/* 1. Modus-Auswahl */}
      <ModeSelector
        selectedMode={defaultMode}
        onSelect={setDefaultMode}
        disabled={builder.isLocked}
      />

      {/* 2. Kunden-Feedback Banner (nur nach Antwort) */}
      {builder.offerPhase === "customer_responded" && builder.customerResponse && (
        <CustomerFeedbackBanner
          response={builder.customerResponse}
          options={builder.options}
          onFinalize={handleFinalize}
        />
      )}

      {/* 3. Options-Grid */}
      <OptionCardGrid
        options={builder.options}
        packages={packages}
        menuItems={builder.menuItems}
        packageConfigs={builder.packageConfigs}
        onUpdateOption={builder.updateOption}
        onRemoveOption={builder.removeOption}
        onToggleActive={builder.toggleOptionActive}
        onAddOption={builder.addOption}
        defaultMode={defaultMode}
        isLocked={builder.isLocked}
      />

      {/* 4. E-Mail Composer */}
      <EmailComposer
        emailDraft={emailDraft}
        onChange={setEmailDraft}
        templates={templates}
        isGenerating={isGeneratingEmail}
        onGenerate={handleGenerateEmail}
        activeOptionsCount={builder.activeOptions.length}
        customerName={inquiry.contact_name}
        eventDate={inquiry.preferred_date || undefined}
        guestCount={inquiry.guest_count || undefined}
      />

      {/* 5. Send Controls */}
      <SendControls
        offerPhase={builder.offerPhase}
        emailDraft={emailDraft}
        activeOptionsCount={builder.activeOptions.length}
        isSending={builder.isSaving}
        onSendProposal={builder.sendProposal}
        onSendFinalOffer={builder.sendFinalOffer}
      />
    </div>
  );
}
