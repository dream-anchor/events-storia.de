import { useState, useCallback } from "react";
import { Sparkles, Send, ChevronDown, Loader2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExtendedInquiry, QuoteItem, EmailTemplate } from "./types";
import { MenuSelection } from "./MenuComposer/types";

interface AIComposerProps {
  inquiry: ExtendedInquiry;
  quoteItems: QuoteItem[];
  templates: EmailTemplate[];
  emailDraft: string;
  onEmailDraftChange: (draft: string) => void;
  onSendEmail: () => void;
  isSending?: boolean;
  menuSelection?: MenuSelection;
  packageName?: string;
}

export const AIComposer = ({
  inquiry,
  quoteItems,
  templates,
  emailDraft,
  onEmailDraftChange,
  onSendEmail,
  isSending = false,
  menuSelection,
  packageName,
}: AIComposerProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Group templates by category
  const templatesByCategory: Record<string, EmailTemplate[]> = {};
  templates.forEach(t => {
    if (!templatesByCategory[t.category]) {
      templatesByCategory[t.category] = [];
    }
    templatesByCategory[t.category].push(t);
  });

  const categoryLabels: Record<string, string> = {
    storno: 'Stornierung',
    allergiker: 'Allergiker',
    zahlung: 'Zahlung',
    lieferung: 'Lieferung',
    general: 'Allgemein',
  };

  const handleGenerateEmail = useCallback(async () => {
    setIsGenerating(true);
    
    try {
      // Get current user for personalized signature
      const { data: { user } } = await supabase.auth.getUser();
      
      // Calculate total
      const totalAmount = quoteItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const { data, error } = await supabase.functions.invoke('generate-inquiry-email', {
        body: {
          inquiryType: inquiry.inquiry_type || 'event',
          contactName: inquiry.contact_name,
          companyName: inquiry.company_name,
          eventType: inquiry.event_type,
          guestCount: inquiry.guest_count,
          preferredDate: inquiry.preferred_date,
          timeSlot: inquiry.time_slot,
          items: quoteItems.map(i => ({ 
            name: i.name, 
            quantity: i.quantity, 
            price: i.price 
          })),
          deliveryAddress: inquiry.delivery_street 
            ? `${inquiry.delivery_street}, ${inquiry.delivery_zip} ${inquiry.delivery_city}`
            : undefined,
          deliveryTime: inquiry.delivery_time_slot,
          totalAmount,
          notes: inquiry.quote_notes,
          menuSelection: menuSelection,
          packageName: packageName,
          senderEmail: user?.email,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Generierung fehlgeschlagen');

      onEmailDraftChange(data.email);
      toast.success("E-Mail-Text wurde generiert!");
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error(err instanceof Error ? err.message : "Fehler bei der Generierung");
    } finally {
      setIsGenerating(false);
    }
  }, [inquiry, quoteItems, onEmailDraftChange, menuSelection, packageName]);

  const handleInsertTemplate = useCallback((template: EmailTemplate) => {
    const insertion = `\n\n---\n${template.content}`;
    onEmailDraftChange(emailDraft + insertion);
    toast.success(`"${template.name}" eingefügt`);
  }, [emailDraft, onEmailDraftChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("In Zwischenablage kopiert");
  }, [emailDraft]);

  return (
    <div className="space-y-6">
      {/* AI Generator */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Composer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Lasse einen personalisierten E-Mail-Text basierend auf den Kundendaten und dem Angebot generieren.
          </p>
          
          <Button 
            onClick={handleGenerateEmail} 
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generiere...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Anschreiben generieren
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Email Editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">E-Mail-Text</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleCopy}
                disabled={!emailDraft}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={emailDraft}
            onChange={(e) => onEmailDraftChange(e.target.value)}
            placeholder="Der generierte E-Mail-Text erscheint hier. Du kannst ihn frei bearbeiten..."
            className="min-h-[300px] font-mono text-sm"
          />
          
          {/* Template Snippets */}
          <Collapsible open={templateOpen} onOpenChange={setTemplateOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span>Standard-Bausteine einfügen</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${templateOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="space-y-4">
                {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                  <div key={category}>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      {categoryLabels[category] || category}
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {categoryTemplates.map(template => (
                        <Button
                          key={template.id}
                          variant="secondary"
                          size="sm"
                          onClick={() => handleInsertTemplate(template)}
                        >
                          {template.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                
                {templates.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-2">
                    Keine Vorlagen verfügbar
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Send Action */}
      <Card className="border-primary/50">
        <CardContent className="pt-6">
          <Button 
            onClick={onSendEmail} 
            disabled={isSending || !emailDraft}
            className="w-full"
            size="lg"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sende Angebot...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Angebot & E-Mail senden
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Generiert PDF via LexOffice und sendet E-Mail mit Anhang
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
