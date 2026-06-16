import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AI_ALLOWED_EXT,
  AI_ALLOWED_MIME,
  AI_MAX_FILES,
  AI_MAX_FILE_BYTES,
  AI_MAX_TOTAL_BYTES,
  extOf,
  type AiAttachmentDraft,
  type AiIntakeExtraction,
  type AiIntakeLanguage,
  type AiIntakeMessage,
  type AiRequiredField,
} from "@/lib/aiIntake/types";
import { uploadAttachmentWithConversation } from "@/lib/aiIntake/uploadAttachment";
import { supabase } from "@/integrations/supabase/client";

const CONVERSATION_STORAGE_KEY = "storia.aiIntake.conversationId";
const AI_REQUEST_TIMEOUT_MS = 30_000;

async function invokeAiAssistant<T>(
  body: Record<string, unknown>,
  options: { allowErrorJson?: boolean } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-catering-assistant`;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as T;
    if (!response.ok && !options.allowErrorJson) {
      const err = new Error(
        typeof (data as { error?: unknown })?.error === "string"
          ? String((data as { error?: unknown }).error)
          : `ai_assistant_${response.status}`,
      );
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function timeoutMessage(language: AiIntakeLanguage): string {
  return language === "de"
    ? "Das dauert gerade zu lange. Bitte versuchen Sie es erneut."
    : "This is taking too long. Please try again.";
}

function isRequestTimeout(error: unknown, startedAt: number): boolean {
  if (Date.now() - startedAt >= AI_REQUEST_TIMEOUT_MS - 250) return true;
  if (!(error instanceof Error)) return false;
  return /abort|timeout|timed out/i.test(`${error.name} ${error.message}`);
}

function readStoredConversationId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredConversationId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.sessionStorage.setItem(CONVERSATION_STORAGE_KEY, id);
    else window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
  } catch {
    /* ignore quota / privacy errors */
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* -------- Local NLU (used only as fallback when the AI backend is unreachable) -------- */

function mockExtract(text: string): AiIntakeExtraction {
  const out: AiIntakeExtraction = {};
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) out.email = email[0];

  const phone = text.match(/\+?\d[\d\s/().-]{6,}\d/);
  if (phone) out.phone = phone[0].trim();

  const guests = text.match(/(?:ca\.?\s*|circa\s*|about\s*|für\s*|for\s*)?(\d{1,4})\s*(?:personen|gäste|guests|people|pax)/i);
  if (guests) out.guestCount = Number(guests[1]);

  const date = text.match(/(\d{1,2}\.\s?\d{1,2}\.?(?:\s?\d{2,4})?)|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (date) out.preferredDate = (date[0] || "").trim();

  const city = text.match(/\b(M[üu]nchen|Munich|Berlin|Hamburg|K[öo]ln|Stuttgart|Frankfurt|Augsburg|N[üu]rnberg)\b/i);
  if (city) out.locationName = city[0];

  const foods = [
    "fingerfood",
    "buffet",
    "pizza",
    "antipasti",
    "menü",
    "menue",
    "menu",
    "flying buffet",
    "bbq",
    "vegan",
    "vegetarisch",
    "vegetarian",
  ];
  const lc = text.toLowerCase();
  const food = foods.find((f) => lc.includes(f));
  if (food) out.foodPreferences = [food];

  return out;
}

function mergeExtraction(
  a: AiIntakeExtraction,
  b: AiIntakeExtraction,
): AiIntakeExtraction {
  return { ...a, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v != null && v !== "")) };
}

function computeMissing(e: AiIntakeExtraction): AiRequiredField[] {
  const missing: AiRequiredField[] = [];
  if (!e.contactName) missing.push("contactName");
  if (!e.email) missing.push("email");
  if (!e.preferredDate && !e.dateRange) missing.push("preferredDate");
  if (!e.guestCount) missing.push("guestCount");
  return missing;
}

function buildAssistantReply(
  lang: AiIntakeLanguage,
  extraction: AiIntakeExtraction,
  missing: AiRequiredField[],
): string {
  const labelMap: Record<AiRequiredField, { de: string; en: string }> = {
    contactName: { de: "Ihr Name oder ein Ansprechpartner", en: "your name or a contact person" },
    email: { de: "Ihre E-Mail-Adresse", en: "your email address" },
    preferredDate: { de: "ein Datum oder Zeitraum", en: "a date or time frame" },
    guestCount: { de: "die ungefähre Personenanzahl", en: "the approximate number of guests" },
  };

  const known: string[] = [];
  if (extraction.guestCount) known.push(lang === "de" ? "Personenanzahl" : "guest count");
  if (extraction.preferredDate || extraction.dateRange) known.push(lang === "de" ? "Datum" : "date");
  if (extraction.email) known.push("E-Mail");
  if (extraction.locationName) known.push(lang === "de" ? "Ort" : "location");
  if (extraction.foodPreferences && extraction.foodPreferences.length > 0)
    known.push(lang === "de" ? "Speisenwunsch" : "menu preference");

  const knownText = known.length
    ? lang === "de"
      ? `Ich habe folgende Angaben erkannt: ${known.join(", ")}.`
      : `I've identified the following details: ${known.join(", ")}.`
    : lang === "de"
      ? "Ich konnte noch keine konkreten Angaben erkennen."
      : "I couldn't identify concrete details yet.";

  if (missing.length === 0) {
    return lang === "de"
      ? `Vielen Dank. ${knownText} Alle Pflichtangaben liegen vor — Sie können die Anfrage gleich an STORIA senden.`
      : `Thank you. ${knownText} All required information is present — you can send the request to STORIA.`;
  }

  const missingText = missing.map((m) => labelMap[m][lang]).join(", ");
  return lang === "de"
    ? `Vielen Dank. ${knownText} Damit STORIA Ihnen ein Angebot senden kann, fehlt noch: ${missingText}.`
    : `Thank you. ${knownText} To prepare an offer, STORIA still needs: ${missingText}.`;
}

function toRequiredFields(input: unknown): AiRequiredField[] {
  if (!Array.isArray(input)) return [];
  const allowed: AiRequiredField[] = [
    "contactName",
    "email",
    "preferredDate",
    "guestCount",
  ];
  return input.filter((x): x is AiRequiredField =>
    allowed.includes(x as AiRequiredField),
  );
}

/* -------- Hook -------- */

export interface UseAiIntakeOptions {
  language: AiIntakeLanguage;
}

export function useAiIntake({ language }: UseAiIntakeOptions) {
  const [expanded, setExpanded] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [messages, setMessages] = useState<AiIntakeMessage[]>([]);
  const [extraction, setExtraction] = useState<AiIntakeExtraction>({});
  const [attachments, setAttachments] = useState<AiAttachmentDraft[]>([]);
  const [thinking, setThinking] = useState(false);
  const [conversationId, setConversationIdState] = useState<string | null>(
    () => readStoredConversationId(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [serverMissing, setServerMissing] = useState<AiRequiredField[] | null>(
    null,
  );
  const [readyFromServer, setReadyFromServer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedInquiryId, setSubmittedInquiryId] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestInFlightRef = useRef(false);
  const extractionRef = useRef<AiIntakeExtraction>({});
  extractionRef.current = extraction;

  const setConversationId = useCallback((id: string | null) => {
    setConversationIdState(id);
    writeStoredConversationId(id);
  }, []);

  // Reload restore: when a conversationId persists from a previous session,
  // pull status, messages, extraction, and submitted state from the server so
  // the UI can faithfully reflect an already-submitted inquiry.
  const didLoadStateRef = useRef(false);
  useEffect(() => {
    if (didLoadStateRef.current) return;
    if (!conversationId) return;
    didLoadStateRef.current = true;
    let cancelled = false;
    setLoadingState(true);
    (async () => {
      try {
        const data = await invokeAiAssistant<{
          status?: string;
          submittedInquiryId?: string | null;
          messages?: Array<{
            id: string;
            role: "user" | "assistant" | "system";
            content: string;
            createdAt: number;
          }>;
          extracted?: AiIntakeExtraction;
          missingFields?: unknown;
          readyToSubmit?: boolean;
          awaitingConfirmation?: boolean;
        } | null>({
          conversationId,
          action: "load_state",
        });
        if (cancelled) return;
        const payload = data;
        if (!payload) return;
        if (Array.isArray(payload.messages) && payload.messages.length > 0) {
          setMessages(payload.messages);
          setExpanded(true);
        }
        if (payload.extracted) setExtraction(payload.extracted);
        setServerMissing(toRequiredFields(payload.missingFields));
        setReadyFromServer(Boolean(payload.readyToSubmit));
        setAwaitingConfirmation(Boolean(payload.awaitingConfirmation));
        if (payload.submittedInquiryId) {
          setSubmittedInquiryId(payload.submittedInquiryId);
        }
      } catch {
        // Non-blocking: chat UI stays usable; user just won't see history.
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, setConversationId]);

  const missing = useMemo<AiRequiredField[]>(
    () => serverMissing ?? computeMissing(extraction),
    [serverMissing, extraction],
  );
  // Client-side safeguard: even when serverMissing/readyFromServer are stale,
  // accept the request if the extracted fields visibly meet all required criteria.
  const hasRequiredExtractedFields = useMemo(() => {
    const email = extraction.email?.trim() ?? "";
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return Boolean(
      extraction.contactName &&
        emailValid &&
        extraction.guestCount &&
        (extraction.preferredDate || extraction.dateRange),
    );
  }, [extraction]);
  const canSubmit =
    readyFromServer || missing.length === 0 || hasRequiredExtractedFields;

  type CtaState =
    | "not_ready"
    | "ready"
    | "awaiting"
    | "submitting"
    | "submitted"
    | "error";
  const ctaState: CtaState = useMemo(() => {
    if (submittedInquiryId) return "submitted";
    if (submitting) return "submitting";
    if (errorMessage && canSubmit) return "error";
    if (awaitingConfirmation && canSubmit) return "awaiting";
    if (canSubmit) return "ready";
    return "not_ready";
  }, [
    submittedInquiryId,
    submitting,
    errorMessage,
    awaitingConfirmation,
    canSubmit,
  ]);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: { submitAfterProcessing?: boolean },
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (requestInFlightRef.current) return;
      const submitAfterProcessing = options?.submitAfterProcessing === true;
      const requestStartedAt = Date.now();
      requestInFlightRef.current = true;
      const userMsg: AiIntakeMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      setMessages((m) => [...m, userMsg]);
      setExpanded(true);
      setThinking(true);
      setErrorMessage(null);
      if (submitAfterProcessing) setSubmitting(true);

      if (thinkTimer.current) clearTimeout(thinkTimer.current);

      const uploadedRemote = attachments
        .filter((a) => a.status === "uploaded" && a.remoteAttachmentId)
        .map((a) => ({
          attachmentId: a.remoteAttachmentId,
          filename: a.file.name,
          mime: a.mime,
          size: a.size,
        }));

      try {
        const { data, error } = await supabase.functions.invoke(
          "ai-catering-assistant",
          {
            timeout: AI_REQUEST_TIMEOUT_MS,
            body: {
              conversationId: conversationId ?? undefined,
              message: trimmed,
              language,
              action: "chat",
              submitAfterProcessing,
              clientState: {
                uploadedFiles: uploadedRemote,
                currentExtraction: extractionRef.current,
              },
            },
          },
        );
        if (error) throw new Error(error.message || "ai_unavailable");
        const payload = data as {
          conversationId?: string;
          reply?: string;
          extracted?: AiIntakeExtraction;
          missingFields?: unknown;
          readyToSubmit?: boolean;
          awaitingConfirmation?: boolean;
          alreadySubmitted?: boolean;
          triggeredFromChat?: boolean;
          submitSuccess?: boolean;
          submittedInquiryId?: string | null;
          submitError?: string | null;
        };
        if (!payload?.conversationId || !payload?.reply) {
          throw new Error("invalid_response");
        }
        if (payload.conversationId !== conversationId) {
          setConversationId(payload.conversationId);
        }
        if (payload.extracted) setExtraction(payload.extracted);
        setServerMissing(toRequiredFields(payload.missingFields));
        setReadyFromServer(Boolean(payload.readyToSubmit));
        // The server is the only source of truth for awaiting confirmation.
        setAwaitingConfirmation(Boolean(payload.awaitingConfirmation));
        // Reflect server-decided submission outcomes (already submitted, or
        // chat-triggered submit). The CTA / success block is driven from this.
        if (payload.alreadySubmitted && payload.submittedInquiryId) {
          setSubmittedInquiryId(payload.submittedInquiryId);
        }
        if (payload.triggeredFromChat) {
          if (payload.submitSuccess && payload.submittedInquiryId) {
            setSubmittedInquiryId(payload.submittedInquiryId);
            setAwaitingConfirmation(false);
          } else if (payload.submitSuccess === false) {
            setErrorMessage(payload.reply);
          }
        }
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: payload.reply!,
            createdAt: Date.now(),
          },
        ]);
      } catch (e) {
        if (isRequestTimeout(e, requestStartedAt)) {
          console.error("ai-catering-assistant_timeout", e);
          setErrorMessage(timeoutMessage(language));
          return;
        }
        // Fallback: local NLU + best-effort reply so the UI stays usable.
        console.error("ai-catering-assistant_failed", e);
        const nextExtraction = mergeExtraction(
          extractionRef.current,
          mockExtract(trimmed),
        );
        setExtraction(nextExtraction);
        const nextMissing = computeMissing(nextExtraction);
        setServerMissing(null);
        setReadyFromServer(false);
        const reply = buildAssistantReply(language, nextExtraction, nextMissing);
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "assistant",
            content: reply,
            createdAt: Date.now(),
          },
        ]);
        setErrorMessage(
          language === "de"
            ? "Die KI ist aktuell nicht erreichbar. Bitte versuchen Sie es erneut."
            : "The AI is currently unreachable. Please try again.",
        );
      } finally {
        requestInFlightRef.current = false;
        setThinking(false);
        if (submitAfterProcessing) setSubmitting(false);
      }
    },
    [attachments, conversationId, language, setConversationId],
  );

  /* -------- Attachments -------- */

  const totalSize = useMemo(
    () => attachments.reduce((s, a) => s + a.size, 0),
    [attachments],
  );

  const validateFile = useCallback(
    (file: File, currentList: AiAttachmentDraft[]): string | null => {
      const ext = extOf(file.name);
      if (!AI_ALLOWED_EXT.has(ext)) {
        return language === "de"
          ? "Dateityp nicht erlaubt."
          : "File type not allowed.";
      }
      if (!AI_ALLOWED_MIME.has(file.type)) {
        return language === "de"
          ? "MIME-Typ nicht erlaubt."
          : "MIME type not allowed.";
      }
      if (file.size > AI_MAX_FILE_BYTES) {
        return language === "de"
          ? "Datei zu groß (max. 15 MB)."
          : "File too large (max 15 MB).";
      }
      if (currentList.length >= AI_MAX_FILES) {
        return language === "de"
          ? "Maximal 10 Dateien."
          : "Maximum of 10 files.";
      }
      const sum = currentList.reduce((s, a) => s + a.size, 0);
      if (sum + file.size > AI_MAX_TOTAL_BYTES) {
        return language === "de"
          ? "Gesamtgröße überschreitet 50 MB."
          : "Total size exceeds 50 MB.";
      }
      return null;
    },
    [language],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      const drafts: AiAttachmentDraft[] = [];
      let working = [...attachments];
      for (const file of arr) {
        const err = validateFile(file, working);
        const draft: AiAttachmentDraft = {
          id: uid(),
          file,
          size: file.size,
          mime: file.type,
          ext: extOf(file.name),
          status: err ? "error" : "pending",
          errorMessage: err ?? undefined,
          previewUrl: file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined,
        };
        drafts.push(draft);
        if (!err) working = [...working, draft];
      }
      setAttachments((prev) => [...prev, ...drafts]);

      // If we already have a conversationId, upload pending ones via the
      // edge function. Without a conversationId, files stay local.
      if (!conversationId) return;
      for (const draft of drafts.filter((d) => d.status === "pending")) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === draft.id ? { ...a, status: "uploading" as const } : a,
          ),
        );
        try {
          const res = await uploadAttachmentWithConversation(conversationId, draft);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === draft.id
                ? {
                    ...a,
                    status: "uploaded" as const,
                    remoteAttachmentId: res.attachmentId,
                    remoteStoragePath: res.storagePath,
                  }
                : a,
            ),
          );
        } catch (e) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === draft.id
                ? {
                    ...a,
                    status: "error" as const,
                    errorMessage:
                      e instanceof Error ? e.message : "upload_failed",
                  }
                : a,
            ),
          );
        }
      }
    },
    [attachments, conversationId, validateFile],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const next = prev.filter((a) => a.id !== id);
      const gone = prev.find((a) => a.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return next;
    });
  }, []);

  const showSubmitMockNotice = useCallback(() => {
    setNotice(
      language === "de"
        ? "Die finale Übermittlung wird im nächsten Schritt aktiviert."
        : "Final submission will be enabled in the next step.",
    );
  }, [language]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const requestConfirmation = useCallback(() => {
    setErrorMessage(null);
    setAwaitingConfirmation(true);
  }, []);

  const cancelConfirmation = useCallback(() => {
    setAwaitingConfirmation(false);
  }, []);

  const resetConversation = useCallback(() => {
    // Revoke any local preview URLs from non-submitted attachments
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return [];
    });
    setConversationId(null);
    setMessages([]);
    setExtraction({});
    setServerMissing(null);
    setReadyFromServer(false);
    setAwaitingConfirmation(false);
    setSubmittedInquiryId(null);
    setErrorMessage(null);
    setNotice(null);
    setBriefing("");
    requestInFlightRef.current = false;
    extractionRef.current = {};
  }, [setConversationId]);

  const submitInquiry = useCallback(async () => {
    if (!conversationId) {
      setErrorMessage(
        language === "de"
          ? "Bitte senden Sie zunächst eine Nachricht, damit die Anfrage vorbereitet werden kann."
          : "Please send a message first so the request can be prepared.",
      );
      return;
    }
    if (submittedInquiryId || submitting) return;
    const requestStartedAt = Date.now();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "ai-catering-assistant",
        {
          timeout: AI_REQUEST_TIMEOUT_MS,
          body: {
            conversationId,
            action: "submit_inquiry",
            confirmed: true,
          },
        },
      );
      if (error) throw new Error(error.message || "submit_failed");
      const payload = data as {
        success?: boolean;
        inquiryId?: string;
        reply?: string;
        error?: string;
        missingFields?: unknown;
      };
      if (!payload?.success || !payload?.inquiryId) {
        if (payload?.error === "missing_required_fields") {
          setServerMissing(toRequiredFields(payload.missingFields));
          setReadyFromServer(false);
        }
        const reply =
          payload?.reply ||
          (language === "de"
            ? "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie STORIA direkt."
            : "The request could not be sent right now. Please try again or contact STORIA directly.");
        setErrorMessage(reply);
        return;
      }
      setSubmittedInquiryId(payload.inquiryId);
      setAwaitingConfirmation(false);
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          content:
            payload.reply ||
            (language === "de"
              ? "Vielen Dank. Ihre Anfrage wurde an STORIA übermittelt. Wir melden uns mit einem individuellen Angebot."
              : "Thank you. Your request has been submitted to STORIA."),
          createdAt: Date.now(),
        },
      ]);
    } catch (e) {
      if (isRequestTimeout(e, requestStartedAt)) {
        console.error("submit_inquiry_timeout", e);
        setErrorMessage(timeoutMessage(language));
        return;
      }
      console.error("submit_inquiry_failed", e);
      setErrorMessage(
        language === "de"
          ? "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie STORIA direkt."
          : "The request could not be sent right now. Please try again or contact STORIA directly.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [conversationId, language, submitting, submittedInquiryId]);

  return {
    // state
    expanded,
    briefing,
    messages,
    extraction,
    attachments,
    thinking,
    missing,
    canSubmit,
    ctaState,
    loadingState,
    totalSize,
    conversationId,
    notice,
    errorMessage,
    awaitingConfirmation,
    submitting,
    submittedInquiryId,
    // setters
    setBriefing,
    setExtraction,
    setConversationId,
    // actions
    expand,
    collapse,
    sendMessage,
    addFiles,
    removeAttachment,
    showSubmitMockNotice,
    clearNotice,
    requestConfirmation,
    cancelConfirmation,
    submitInquiry,
    resetConversation,
  };
}