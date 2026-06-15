import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiIntake } from "@/hooks/useAiIntake";
import { AiChatMessages } from "./AiChatMessages";
import { AiAttachmentUploader } from "./AiAttachmentUploader";
import { AiSummaryCard } from "./AiSummaryCard";
import type { AiIntakeLanguage } from "@/lib/aiIntake/types";
import type { AiIntakeExtraction } from "@/lib/aiIntake/types";

interface Props {
  language: AiIntakeLanguage;
}

const COPY = {
  de: {
    placeholder:
      "Stellen Sie eine Frage oder beschreiben Sie Ihr Catering — die KI hilft bei der Vorbereitung.",
    send: "Frage senden",
    sendEmptyTooltip: "Geben Sie eine Nachricht ein, um weiterzufragen.",
    composerHint:
      "Dieser Button sendet nur eine Chat-Nachricht. Die Anfrage an STORIA senden Sie unten.",
    introHint:
      "Sie können Fragen stellen, gemeinsam planen oder direkt ein Angebot bei STORIA anfragen.",
    expandedPlaceholder:
      "Stellen Sie eine Frage oder beschreiben Sie Anlass, Datum, Personenanzahl und Speisenwünsche.",
    chatLabel: "KI-Hinweise",
    attachmentsLabel: "Anhänge (optional)",
    summaryLabel: "Übersicht",
    submit: "Angebot bei STORIA anfragen",
    submitDisabledHintPrefix: "Dafür fehlen noch:",
    submitEnabledHint:
      "Die KI bereitet Ihre Anfrage vor. STORIA prüft Details, Verfügbarkeit und finale Preise und sendet Ihnen das verbindliche Angebot.",
    close: "Panel schließen",
    minimize: "Minimieren",
    aiHint: "KI-Assistenz",
    aiDisclaimer:
      "Die KI hilft unverbindlich bei der Vorbereitung. STORIA sendet Ihnen das verbindliche Angebot nach Prüfung.",
    confirmTitle: "Anfrage zur Prüfung an STORIA senden?",
    confirmIntro:
      "STORIA prüft Ihre Angaben, passt bei Bedarf Menü, Mengen und Preise an und sendet Ihnen anschließend ein verbindliches Angebot.",
    confirm: "Ja, Anfrage senden",
    cancel: "Weiter bearbeiten",
    submitting: "Wird übermittelt …",
    successTitle: "Vielen Dank.",
    successBody:
      "Ihre Anfrage liegt bei STORIA zur Prüfung. Das Team meldet sich mit einem individuellen, verbindlichen Angebot.",
    successHint: "Ihre Anfrage wurde erfolgreich erfasst.",
    files: "Hochgeladene Dateien",
    examplesLabel: "Schnellstart",
    newInquiry: "Neue Anfrage starten",
    examples: [
      "Frage stellen",
      "Angebot einholen",
      "Menü planen",
      "Briefing einfügen",
    ],
    missingLabels: {
      contactName: "Name",
      email: "E-Mail",
      guestCount: "Personenanzahl",
      preferredDate: "Datum oder Zeitraum",
    } as Record<string, string>,
  },
  en: {
    placeholder:
      "Ask a question or describe your catering — the AI helps prepare your request.",
    send: "Send message",
    sendEmptyTooltip: "Enter a message to continue the conversation.",
    composerHint:
      "This button only sends a chat message. Use the button below to send the request to STORIA.",
    introHint:
      "You can ask questions, plan together, or directly request an offer from STORIA.",
    expandedPlaceholder:
      "Ask a question or describe occasion, date, guest count and menu preferences.",
    chatLabel: "AI hints",
    attachmentsLabel: "Attachments (optional)",
    summaryLabel: "Summary",
    submit: "Request an offer from STORIA",
    submitDisabledHintPrefix: "Still missing:",
    submitEnabledHint:
      "The AI prepares your request. STORIA reviews the details, availability and final pricing and sends you the binding offer.",
    close: "Close panel",
    minimize: "Minimize",
    aiHint: "AI assistance",
    aiDisclaimer:
      "The AI helps non-bindingly to prepare your request. STORIA sends the binding offer after review.",
    confirmTitle: "Send request to STORIA for review?",
    confirmIntro:
      "STORIA will review your details, adjust menu, quantities and pricing if needed, and then send you a binding offer.",
    confirm: "Yes, send request",
    cancel: "Keep editing",
    submitting: "Submitting …",
    successTitle: "Thank you.",
    successBody:
      "Your request is with STORIA for review. The team will get back to you with an individual, binding offer.",
    successHint: "Your request was successfully recorded.",
    files: "Uploaded files",
    examplesLabel: "Quick start",
    newInquiry: "Start a new request",
    examples: [
      "Ask a question",
      "Request an offer",
      "Plan a menu",
      "Paste a briefing",
    ],
    missingLabels: {
      contactName: "Name",
      email: "email",
      guestCount: "guest count",
      preferredDate: "date or time frame",
    } as Record<string, string>,
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
    awaitingConfirmation,
    submitting,
    submittedInquiryId,
    expand,
    collapse,
    sendMessage,
    addFiles,
    removeAttachment,
    clearNotice,
    requestConfirmation,
    cancelConfirmation,
    submitInquiry,
    resetConversation,
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
            <div className="flex items-center gap-1">
              {(messages.length > 0 || Object.keys(extraction).length > 0 || attachments.length > 0 || submittedInquiryId) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                  onClick={resetConversation}
                >
                  {t.newInquiry}
                </Button>
              ) : null}
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
            </div>
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
                attachmentCount={
                  attachments.filter((a) => a.status !== "error").length
                }
              />
            </section>

            {/* Example chips (only on empty conversation) */}
            {messages.length === 0 ? (
              <section aria-label={t.examplesLabel} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t.examplesLabel}
                </p>
                <div className="flex flex-wrap gap-2">
                  {t.examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        sendMessage(ex);
                      }}
                      disabled={thinking}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

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
              {!submittedInquiryId && !awaitingConfirmation ? (
                <p className="text-xs text-muted-foreground">
                  {t.aiDisclaimer}
                </p>
              ) : null}
              {submittedInquiryId ? (
                <div
                  role="status"
                  className="w-full rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <p className="text-base font-medium text-foreground">
                    {t.successTitle}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{t.successBody}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t.successHint}
                  </p>
                </div>
              ) : awaitingConfirmation ? (
                <ConfirmationSummary
                  t={t}
                  language={language}
                  extraction={extraction}
                  attachmentNames={attachments
                    .filter((a) => a.status !== "error")
                    .map((a) => a.file.name)}
                  submitting={submitting}
                  onConfirm={() => void submitInquiry()}
                  onCancel={cancelConfirmation}
                />
              ) : (
                <>
                  <Button
                    type="button"
                    size="lg"
                    disabled={!canSubmit}
                    onClick={requestConfirmation}
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
                </>
              )}
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

/* -------- Confirmation summary subcomponent -------- */

type CopyDict = (typeof COPY)[keyof typeof COPY];

interface ConfirmationSummaryProps {
  t: CopyDict;
  language: AiIntakeLanguage;
  extraction: AiIntakeExtraction;
  attachmentNames: string[];
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationSummary({
  t,
  language,
  extraction,
  attachmentNames,
  submitting,
  onConfirm,
  onCancel,
}: ConfirmationSummaryProps) {
  const fmt = (v: unknown): string => {
    if (v == null) return language === "de" ? "—" : "—";
    if (Array.isArray(v)) return v.length ? v.join(", ") : language === "de" ? "—" : "—";
    return String(v);
  };
  const dateLabel =
    extraction.preferredDate
      ? fmt(extraction.preferredDate)
      : extraction.dateRange
        ? (language === "de" ? `Zeitraum: ${extraction.dateRange}` : `Range: ${extraction.dateRange}`)
        : "—";
  const place = extraction.locationName || extraction.deliveryAddress;

  const rows: Array<[string, string]> = [
    [language === "de" ? "Ansprechpartner" : "Contact", fmt(extraction.contactName)],
    ["E-Mail", fmt(extraction.email)],
    [language === "de" ? "Telefon" : "Phone", fmt(extraction.phone)],
    [language === "de" ? "Firma" : "Company", fmt(extraction.companyName)],
    [language === "de" ? "Personen" : "Guests", fmt(extraction.guestCount)],
    [language === "de" ? "Datum / Zeitraum" : "Date / range", dateLabel],
    [language === "de" ? "Uhrzeit" : "Time", fmt(extraction.timeSlot)],
    [language === "de" ? "Anlass" : "Occasion", fmt(extraction.eventType)],
    [language === "de" ? "Ort / Adresse" : "Location / address", fmt(place)],
    [language === "de" ? "Speisen" : "Food", fmt(extraction.foodPreferences)],
    [
      language === "de" ? "Allergien / Anforderungen" : "Allergies / requirements",
      fmt(extraction.dietaryRequirements),
    ],
    [
      language === "de" ? "Service / Equipment" : "Service / equipment",
      fmt([
        ...(extraction.serviceNeeds ?? []),
        ...(extraction.equipmentNeeds ?? []),
      ]),
    ],
  ];

  return (
    <div className="w-full rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-sm font-medium text-foreground">{t.confirmTitle}</p>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm md:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="min-w-[140px] text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="flex-1 text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {attachmentNames.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t.files}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-foreground">
            {attachmentNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-sm text-foreground">{t.confirmIntro}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={submitting}
          onClick={onConfirm}
          className="h-10 rounded-full bg-foreground px-4 text-background hover:bg-foreground/90"
        >
          {submitting ? t.submitting : t.confirm}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={submitting}
          onClick={onCancel}
          className="h-10 rounded-full px-4"
        >
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}