import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Send, Loader2, History, Check, Sparkles } from "lucide-react";
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

  const [emailDraft, setEmailDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [generatingPaymentLinks, setGeneratingPaymentLinks] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  // Calculate totals for active options
  const activeOptions = options.filter(o => o.isActive);
  const activeOptionsWithPackage = activeOptions.filter(o => o.packageId);
  const totalForAllOptions = activeOptions.reduce((sum, opt) => sum + opt.totalAmount, 0);

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

        {/* Spacer for Floating Island */}
        <div className="h-24" />

        {/* Floating Send Bar - Centered Pill */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
            "px-5 py-3 rounded-full",
            "bg-background/80 backdrop-blur-2xl",
            "border border-border/50",
            "shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          )}
        >
          <div className="flex items-center gap-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium">
                {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''}
              </span>
            </div>

            <div className="h-4 w-px bg-border/50" />

            <span className="text-sm text-muted-foreground">
              {totalForAllOptions.toFixed(2)} €
            </span>

            <div className="h-4 w-px bg-border/50" />

            {/* Send CTA */}
            <motion.button
              onClick={handleSendOffer}
              disabled={isSending || !emailDraft.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "h-10 px-5 rounded-full font-medium text-sm flex items-center gap-2",
                "bg-gradient-to-r from-amber-500 to-amber-600",
                "text-white shadow-lg shadow-amber-500/25",
                "hover:shadow-xl hover:shadow-amber-500/35",
                "transition-shadow duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>
        </motion.div>
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

      {/* Email Generation Section - Static Inline */}
      <AnimatePresence mode="wait">
        {activeOptions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="mt-8"
          >
            {/* Show button if no email draft, otherwise show email preview */}
            {!emailDraft ? (
              <div className="bg-muted/30 border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  {/* Left: Generate Button */}
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
                          Anschreiben generieren
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  {/* Right: Status */}
                  <div className="flex flex-col gap-0.5 ml-auto text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-base font-semibold text-foreground tracking-tight">
                        {activeOptions.length} aktive Option{activeOptions.length !== 1 ? 'en' : ''}
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
            ) : (
              /* Email Draft Preview */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm text-foreground">Anschreiben generiert</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEmailDraft("")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Neu generieren
                    </Button>
                  </div>
                </div>
                
                {/* Email Content Preview */}
                <div className="p-5">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground bg-transparent p-0 m-0 overflow-hidden">
                      {emailDraft.length > 500 ? emailDraft.slice(0, 500) + '...' : emailDraft}
                    </pre>
                  </div>
                </div>

                {/* Footer with Send Action */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
                  <div className="text-sm text-muted-foreground">
                    {activeOptions.length} Option{activeOptions.length !== 1 ? 'en' : ''} · {totalForAllOptions.toFixed(2)} €
                  </div>
                  <Button
                    onClick={handleSendOffer}
                    disabled={isSending}
                    className="bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sende...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Angebot senden
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
