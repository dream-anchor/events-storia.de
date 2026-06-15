import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const MODEL = "google/gemini-3-flash-preview";
const MAX_MESSAGE_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STOPWORDS = new Set([
  "der","die","das","den","dem","des","ein","eine","einer","einem","einen","und","oder","aber","mit","ohne","für","zu","zum","zur","von","vom","im","in","am","an","auf","aus","über","unter","wir","ihr","sie","es","ich","du","mein","meine","euer","eure",
  "the","a","an","and","or","for","to","of","in","on","at","with","without","is","are","was","were","be","been","being","that","this","it","i","we","you","they",
  "ja","nein","bitte","danke","hallo","guten","tag","please","thanks","hello",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
    .slice(0, 12);
}

const REQUIRED_FIELDS = [
  "contactName",
  "email",
  "guestCount",
  "preferredDate", // OR dateRange
] as const;

type Lang = "de" | "en";
type Intent = "faq" | "inquiry" | "mixed";

interface Extracted {
  contactName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  guestCount: number | null;
  eventType: string | null;
  preferredDate: string | null;
  dateRange: string | null;
  timeSlot: string | null;
  locationName: string | null;
  deliveryAddress: string | null;
  budget: string | null;
  foodPreferences: string[];
  dietaryRequirements: string[];
  serviceNeeds: string[];
  equipmentNeeds: string[];
  attachmentsMentioned: boolean;
  openQuestions: string[];
  summary: string | null;
  originalUserText: string | null;
}

function emptyExtraction(): Extracted {
  return {
    contactName: null,
    email: null,
    phone: null,
    companyName: null,
    guestCount: null,
    eventType: null,
    preferredDate: null,
    dateRange: null,
    timeSlot: null,
    locationName: null,
    deliveryAddress: null,
    budget: null,
    foodPreferences: [],
    dietaryRequirements: [],
    serviceNeeds: [],
    equipmentNeeds: [],
    attachmentsMentioned: false,
    openQuestions: [],
    summary: null,
    originalUserText: null,
  };
}

function mergeExtraction(prev: Extracted, next: Partial<Extracted>): Extracted {
  const out: Extracted = { ...prev };
  for (const k of Object.keys(next) as (keyof Extracted)[]) {
    const v = next[k];
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length > 0) {
        const merged = new Set<string>([
          ...((prev[k] as string[] | undefined) ?? []),
          ...v.map((x) => String(x)),
        ]);
        (out as Record<string, unknown>)[k] = Array.from(merged);
      }
    } else if (typeof v === "string") {
      if (v.trim().length > 0) (out as Record<string, unknown>)[k] = v.trim();
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

function emailLooksValid(e: string | null | undefined): boolean {
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function computeMissing(e: Extracted): string[] {
  const missing: string[] = [];
  if (!e.contactName) missing.push("contactName");
  if (!emailLooksValid(e.email)) missing.push("email");
  if (!e.guestCount || e.guestCount <= 0) missing.push("guestCount");
  if (!e.preferredDate && !e.dateRange) missing.push("preferredDate");
  return missing;
}

function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* -------- Rate limit (in-memory; best-effort) -------- */
const rateMap = new Map<string, { count: number; reset: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
function checkRate(key: string): boolean {
  const now = Date.now();
  const e = rateMap.get(key);
  if (!e || e.reset < now) {
    rateMap.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (e.count >= RATE_MAX) return false;
  e.count += 1;
  return true;
}

/* -------- System prompt -------- */

function systemPrompt(lang: Lang): string {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const currentYear = today.getUTCFullYear();
  const de = `Du bist die KI-Assistenz von STORIA, einem italienischen Catering- und Eventunternehmen in München (offiziell info@events-storia.de).

HEUTE
- Heutiges Datum (UTC): ${todayIso}. Aktuelles Jahr: ${currentYear}.

ROLLE
- Antworte freundlich, klar, professionell. Auf Deutsch immer formell mit "Sie".
- Wenn der Nutzer Englisch schreibt: antworte Englisch. Sprache unklar → Deutsch.
- Mache klar: Du bereitest die Anfrage für STORIA vor. Du erstellst KEIN finales Angebot. Final geprüft und freigegeben wird durch das STORIA-Team. Formuliere z. B. "Ich bereite Ihre Anfrage für STORIA vor." statt "Hier ist Ihr Angebot".

AUFGABE
- Klassifiziere die Nachricht als "faq", "inquiry" oder "mixed".
- Beantworte FAQs nur mit gesichertem allgemeinen Wissen. Erfinde NIEMALS konkrete Preise, Mindestmengen, Lieferbedingungen, AGB- oder Rechtsaussagen.
- Wenn unsicher: "Das klärt das STORIA-Team gerne individuell für Ihre Anfrage."
- Für inquiries/mixed: extrahiere Lead-Daten konservativ und frage gezielt nach den noch fehlenden Pflichtangaben.
- Pflichtangaben sind: Ansprechpartner (contactName), E-Mail (email), Personenanzahl (guestCount), Datum (preferredDate) ODER Zeitraum (dateRange).

EXTRAKTIONSREGELN
- contactName nicht aus E-Mail-Adressen raten.
- preferredDate nur bei einem KONKRETEN Datum setzen, immer als ISO YYYY-MM-DD.
- Datum-Jahr-Regel: Verwende NIEMALS ein vergangenes Datum. Wenn der Nutzer nur Tag und Monat angibt (z. B. "14.7.", "am 3. Oktober"): nimm das nächste zukünftige Vorkommen. Wenn das Datum im aktuellen Jahr (${currentYear}) bereits vergangen ist, verwende das nächste Jahr.
- "im Juli", "Ende September", "Q4", "im Sommer", "im Herbst" → dateRange (nicht preferredDate). Erfinde KEIN konkretes Datum aus einem Zeitraum.
- Im Zweifel lieber dateRange (z. B. "Juli ${currentYear}") setzen als ein falsches konkretes Datum.
- guestCount als Zahl. "ca. 35" → 35. Bei Spannen ("30-40") nimm einen sinnvollen Mittelwert oder die kleinere Zahl.
- email muss formal gültig sein, sonst null.
- attachmentsMentioned = true, wenn der Nutzer Fotos, Briefing-PDFs, Moodboards o. ä. erwähnt.

UPLOADS
- Wenn Uploads erwähnt werden: "Sie können Fotos oder Dokumente direkt hier hochladen. Das STORIA-Team sieht diese später in Maestro."
- Wenn bereits Dateien hochgeladen wurden (clientState.uploadedFiles > 0): "Ich habe die Dateien zur Anfrage hinzugefügt. Das STORIA-Team kann sie später in Maestro einsehen."
- Behaupte keine Bilddetails — es findet keine Bildanalyse statt.

ANTWORTFORMAT — STRENG
Antworte AUSSCHLIESSLICH durch Aufruf der Funktion "respond". Kein Fließtext daneben.`;

  const en = `You are the AI assistant of STORIA, an Italian catering and event company in Munich (official: info@events-storia.de).

TODAY
- Today's date (UTC): ${todayIso}. Current year: ${currentYear}.

ROLE
- Friendly, clear, professional. In German always formal ("Sie").
- Match the user's language. If unclear, default to German.
- Make clear: you prepare the request for STORIA. You do NOT create a final offer. Final review and approval happens through the STORIA team. Prefer "I'm preparing your request for STORIA" over "Here is your offer".

TASK
- Classify the message as "faq", "inquiry" or "mixed".
- Answer FAQs only with safe general knowledge. NEVER invent concrete prices, minimums, delivery terms or legal statements.
- If unsure: "The STORIA team will gladly clarify this individually for your request."
- For inquiries/mixed: extract lead data conservatively and ask gently for the still missing required fields.
- Required fields: contactName, email, guestCount, preferredDate OR dateRange.

EXTRACTION
- Do not guess contactName from email addresses.
- preferredDate only when a CONCRETE date is given, always as ISO YYYY-MM-DD.
- Year rule: NEVER use a past date. If the user gives only day+month (e.g. "14.7.", "Oct 3"), use the next future occurrence. If that date in the current year (${currentYear}) is already past, use next year.
- "in July", "late September", "Q4", "in summer", "in autumn" → dateRange (not preferredDate). Do NOT invent a concrete date from a time frame.
- When in doubt, prefer dateRange (e.g. "July ${currentYear}") over a wrong concrete date.
- guestCount as a number. Range → median/lower bound.
- email must look formally valid, otherwise null.

UPLOADS
- If the user mentions photos/documents: "You can upload photos or documents directly here. The STORIA team will see them later in Maestro."
- If files were already uploaded (clientState.uploadedFiles > 0): "I've added the files to your request. The STORIA team will see them later in Maestro."
- Do not claim image details — there is no image analysis.

OUTPUT FORMAT — STRICT
Respond ONLY by calling the "respond" function. No prose alongside.`;

  return lang === "en" ? en : de;
}

const RESPOND_TOOL = {
  type: "function",
  function: {
    name: "respond",
    description: "Assistant reply, intent, structured extraction, missing fields.",
    parameters: {
      type: "object",
      properties: {
        reply: { type: "string", description: "The user-facing reply text." },
        intent: { type: "string", enum: ["faq", "inquiry", "mixed"] },
        suggestedNextQuestion: { type: "string" },
        extracted: {
          type: "object",
          properties: {
            contactName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            companyName: { type: "string" },
            guestCount: { type: "number" },
            eventType: { type: "string" },
            preferredDate: { type: "string" },
            dateRange: { type: "string" },
            timeSlot: { type: "string" },
            locationName: { type: "string" },
            deliveryAddress: { type: "string" },
            budget: { type: "string" },
            foodPreferences: { type: "array", items: { type: "string" } },
            dietaryRequirements: { type: "array", items: { type: "string" } },
            serviceNeeds: { type: "array", items: { type: "string" } },
            equipmentNeeds: { type: "array", items: { type: "string" } },
            attachmentsMentioned: { type: "boolean" },
            openQuestions: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
          },
        },
      },
      required: ["reply", "intent", "extracted"],
    },
  },
} as const;

/* -------- AI Gateway call -------- */

async function callAiGateway(
  apiKey: string,
  lang: Lang,
  history: { role: "user" | "assistant"; content: string }[],
  currentExtraction: Extracted,
  uploadedFiles: number,
  knowledgeContext: string,
): Promise<{
  reply: string;
  intent: Intent;
  extracted: Partial<Extracted>;
  suggestedNextQuestion?: string;
} | null> {
  const systemMessage = {
    role: "system",
    content:
      systemPrompt(lang) +
      `\n\nKONTEXT (aktuelle Extraktion, JSON): ${JSON.stringify(currentExtraction)}\n` +
      `KONTEXT (clientState.uploadedFiles.count): ${uploadedFiles}` +
      (knowledgeContext
        ? `\n\n${knowledgeContext}`
        : "\n\nVERFÜGBARE QUELLEN: (keine passenden öffentlichen Quellen gefunden — bei Sachfragen ausdrücklich auf das STORIA-Team verweisen, niemals Preise/Liefer-/Zahlungs-/AGB-Aussagen erfinden)"),
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [systemMessage, ...history],
      tools: [RESPOND_TOOL],
      tool_choice: { type: "function", function: { name: "respond" } },
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("ai_gateway_error", res.status, txt.slice(0, 300));
    if (res.status === 429) throw new Error("rate_limited_upstream");
    if (res.status === 402) throw new Error("credits_exhausted");
    throw new Error(`upstream_${res.status}`);
  }

  const data = await res.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== "respond") return null;
  try {
    const args = JSON.parse(toolCall.function.arguments);
    return {
      reply: String(args.reply ?? "").trim(),
      intent: (args.intent === "faq" || args.intent === "mixed"
        ? args.intent
        : "inquiry") as Intent,
      extracted: (args.extracted ?? {}) as Partial<Extracted>,
      suggestedNextQuestion:
        typeof args.suggestedNextQuestion === "string"
          ? args.suggestedNextQuestion
          : undefined,
    };
  } catch (e) {
    console.error("tool_args_parse_failed", (e as Error).message);
    return null;
  }
}

function fallbackReply(lang: Lang, missing: string[]): string {
  if (lang === "en") {
    if (missing.length === 0) {
      return "Thank you. I have all required details — you can send the request to STORIA now.";
    }
    return "Thank you for your message. To prepare an offer, the STORIA team still needs a few details. Could you provide them?";
  }
  if (missing.length === 0) {
    return "Vielen Dank. Alle Pflichtangaben liegen vor — Sie können die Anfrage jetzt an STORIA senden.";
  }
  return "Vielen Dank für Ihre Nachricht. Damit STORIA Ihnen ein passendes Angebot senden kann, fehlen noch einige Angaben. Können Sie diese kurz ergänzen?";
}

/* -------- Handler -------- */

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, cors);
  }

  let body: {
    conversationId?: unknown;
    message?: unknown;
    language?: unknown;
    action?: unknown;
    confirmed?: unknown;
    clientState?: { uploadedFiles?: unknown; currentExtraction?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, cors);
  }

  const action = typeof body.action === "string" ? body.action : "chat";
  const incomingConvId =
    typeof body.conversationId === "string" && UUID_RE.test(body.conversationId)
      ? body.conversationId
      : null;
  const language: Lang = body.language === "en" ? "en" : "de";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // -------- submit_inquiry branch --------
  if (action === "submit_inquiry") {
    if (!incomingConvId) {
      return jsonResponse({ error: "conversation_required" }, 400, cors);
    }
    if (body.confirmed !== true) {
      return jsonResponse({ error: "confirmation_required" }, 400, cors);
    }
    const rateKey = `submit:${incomingConvId}`;
    if (!checkRate(rateKey)) {
      return jsonResponse({ error: "rate_limited" }, 429, cors);
    }
    return await handleSubmitInquiry(supabase, incomingConvId, language, cors);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return jsonResponse({ error: "message_required" }, 400, cors);
  if (message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse({ error: "message_too_long" }, 400, cors);
  }

  const uploadedFilesCount = Array.isArray(body.clientState?.uploadedFiles)
    ? (body.clientState!.uploadedFiles as unknown[]).length
    : 0;

  // Rate limit by conversationId when present, otherwise by client hint
  const rateKey =
    incomingConvId ??
    req.headers.get("x-forwarded-for") ??
    req.headers.get("cf-connecting-ip") ??
    "anon";
  if (!checkRate(rateKey)) {
    return jsonResponse({ error: "rate_limited" }, 429, cors);
  }

  // 1. Resolve / create conversation
  let conversationId = incomingConvId;
  let conversationStatus = "active";
  if (conversationId) {
    const { data: existing, error } = await supabase
      .from("ai_conversations")
      .select("id, status, language")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) {
      console.error("conv_lookup_failed");
      return jsonResponse({ error: "lookup_failed" }, 500, cors);
    }
    if (!existing) {
      conversationId = null; // fall through to create
    } else {
      conversationStatus = existing.status;
    }
  }
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("ai_conversations")
      .insert({
        language,
        status: "active",
        source: "ai_intake_bar",
      })
      .select("id, status")
      .single();
    if (error || !created) {
      console.error("conv_create_failed");
      return jsonResponse({ error: "create_failed" }, 500, cors);
    }
    conversationId = created.id;
    conversationStatus = created.status;
  }

  // 2. Persist user message
  const { error: userMsgErr } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
    metadata: { uploadedFilesCount },
  });
  if (userMsgErr) console.error("user_msg_insert_failed");

  // 3. Build history from DB (so refresh works)
  const { data: history } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  const chatHistory = (history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content ?? ""),
    }));

  // 4. Current extraction baseline (latest stored, optionally merged with clientState)
  const { data: latestExtraction } = await supabase
    .from("ai_extractions")
    .select("extracted")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let currentExtraction: Extracted = emptyExtraction();
  if (latestExtraction?.extracted && typeof latestExtraction.extracted === "object") {
    currentExtraction = mergeExtraction(
      currentExtraction,
      latestExtraction.extracted as Partial<Extracted>,
    );
  }
  if (body.clientState?.currentExtraction && typeof body.clientState.currentExtraction === "object") {
    currentExtraction = mergeExtraction(
      currentExtraction,
      body.clientState.currentExtraction as Partial<Extracted>,
    );
  }
  currentExtraction.attachmentsMentioned =
    currentExtraction.attachmentsMentioned || uploadedFilesCount > 0;

  // 4b. Knowledge lookup (safe sources only)
  const knowledgeContext = await lookupKnowledge(supabase, message);

  // 5. Call AI gateway
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  let reply = "";
  let intent: Intent = "inquiry";
  let suggestedNextQuestion: string | undefined;
  let nextExtraction = currentExtraction;

  if (!apiKey) {
    console.error("missing_lovable_api_key");
    reply = fallbackReply(language, computeMissing(currentExtraction));
  } else {
    try {
      const aiResult = await callAiGateway(
        apiKey,
        language,
        chatHistory,
        currentExtraction,
        uploadedFilesCount,
        knowledgeContext,
      );
      if (aiResult) {
        reply = aiResult.reply || fallbackReply(language, computeMissing(currentExtraction));
        intent = aiResult.intent;
        suggestedNextQuestion = aiResult.suggestedNextQuestion;
        const extractedClean: Partial<Extracted> = { ...aiResult.extracted };
        if (!emailLooksValid(extractedClean.email)) extractedClean.email = null;
        extractedClean.originalUserText = message;
        nextExtraction = mergeExtraction(currentExtraction, extractedClean);
      } else {
        reply = fallbackReply(language, computeMissing(currentExtraction));
      }
    } catch (e) {
      const err = (e as Error).message;
      if (err === "credits_exhausted") {
        return jsonResponse(
          { error: "ai_unavailable", reason: "credits" },
          402,
          cors,
        );
      }
      if (err === "rate_limited_upstream") {
        return jsonResponse({ error: "rate_limited" }, 429, cors);
      }
      console.error("ai_call_failed", err);
      reply = fallbackReply(language, computeMissing(currentExtraction));
    }
  }

  const missingFields = computeMissing(nextExtraction);
  const readyToSubmit = missingFields.length === 0;

  // 6. Persist assistant message + extraction + status
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: reply,
    metadata: { intent, missingFields },
  });

  await supabase.from("ai_extractions").insert({
    conversation_id: conversationId,
    extracted: nextExtraction,
    missing_fields: missingFields,
    confidence: {},
  });

  const desiredStatus = readyToSubmit ? "ready_to_submit" : "active";
  if (desiredStatus !== conversationStatus) {
    await supabase
      .from("ai_conversations")
      .update({ status: desiredStatus })
      .eq("id", conversationId);
  }

  return jsonResponse(
    {
      conversationId,
      reply,
      intent,
      extracted: nextExtraction,
      missingFields,
      readyToSubmit,
      requiresConfirmation: false,
      suggestedNextQuestion,
    },
    200,
    cors,
  );
});

// Suppress unused-warning for REQUIRED_FIELDS (kept for clarity / future use)
void REQUIRED_FIELDS;

/* ============================================================
 * submit_inquiry — server-to-server call to receive-event-inquiry
 * ============================================================ */

type SupaClient = ReturnType<typeof createClient>;

/* -------- Knowledge lookup (safe sources only) -------- */

async function lookupKnowledge(
  supabase: SupaClient,
  query: string,
): Promise<string> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return "";
  try {
    // Pull candidate active chunks via ILIKE on top tokens; rank in-memory.
    const orExpr = tokens
      .slice(0, 6)
      .map((t) => `content.ilike.%${t.replace(/[,()]/g, " ")}%`)
      .join(",");
    const { data: chunks } = await supabase
      .from("knowledge_chunks")
      .select("content, metadata, document_id, knowledge_documents!inner(status, title, path)")
      .eq("knowledge_documents.status", "active")
      .or(orExpr)
      .limit(20);
    if (!chunks || chunks.length === 0) return "";
    type Row = {
      content: string;
      metadata: Record<string, unknown> | null;
      knowledge_documents: { title: string | null; path: string | null; status: string };
    };
    const safe = (chunks as unknown as Row[]).filter((c) => {
      const meta = (c.metadata ?? {}) as Record<string, unknown>;
      if (meta.requires_manual_review === true) return false;
      if (meta.status && meta.status !== "active") return false;
      if (meta.risk && meta.risk !== null) return false;
      return true;
    });
    const scored = safe.map((c) => {
      const lc = (c.content || "").toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (lc.includes(t)) score += 1;
      }
      return { c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter((x) => x.score > 0).slice(0, 5);
    if (top.length === 0) return "";
    const lines: string[] = [
      "VERFÜGBARE QUELLEN (nur diese als gesicherte Fakten verwenden — wenn die Frage hier nicht beantwortet wird, ausdrücklich auf das STORIA-Team verweisen; KEINE Preise/Liefer-/Zahlungs-/AGB-Aussagen erfinden):",
    ];
    top.forEach((x, i) => {
      const title = x.c.knowledge_documents?.title ?? "Quelle";
      const text = x.c.content.slice(0, 800);
      lines.push(`\n[Quelle ${i + 1}: ${title}]\n${text}`);
    });
    return lines.join("\n");
  } catch (e) {
    console.error("knowledge_lookup_failed", (e as Error).message);
    return "";
  }
}

function buildInquiryMessageText(
  e: Extracted,
  messages: { role: string; content: string }[],
  attachmentNames: string[],
): string {
  const lines: string[] = [];
  lines.push("AI INTAKE ZUSAMMENFASSUNG");
  lines.push("");
  if (e.originalUserText) {
    lines.push("Originaltext des Kunden:");
    lines.push(e.originalUserText);
    lines.push("");
  }
  lines.push("Erkannte Angaben:");
  lines.push(`- Name / Ansprechpartner: ${e.contactName ?? "(nicht angegeben)"}`);
  lines.push(`- E-Mail: ${e.email ?? "(nicht angegeben)"}`);
  lines.push(`- Telefon: ${e.phone ?? "(nicht angegeben)"}`);
  lines.push(`- Firma: ${e.companyName ?? "(nicht angegeben)"}`);
  lines.push(
    `- Personenanzahl: ${e.guestCount != null ? String(e.guestCount) : "(nicht angegeben)"}`,
  );
  const dateText = e.preferredDate
    ? e.preferredDate
    : e.dateRange
      ? `Zeitraum: ${e.dateRange}`
      : "(nicht angegeben)";
  lines.push(`- Datum / Zeitraum: ${dateText}`);
  lines.push(`- Uhrzeit: ${e.timeSlot ?? "(nicht angegeben)"}`);
  lines.push(`- Anlass: ${e.eventType ?? "(nicht angegeben)"}`);
  const place = e.locationName || e.deliveryAddress;
  lines.push(`- Ort / Lieferadresse: ${place ?? "(nicht angegeben)"}`);
  lines.push(
    `- Speisenwünsche: ${e.foodPreferences?.length ? e.foodPreferences.join(", ") : "(nicht angegeben)"}`,
  );
  lines.push(
    `- Allergien / besondere Anforderungen: ${e.dietaryRequirements?.length ? e.dietaryRequirements.join(", ") : "(nicht angegeben)"}`,
  );
  const serviceEquip = [
    ...(e.serviceNeeds ?? []),
    ...(e.equipmentNeeds ?? []),
  ];
  lines.push(
    `- Service / Equipment: ${serviceEquip.length ? serviceEquip.join(", ") : "(nicht angegeben)"}`,
  );
  lines.push("");
  lines.push("Hochgeladene Dateien:");
  if (attachmentNames.length === 0) {
    lines.push("- (keine)");
  } else {
    for (const n of attachmentNames) lines.push(`- ${n}`);
  }
  lines.push("");
  lines.push("Offene Punkte:");
  if (e.openQuestions?.length) {
    for (const q of e.openQuestions) lines.push(`- ${q}`);
  } else {
    lines.push("- (keine)");
  }
  lines.push("");
  lines.push("Gesprächsprotokoll:");
  for (const m of messages) {
    const who = m.role === "user" ? "Kunde" : m.role === "assistant" ? "KI" : m.role;
    const content = String(m.content ?? "").trim();
    if (!content) continue;
    lines.push(`${who}: ${content}`);
  }
  return lines.join("\n");
}

function isIsoDate(s: string | null | undefined): boolean {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function handleSubmitInquiry(
  supabase: SupaClient,
  conversationId: string,
  language: Lang,
  cors: Record<string, string>,
): Promise<Response> {
  // Load conversation
  const { data: conv, error: convErr } = await supabase
    .from("ai_conversations")
    .select("id, status, inquiry_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr || !conv) {
    return jsonResponse({ success: false, error: "conversation_not_found" }, 404, cors);
  }
  if (conv.status === "submitted" && conv.inquiry_id) {
    return jsonResponse(
      {
        success: true,
        inquiryId: conv.inquiry_id,
        reply:
          language === "en"
            ? "Your request has already been sent to STORIA."
            : "Ihre Anfrage wurde bereits an STORIA übermittelt.",
      },
      200,
      cors,
    );
  }

  // Load latest extraction
  const { data: latest } = await supabase
    .from("ai_extractions")
    .select("extracted")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let extraction = emptyExtraction();
  if (latest?.extracted && typeof latest.extracted === "object") {
    extraction = mergeExtraction(extraction, latest.extracted as Partial<Extracted>);
  }

  const missingFields = computeMissing(extraction);
  if (missingFields.length > 0) {
    const replyDe =
      "Für die Übermittlung fehlen noch folgende Angaben: " +
      missingFields.join(", ") +
      ".";
    const replyEn =
      "For submission, the following details are still missing: " +
      missingFields.join(", ") +
      ".";
    return jsonResponse(
      {
        success: false,
        error: "missing_required_fields",
        missingFields,
        reply: language === "en" ? replyEn : replyDe,
      },
      400,
      cors,
    );
  }

  // Load all messages
  const { data: msgs } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // Load attachment filenames
  const { data: attRows } = await supabase
    .from("inquiry_attachments")
    .select("id, original_filename")
    .eq("conversation_id", conversationId)
    .is("inquiry_id", null);

  const attachmentNames = (attRows ?? []).map((r) => String(r.original_filename));
  const messageText = buildInquiryMessageText(extraction, msgs ?? [], attachmentNames);

  const payload: Record<string, unknown> = {
    contactName: extraction.contactName,
    email: extraction.email,
    phone: extraction.phone ?? undefined,
    companyName: extraction.companyName ?? undefined,
    guestCount:
      extraction.guestCount != null ? String(extraction.guestCount) : undefined,
    eventType: extraction.eventType ?? undefined,
    preferredDate: isIsoDate(extraction.preferredDate)
      ? extraction.preferredDate
      : undefined,
    timeSlot: extraction.timeSlot ?? undefined,
    message: messageText,
    source: "ai_intake_bar",
  };

  // Server-to-server call to receive-event-inquiry
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let inquiryId: string | null = null;
  try {
    const res = await fetch(`${supaUrl}/functions/v1/receive-event-inquiry`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("receive_event_inquiry_failed", res.status, txt.slice(0, 300));
      return jsonResponse(
        {
          success: false,
          error: "submit_failed",
          reply:
            language === "en"
              ? "The request could not be sent right now. Please try again or contact STORIA directly."
              : "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie STORIA direkt.",
        },
        502,
        cors,
      );
    }
    const json = await res.json().catch(() => ({}));
    inquiryId = typeof json?.inquiryId === "string" ? json.inquiryId : null;
  } catch (e) {
    console.error("receive_event_inquiry_call_failed", (e as Error).message);
    return jsonResponse(
      {
        success: false,
        error: "submit_failed",
        reply:
          language === "en"
            ? "The request could not be sent right now. Please try again or contact STORIA directly."
            : "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie STORIA direkt.",
      },
      502,
      cors,
    );
  }

  if (!inquiryId) {
    return jsonResponse(
      {
        success: false,
        error: "submit_failed",
        reply:
          language === "en"
            ? "The request could not be sent right now. Please try again or contact STORIA directly."
            : "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie STORIA direkt.",
      },
      502,
      cors,
    );
  }

  // Update conversation
  await supabase
    .from("ai_conversations")
    .update({ status: "submitted", inquiry_id: inquiryId })
    .eq("id", conversationId);

  // Link attachments
  await supabase
    .from("inquiry_attachments")
    .update({ inquiry_id: inquiryId })
    .eq("conversation_id", conversationId)
    .is("inquiry_id", null);

  const successReply =
    language === "en"
      ? "Thank you. Your request has been submitted to STORIA. We will get back to you with an individual offer."
      : "Vielen Dank. Ihre Anfrage wurde an STORIA übermittelt. Wir melden uns mit einem individuellen Angebot.";

  // Persist a system-style assistant message so the chat log reflects submission
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: successReply,
    metadata: { event: "submit_inquiry", inquiryId },
  });

  return jsonResponse(
    { success: true, inquiryId, reply: successReply },
    200,
    cors,
  );
}