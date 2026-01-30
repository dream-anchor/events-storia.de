import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Send, Loader2, History, Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { OfferOptionCard } from "./OfferOptionCard";
import { OfferVersionHistory } from "./OfferVersionHistory";
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

      {/* Spacer for Floating Island */}
      <div className="h-28" />

      {/* Floating Island Bottom Bar - Apple 2026 */}
      <AnimatePresence>
        {activeOptions.length > 0 && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-2xl"
          >
            <div className="bg-background/80 backdrop-blur-2xl border border-border/50 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] px-6 py-4">
              <div className="flex items-center justify-between gap-6">
                {/* Status - Elegant Typography */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-lg font-semibold text-foreground tracking-tight">
                      {activeOptions.length} aktive Option{activeOptions.length !== 1 ? 'en' : ''}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Gesamtwert: 
                    <span className="ml-1 font-medium text-foreground">
                      {totalForAllOptions.toFixed(2)} €
                    </span>
                  </span>
                </div>
                
                {/* Primary CTA - Amber Glow */}
                <motion.button
                  onClick={generateEmail}
                  disabled={activeOptionsWithPackage.length === 0 || isGeneratingEmail}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "h-12 px-6 rounded-2xl font-medium text-base flex items-center gap-2",
                    "bg-gradient-to-r from-amber-500 to-amber-600",
                    "text-white shadow-lg shadow-amber-500/25",
                    "hover:shadow-xl hover:shadow-amber-500/35",
                    "transition-shadow duration-200",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:hover:shadow-amber-500/25"
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Draft */}
      {emailDraft && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">E-Mail-Entwurf</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSendOffer}
                disabled={isSending || !emailDraft.trim()}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Angebot senden
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
