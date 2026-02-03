import { useState, useCallback } from "react";
import { 
  FileText, Send, Sparkles, Loader2, Copy, Check, 
  UtensilsCrossed, Wine, ChefHat, Utensils, Pencil 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MenuSelection, CourseConfig, DrinkConfig, COURSE_ICONS, DRINK_ICONS } from "./types";
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
  // Navigation-based editing - navigate back to course/drink step
  courseConfigs?: CourseConfig[];
  drinkConfigs?: DrinkConfig[];
  onNavigateToCourse?: (courseIndex: number) => void;
  onNavigateToDrinks?: () => void;
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
  courseConfigs = [],
  drinkConfigs = [],
  onNavigateToCourse,
  onNavigateToDrinks,
}: FinalizePanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const canEditCourses = !!onNavigateToCourse;
  const canEditDrinks = !!onNavigateToDrinks;

  const handleGenerateEmail = useCallback(async () => {
    if (!inquiry) return;
    setIsGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

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
          senderEmail: user?.email,
          customerMessage: inquiry.message, // Original customer message for context
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

  // Find the index of a course in courseConfigs
  const findCourseIndex = (courseType: string): number => {
    return courseConfigs.findIndex(c => c.course_type === courseType);
  };

  return (
    <div className="space-y-6">
      {/* Menu Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="h-5 w-5" />
              Menü-Zusammenfassung
            </CardTitle>
            {(canEditCourses || canEditDrinks) && (
              <span className="text-xs text-muted-foreground">
                Klicke zum Bearbeiten
              </span>
            )}
          </div>
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
                {menuSelection.courses.map((course, idx) => {
                  const courseIndex = findCourseIndex(course.courseType);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`
                        group flex items-start justify-between p-3 rounded-lg transition-all bg-muted/50
                        ${canEditCourses ? 'hover:bg-muted cursor-pointer' : ''}
                      `}
                      onClick={() => {
                        if (canEditCourses && courseIndex >= 0) {
                          onNavigateToCourse(courseIndex);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-lg">{COURSE_ICONS[course.courseType] || '🍽️'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{course.courseLabel}</p>
                            <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                          </div>
                          <p className="text-sm truncate">{course.itemName}</p>
                          {course.itemDescription && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {course.itemDescription}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge 
                          variant={course.itemSource === 'ristorante' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {course.itemSource === 'ristorante' && <Utensils className="h-3 w-3 mr-1" />}
                          {course.itemSource === 'catering' && <ChefHat className="h-3 w-3 mr-1" />}
                          {course.itemSource === 'manual' ? 'Frei' : 
                           course.itemSource === 'custom' ? 'Paket' :
                           course.itemSource === 'ristorante' ? 'Restaurant' : 'Catering'}
                        </Badge>
                        {canEditCourses && courseIndex >= 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToCourse(courseIndex);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                    className={`
                      group flex items-center gap-2 px-3 py-2 rounded-lg transition-all bg-muted/50
                      ${canEditDrinks ? 'hover:bg-muted cursor-pointer' : ''}
                    `}
                    onClick={() => {
                      if (canEditDrinks) {
                        onNavigateToDrinks();
                      }
                    }}
                  >
                    <span>{DRINK_ICONS[drink.drinkGroup] || '🍷'}</span>
                    <div>
                      <p className="text-sm font-medium">{drink.drinkLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {drink.customDrink || drink.selectedChoice}
                        {drink.quantityLabel && ` (${drink.quantityLabel})`}
                      </p>
                    </div>
                    {canEditDrinks && (
                      <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground ml-1" />
                    )}
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
            disabled={isSending || !emailDraft || !onSendOffer}
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
