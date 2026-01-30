import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Sparkles, ChevronDown, Check, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { EmailTemplate } from "../types";
import { toast } from "sonner";

interface EmailEditorPanelProps {
  emailDraft: string;
  onChange: (draft: string) => void;
  templates: EmailTemplate[];
  isGenerating: boolean;
  onRegenerate: () => void;
  onBack: () => void;
  activeOptionsCount: number;
}

export function EmailEditorPanel({
  emailDraft,
  onChange,
  templates,
  isGenerating,
  onRegenerate,
  onBack,
  activeOptionsCount,
}: EmailEditorPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emailDraft);
    setCopied(true);
    toast.success("In Zwischenablage kopiert");
    setTimeout(() => setCopied(false), 2000);
  };

  const insertTemplate = (content: string) => {
    onChange(emailDraft + "\n\n" + content);
    setShowTemplates(false);
  };

  return (
    <Card className="flex-1 flex flex-col overflow-hidden rounded-3xl border-border/30 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="font-medium">Anschreiben</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeOptionsCount} Option{activeOptionsCount !== 1 ? "en" : ""}{" "}
            aktiv
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8 rounded-xl"
          >
          {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={isGenerating}
              className="h-8 rounded-xl gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Neu generieren
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Full-Height Textarea */}
      <div className="flex-1 p-6 min-h-0">
        <Textarea
          value={emailDraft}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-full min-h-[400px] resize-none",
            "font-sans text-base leading-relaxed tracking-[-0.01em]",
            "border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
            "bg-transparent p-0",
            "placeholder:text-muted-foreground/50"
          )}
          placeholder="Ihr Anschreiben..."
        />
      </div>

      {/* Template Snippets - Collapsed */}
      {templates.length > 0 && (
        <Collapsible
          open={showTemplates}
          onOpenChange={setShowTemplates}
          className="border-t border-border/30"
        >
          <CollapsibleTrigger className="w-full px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <span className="text-sm text-muted-foreground">Textbausteine</span>
            <motion.div
              animate={{ rotate: showTemplates ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </CollapsibleTrigger>
          <CollapsibleContent className="px-6 pb-4">
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  onClick={() => insertTemplate(template.content)}
                  className="h-7 text-xs rounded-lg"
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
