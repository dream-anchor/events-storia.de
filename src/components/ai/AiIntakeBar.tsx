import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiIntake } from "@/hooks/useAiIntake";
import { AiChatMessages } from "./AiChatMessages";
import { AiAttachmentUploader } from "./AiAttachmentUploader";
import { AiSummaryCard } from "./AiSummaryCard";
import type { AiIntakeLanguage } from "@/lib/aiIntake/types";

interface Props {
  language: AiIntakeLanguage;
}

const COPY = {
  de: {
    placeholder:
      "Beschreiben Sie Ihre Anforderungen oder kopieren Sie Ihr Briefing hier ein …",
    send: "Senden",
    expandedPlaceholder:
      "Beschreiben Sie Anlass, Datum, Personenanzahl, Ort und Speisenwünsche — gerne auch als kompletter Briefing-Text.",
    chatLabel: "KI-Hinweise",
    attachmentsLabel: "Anhänge (optional)",
    summaryLabel: "Übersicht",
    submit: "Anfrage an STORIA senden",
    submitDisabledHint:
      "Pflichtangaben ergänzen, um die Anfrage senden zu können.",
    close: "Panel schließen",
    minimize: "Minimieren",
    aiHint: "KI-Assistenz",
  },
  en: {
    placeholder:
      "Describe your catering request or paste your briefing here …",
    send: "Send",
    expandedPlaceholder:
      "Describe the occasion, date, guest count, location and menu preferences — full briefings are welcome.",
    chatLabel: "AI hints",
    attachmentsLabel: "Attachments (optional)",
    summaryLabel: "Summary",
    submit: "Send request to STORIA",
    submitDisabledHint: "Provide the required details to enable submission.",
    close: "Close panel",
    minimize: "Minimize",
    aiHint: "AI assistance",
  },
} as const;

export function AiIntakeBar({ language }: Props) {
  const t = COPY[language];
  const {
    expanded,
    messages,
    extraction,
    attachments,
    thinking,
    missing,
    canSubmit,
    totalSize,
    notice,
    conversationId,
    errorMessage,
    expand,
    collapse,
    sendMessage,
    addFiles,
    removeAttachment,
    showSubmitMockNotice,
    clearNotice,
  } = useAiIntake({ language });

  const [draft, setDraft] = useState("");
  const collapsedRef = useRef<HTMLTextAreaElement>(null);
  const expandedRef = useRef<HTMLTextAreaElement>(null);

  const onSubmit = useCallback(() => {
    if (!draft.trim()) return;
    sendMessage(draft);
    setDraft("");
  }, [draft, sendMessage]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  // Escape collapses the expanded panel
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, collapse]);

  // Autofocus expanded textarea on expand
  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => expandedRef.current?.focus());
    }
  }, [expanded]);

  // Auto-clear notice
  useEffect(() => {
    if (!notice) return;
    const timer: ReturnType<typeof setTimeout> = setTimeout(clearNotice, 4500);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  return (
    <div className="mx-auto mt-6 md:mt-8 w-full max-w-[880px] px-2 text-left">
      {/* Collapsed bar */}
      {!expanded ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="group flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.18)] backdrop-blur transition-shadow hover:shadow-[0_18px_60px_-16px_rgba(0,0,0,0.25)] focus-within:shadow-[0_18px_60px_-16px_rgba(0,0,0,0.28)]"
          aria-label={t.aiHint}
        >
          <span
            aria-hidden
            className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <label htmlFor="ai-intake-collapsed" className="sr-only">
            {t.placeholder}
          </label>
          <textarea
            id="ai-intake-collapsed"
            ref={collapsedRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={expand}
            onClick={expand}
            rows={1}
            placeholder={t.placeholder}
            aria-expanded={expanded}
            aria-controls="ai-intake-panel"
            className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10 shrink-0 gap-1.5 rounded-full bg-foreground px-4 text-background hover:bg-foreground/90"
          >
            <span>{t.send}</span>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </form>
      ) : null}

      {/* Expanded panel */}
      {expanded ? (
        <section
          id="ai-intake-panel"
          role="region"
          aria-label={t.aiHint}
          className="overflow-hidden rounded-3xl border border-border bg-background/95 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)] backdrop-blur animate-fade-in"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm font-medium text-foreground">{t.aiHint}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={collapse}
              aria-label={t.minimize}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </header>

          <div className="space-y-4 p-4 md:p-5">
            {/* Chat */}
            <section aria-label={t.chatLabel} className="space-y-2">
              <AiChatMessages
                messages={messages}
                thinking={thinking}
                language={language}
              />
            </section>

            {/* Summary */}
            <section aria-label={t.summaryLabel}>
              <AiSummaryCard
                extraction={extraction}
                missing={missing}
                language={language}
              />
            </section>

            {/* Textarea */}
            <div className="rounded-2xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-foreground/20">
              <label htmlFor="ai-intake-expanded" className="sr-only">
                {t.expandedPlaceholder}
              </label>
              <textarea
                id="ai-intake-expanded"
                ref={expandedRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={4}
                placeholder={t.expandedPlaceholder}
                className="min-h-[110px] w-full resize-y bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 px-1 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={onSubmit}
                  disabled={!draft.trim() || thinking}
                  className="h-9 gap-1.5 rounded-full bg-foreground px-4 text-background hover:bg-foreground/90"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  <span>{t.send}</span>
                </Button>
              </div>
            </div>

            {/* Attachments */}
            <section aria-label={t.attachmentsLabel} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t.attachmentsLabel}
              </h3>
              <AiAttachmentUploader
                attachments={attachments}
                totalSize={totalSize}
                language={language}
                onAdd={(files) => void addFiles(files)}
                onRemove={removeAttachment}
              />
              {!conversationId && attachments.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {language === "de"
                    ? "Dateien werden gemeinsam mit der Anfrage übermittelt."
                    : "Files will be transmitted together with the request."}
                </p>
              ) : null}
            </section>

            {/* CTA */}
            <div className="flex flex-col items-start gap-2 border-t border-border pt-4">
              <Button
                type="button"
                size="lg"
                disabled={!canSubmit}
                onClick={showSubmitMockNotice}
                className={cn(
                  "h-11 rounded-full px-5",
                  canSubmit
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {t.submit}
              </Button>
              {!canSubmit ? (
                <p className="text-xs text-muted-foreground">
                  {t.submitDisabledHint}
                </p>
              ) : null}
              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground"
                >
                  {errorMessage}
                </p>
              ) : null}
              {notice ? (
                <p
                  role="status"
                  className="rounded-xl bg-muted px-3 py-2 text-sm text-foreground"
                >
                  {notice}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default AiIntakeBar;