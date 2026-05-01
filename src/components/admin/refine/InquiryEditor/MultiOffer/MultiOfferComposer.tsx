import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  Sparkles,
  Send,
  Mail,
  History,
  Lock,
  Unlock,
  User,
  Clock,
  ChefHat,
  Pencil,
  FileEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OptionsOverview } from "./OptionsOverview";
import { WizardConfigurator } from "./WizardConfigurator";
import { OfferVersionHistory } from "./OfferVersionHistory";
import { EmailEditorPanel } from "./EmailEditorPanel";
import { LivePDFPreview } from "./LivePDFPreview";
import { useMultiOfferState } from "./useMultiOfferState";
import { Package, ExtendedInquiry, EmailTemplate } from "../types";
import { supabase } from "@/integrations/supabase/typed-client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { getAdminDisplayName } from "@/lib/adminDisplayNames";
import { useAllPackageCourseConfigs } from "@/hooks/useAllPackageCourseConfigs";
import { OfferOption } from "./types";
import { MenuImporter } from "../OfferBuilder/MenuImporter";

type ActiveView = "overview" | "wizard" | "email";

interface MultiOfferComposerProps {
  inquiry: ExtendedInquiry;
  packages: Package[];
  templates: EmailTemplate[];
  onSave: () => Promise<void>;
}

export function MultiOfferComposer({
  inquiry,
  packages,
  templates,
  onSave,
}: MultiOfferComposerProps) {
  const guestCount = parseInt(inquiry.guest_count || "1") || 1;

  const selectedPackages = Array.isArray(inquiry.selected_packages)
    ? (inquiry.selected_packages as { id: string; name?: string }[])
    : [];

  const {
    options,
    currentVersion,
    history,
    isLoading,
    isSaving,
    addOption,
    addImportedOptions,
    removeOption,
    updateOption,
    toggleOptionActive,
    saveOptions,
    createNewVersion,
    unlockForNewVersion,
    flushSave,
  } = useMultiOfferState({ inquiryId: inquiry.id, guestCount, selectedPackages });

  // === VIEW STATE ===
  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [wizardOptionId, setWizardOptionId] = useState<string | null>(null);

  // === LOCKING STATE ===
  // Local override so we don't need page reload after unlocking
  const [localUnlocked, setLocalUnlocked] = useState(false);
  const isLocked = Boolean(inquiry.offer_sent_at) && !localUnlocked;
  const hasSavedDraft = Boolean(inquiry.email_draft);
  const savedEmailDraft = inquiry.email_draft || "";
  const lastSentEntry = history.length > 0 ? history[0] : null;
  const hasBeenSentBefore = lastSentEntry !== null;

  const [emailDraft, setEmailDraft] = useState("");
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatingPaymentLinks, setGeneratingPaymentLinks] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [showSentEmail, setShowSentEmail] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // === CALCULATED VALUES ===
  const activeOptions = options.filter((o) => o.isActive);
  const activeOptionsWithPackage = activeOptions.filter((o) => o.packageId);
  const totalForAllOptions = activeOptions.reduce((sum, opt) => sum + opt.totalAmount, 0);

  const packageIdsInUse = useMemo(
    () => activeOptionsWithPackage.map((o) => o.packageId).filter(Boolean) as string[],
    [activeOptionsWithPackage]
  );
  const { data: courseConfigsByPackage = {} } = useAllPackageCourseConfigs(packageIdsInUse);

  const isMenuComplete = (opt: OfferOption): boolean => {
    const configs = courseConfigsByPackage[opt.packageId || ""] || [];
    const requiredCourses = configs.filter((c) => c.is_required);

    if (requiredCourses.length === 0) {
      return opt.menuSelection.courses.filter((c) => c.itemId || c.itemName).length > 0;
    }

    const configuredCourseTypes = new Set(
      opt.menuSelection.courses.filter((c) => c.itemId || c.itemName).map((c) => c.courseType)
    );
    return requiredCourses.every((rc) => configuredCourseTypes.has(rc.course_type));
  };

  const allMenusConfigured =
    activeOptionsWithPackage.length > 0 &&
    activeOptionsWithPackage.every((opt) => isMenuComplete(opt));

  // === HANDLERS ===

  const generatePaymentLinks = async () => {
    const optionsNeedingLinks = activeOptions.filter((o) => !o.stripePaymentLinkUrl && o.packageId);
    if (optionsNeedingLinks.length === 0) return true;

    for (const option of optionsNeedingLinks) {
      const pkg = packages.find((p) => p.id === option.packageId);
      if (!pkg) continue;

      setGeneratingPaymentLinks((prev) => new Set(prev).add(option.id));

      try {
        const { data, error } = await supabase.functions.invoke("create-offer-payment-link", {
          body: {
            inquiryId: inquiry.id,
            optionId: option.id,
            packageName: pkg.name,
            amount: option.totalAmount,
            customerEmail: inquiry.email,
            customerName: inquiry.contact_name,
            eventDate: inquiry.preferred_date || "",
            guestCount: option.guestCount,
            companyName: inquiry.company_name,
          },
        });
        if (error) throw error;
        updateOption(option.id, {
          stripePaymentLinkId: data.paymentLinkId,
          stripePaymentLinkUrl: data.paymentLinkUrl,
        });
      } catch (error) {
        console.error("Error generating payment link:", error);
        toast.error(`Fehler beim Erstellen des Zahlungslinks für Option ${option.optionLabel}`);
        return false;
      } finally {
        setGeneratingPaymentLinks((prev) => {
          const next = new Set(prev);
          next.delete(option.id);
          return next;
        });
      }
    }
    return true;
  };

  const generateEmail = async () => {
    if (activeOptions.length === 0) {
      toast.warning("Bitte mindestens eine Option aktivieren");
      return;
    }
    setIsGeneratingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("generate-inquiry-email", {
        body: {
          inquiry: {
            contact_name: inquiry.contact_name,
            company_name: inquiry.company_name,
            email: inquiry.email,
            preferred_date: inquiry.preferred_date,
            guest_count: inquiry.guest_count,
            event_type: inquiry.event_type,
            message: inquiry.message,
          },
          options: activeOptions.map((opt) => {
            const pkg = packages.find((p) => p.id === opt.packageId);
            return {
              label: opt.optionLabel,
              packageName: pkg?.name || opt.packageName || "Individuelles Paket",
              guestCount: opt.guestCount,
              totalAmount: opt.totalAmount,
              menuSelection: opt.menuSelection,
              paymentLinkUrl: opt.stripePaymentLinkUrl,
            };
          }),
          isMultiOption: true,
          senderEmail: user?.email,
        },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Generierung fehlgeschlagen");
      const generatedText = data?.email || data?.emailDraft;
      if (!generatedText) throw new Error("Keine E-Mail vom Service erhalten");

      setEmailDraft(generatedText);
      setActiveView("email");
      toast.success("E-Mail-Entwurf erstellt");
    } catch (error) {
      console.error("Error generating email:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Generieren der E-Mail");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleSendOffer = async () => {
    if (activeOptions.length === 0) {
      toast.warning("Bitte mindestens eine Option aktivieren");
      return;
    }
    if (!emailDraft.trim()) {
      toast.warning("Bitte erst einen E-Mail-Text erstellen");
      return;
    }
    setIsSending(true);
    try {
      await saveOptions();
      const linksOk = await generatePaymentLinks();
      if (!linksOk) throw new Error("Fehler beim Erstellen der Zahlungslinks");

      const newVersion = await createNewVersion(emailDraft);

      // LexOffice-Quotation NUR bei genau einer aktiven Option erzeugen.
      // Bei Multi-Option (Kunde wählt aus) wird das verbindliche Angebot
      // erst nach der Kunden-Auswahl in create-payment-session erzeugt —
      // sonst würden alle Optionen zur Gesamtsumme aufaddiert.
      if (activeOptions.length === 1) {
        const { data: quotRes, error } = await supabase.functions.invoke("create-event-quotation", {
          body: { inquiryId: inquiry.id },
        });
        if (error) throw error;
        if (quotRes?.success && quotRes.quotationId) {
          await supabase
            .from("event_inquiries")
            .update({
              lexoffice_quotation_id: quotRes.quotationId,
              lexoffice_invoice_id: quotRes.quotationId,
            } as Record<string, unknown>)
            .eq("id", inquiry.id);
        }
      }

      const now = new Date().toISOString();
      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from("event_inquiries")
        .update({
          status: "offer_sent",
          current_offer_version: newVersion,
          email_draft: emailDraft,
          offer_sent_at: now,
          offer_sent_by: userData.user?.email || null,
        })
        .eq("id", inquiry.id);

      toast.success(`Angebot (Version ${newVersion}) wurde versendet!`);
      await onSave();
    } catch (error) {
      console.error("Error sending offer:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Senden");
    } finally {
      setIsSending(false);
    }
  };

  // === WIZARD HELPERS ===

  const handleConfigureOption = (optionId: string) => {
    setWizardOptionId(optionId);
    setActiveView("wizard");
  };

  const handleWizardBack = () => {
    setWizardOptionId(null);
    setActiveView("overview");
  };

  const wizardOption = wizardOptionId ? options.find((o) => o.id === wizardOptionId) : null;

  // === LOADING ===

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // === EMAIL VIEW ===

  if (activeView === "email" && emailDraft) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Angebot finalisieren</h3>
            <p className="text-sm text-muted-foreground mt-1">E-Mail bearbeiten und PDF-Vorschau prüfen</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm font-medium">Version {currentVersion}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[calc(100vh-280px)]">
          <div className="lg:col-span-3 flex flex-col">
            <EmailEditorPanel
              emailDraft={emailDraft}
              onChange={setEmailDraft}
              templates={templates}
              isGenerating={isGeneratingEmail}
              onRegenerate={generateEmail}
              onBack={() => { setEmailDraft(""); setActiveView("overview"); }}
              activeOptionsCount={activeOptions.length}
              customerName={inquiry.contact_name || inquiry.company_name || ""}
              eventDate={inquiry.preferred_date ? format(parseISO(inquiry.preferred_date), "dd. MMMM yyyy", { locale: de }) : ""}
              packageName={activeOptionsWithPackage[0]?.packageName || ""}
              guestCount={inquiry.guest_count || ""}
            />
          </div>
          <div className="lg:col-span-2 flex flex-col">
            <LivePDFPreview inquiry={inquiry} options={activeOptions} packages={packages} emailDraft={emailDraft} />
          </div>
        </div>

        <div className="mt-8 bg-muted/30 border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={handleSendOffer}
              disabled={isSending || !emailDraft.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "h-12 px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap",
                "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
                "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                "transition-shadow duration-300",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {isSending ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sende…</>) : (<><Send className="h-4 w-4" /> Angebot senden</>)}
            </motion.button>
            <div className="flex flex-col gap-0.5 ml-auto text-right">
              <span className="text-base font-semibold text-foreground tracking-tight">
                {activeOptions.length} Option{activeOptions.length !== 1 ? "en" : ""}
              </span>
              <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                <span>Gesamtwert:</span>
                <span className="font-semibold text-foreground">{totalForAllOptions.toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === WIZARD VIEW ===

  if (activeView === "wizard" && wizardOption) {
    return (
      <div className="space-y-6">
        <WizardConfigurator
          option={wizardOption}
          packages={packages}
          inquiry={inquiry}
          onUpdateOption={(updates) => updateOption(wizardOption.id, updates)}
          onBack={handleWizardBack}
          onImportRestaurantMenus={addImportedOptions}
          isLocked={isLocked}
          onFlushSave={flushSave}
          onGenerateEmail={generateEmail}
          isGeneratingEmail={isGeneratingEmail}
        />
      </div>
    );
  }

  // === OVERVIEW VIEW (default) ===

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Multi-Paket-Angebot</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isLocked ? "Dieses Angebot wurde versendet und ist schreibgeschützt" : "Erstellen Sie bis zu 5 Optionen mit unterschiedlichen Paketen"}
          </p>
          {!isLocked && hasBeenSentBefore && (
            <p className="text-sm text-muted-foreground mt-1">
              Passen Sie das Angebot an und senden Sie es erneut
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm font-medium">Version {currentVersion}</Badge>
          {!isLocked && !hasBeenSentBefore && (
            <MenuImporter
              guestCount={guestCount}
              currentOptionCount={options.length}
              onImportMultiple={(imported) => addImportedOptions(imported)}
              disabled={options.length >= 5}
            />
          )}
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="h-10">
              <History className="h-4 w-4 mr-1.5" /> Historie
            </Button>
          )}
        </div>
      </div>

      {/* Locked Banner */}
      {isLocked && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-border bg-muted/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-neutral-400" />
              </div>
              <div>
                <span className="font-medium text-foreground">Angebot wurde versendet</span>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">v{inquiry.current_offer_version || currentVersion}</Badge>
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {getAdminDisplayName(inquiry.offer_sent_by)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {inquiry.offer_sent_at ? format(parseISO(inquiry.offer_sent_at), "dd.MM.yy 'um' HH:mm", { locale: de }) : "-"}</span>
                </div>
              </div>
            </div>
            <motion.button
              onClick={async () => { setIsUnlocking(true); await unlockForNewVersion(); setIsUnlocking(false); setLocalUnlocked(true); }}
              disabled={isUnlocking}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full sm:w-auto h-12 px-6 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0",
                "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
                "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                "transition-shadow duration-300",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {isUnlocking ? (<><Loader2 className="h-4 w-4 animate-spin" /> Wird entsperrt…</>) : (<><Pencil className="h-4 w-4" /> Angebot bearbeiten</>)}
            </motion.button>
          </div>
          <div className="px-5 pb-4 text-xs text-muted-foreground">Änderungen werden automatisch als neue Version gespeichert.</div>
        </motion.div>
      )}

      {/* Draft Banner — shown after unlocking a previously sent offer */}
      {!isLocked && hasBeenSentBefore && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-3">
          <FileEdit className="h-4 w-4 text-neutral-500 shrink-0" />
          <span className="text-sm text-foreground font-medium">Version {currentVersion} — Entwurf</span>
          <span className="text-xs text-muted-foreground">Änderungen sind noch nicht gesendet</span>
          <div className="ml-auto">
            <MenuImporter
              guestCount={guestCount}
              currentOptionCount={options.length}
              onImportMultiple={(imported) => addImportedOptions(imported)}
              disabled={options.length >= 5}
            />
          </div>
        </motion.div>
      )}

      {/* Version History */}
      {showHistory && history.length > 0 && (
        <OfferVersionHistory history={history} onClose={() => setShowHistory(false)} />
      )}

      {/* Options Overview */}
      <OptionsOverview
        options={options}
        packages={packages}
        isLocked={isLocked}
        onUpdateOption={updateOption}
        onRemoveOption={removeOption}
        onToggleActive={toggleOptionActive}
        onAddOption={addOption}
        onConfigureOption={handleConfigureOption}
        isMenuComplete={isMenuComplete}
      />

      {/* Sent Email Banner */}
      {hasBeenSentBefore && lastSentEntry && (
        <div className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border bg-neutral-50/80 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-700/60">
            <button onClick={() => setShowSentEmail(!showSentEmail)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-neutral-800 dark:bg-neutral-200">
                  <Check className="h-4 w-4 text-white dark:text-neutral-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Anschreiben gesendet</span>
                    <Badge variant="outline" className="text-xs">v{lastSentEntry.version}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {getAdminDisplayName(lastSentEntry.sentBy)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(parseISO(lastSentEntry.sentAt), "dd.MM.yy 'um' HH:mm", { locale: de })}</span>
                  </div>
                </div>
              </div>
              <motion.div animate={{ rotate: showSentEmail ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-muted-foreground">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </motion.div>
            </button>
            <AnimatePresence>
              {showSentEmail && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <div className="border-t border-border">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                      <div className="p-5 max-h-[600px] overflow-y-auto bg-background/50 lg:border-r border-border">
                        <p className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                          {(lastSentEntry.emailContent || savedEmailDraft).replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s*/gm, "").replace(/^-\s*/gm, "• ")}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/20 h-[600px]">
                        <LivePDFPreview inquiry={inquiry} options={activeOptions} packages={packages} emailDraft={lastSentEntry.emailContent || savedEmailDraft} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          {!isLocked && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
              <Button variant="outline" size="lg" onClick={() => setIsNewDraft(true)} className="h-12 px-6 rounded-2xl border-dashed">
                <Mail className="h-4 w-4 mr-2" /> Neue Nachricht erstellen
              </Button>
            </motion.div>
          )}
        </div>
      )}

      {/* Draft Banner */}
      {hasSavedDraft && !hasBeenSentBefore && (
        <div className="mt-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border bg-neutral-100/60 dark:bg-neutral-800/40 border-neutral-200/50 dark:border-neutral-700/50">
            <button onClick={() => setShowSentEmail(!showSentEmail)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-neutral-200 dark:bg-neutral-700">
                  <Mail className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Anschreiben-Entwurf vorhanden</span>
                    <Badge variant="outline" className="text-xs">v{currentVersion}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {getAdminDisplayName(inquiry.last_edited_by)}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {inquiry.last_edited_at ? format(parseISO(inquiry.last_edited_at), "dd.MM.yy 'um' HH:mm", { locale: de }) : "-"}</span>
                  </div>
                </div>
              </div>
              <motion.div animate={{ rotate: showSentEmail ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-muted-foreground">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </motion.div>
            </button>
            <AnimatePresence>
              {showSentEmail && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <div className="border-t border-border">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                      <div className="p-5 max-h-[600px] overflow-y-auto bg-background/50 lg:border-r border-border">
                        <p className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                          {savedEmailDraft.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s*/gm, "").replace(/^-\s*/gm, "• ")}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/20 h-[600px]">
                        <LivePDFPreview inquiry={inquiry} options={activeOptions} packages={packages} emailDraft={savedEmailDraft} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Email Generation CTA */}
      <AnimatePresence mode="wait">
        {(!hasSavedDraft || isNewDraft) && !isLocked && activeOptions.length > 0 && (
          <motion.div key="draft-interface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-6">
            <div className={cn("rounded-3xl p-6", "bg-white/70 dark:bg-neutral-900/70", "backdrop-blur-xl", "border border-white/20", "shadow-[0_8px_32px_rgba(0,0,0,0.08)]")}>
              <div className="flex items-center gap-4">
                {!allMenusConfigured ? (
                  <motion.button
                    onClick={() => {
                      const unconfigured = activeOptionsWithPackage.find((opt) => !isMenuComplete(opt));
                      if (unconfigured) handleConfigureOption(unconfigured.id);
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "h-12 px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap",
                      "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
                      "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                      "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                      "transition-shadow duration-300"
                    )}
                  >
                    <ChefHat className="h-4 w-4" /> Konfigurieren
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={generateEmail}
                    disabled={activeOptionsWithPackage.length === 0 || isGeneratingEmail}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "h-12 px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap",
                      "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
                      "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                      "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                      "transition-shadow duration-300",
                      "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    )}
                  >
                    {isGeneratingEmail ? (<><Loader2 className="h-4 w-4 animate-spin" /> Generiere…</>) : (<><Sparkles className="h-4 w-4" /> {hasSavedDraft ? "Folge-Mail generieren" : "Anschreiben generieren"}</>)}
                  </motion.button>
                )}

                {isNewDraft && (
                  <Button variant="ghost" size="sm" onClick={() => setIsNewDraft(false)} className="text-muted-foreground">Abbrechen</Button>
                )}

                <div className="flex flex-col gap-0.5 ml-auto text-right">
                  <span className="text-base font-semibold text-foreground tracking-tight">
                    {!allMenusConfigured ? "Menü unvollständig" : `${activeOptions.length} aktive Option${activeOptions.length !== 1 ? "en" : ""}`}
                  </span>
                  <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                    <span>Gesamtwert:</span>
                    <span className="font-semibold text-foreground">{totalForAllOptions.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
