import { useState, useCallback, useEffect } from "react";
import { 
  FileText, Send, Sparkles, Loader2, Copy, Check, 
  UtensilsCrossed, Wine, ChefHat, Utensils, Pencil 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MenuSelection, CourseSelection, DrinkSelection, CourseConfig, DrinkConfig, COURSE_ICONS, DRINK_ICONS, CourseType, DrinkGroupType } from "./types";
import { GlobalItemSearch } from "./GlobalItemSearch";
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
  // New props for inline editing
  courseConfigs?: CourseConfig[];
  drinkConfigs?: DrinkConfig[];
  onCourseEdit?: (newSelection: CourseSelection) => void;
  onDrinkEdit?: (newSelection: DrinkSelection) => void;
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
  onCourseEdit,
  onDrinkEdit,
}: FinalizePanelProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseType | null>(null);
  const [editingDrink, setEditingDrink] = useState<DrinkGroupType | null>(null);
  const [justEdited, setJustEdited] = useState<string | null>(null);

  // Clear "just edited" indicator after animation
  useEffect(() => {
    if (justEdited) {
      const timeout = setTimeout(() => setJustEdited(null), 1500);
      return () => clearTimeout(timeout);
    }
  }, [justEdited]);

  // Keyboard shortcuts: E + 1-5 for courses, E + D for drinks
  useEffect(() => {
    let ePressed = false;
    let eTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key.toLowerCase() === 'e') {
        ePressed = true;
        eTimeout = setTimeout(() => { ePressed = false; }, 500);
      } else if (ePressed && menuSelection.courses.length > 0) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= menuSelection.courses.length) {
          const course = menuSelection.courses[num - 1];
          setEditingCourse(course.courseType);
          ePressed = false;
        } else if (e.key.toLowerCase() === 'd' && menuSelection.drinks.length > 0) {
          setEditingDrink(menuSelection.drinks[0].drinkGroup);
          ePressed = false;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(eTimeout);
    };
  }, [menuSelection]);

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

  // Handle course edit selection
  const handleCourseItemSelect = useCallback((item: any) => {
    if (!editingCourse || !onCourseEdit) return;

    const config = courseConfigs.find(c => c.course_type === editingCourse);
    const newSelection: CourseSelection = {
      courseType: editingCourse,
      courseLabel: config?.course_label || editingCourse,
      itemId: item.id,
      itemName: item.name,
      itemDescription: item.description,
      itemSource: item.source,
      isCustom: false,
    };

    onCourseEdit(newSelection);
    setJustEdited(`course-${editingCourse}`);
    setEditingCourse(null);
    toast.success("Gang aktualisiert");
  }, [editingCourse, courseConfigs, onCourseEdit]);

  // Handle drink edit selection
  const handleDrinkItemSelect = useCallback((item: any) => {
    if (!editingDrink || !onDrinkEdit) return;

    const config = drinkConfigs.find(d => d.drink_group === editingDrink);
    const newSelection: DrinkSelection = {
      drinkGroup: editingDrink,
      drinkLabel: config?.drink_label || editingDrink,
      selectedChoice: item.name,
      quantityLabel: config?.quantity_label || null,
      customDrink: null,
    };

    onDrinkEdit(newSelection);
    setJustEdited(`drink-${editingDrink}`);
    setEditingDrink(null);
    toast.success("Getränk aktualisiert");
  }, [editingDrink, drinkConfigs, onDrinkEdit]);

  const canEdit = onCourseEdit || onDrinkEdit;

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
            {canEdit && (
              <span className="text-xs text-muted-foreground">
                Klicke zum Bearbeiten • <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">E</kbd>+<kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">1-5</kbd>
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
                  const isEditing = editingCourse === course.courseType;
                  const wasJustEdited = justEdited === `course-${course.courseType}`;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`
                        group flex items-start justify-between p-3 rounded-lg transition-all
                        ${wasJustEdited ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/50'}
                        ${canEdit && onCourseEdit ? 'hover:bg-muted cursor-pointer' : ''}
                      `}
                      onClick={() => {
                        if (canEdit && onCourseEdit) {
                          setEditingCourse(course.courseType);
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
                        {canEdit && onCourseEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCourse(course.courseType);
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
                {menuSelection.drinks.map((drink, idx) => {
                  const wasJustEdited = justEdited === `drink-${drink.drinkGroup}`;
                  
                  return (
                    <div 
                      key={idx}
                      className={`
                        group flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                        ${wasJustEdited ? 'bg-primary/10 ring-2 ring-primary/30' : 'bg-muted/50'}
                        ${canEdit && onDrinkEdit ? 'hover:bg-muted cursor-pointer' : ''}
                      `}
                      onClick={() => {
                        if (canEdit && onDrinkEdit) {
                          setEditingDrink(drink.drinkGroup);
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
                      {canEdit && onDrinkEdit && (
                        <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground ml-1" />
                      )}
                    </div>
                  );
                })}
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

      {/* GlobalItemSearch for Course Editing */}
      <GlobalItemSearch
        open={!!editingCourse}
        onOpenChange={(open) => !open && setEditingCourse(null)}
        onSelect={handleCourseItemSelect}
        filterType="food"
        placeholder={`${menuSelection.courses.find(c => c.courseType === editingCourse)?.courseLabel || 'Gang'} ersetzen...`}
      />

      {/* GlobalItemSearch for Drink Editing */}
      <GlobalItemSearch
        open={!!editingDrink}
        onOpenChange={(open) => !open && setEditingDrink(null)}
        onSelect={handleDrinkItemSelect}
        filterType="drinks"
        placeholder={`${menuSelection.drinks.find(d => d.drinkGroup === editingDrink)?.drinkLabel || 'Getränk'} ersetzen...`}
      />

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
