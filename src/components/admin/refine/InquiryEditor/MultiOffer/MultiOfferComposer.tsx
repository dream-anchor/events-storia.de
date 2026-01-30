import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Send, Loader2, History, Check, Sparkles, Mail, Clock, User, ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OfferOptionCard } from "./OfferOptionCard";
import { OfferVersionHistory } from "./OfferVersionHistory";
import { EmailEditorPanel } from "./EmailEditorPanel";
import { LivePDFPreview } from "./LivePDFPreview";
import { useMultiOfferState } from "./useMultiOfferState";
import { Package, ExtendedInquiry, EmailTemplate } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

// Helper to get display name from email
const getDisplayName = (email: string | null | undefined): string => {
  if (!email) return 'Unbekannt';
  if (email.includes('mimmo')) return 'Domenico';
  if (email.includes('madi')) return 'Madina';
  return email.split('@')[0];
};

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
  const guestCount = parseInt(inquiry.guest_count || '1') || 1;
  
  // Parse selected_packages from inquiry (customer's original selection)
  const selectedPackages = Array.isArray(inquiry.selected_packages) 
    ? inquiry.selected_packages as { id: string; name?: string }[]
    : [];
  
  const {
    options,
    currentVersion,
    history,
    isLoading,
    isSaving,
    saveStatus,
    addOption,
    removeOption,
    updateOption,
    toggleOptionActive,
    saveOptions,
    createNewVersion,
  } = useMultiOfferState({ inquiryId: inquiry.id, guestCount, selectedPackages });

  // Check if an offer was already sent (email_draft exists in DB)
  const hasSentOffer = Boolean(inquiry.offer_sent_at && inquiry.email_draft);
  const savedEmailDraft = inquiry.email_draft || '';
  
  const [emailDraft, setEmailDraft] = useState("");
  const [isNewDraft, setIsNewDraft] = useState(false); // Track if user is creating a follow-up
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatingPaymentLinks, setGeneratingPaymentLinks] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  // Calculate totals for active options
  const activeOptions = options.filter(o => o.isActive);
  const activeOptionsWithPackage = activeOptions.filter(o => o.packageId);
  const totalForAllOptions = activeOptions.reduce((sum, opt) => sum + opt.totalAmount, 0);
  
  // Check if all active options have menu configured
  const allMenusConfigured = activeOptionsWithPackage.length > 0 && activeOptionsWithPackage.every(opt => {
    const configuredCourses = opt.menuSelection.courses.filter(c => c.itemId || c.itemName).length;
    const configuredDrinks = opt.menuSelection.drinks.filter(d => d.selectedChoice || d.customDrink).length;
    return configuredCourses > 0 || configuredDrinks > 0;
  });
  
  // Find first option without menu config (for "Konfigurieren" action)
  const firstUnconfiguredOption = activeOptionsWithPackage.find(opt => {
    const configuredCourses = opt.menuSelection.courses.filter(c => c.itemId || c.itemName).length;
    const configuredDrinks = opt.menuSelection.drinks.filter(d => d.selectedChoice || d.customDrink).length;
    return configuredCourses === 0 && configuredDrinks === 0;
  });
  
  // Debug logging
  console.log('[MenuConfig Debug]', {
    activeOptionsWithPackage: activeOptionsWithPackage.length,
    allMenusConfigured,
    firstUnconfiguredOption: firstUnconfiguredOption?.optionLabel,
  });

  // Generate payment links for all active options
  const generatePaymentLinks = async () => {
    const optionsNeedingLinks = activeOptions.filter(o => !o.stripePaymentLinkUrl && o.packageId);
    
    if (optionsNeedingLinks.length === 0) {
      return true;
    }

    for (const option of optionsNeedingLinks) {
      const pkg = packages.find(p => p.id === option.packageId);
      if (!pkg) continue;

      setGeneratingPaymentLinks(prev => new Set(prev).add(option.id));

      try {
        const { data, error } = await supabase.functions.invoke('create-offer-payment-link', {
          body: {
            inquiryId: inquiry.id,
            optionId: option.id,
            packageName: pkg.name,
            amount: option.totalAmount,
            customerEmail: inquiry.email,
            customerName: inquiry.contact_name,
            eventDate: inquiry.preferred_date || '',
            guestCount: option.guestCount,
            companyName: inquiry.company_name,
          },
        });

        if (error) throw error;

        // Update option with payment link
        updateOption(option.id, {
          stripePaymentLinkId: data.paymentLinkId,
          stripePaymentLinkUrl: data.paymentLinkUrl,
        });

      } catch (error) {
        console.error('Error generating payment link:', error);
        toast.error(`Fehler beim Erstellen des Zahlungslinks für Option ${option.optionLabel}`);
        return false;
      } finally {
        setGeneratingPaymentLinks(prev => {
          const next = new Set(prev);
          next.delete(option.id);
          return next;
        });
      }
    }

    return true;
  };

  // Generate email with AI
  const generateEmail = async () => {
    if (activeOptions.length === 0) {
      toast.warning("Bitte mindestens eine Option aktivieren");
      return;
    }

    setIsGeneratingEmail(true);

    try {
      // Get current user for personalized signature
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.functions.invoke('generate-inquiry-email', {
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
          options: activeOptions.map(opt => {
            const pkg = packages.find(p => p.id === opt.packageId);
            return {
              label: opt.optionLabel,
              packageName: pkg?.name || opt.packageName || 'Individuelles Paket',
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
      
      // Check for backend error response
      if (data && !data.success) {
        throw new Error(data.error || 'Generierung fehlgeschlagen');
      }
      
      // Get email from response (support both field names for compatibility)
      const generatedText = data?.email || data?.emailDraft;
      
      if (!generatedText) {
        throw new Error('Keine E-Mail vom Service erhalten');
      }
      
      setEmailDraft(generatedText);
      toast.success("E-Mail-Entwurf erstellt");
      
    } catch (error) {
      console.error('Error generating email:', error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Generieren der E-Mail");
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  // Send offer
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
      // 1. Save current options
      await saveOptions();

      // 2. Generate payment links if needed
      const linksOk = await generatePaymentLinks();
      if (!linksOk) {
        throw new Error("Fehler beim Erstellen der Zahlungslinks");
      }

      // 3. Create new version and save to history
      const newVersion = await createNewVersion(emailDraft);

      // 4. Call LexOffice quotation creation
      const lineItems = activeOptions.flatMap(opt => {
        const pkg = packages.find(p => p.id === opt.packageId);
        if (!pkg) return [];
        return [{
          type: 'custom',
          name: `Option ${opt.optionLabel}: ${pkg.name}`,
          description: `${opt.guestCount} Gäste`,
          quantity: pkg.price_per_person ? opt.guestCount : 1,
          unitName: pkg.price_per_person ? 'Person' : 'Stück',
          unitPrice: {
            currency: 'EUR',
            netAmount: pkg.price,
            taxRatePercentage: 7,
          },
        }];
      });

      const { data, error } = await supabase.functions.invoke('create-event-quotation', {
        body: {
          eventId: inquiry.id,
          event: {
            contact_name: inquiry.contact_name,
            company_name: inquiry.company_name,
            email: inquiry.email,
            phone: inquiry.phone,
            preferred_date: inquiry.preferred_date,
            guest_count: inquiry.guest_count,
            event_type: inquiry.event_type,
          },
          items: lineItems,
          notes: `Angebot Version ${newVersion}`,
          emailBody: emailDraft,
          options: activeOptions,
        },
      });

      if (error) throw error;

      // 5. Update inquiry status
      await supabase
        .from('event_inquiries')
        .update({
          status: 'offer_sent',
          current_offer_version: newVersion,
          email_draft: emailDraft,
        })
        .eq('id', inquiry.id);

      toast.success(`Angebot (Version ${newVersion}) wurde versendet!`);
      await onSave();

    } catch (error) {
      console.error('Error sending offer:', error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Senden");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Conditional rendering: Email Draft Mode (Split Layout) vs Options List Mode
  if (emailDraft) {
    return (
      <div className="space-y-6">
        {/* Compact Header for Email Mode */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Angebot finalisieren</h3>
            <p className="text-sm text-muted-foreground mt-1">
              E-Mail bearbeiten und PDF-Vorschau prüfen
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Speichert...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="h-3 w-3" />
                Gespeichert
              </span>
            )}
            <Badge variant="outline" className="text-sm font-medium">
              Version {currentVersion}
            </Badge>
          </div>
        </div>

        {/* Split Screen Layout: 60/40 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[calc(100vh-280px)]">
          {/* Email Editor: 3 of 5 columns = 60% */}
          <div className="lg:col-span-3 flex flex-col">
            <EmailEditorPanel
              emailDraft={emailDraft}
              onChange={setEmailDraft}
              templates={templates}
              isGenerating={isGeneratingEmail}
              onRegenerate={generateEmail}
              onBack={() => setEmailDraft("")}
              activeOptionsCount={activeOptions.length}
            />
          </div>

          {/* PDF Preview: 2 of 5 columns = 40% */}
          <div className="lg:col-span-2 flex flex-col">
            <LivePDFPreview
              inquiry={inquiry}
              options={activeOptions}
              packages={packages}
              emailDraft={emailDraft}
            />
          </div>
        </div>

        {/* Static Send Bar */}
        <div className="mt-8 bg-muted/30 border border-border rounded-2xl p-6">
          <div className="flex items-center gap-4">
            {/* Left: Send Button */}
            <motion.button
              onClick={handleSendOffer}
              disabled={isSending || !emailDraft.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={cn(
                "h-12 px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap",
                "bg-gradient-to-r from-amber-500 to-amber-600",
                "text-white",
                "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                "transition-shadow duration-300",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sende…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Angebot senden
                </>
              )}
            </motion.button>

            {/* Right: Status */}
            <div className="flex flex-col gap-0.5 ml-auto text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-base font-semibold text-foreground tracking-tight">
                  {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''}
                </span>
                <motion.div 
                  className="h-2 w-2 rounded-full bg-amber-500"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                <span>Gesamtwert:</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={totalForAllOptions.toFixed(2)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="font-semibold text-foreground"
                  >
                    {totalForAllOptions.toFixed(2)} €
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard Options List Mode
  return (
    <div className="space-y-10">
      {/* Header - Clean 2026 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Multi-Paket-Angebot</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Erstellen Sie bis zu 5 Optionen mit unterschiedlichen Paketen
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-save status - Subtle 2026 */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Speichert...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3 w-3" />
              Gespeichert
            </span>
          )}
          <Badge variant="outline" className="text-sm font-medium">
            Version {currentVersion}
          </Badge>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="h-10"
            >
              <History className="h-4 w-4 mr-1.5" />
              Historie
            </Button>
          )}
        </div>
      </div>

      {/* Version History */}
      {showHistory && history.length > 0 && (
        <OfferVersionHistory history={history} onClose={() => setShowHistory(false)} />
      )}

      {/* Options List - More spacing 2026 */}
      <div className="space-y-5">
        {options.map(option => (
          <OfferOptionCard
            key={option.id}
            option={option}
            packages={packages}
            inquiry={inquiry}
            onUpdate={(updates) => updateOption(option.id, updates)}
            onRemove={() => removeOption(option.id)}
            onToggleActive={() => toggleOptionActive(option.id)}
            isGeneratingPaymentLink={generatingPaymentLinks.has(option.id)}
          />
        ))}
      </div>

      {/* Add Option Button */}
      {options.length < 5 && (
        <Button
          variant="outline"
          onClick={addOption}
          className="w-full border-dashed h-12 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4 mr-2" />
          Weitere Option hinzufügen
        </Button>
      )}

      {/* Email Section - Show sent offer OR generation interface */}
      <AnimatePresence mode="wait">
        {/* CASE 1: Already sent offer - show read-only with Apple 2026 glassmorphism */}
        {hasSentOffer && !isNewDraft && (
          <motion.div
            key="sent-offer"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mt-8"
          >
            <div className={cn(
              "relative overflow-hidden rounded-3xl",
              "bg-white/70 dark:bg-neutral-900/70",
              "backdrop-blur-xl",
              "border border-white/20",
              "shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
            )}>
              {/* Header with sent status */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                    <Send className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Angebot gesendet</span>
                      <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-700 bg-emerald-50">
                        Version {inquiry.current_offer_version || 1}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getDisplayName(inquiry.offer_sent_by)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {inquiry.offer_sent_at 
                          ? format(parseISO(inquiry.offer_sent_at), "dd.MM.yy 'um' HH:mm", { locale: de })
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewDraft(true)}
                  className="rounded-xl"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Nachricht senden
                </Button>
              </div>
              
              {/* Read-only email content */}
              <div className="p-6 max-h-[300px] overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-transparent p-0 m-0">
                    {savedEmailDraft}
                  </pre>
                </div>
              </div>

              {/* Footer with summary */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                <div className="text-sm text-muted-foreground">
                  {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''} · {totalForAllOptions.toFixed(2)} €
                </div>
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <History className="h-4 w-4 mr-1.5" />
                    {history.length} Version{history.length !== 1 ? 'en' : ''}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* CASE 2: Creating new draft (follow-up) OR no offer sent yet */}
        {(!hasSentOffer || isNewDraft) && activeOptions.length > 0 && (
          <motion.div
            key="draft-interface"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mt-8"
          >
            {/* Show button if no email draft, otherwise show email preview */}
            {!emailDraft ? (
              <div className={cn(
                "rounded-3xl p-6",
                "bg-white/70 dark:bg-neutral-900/70",
                "backdrop-blur-xl",
                "border border-white/20",
                "shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
              )}>
                <div className="flex items-center gap-4">
                  {/* Primary CTA: "Konfigurieren" if menu missing, else "Anschreiben generieren" */}
                  {!allMenusConfigured && firstUnconfiguredOption ? (
                    // Menu not configured yet - show "Konfigurieren" as next step
                    <motion.button
                      onClick={() => {
                        // Find the OfferOptionCard and trigger its menu editor
                        // We scroll to the option and show a visual hint
                        const optionElement = document.getElementById(`option-${firstUnconfiguredOption.id}`);
                        if (optionElement) {
                          optionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          // Add a highlight animation
                          optionElement.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
                          setTimeout(() => {
                            optionElement.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
                          }, 2000);
                        }
                        toast.info(`Bitte das Menü für Option ${firstUnconfiguredOption.optionLabel} konfigurieren`);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={cn(
                        "h-12 px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap",
                        "bg-gradient-to-r from-amber-500 to-amber-600",
                        "text-white",
                        "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                        "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                        "transition-shadow duration-300"
                      )}
                    >
                      <ChefHat className="h-4 w-4" />
                      Konfigurieren
                    </motion.button>
                  ) : (
                    // All menus configured - show "Anschreiben generieren"
                    <motion.button
                      onClick={generateEmail}
                      disabled={activeOptionsWithPackage.length === 0 || isGeneratingEmail}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={cn(
                        "h-12 px-6 rounded-2xl font-semibold text-sm flex items-center gap-2 whitespace-nowrap",
                        "bg-gradient-to-r from-amber-500 to-amber-600",
                        "text-white",
                        "shadow-[0_4px_20px_-4px_rgba(245,158,11,0.5)]",
                        "hover:shadow-[0_8px_30px_-4px_rgba(245,158,11,0.6)]",
                        "transition-shadow duration-300",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      )}
                    >
                      <AnimatePresence mode="wait">
                        {isGeneratingEmail ? (
                          <motion.span
                            key="loading"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2"
                          >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generiere…
                          </motion.span>
                        ) : (
                          <motion.span
                            key="default"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {hasSentOffer ? 'Folge-Mail generieren' : 'Anschreiben generieren'}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )}

                  {/* Back button if creating follow-up */}
                  {isNewDraft && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsNewDraft(false)}
                      className="text-muted-foreground"
                    >
                      Abbrechen
                    </Button>
                  )}

                  {/* Right: Status - show menu status or option count */}
                  <div className="flex flex-col gap-0.5 ml-auto text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-base font-semibold text-foreground tracking-tight">
                        {!allMenusConfigured && firstUnconfiguredOption 
                          ? `Option ${firstUnconfiguredOption.optionLabel}: Menü fehlt`
                          : `${activeOptions.length} aktive Option${activeOptions.length !== 1 ? 'en' : ''}`
                        }
                      </span>
                      <motion.div 
                        className={cn(
                          "h-2 w-2 rounded-full",
                          allMenusConfigured ? "bg-amber-500" : "bg-muted-foreground"
                        )}
                        animate={allMenusConfigured ? { 
                          scale: [1, 1.2, 1],
                          opacity: [0.7, 1, 0.7]
                        } : {}}
                        transition={{ 
                          duration: 2, 
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                      <span>Gesamtwert:</span>
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={totalForAllOptions.toFixed(2)}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="font-semibold text-foreground"
                        >
                          {totalForAllOptions.toFixed(2)} €
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Email Draft Preview - ready to send */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={cn(
                  "overflow-hidden rounded-3xl",
                  "bg-white/70 dark:bg-neutral-900/70",
                  "backdrop-blur-xl",
                  "border border-white/20",
                  "shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="font-medium text-sm text-foreground">
                      {hasSentOffer ? 'Folge-Mail bereit' : 'Anschreiben generiert'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEmailDraft("");
                        if (isNewDraft) setIsNewDraft(false);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isNewDraft ? 'Abbrechen' : 'Neu generieren'}
                    </Button>
                  </div>
                </div>
                
                {/* Email Content Preview */}
                <div className="p-6 max-h-[250px] overflow-y-auto">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-transparent p-0 m-0">
                      {emailDraft.length > 500 ? emailDraft.slice(0, 500) + '...' : emailDraft}
                    </pre>
                  </div>
                </div>

                {/* Footer with Send Action */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/20">
                  <div className="text-sm text-muted-foreground">
                    {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''} · {totalForAllOptions.toFixed(2)} €
                  </div>
                  <Button
                    onClick={handleSendOffer}
                    disabled={isSending}
                    className={cn(
                      "rounded-xl",
                      "bg-gradient-to-r from-amber-500 to-amber-600 text-white",
                      "hover:from-amber-600 hover:to-amber-700",
                      "shadow-[0_4px_16px_-4px_rgba(245,158,11,0.4)]"
                    )}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sende...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {hasSentOffer ? 'Folge-Mail senden' : 'Angebot senden'}
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
