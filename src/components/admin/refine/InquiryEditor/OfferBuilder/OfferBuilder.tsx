import { useState, useCallback } from "react";
import { Loader2, AlertCircle, Plus, Clock, ChevronDown, Mail, ExternalLink, UtensilsCrossed } from "lucide-react";
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
import type { OfferMode, ExtendedInquiry, Package, EmailTemplate, OfferHistoryEntry } from "./types";

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
  const [defaultMode, setDefaultMode] = useState<OfferMode>("menu");
  const [isUnlocking, setIsUnlocking] = useState(false);

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

  // --- Neue Version erstellen ---
  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    await builder.unlockForNewVersion();
    setIsUnlocking(false);
  }, [builder.unlockForNewVersion]);

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
          defaultMode={defaultMode}
          isLocked={builder.isLocked}
        />
      )}

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
        companyName={inquiry.company_name || undefined}
        eventType={inquiry.event_type || undefined}
        roomSelection={inquiry.room_selection || undefined}
        timeSlot={inquiry.time_slot || undefined}
        activeOptions={builder.activeOptions}
        menuItems={builder.menuItems}
        isLocked={builder.isLocked}
      />

      {/* 5. Send Controls */}
      <SendControls
        offerPhase={builder.offerPhase}
        emailDraft={emailDraft}
        activeOptionsCount={defaultMode === 'email' ? 1 : builder.activeOptions.length}
        isSending={builder.isSaving}
        onSendProposal={builder.sendProposal}
        onSendFinalOffer={builder.sendFinalOffer}
        hasHistory={builder.history.length > 0}
      />

      {/* 6. Versionshistorie */}
      {builder.history.length > 0 && (
        <OfferVersionHistory history={builder.history} inquiryId={inquiry.id} />
      )}
    </div>
  );
}

// =================================================================
// OFFER VERSION HISTORY
// =================================================================

function OfferVersionHistory({ history, inquiryId }: { history: OfferHistoryEntry[]; inquiryId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const offerUrl = `https://events-storia.de/offer/${inquiryId}`;

  const formatEur = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(amount);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Versionshistorie
        </h3>
        <a
          href={offerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Kundenansicht öffnen
        </a>
      </div>

      {history.map((entry) => {
        const isExpanded = expandedId === entry.id;
        const activeOpts = entry.optionsSnapshot.filter(o => o.isActive);

        return (
          <div
            key={entry.id}
            className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden"
          >
            {/* Header — immer sichtbar */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold font-mono text-muted-foreground bg-muted rounded-md px-2 py-0.5">
                  V{entry.version}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    Version {entry.version}
                    {activeOpts.length > 0 && (
                      <span className="text-muted-foreground font-normal ml-1">
                        — {activeOpts.length} Option{activeOpts.length !== 1 ? 'en' : ''}
                        {activeOpts.length > 0 && `, ${formatEur(activeOpts.reduce((s, o) => s + o.totalAmount, 0))}`}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.sentAt
                      ? format(parseISO(entry.sentAt), "d. MMM yyyy, HH:mm", { locale: de })
                      : "Nicht gesendet"}
                    {entry.sentBy && ` · ${entry.sentBy}`}
                  </p>
                </div>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isExpanded && "rotate-180"
              )} />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border/40 space-y-4">
                {/* E-Mail-Inhalt */}
                {entry.emailContent && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Mail className="h-3 w-3" />
                      Anschreiben
                    </p>
                    <div className="bg-background/60 rounded-lg p-3 text-sm text-foreground/70 whitespace-pre-line max-h-48 overflow-y-auto leading-relaxed">
                      {entry.emailContent}
                    </div>
                  </div>
                )}

                {/* Options-Snapshot mit vollen Menü-Details */}
                {activeOpts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <UtensilsCrossed className="h-3 w-3" />
                      Optionen & Menü
                    </p>
                    <div className="space-y-3">
                      {activeOpts.map((opt, i) => {
                        const courses = opt.menuSelection?.courses?.filter(c => c.itemName) || [];
                        const drinks = (opt.menuSelection?.drinks || []).filter(
                          (d) => d.selectedChoice || (d as any).customDrink
                        );
                        const ppPrice = opt.guestCount > 0
                          ? (opt.budgetPerPerson && opt.budgetPerPerson > 0
                            ? opt.budgetPerPerson
                            : opt.totalAmount / opt.guestCount)
                          : 0;

                        return (
                          <div key={i} className="bg-background/60 rounded-lg p-3">
                            {/* Option-Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-0.5">
                                  {opt.optionLabel}
                                </span>
                                <span className="text-sm font-medium">
                                  {opt.guestCount} Gäste
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-primary">
                                  {ppPrice > 0 ? `${formatEur(ppPrice)} / Pers.` : formatEur(opt.totalAmount)}
                                </span>
                                {ppPrice > 0 && (
                                  <span className="text-[10px] text-muted-foreground block">
                                    Gesamt: {formatEur(opt.totalAmount)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Gänge */}
                            {courses.length > 0 && (
                              <div className="space-y-1 mt-2 pt-2 border-t border-border/30">
                                {courses.map((c, ci) => (
                                  <div key={ci} className="flex items-baseline gap-2 text-xs">
                                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider w-16 shrink-0">
                                      {c.courseLabel}
                                    </span>
                                    <span className="text-foreground/70">{c.itemName}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Getränke */}
                            {drinks.length > 0 && (
                              <div className="space-y-1 mt-2 pt-2 border-t border-border/30">
                                {drinks.map((d, di) => (
                                  <div key={di} className="flex items-baseline gap-2 text-xs">
                                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider w-16 shrink-0">
                                      {d.drinkLabel}
                                    </span>
                                    <span className="text-foreground/70">
                                      {(d as any).customDrink || d.selectedChoice}
                                      {d.quantityLabel && (
                                        <span className="text-muted-foreground/50 ml-1">({d.quantityLabel})</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Offer-URL Link */}
                <div className="pt-2 border-t border-border/30">
                  <a
                    href={offerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Kundenansicht: {offerUrl}
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
