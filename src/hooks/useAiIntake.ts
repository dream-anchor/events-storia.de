import { useCallback, useMemo, useRef, useState } from "react";
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

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* -------- Mock NLU (Step 3 – no AI backend yet) -------- */

function mockExtract(text: string): AiIntakeExtraction {
  const out: AiIntakeExtraction = {};
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) out.email = email[0];

  const phone = text.match(/\+?\d[\d\s/().-]{6,}\d/);
  if (phone) out.phone = phone[0].trim();

  const guests = text.match(/(?:ca\.?\s*|circa\s*|about\s*|für\s*|for\s*)?(\d{1,4})\s*(?:personen|gäste|guests|people|pax)/i);
  if (guests) out.guestCount = Number(guests[1]);

  const date = text.match(/(\d{1,2}\.\s?\d{1,2}\.?(?:\s?\d{2,4})?)|(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (date) out.eventDate = (date[0] || "").trim();

  const city = text.match(/\b(M[üu]nchen|Munich|Berlin|Hamburg|K[öo]ln|Stuttgart|Frankfurt|Augsburg|N[üu]rnberg)\b/i);
  if (city) out.location = city[0];

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
  if (food) out.foodWish = food;

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
  if (!e.eventDate && !e.eventDateRange) missing.push("eventDate");
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
    eventDate: { de: "ein Datum oder Zeitraum", en: "a date or time frame" },
    guestCount: { de: "die ungefähre Personenanzahl", en: "the approximate number of guests" },
  };

  const known: string[] = [];
  if (extraction.guestCount) known.push(lang === "de" ? "Personenanzahl" : "guest count");
  if (extraction.eventDate || extraction.eventDateRange) known.push(lang === "de" ? "Datum" : "date");
  if (extraction.email) known.push("E-Mail");
  if (extraction.location) known.push(lang === "de" ? "Ort" : "location");
  if (extraction.foodWish) known.push(lang === "de" ? "Speisenwunsch" : "menu preference");

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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const thinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const missing = useMemo(() => computeMissing(extraction), [extraction]);
  const canSubmit = missing.length === 0;

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMsg: AiIntakeMessage = {
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const nextExtraction = mergeExtraction(extraction, mockExtract(trimmed));
      setMessages((m) => [...m, userMsg]);
      setExtraction(nextExtraction);
      setExpanded(true);
      setThinking(true);

      if (thinkTimer.current) clearTimeout(thinkTimer.current);
      thinkTimer.current = setTimeout(() => {
        const nextMissing = computeMissing(nextExtraction);
        const reply = buildAssistantReply(language, nextExtraction, nextMissing);
        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", content: reply, createdAt: Date.now() },
        ]);
        setThinking(false);
      }, 650);
    },
    [extraction, language],
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
    totalSize,
    conversationId,
    notice,
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
  };
}