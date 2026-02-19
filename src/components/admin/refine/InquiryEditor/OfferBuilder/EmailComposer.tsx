import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, Copy, Check, ChevronDown, FileText, Zap, PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EmailTemplate } from "../types";

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
}: EmailComposerProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Vorlagen (category = 'vorlage') — ersetzen den gesamten Text
  const vorlagen = useMemo(
    () => templates.filter(t => t.category === 'vorlage').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [templates]
  );

  // Textbausteine (category = 'baustein') — werden eingefügt
  const bausteine = useMemo(
    () => templates.filter(t => t.category === 'baustein').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [templates]
  );

  // Legacy-Templates (category = 'angebot' oder andere)
  const legacyTemplates = useMemo(
    () => templates.filter(t => t.category !== 'vorlage' && t.category !== 'baustein'),
    [templates]
  );

  // Alle Vorlagen für Schnellauswahl (wenn Textfeld leer)
  const quickTemplates = useMemo(() => vorlagen.slice(0, 6), [vorlagen]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  const replaceVariables = (text: string): string => {
    return text
      .replace(/\{\{kundenname\}\}/g, customerName || "[Kundenname]")
      .replace(/\{\{eventdatum\}\}/g, eventDate || "[Eventdatum]")
      .replace(/\{\{gaeste\}\}/g, guestCount || "[Gästeanzahl]");
  };

  // Vorlage anwenden — ERSETZT den gesamten Text
  const applyTemplate = (template: EmailTemplate) => {
    const text = template.body || template.content || "";
    onChange(replaceVariables(text));
    toast.success(`Vorlage "${template.name}" angewendet`);
  };

  // Textbaustein einfügen — FÜGT AN (am Ende oder an Cursor-Position)
  const insertSnippet = (template: EmailTemplate) => {
    const snippet = replaceVariables(template.body || template.content || "");
    const textarea = textareaRef.current;

    if (textarea && textarea === document.activeElement) {
      // An Cursor-Position einfügen
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = emailDraft.slice(0, start);
      const after = emailDraft.slice(end);
      const separator = before && !before.endsWith('\n') ? '\n\n' : '';
      onChange(before + separator + snippet + after);
      // Cursor nach dem Snippet positionieren
      requestAnimationFrame(() => {
        const newPos = start + separator.length + snippet.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    } else {
      // Am Ende anfügen
      const separator = emailDraft && !emailDraft.endsWith('\n') ? '\n\n' : '';
      onChange(emailDraft + separator + snippet);
    }
    toast.success(`"${template.name}" eingefügt`);
  };

  return (
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
          {/* Vorlagen-Dropdown (ersetzt Text) */}
          {(vorlagen.length > 0 || legacyTemplates.length > 0) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 rounded-xl gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  Vorlage
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                {vorlagen.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      STORIA Vorlagen
                    </DropdownMenuLabel>
                    {vorlagen.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)} className="text-xs">
                        {t.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                {legacyTemplates.length > 0 && (
                  <>
                    {vorlagen.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Weitere
                    </DropdownMenuLabel>
                    {legacyTemplates.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)} className="text-xs">
                        {t.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Textbausteine-Dropdown (fügt hinzu) */}
          {bausteine.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 rounded-xl gap-1 text-xs">
                  <PlusCircle className="h-3 w-3" />
                  Baustein
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Textbaustein einfügen
                </DropdownMenuLabel>
                {bausteine.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => insertSnippet(t)} className="text-xs">
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

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

      {/* Schnellvorlagen (wenn Textfeld leer) */}
      {quickTemplates.length > 0 && !emailDraft && (
        <div className="px-5 py-2.5 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Vorlage wählen
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickTemplates.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                onClick={() => applyTemplate(t)}
                className="h-7 rounded-xl text-xs"
              >
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Textarea */}
      <div className="p-5">
        <Textarea
          ref={textareaRef}
          value={emailDraft}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "min-h-[200px] resize-none",
            "font-sans text-sm leading-relaxed",
            "border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
            "bg-transparent p-0",
            "placeholder:text-muted-foreground/50"
          )}
          placeholder="Vorlage wählen oder Anschreiben verfassen..."
        />
      </div>
    </Card>
  );
}
