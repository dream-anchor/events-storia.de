import { useState, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Copy, Check, ChevronDown, FileText, Plus, Braces } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EmailTemplate } from "../types";
import type { OfferBuilderOption, CombinedMenuItem } from "./types";
import {
  type TemplateContext,
  type TemplateOption,
} from "@/lib/emailTemplates";
import { renderTemplate } from "@/lib/emailTemplateRenderer";

interface EmailComposerProps {
  emailDraft: string;
  onChange: (draft: string) => void;
  templates: EmailTemplate[];
  isGenerating: boolean;
  onGenerate: () => void;
  activeOptionsCount: number;
  customerName?: string;
  eventDate?: string;
  guestCount?: string;
  companyName?: string;
  eventType?: string;
  roomSelection?: string;
  timeSlot?: string;
  activeOptions?: OfferBuilderOption[];
  menuItems?: CombinedMenuItem[];
}

export function EmailComposer({
  emailDraft,
  onChange,
  templates,
  isGenerating,
  onGenerate,
  activeOptionsCount,
  customerName = "",
  eventDate = "",
  guestCount = "",
  companyName = "",
  eventType = "",
  roomSelection = "",
  timeSlot = "",
  activeOptions = [],
  menuItems = [],
}: EmailComposerProps) {
  const [copied, setCopied] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorPosRef = useRef<number | null>(null);

  // Cursor-Position merken bei jedem Klick/Tastendruck im Textarea
  const saveCursorPos = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      lastCursorPosRef.current = textarea.selectionStart;
    }
  }, []);

  // Textbausteine (category = 'baustein')
  const bausteine = useMemo(
    () => templates.filter(t => t.category === 'baustein').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [templates]
  );

  // DB-Vorlagen (category = 'vorlage')
  const dbVorlagen = useMemo(
    () => templates.filter(t => t.category === 'vorlage').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [templates]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  // --- OfferBuilderOption → TemplateOption Mapping ---

  const findItemName = (itemId: string | null): string | null => {
    if (!itemId) return null;
    return menuItems.find(m => m.id === itemId)?.name || null;
  };

  const courseLabelMap: Record<string, string> = {
    starter: 'Antipasto', pasta: 'Pasta', main: 'Hauptgang',
    main_fish: 'Fisch', main_meat: 'Fleisch', dessert: 'Dessert',
    fingerfood: 'Fingerfood', side: 'Beilage', soup: 'Suppe',
  };

  const buildTemplateOptions = useCallback((): TemplateOption[] => {
    return activeOptions.map(opt => {
      // Finaler Angebotspreis: budgetPerPerson × Gäste, fallback auf totalAmount
      const finalTotal = (opt.budgetPerPerson && opt.budgetPerPerson > 0)
        ? opt.budgetPerPerson * opt.guestCount
        : opt.totalAmount;
      return {
      label: opt.optionLabel,
      packageName: opt.packageName || undefined,
      guestCount: opt.guestCount,
      totalAmount: finalTotal,
      courses: (opt.menuSelection?.courses || [])
        .filter(c => c.itemId || c.itemName)
        .map(c => ({
          courseType: c.courseType,
          courseLabel: c.courseLabel || courseLabelMap[c.courseType] || c.courseType,
          itemName: c.itemName || findItemName(c.itemId) || '–',
        })),
      drinks: (opt.menuSelection?.drinks || [])
        .filter(d => d.selectedChoice || d.customDrink)
        .map(d => ({
          drinkGroup: d.drinkGroup,
          drinkLabel: d.drinkLabel,
          selectedChoice: d.selectedChoice || d.customDrink || '',
        })),
    };});
  }, [activeOptions, menuItems]);

  /** TemplateContext — wird für beide Systeme verwendet */
  const buildTemplateContext = useCallback((): TemplateContext => ({
    kundenname: customerName || undefined,
    firma: companyName || undefined,
    eventdatum: eventDate || undefined,
    gaeste: guestCount || undefined,
    eventart: eventType || undefined,
    raum: roomSelection || undefined,
    zeitfenster: timeSlot || undefined,
    options: buildTemplateOptions(),
  }), [customerName, companyName, eventDate, guestCount, eventType, roomSelection, timeSlot, buildTemplateOptions]);

  // --- DB-Vorlage anwenden (universeller Renderer) ---
  const applyDbTemplate = (template: EmailTemplate) => {
    const body = template.body || template.content || "";
    const ctx = buildTemplateContext();
    onChange(renderTemplate(body, ctx));
    toast.success(`Vorlage "${template.name}" angewendet`);
  };

  // --- Klickbare Variablen ---
  const TEMPLATE_VARIABLES = [
    { key: '{{kundenname}}', label: 'Kundenname', group: 'anfrage' },
    { key: '{{firma}}', label: 'Firma', group: 'anfrage' },
    { key: '{{eventdatum}}', label: 'Eventdatum', group: 'anfrage' },
    { key: '{{gaeste}}', label: 'Gäste', group: 'anfrage' },
    { key: '{{eventart}}', label: 'Eventart', group: 'anfrage' },
    { key: '{{raum}}', label: 'Raum', group: 'anfrage' },
    { key: '{{zeitfenster}}', label: 'Zeitfenster', group: 'anfrage' },
    { key: '{{paketname}}', label: 'Paketname', group: 'angebot' },
    { key: '{{menu}}', label: 'Menü', group: 'angebot' },
    { key: '{{getraenke}}', label: 'Getränke', group: 'angebot' },
    { key: '{{gesamtpreis}}', label: 'Gesamtpreis', group: 'angebot' },
    { key: '{{preis_pro_person}}', label: 'Preis/Person', group: 'angebot' },
    { key: '{{optionen}}', label: 'Alle Optionen', group: 'angebot' },
    { key: '{{eventdetails_satz}}', label: 'Eventdetails-Satz', group: 'angebot' },
    { key: '{{signatur}}', label: 'Signatur', group: 'angebot' },
    { key: '{{checkliste}}', label: 'Checkliste', group: 'angebot' },
    { key: '{{tafelhinweis}}', label: 'Tafelhinweis', group: 'angebot' },
  ] as const;

  /** Variable aufgelöst an Cursor-Position einfügen */
  const insertVariable = (variableKey: string) => {
    const ctx = buildTemplateContext();
    const resolved = renderTemplate(variableKey, ctx);
    const textarea = textareaRef.current;
    const pos = lastCursorPosRef.current ?? emailDraft.length;

    const before = emailDraft.slice(0, pos);
    const after = emailDraft.slice(pos);
    onChange(before + resolved + after);

    requestAnimationFrame(() => {
      if (textarea) {
        const newPos = pos + resolved.length;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
        lastCursorPosRef.current = newPos;
      }
    });
  };

  /** Textbaustein einfügen — an Cursor-Position oder am Ende */
  const insertSnippet = (template: EmailTemplate) => {
    const body = template.body || template.content || "";
    const ctx = buildTemplateContext();
    const snippet = renderTemplate(body, ctx);
    const textarea = textareaRef.current;

    if (textarea && textarea === document.activeElement) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = emailDraft.slice(0, start);
      const after = emailDraft.slice(end);
      const separator = before && !before.endsWith('\n') ? '\n\n' : '';
      onChange(before + separator + snippet + after);
      requestAnimationFrame(() => {
        const newPos = start + separator.length + snippet.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    } else {
      const separator = emailDraft && !emailDraft.endsWith('\n') ? '\n\n' : '';
      onChange(emailDraft + separator + snippet);
    }
    toast.success(`"${template.name}" eingefügt`);
  };

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-border/30 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-sm font-medium">Anschreiben</span>
            <Badge variant="outline" className="text-[10px] h-5">
              {activeOptionsCount} Option{activeOptionsCount !== 1 ? "en" : ""} aktiv
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Vorlagen-Dropdown — eine saubere Liste */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 rounded-xl gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  Vorlage
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto p-1">
                {dbVorlagen.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => applyDbTemplate(t)}
                    className="py-2 px-3 rounded-lg cursor-pointer"
                  >
                    <span className="text-[13px] font-sans">{t.name}</span>
                  </DropdownMenuItem>
                ))}
                {dbVorlagen.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Keine Vorlagen vorhanden
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-7 w-7 rounded-lg"
              disabled={!emailDraft}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onGenerate}
                disabled={isGenerating}
                className="h-7 rounded-xl gap-1 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                {isGenerating ? "Generiert..." : "KI generieren"}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Textarea */}
        <div className="p-5 pb-2">
          <Textarea
            ref={textareaRef}
            value={emailDraft}
            onChange={(e) => { onChange(e.target.value); saveCursorPos(); }}
            onSelect={saveCursorPos}
            onBlur={saveCursorPos}
            onKeyUp={saveCursorPos}
            className={cn(
              "min-h-[200px] resize-y",
              "font-sans text-sm leading-relaxed",
              "border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "bg-transparent p-0",
              "placeholder:text-muted-foreground/50"
            )}
            placeholder="Vorlage wählen oder Anschreiben verfassen..."
          />
        </div>

        {/* Variablen — klickbar zum Einfügen an Cursor-Position */}
        <div className="px-5 py-2 border-t border-border/20">
          <button
            type="button"
            onClick={() => setShowVariables(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors mb-1.5"
          >
            <Braces className="h-3 w-3" />
            Variablen
            <ChevronDown className={cn("h-3 w-3 transition-transform", showVariables && "rotate-180")} />
          </button>
          {showVariables && (
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARIABLES.map(v => {
                const isUsed = emailDraft.includes(v.key) || emailDraft.includes(renderTemplate(v.key, buildTemplateContext()));
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className={cn(
                      "inline-flex items-center h-6 px-2 rounded-md text-[11px] font-mono border transition-colors cursor-pointer",
                      isUsed
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary border-border/30"
                    )}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Textbausteine */}
        {bausteine.length > 0 && (
          <div className="px-5 pb-4 pt-1 border-t border-border/20">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-2">
              Textbausteine
            </span>
            <div className="flex flex-wrap gap-1.5">
              {bausteine.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  size="sm"
                  onClick={() => insertSnippet(t)}
                  className="h-7 rounded-xl gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
