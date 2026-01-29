import { useState } from "react";
import { Plus, Send, FileText, Loader2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  
  const {
    options,
    currentVersion,
    history,
    isLoading,
    isSaving,
    addOption,
    removeOption,
    updateOption,
    toggleOptionActive,
    saveOptions,
    createNewVersion,
  } = useMultiOfferState({ inquiryId: inquiry.id, guestCount });

  const [emailDraft, setEmailDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [generatingPaymentLinks, setGeneratingPaymentLinks] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  // Calculate totals for active options
  const activeOptions = options.filter(o => o.isActive);
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

    try {
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
              packageName: pkg?.name || opt.packageName,
              guestCount: opt.guestCount,
              totalAmount: opt.totalAmount,
              menuSelection: opt.menuSelection,
              paymentLinkUrl: opt.stripePaymentLinkUrl,
            };
          }),
          isMultiOption: true,
        },
      });

      if (error) throw error;
      if (data?.emailDraft) {
        setEmailDraft(data.emailDraft);
        toast.success("E-Mail-Entwurf erstellt");
      }
    } catch (error) {
      console.error('Error generating email:', error);
      toast.error("Fehler beim Generieren der E-Mail");
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Multi-Paket-Angebot</h3>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie bis zu 5 Optionen mit unterschiedlichen Paketen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            Version {currentVersion}
          </Badge>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
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

      {/* Options List */}
      <div className="space-y-4">
        {options.map(option => (
          <OfferOptionCard
            key={option.id}
            option={option}
            packages={packages}
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
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Weitere Option hinzufügen
        </Button>
      )}

      <Separator />

      {/* Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {activeOptions.length} aktive Option{activeOptions.length !== 1 ? 'en' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Gesamtwert aller Optionen: {totalForAllOptions.toFixed(2)} €
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={generateEmail}
                disabled={activeOptions.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                E-Mail generieren
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
