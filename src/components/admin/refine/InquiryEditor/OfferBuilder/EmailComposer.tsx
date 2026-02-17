import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles, Copy, Check, ChevronDown, FileText, Zap } from "lucide-react";
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

  const quickTemplates = useMemo(() => templates.slice(0, 3), [templates]);

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

  const applyTemplate = (template: EmailTemplate) => {
    const text = template.body || template.content || "";
    onChange(replaceVariables(text));
    toast.success(`Vorlage "${template.name}" angewendet`);
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
          {templates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 rounded-xl gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  Vorlage
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {templates.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => applyTemplate(t)}>
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

      {/* Quick Templates (wenn leer) */}
      {quickTemplates.length > 0 && !emailDraft && (
        <div className="px-5 py-2.5 border-b border-border/30 bg-muted/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Schnellvorlagen
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
          value={emailDraft}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "min-h-[200px] resize-none",
            "font-sans text-sm leading-relaxed",
            "border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
            "bg-transparent p-0",
            "placeholder:text-muted-foreground/50"
          )}
          placeholder="Ihr Anschreiben an den Kunden..."
        />
      </div>
    </Card>
  );
}
