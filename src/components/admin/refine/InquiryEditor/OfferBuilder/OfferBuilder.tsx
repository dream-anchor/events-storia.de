import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useOfferBuilder } from "./useOfferBuilder";
import { OptionCardGrid } from "./OptionCardGrid";
import { EmailComposer } from "./EmailComposer";
import { SendControls } from "./SendControls";
import { CustomerFeedbackBanner } from "./CustomerFeedbackBanner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExtendedInquiry, Package, EmailTemplate, OfferHistoryEntry, OfferBuilderOption } from "./types";
import { OPTION_LABELS, createEmptyOption } from "./types";
import { PaymentTermsBlock } from "../PaymentTermsBlock";

export interface OfferBuilderHandle {
  /** Scrollt zum E-Mail-Composer und öffnet ihn; generiert optional KI-Text */
  scrollToEmail: (withGeneration?: boolean) => void;
  /** Entsperrt den OfferBuilder für eine neue Angebotsversion */
  triggerNewVersion: () => void;
  /** Sofort speichern — vor Navigation/Unmount aufrufen */
  flushSave: () => void;
  /** Von Preview-Seite aufgerufen: Proposal-Versand direkt auslösen (ohne AlertDialog). */
  triggerSendProposal: () => Promise<unknown>;
  /** Von Preview-Seite aufgerufen: Final-Offer-Versand direkt auslösen (ohne AlertDialog). */
  triggerSendFinalOffer: () => Promise<void>;
  /** True sobald Hook fertig hydriert ist (kein isLoading mehr). Verhindert Send-Race. */
  isReady: () => boolean;
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
  /** Callback um Inquiry-Felder lokal zu ändern (Auto-Save kümmert sich um Persistenz) */
  onFieldChange?: (field: keyof ExtendedInquiry, value: unknown) => void;
}

export const OfferBuilder = forwardRef<OfferBuilderHandle, OfferBuilderProps>(function OfferBuilder({
  inquiry,
  packages,
  templates,
  onSave,
  isCreateMode = false,
  onEmailContentChange,
  onFieldChange,
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

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [menuImporterOpen, setMenuImporterOpen] = useState(false);

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

  // Initial-Sync: wenn inquiry.email_draft nach dem Mount nachgeladen wird
  // (z.B. weil die DB-Query noch lief als die Component mountete), einmalig
  // in den lokalen State uebernehmen. Danach gewinnt der lokale State
  // (Auto-save wuerde sonst User-Input wegloeschen bei jedem Parent-Rerender).
  const emailDraftInitialSyncedRef = useRef(false);
  useEffect(() => {
    if (emailDraftInitialSyncedRef.current) return;
    const incoming = inquiry.email_draft;
    if (typeof incoming === 'string' && incoming.length > 0) {
      setEmailDraft(incoming);
      emailDraftInitialSyncedRef.current = true;
    }
  }, [inquiry.email_draft]);

  // --- CX: Erkennung lokaler Änderungen nach Versand ---
  // Vergleicht aktuelle Options mit dem LETZTEN versendeten Snapshot
  // (aus inquiry_offer_history). Das ist robust ueber Reloads hinweg:
  // solange in der DB nichts versendet wurde, bleibt die amber Strip sichtbar.
  const hasLocalChangesAfterSend = useMemo(() => {
    // Nur wenn das Angebot bereits versendet wurde
    if (!inquiry.offer_sent_at) return false;
    if (builder.isLoading) return false;
    if (builder.history.length === 0) return false;

    // Der neueste History-Eintrag enthaelt den Snapshot der zuletzt versendeten Version.
    // history ist bereits nach version DESC sortiert im Hook ("order by version DESC").
    const lastSent = builder.history[0];
    if (!lastSent || !lastSent.optionsSnapshot) return false;

    // Serialisiere nur die semantisch relevanten Felder
    const serialize = (opts: OfferBuilderOption[]) => JSON.stringify(
      opts.map(o => ({
        packageId: o.packageId,
        offerMode: o.offerMode,
        guestCount: o.guestCount,
        totalAmount: o.totalAmount,
        menuSelection: o.menuSelection,
        isActive: o.isActive,
      }))
    );

    return serialize(builder.options) !== serialize(lastSent.optionsSnapshot);
  }, [inquiry.offer_sent_at, builder.options, builder.history, builder.isLoading]);

  const handleEmailDraftChange = useCallback((content: string) => {
    setEmailDraft(content);
    onEmailContentChange?.(content);
  }, [onEmailContentChange]);

  // E-Mail-Sektion ist IMMER sichtbar (CX-Refactor: WYSIWYG-Prinzip,
  // Edit-Seite hat alle Edit-Möglichkeiten direkt verfügbar).
  const emailSectionRef = useRef<HTMLDivElement>(null);

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
        // Belt-and-suspenders: direkt in die DB schreiben, falls der
        // Auto-Save-Cascade aus irgendeinem Grund nicht greift (z.B. Parent
        // hat onEmailContentChange nicht durchgereicht). So bleibt der
        // generierte Text auch nach Reload erhalten.
        try {
          await supabase
            .from('event_inquiries')
            .update({ email_draft: data.email } as Record<string, unknown>)
            .eq('id', inquiry.id);
        } catch (persistErr) {
          console.warn('[OfferBuilder] direct email_draft persist failed:', persistErr);
        }
        toast.success("E-Mail generiert");
      }
    } catch (err) {
      console.error("Email generation error:", err);
      toast.error("Fehler beim Generieren der E-Mail");
    } finally {
      setIsGeneratingEmail(false);
    }
  }, [inquiry.id, builder.offerPhase, handleEmailDraftChange]);

  // --- Neue Version erstellen ---
  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    await builder.unlockForNewVersion();
    setIsUnlocking(false);
  }, [builder.unlockForNewVersion]);

  // --- Exponierten Handle für Parent (SmartInquiryEditor) ---
  useImperativeHandle(ref, () => ({
    scrollToEmail: (withGeneration = true) => {
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
    triggerSendProposal: async () => {
      return await builder.sendProposal(emailDraft);
    },
    triggerSendFinalOffer: async () => {
      await builder.sendFinalOffer(emailDraft);
    },
    isReady: () => !builder.isLoading,
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
      {/* Versions-Info — grün wenn synchron, amber wenn lokale Änderungen */}
      {inquiry.offer_sent_at && !hasLocalChangesAfterSend && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-emerald-700 dark:text-emerald-300">
            Version {builder.currentVersion} gesendet
            {inquiry.offer_sent_at && ` am ${format(parseISO(inquiry.offer_sent_at), "d. MMM yyyy", { locale: de })}`}
          </span>
          <span className="text-emerald-600/60 dark:text-emerald-400/40">—</span>
          <span className="text-emerald-600/80 dark:text-emerald-400/60">
            Synchron mit Kunde
          </span>
        </div>
      )}

      {inquiry.offer_sent_at && hasLocalChangesAfterSend && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300/60 dark:border-amber-800/40 text-xs">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-amber-800 dark:text-amber-200 font-medium">
            Entwurf für Version {builder.currentVersion + 1}
          </span>
          <span className="text-amber-700/70 dark:text-amber-300/50">—</span>
          <span className="text-amber-700/80 dark:text-amber-300/70">
            Kunde sieht noch Version {builder.currentVersion}
            {inquiry.offer_sent_at && ` vom ${format(parseISO(inquiry.offer_sent_at), "d. MMM yyyy", { locale: de })}`}
            . Nicht vergessen: neue Version senden.
          </span>
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

      {/* Erklärtext: jede Option ist unabhängig */}
      <p className="text-xs text-muted-foreground -mt-4">
        Erstelle bis zu drei Varianten für deinen Kunden. Jede Option kann unabhängig
        ein Restaurant-Menü, Eigenes Menü, Paket oder nur eine E-Mail sein.
      </p>

      {/* 2. Kunden-Feedback Banner (nur nach Antwort) */}
      {builder.offerPhase === "customer_responded" && builder.customerResponse && (
        <CustomerFeedbackBanner
          response={builder.customerResponse}
          options={builder.options}
        />
      )}

      {/* 3. Options-Grid — pro Option wird der Modus innerhalb der Karte gewählt */}
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
        isLocked={false}
        currentVersion={builder.currentVersion}
        guestCount={guestCount}
        menuImporterOpen={menuImporterOpen}
        onMenuImporterOpenChange={setMenuImporterOpen}
      />

      {/* 4. Zahlungs-Konditionen — pro Inquiry editierbar */}
      {onFieldChange && (
        <PaymentTermsBlock
          depositPercent={inquiry.deposit_percent}
          depositDueDays={inquiry.deposit_due_days}
          offerValidityDays={inquiry.offer_validity_days}
          onChange={(field, value) => onFieldChange(field, value)}
          isReadOnly={inquiry.status === 'confirmed'}
        />
      )}

      {/* 5. E-Mail Composer — IMMER offen (CX-Refactor: Anschreiben ist Pflichtbestandteil) */}
      <div ref={emailSectionRef}>
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
      </div>

      {/* 5. Send Controls — nicht auf der Create-Seite (eigene Buttons im DraftPanel) */}
      {!isCreateMode && <SendControls
        offerPhase={builder.offerPhase}
        emailDraft={emailDraft}
        activeOptionsCount={builder.activeOptions.length}
        isSending={builder.isSaving}
        onSendProposal={builder.sendProposal}
        onSendFinalOffer={builder.sendFinalOffer}
        hasHistory={builder.history.length > 0}
        isNewVersionAfterSend={hasLocalChangesAfterSend}
        currentVersion={builder.currentVersion}
        inquiryId={inquiry.id}
      />}

      {/* Versionshistorie entfernt — wird in Timeline & Aktivitäten angezeigt */}
    </div>
  );
});
