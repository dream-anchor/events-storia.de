import { useState, useCallback } from "react";
import { 
  FileText, Send, Sparkles, Loader2, Copy, Check, 
  UtensilsCrossed, Wine, ChefHat, Utensils 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MenuSelection, COURSE_ICONS, DRINK_ICONS } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FinalizePanelProps {
  inquiry?: any;
  packageName: string | null;
  guestCount: number;
  menuSelection: MenuSelection;
  emailDraft: string;
  onEmailDraftChange?: (draft: string) => void;
  onSendOffer?: () => void;
  isSending?: boolean;
  templates?: any[];
}

export const FinalizePanel = ({
  inquiry,
  packageName,
  guestCount,
  menuSelection,
  emailDraft,
  onEmailDraftChange,
  onSendOffer,
  isSending = false,
  templates = [],
}: FinalizePanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateEmail = useCallback(async () => {
    if (!inquiry) return;
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-inquiry-email', {
        body: {
          inquiryType: inquiry.inquiry_type || 'event',
          contactName: inquiry.contact_name,
          companyName: inquiry.company_name,
          eventType: inquiry.event_type,
          guestCount: inquiry.guest_count,
          preferredDate: inquiry.preferred_date,
          items: [],
          menuSelection: menuSelection,
          packageName: packageName,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Generierung fehlgeschlagen');

      onEmailDraftChange?.(data.email);
      toast.success("Anschreiben wurde generiert!");
    } catch (err) {
      console.error('AI generation error:', err);
      toast.error(err instanceof Error ? err.message : "Fehler bei der Generierung");
    } finally {
      setIsGenerating(false);
    }
  }, [inquiry, menuSelection, packageName, onEmailDraftChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("In Zwischenablage kopiert");
  }, [emailDraft]);

  return (
    <div className="space-y-6">
      {/* Menu Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UtensilsCrossed className="h-5 w-5" />
            Menü-Zusammenfassung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Package Info */}
          {packageName && (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
              <div>
                <p className="font-medium">{packageName}</p>
                <p className="text-sm text-muted-foreground">{guestCount} Gäste</p>
              </div>
              <Badge>Gewähltes Paket</Badge>
            </div>
          )}

          {/* Courses */}
          {menuSelection.courses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ChefHat className="h-4 w-4" />
                Gänge
              </h4>
              <div className="space-y-2">
                {menuSelection.courses.map((course, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{COURSE_ICONS[course.courseType] || '🍽️'}</span>
                      <div>
                        <p className="font-medium text-sm">{course.courseLabel}</p>
                        <p className="text-sm">{course.itemName}</p>
                        {course.itemDescription && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {course.itemDescription}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant={course.itemSource === 'ristorante' ? 'secondary' : 'outline'}
                      className="text-xs shrink-0"
                    >
                      {course.itemSource === 'ristorante' && <Utensils className="h-3 w-3 mr-1" />}
                      {course.itemSource === 'catering' && <ChefHat className="h-3 w-3 mr-1" />}
                      {course.itemSource === 'manual' ? 'Frei' : 
                       course.itemSource === 'custom' ? 'Paket' :
                       course.itemSource === 'ristorante' ? 'Restaurant' : 'Catering'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Drinks */}
          {menuSelection.drinks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wine className="h-4 w-4" />
                Getränke
              </h4>
              <div className="flex flex-wrap gap-2">
                {menuSelection.drinks.map((drink, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
                  >
                    <span>{DRINK_ICONS[drink.drinkGroup] || '🍷'}</span>
                    <div>
                      <p className="text-sm font-medium">{drink.drinkLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {drink.customDrink || drink.selectedChoice}
                        {drink.quantityLabel && ` (${drink.quantityLabel})`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {menuSelection.courses.length === 0 && menuSelection.drinks.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Noch keine Auswahl getroffen
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Email Generator */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              Persönliches Anschreiben
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!emailDraft}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGenerateEmail} 
            disabled={isGenerating || !inquiry}
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

          <Textarea
            value={emailDraft}
            onChange={(e) => onEmailDraftChange?.(e.target.value)}
            placeholder="Das generierte Anschreiben erscheint hier. Du kannst es frei bearbeiten..."
            className="min-h-[250px] font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Send Action */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-6">
          <Button 
            onClick={onSendOffer} 
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