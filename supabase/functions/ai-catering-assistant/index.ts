import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  type Draft,
  type DraftItemSuggestion,
  type DraftPackageSuggestion,
  computeEstimate,
  computeSubtotal,
  emptyDraft,
  isDraftLike,
  resolvePackagePrice,
} from "../_shared/draft-pricing.ts";
import {
  type CatalogItem,
  type CatalogPackage,
  type CatalogSnippet,
} from "../_shared/catalog-snippet.ts";

const MODEL = "google/gemini-3-flash-preview";
const MAX_MESSAGE_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 30;
const AI_GATEWAY_TIMEOUT_MS = 16_000;
const SUBMIT_FETCH_TIMEOUT_MS = 18_000;
const KNOWLEDGE_TIMEOUT_MS = 2_500;
const DRAFT_TIMEOUT_MS = 2_500;

type Trace = {
  id: string;
  action: string;
  start: number;
  last: number;
  timings: Record<string, number>;
};

function createTrace(action: string): Trace {
  const now = Date.now();
  const trace = {
    id: crypto.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    start: now,
    last: now,
    timings: {},
  };
  console.log(JSON.stringify({ event: "request_start", request_id: trace.id, action }));
  return trace;
}

function traceStep(trace: Trace, step: string, extra = "", timingKey?: string) {
  const now = Date.now();
  if (timingKey) trace.timings[timingKey] = now - trace.last;
  console.log(
    `[ai-catering-assistant] ${trace.id} ${step} total_ms=${now - trace.start} delta_ms=${now - trace.last}${extra ? ` ${extra}` : ""}`,
  );
  trace.last = now;
}

function traceEnd(trace: Trace, extra: Record<string, unknown> = {}) {
  const totalMs = Date.now() - trace.start;
  console.log(JSON.stringify({
    event: "request_end",
    request_id: trace.id,
    action: trace.action,
    conversation_load_ms: trace.timings.conversation_load_ms ?? null,
    extraction_ms: trace.timings.extraction_ms ?? null,
    knowledge_lookup_ms: trace.timings.knowledge_lookup_ms ?? null,
    ai_call_ms: trace.timings.ai_call_ms ?? null,
    draft_ms: trace.timings.draft_ms ?? null,
    submit_ms: trace.timings.submit_ms ?? null,
    receive_event_ms: trace.timings.receive_event_ms ?? null,
    total_ms: totalMs,
    ...extra,
  }));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutError: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new Error(timeoutError);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

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

ANTWORT-STIL — KLARTEXT, KEIN MARKDOWN
- Verwende NIEMALS Markdown-Formatierung. Kein **fett**, kein __unterstrichen__, kein *kursiv*, keine ### Überschriften, keine Tabellen, keine Codeblöcke, keine Backticks.
- Antworte in einfachen, gut lesbaren Klartext-Absätzen.
- Einfache nummerierte Listen (1. 2. 3.) ohne Fettung sind erlaubt. Einfache Bindestrichlisten (- Punkt) ohne Fettung sind erlaubt.
- Niemals Stichwörter wie "Datum", "Name", "E-Mail" mit Sternchen umrahmen. Schreibe sie als normale Wörter.

AUFGABE
- Klassifiziere die Nachricht als "faq", "inquiry" oder "mixed".
- Beantworte FAQs nur mit gesichertem allgemeinen Wissen. Erfinde NIEMALS konkrete Preise, Mindestmengen, Lieferbedingungen, AGB- oder Rechtsaussagen.
- Wenn unsicher: "Das klärt das STORIA-Team gerne individuell für Ihre Anfrage."
- Für inquiries/mixed: extrahiere Lead-Daten konservativ und frage gezielt nach den noch fehlenden Pflichtangaben.
- Pflichtangaben sind: Ansprechpartner (contactName), E-Mail (email), Personenanzahl (guestCount), Datum (preferredDate) ODER Zeitraum (dateRange).

FUNNEL-PHASEN
- Phase 1 (Orientierung): kurze, hilfreiche erste Einordnung. Maximal 1–2 fehlende Pflichtangaben gleichzeitig erfragen. Nicht formularhaft wirken.
- Phase 2 (Vorschlag): sobald genug Infos vorhanden sind, einen kompakten unverbindlichen Vorschlag skizzieren und klar sagen, dass STORIA persönlich prüft.
- Phase 3a (Ernährungsfrage): sobald ALLE Pflichtangaben (Name, E-Mail, Personenanzahl, Datum/Zeitraum) vorliegen, frage zuerst GENAU EINMAL elegant nach Ernährungswünschen — es sei denn, der Nutzer hat bereits etwas dazu gesagt (siehe extracted.dietaryRequirements oder extracted.foodPreferences) ODER hat die Frage bereits beantwortet (auch mit "nein"/"keine"). Formulierung: "Gibt es vegetarische oder vegane Wünsche, Allergien oder Unverträglichkeiten, die STORIA berücksichtigen soll? Falls nicht, kann ich die Anfrage direkt übermitteln." In diesem Turn setze requestSubmitConfirmation=false. Wenn der Nutzer im selben Turn die Ernährungsfrage klar beantwortet UND eindeutig senden möchte ("Nein, bitte senden", "Keine, abschicken", "Vegan bitte, senden"), darfst du Phase 3a überspringen.
- Phase 3b (Abschluss): sobald die Ernährungsfrage gestellt UND beantwortet wurde (egal ob "keine", konkrete Wünsche oder leere Bestätigung), frage GENAU EINMAL: "Soll ich diese Anfrage jetzt unverbindlich an STORIA übermitteln?" und setze dabei requestSubmitConfirmation=true. In allen anderen Fällen setze requestSubmitConfirmation=false.
- Ernährungsantworten konsequent in extracted.dietaryRequirements / extracted.foodPreferences übernehmen. "Keine" / "Nein" / "None" → dietaryRequirements=["keine"] setzen, damit die Frage als beantwortet gilt.

ABSCHLUSS — STRENG
- Du übermittelst NIEMALS selbst. Das Backend führt die Übermittlung durch, nachdem der Nutzer zugestimmt hat.
- VERBOTEN sind Aussagen wie: "Ihre Anfrage wurde übermittelt", "Ich habe es verschickt", "submitted", "sent", "Anfrage ist raus". Auch dann nicht, wenn der Nutzer gerade zustimmt — das Backend liefert die Erfolgsbestätigung.
- VERBOTEN: "jetzt sichern", "nur heute", "sofort buchen", "verbindlich bestellen", drängende Verknappung.
- Erlaubt: "unverbindlich anfragen", "STORIA prüft persönlich", "Preisorientierung", "Vorschlag vorbereiten", "Anfrage übermitteln".

EXTRAKTIONSREGELN
- contactName nicht aus E-Mail-Adressen raten.
- FAQ-/Brainstorming-Trennung: Speisen, die der Nutzer nur in einer allgemeinen Frage erwähnt (z. B. "Bietet ihr Pizza Catering an?", "Macht ihr auch Fingerfood?"), sind KEIN Speisenwunsch. foodPreferences NUR setzen, wenn der Nutzer in einer konkreten Anfrage ausdrücklich sagt, was er bestellen/haben möchte (z. B. "Wir möchten Fingerfood für 35 Personen"). Im Zweifel foodPreferences leer lassen.
- Wenn frühere Turns FAQs waren und der Nutzer jetzt eine neue konkrete Anfrage mit anderen Speisen startet: übernimm KEINE Speisen aus den FAQ-Turns. Verwende ausschließlich die Speisen aus der aktuellen konkreten Anfrage. Sage kurz und freundlich: "Ich starte daraus eine neue Anfrage. Vorherige allgemeine Fragen übernehme ich nicht automatisch als Speisenwunsch."
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

RESPONSE STYLE — PLAIN TEXT, NO MARKDOWN
- NEVER use Markdown formatting. No **bold**, no __underline__, no *italics*, no ### headings, no tables, no code blocks, no backticks.
- Reply in simple, readable plain-text paragraphs.
- Simple numbered lists (1. 2. 3.) without bolding are allowed. Simple hyphen bullet lists (- item) without bolding are allowed.
- Never wrap field names like "date", "name", "email" in asterisks. Write them as normal words.

TASK
- Classify the message as "faq", "inquiry" or "mixed".
- Answer FAQs only with safe general knowledge. NEVER invent concrete prices, minimums, delivery terms or legal statements.
- If unsure: "The STORIA team will gladly clarify this individually for your request."
- For inquiries/mixed: extract lead data conservatively and ask gently for the still missing required fields.
- Required fields: contactName, email, guestCount, preferredDate OR dateRange.

FUNNEL PHASES
- Phase 1 (orientation): short, helpful framing. Ask at most 1–2 missing required fields at a time. Don't sound like a form.
- Phase 2 (proposal): once enough info is present, sketch a compact non-binding proposal and clarify that STORIA reviews personally.
- Phase 3a (dietary check): once ALL required fields (name, email, guest count, date/range) are present, first ask EXACTLY ONCE about dietary preferences — unless the user already mentioned them (see extracted.dietaryRequirements or extracted.foodPreferences) OR has already answered (including with "no"/"none"). Wording: "Are there any vegetarian or vegan preferences, allergies, or dietary restrictions STORIA should take into account? If not, I can send the request now." In that turn set requestSubmitConfirmation=false. If the user clearly answers the dietary question AND clearly asks to send in the same turn ("No, please send", "None, send it", "Vegan options please, send"), you may skip Phase 3a.
- Phase 3b (closing): once the dietary question has been asked AND answered (whether "none", concrete requirements, or empty confirmation), ask EXACTLY ONCE: "Shall I send this request to STORIA now (non-binding)?" and set requestSubmitConfirmation=true. In all other cases set requestSubmitConfirmation=false.
- Always carry dietary answers into extracted.dietaryRequirements / extracted.foodPreferences. "None" / "No" / "Keine" → set dietaryRequirements=["none"] so the question counts as answered.

CLOSING — STRICT
- You NEVER submit yourself. The backend submits after the user confirms.
- FORBIDDEN: "Your request has been submitted", "I sent it", "submitted", "sent", "request is on its way". Not even when the user just confirms — the backend will produce the success confirmation.
- FORBIDDEN: "secure it now", "today only", "book now", "binding order", pushy scarcity.
- Allowed: "non-binding request", "STORIA reviews personally", "price orientation", "prepare a proposal", "submit the request".

EXTRACTION
- Do not guess contactName from email addresses.
- FAQ vs. inquiry separation: foods mentioned only in a general question (e.g. "Do you offer pizza catering?", "Do you also do finger food?") are NOT a food preference. Set foodPreferences ONLY when the user explicitly states what they want to order in a concrete request (e.g. "We'd like finger food for 35 guests"). When in doubt, leave foodPreferences empty.
- If earlier turns were FAQs and the user now starts a new concrete request with different foods: do NOT carry over foods from FAQ turns. Use only the foods from the current concrete request. Briefly note: "I'm starting a new request from this. I won't carry over earlier general questions as food preferences."
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
        requestSubmitConfirmation: {
          type: "boolean",
          description:
            "True ONLY when all required fields are present AND you are explicitly asking the user to confirm sending the inquiry to STORIA. False in every other case.",
        },
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
        draftSuggestions: {
          type: "object",
          description:
            "Optional unverbindliche Vorschläge für Pakete/Items. Nur IDs aus der bereitgestellten KATALOG-Liste. NIEMALS Preise hier zurückgeben — Preise werden serverseitig berechnet.",
          properties: {
            suggested_packages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  package_id: { type: "string" },
                  guests: { type: "number" },
                  rationale: { type: "string" },
                },
                required: ["package_id"],
              },
            },
            suggested_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  menu_item_id: { type: "string" },
                  qty: { type: "number" },
                  unit: { type: "string" },
                  rationale: { type: "string" },
                },
                required: ["menu_item_id"],
              },
            },
            custom_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  note: { type: "string" },
                },
                required: ["label"],
              },
            },
          },
        },
      },
      required: ["reply", "intent", "extracted"],
    },
  },
} as const;

/* -------- Draft suggestion helpers -------- */

interface RawPackageSuggestion {
  package_id?: unknown;
  guests?: unknown;
  rationale?: unknown;
}
interface RawItemSuggestion {
  menu_item_id?: unknown;
  qty?: unknown;
  unit?: unknown;
  rationale?: unknown;
}
interface RawCustomItem {
  label?: unknown;
  note?: unknown;
}
interface RawDraftSuggestions {
  suggested_packages?: unknown;
  suggested_items?: unknown;
  custom_items?: unknown;
}

function hasUsableDraftSuggestions(raw: RawDraftSuggestions | undefined): boolean {
  if (!raw) return false;
  return [raw.suggested_packages, raw.suggested_items, raw.custom_items].some(
    (value) => Array.isArray(value) && value.length > 0,
  );
}

function buildCatalogPromptBlock(catalog: CatalogSnippet): string {
  const pkgLines = catalog.packages.map((p) => {
    const base = `id=${p.id} | "${p.name}" | type=${p.package_type ?? "?"} | per_person=${p.price_per_person} | price=${p.price ?? "(tier)"} | pricing_type=${p.pricing_type ?? "flat"} | min_guests=${p.min_guests ?? "-"} | max_guests=${p.max_guests ?? "-"}`;
    return `- ${base}${p.description ? ` :: ${String(p.description).slice(0, 120)}` : ""}`;
  });
  const itemLines = catalog.items.map((i) => {
    const diet = [
      i.is_vegan ? "vegan" : null,
      !i.is_vegan && i.is_vegetarian ? "vegetarisch" : null,
    ].filter(Boolean).join("/");
    return `- id=${i.id} | "${i.name}" | price=${i.price} EUR${i.min_order ? ` | min_order=${i.min_order}` : ""}${diet ? ` | ${diet}` : ""}`;
  });
  return [
    "KATALOG (einzige zulässige Quelle für Paket-/Item-IDs in draftSuggestions; Preise sind interne Referenzwerte, NIEMALS verbindlich):",
    "PAKETE:",
    pkgLines.length ? pkgLines.join("\n") : "(keine aktiven Pakete)",
    "MENU_ITEMS:",
    itemLines.length ? itemLines.join("\n") : "(keine aktiven Items)",
  ].join("\n");
}

function resolveDraftFromSuggestions(
  raw: RawDraftSuggestions | undefined,
  catalog: CatalogSnippet | null,
  guestCount: number | null,
): {
  suggested_packages: DraftPackageSuggestion[];
  suggested_items: DraftItemSuggestion[];
  custom_items: { label: string; note?: string | null }[];
  extraOpenQuestions: string[];
} {
  const out = {
    suggested_packages: [] as DraftPackageSuggestion[],
    suggested_items: [] as DraftItemSuggestion[],
    custom_items: [] as { label: string; note?: string | null }[],
    extraOpenQuestions: [] as string[],
  };
  if (!raw || !catalog) return out;

  const pkgById = new Map<string, CatalogPackage>(
    catalog.packages.map((p) => [p.id, p]),
  );
  const itemById = new Map<string, CatalogItem>(
    catalog.items.map((i) => [i.id, i]),
  );

  if (Array.isArray(raw.suggested_packages)) {
    for (const s of raw.suggested_packages as RawPackageSuggestion[]) {
      const id = typeof s?.package_id === "string" ? s.package_id : null;
      if (!id) continue;
      const pkg = pkgById.get(id);
      if (!pkg) {
        out.extraOpenQuestions.push(
          `Paket-ID ${id} nicht im aktuellen Katalog — bitte durch STORIA prüfen lassen.`,
        );
        continue;
      }
      const g = typeof s.guests === "number" && Number.isFinite(s.guests)
        ? Math.max(0, Math.round(s.guests))
        : guestCount;
      if (pkg.min_guests != null && g != null && g < pkg.min_guests) {
        out.extraOpenQuestions.push(
          `Paket "${pkg.name}" benötigt mindestens ${pkg.min_guests} Personen (aktuell ${g}).`,
        );
        continue;
      }
      const unitPrice = resolvePackagePrice(pkg, g);
      const subtotal = computeSubtotal(unitPrice, g, pkg.price_per_person);
      if (unitPrice == null || subtotal == null) {
        out.extraOpenQuestions.push(
          `Preis für Paket "${pkg.name}" kann nicht automatisch berechnet werden — STORIA klärt das individuell.`,
        );
      }
      out.suggested_packages.push({
        package_id: pkg.id,
        name: pkg.name,
        guests: g,
        unit_price: unitPrice,
        subtotal,
        rationale: typeof s.rationale === "string" ? s.rationale : null,
      });
    }
  }

  if (Array.isArray(raw.suggested_items)) {
    for (const s of raw.suggested_items as RawItemSuggestion[]) {
      const id = typeof s?.menu_item_id === "string" ? s.menu_item_id : null;
      if (!id) continue;
      const it = itemById.get(id);
      if (!it) {
        out.extraOpenQuestions.push(
          `Item-ID ${id} nicht im aktuellen Katalog — bitte durch STORIA prüfen lassen.`,
        );
        continue;
      }
      const qty = typeof s.qty === "number" && Number.isFinite(s.qty)
        ? Math.max(0, Math.round(s.qty))
        : null;
      const unitPrice = Number.isFinite(it.price) ? Math.round(it.price * 100) / 100 : null;
      const subtotal = unitPrice != null && qty != null
        ? Math.round(unitPrice * qty * 100) / 100
        : null;
      if (unitPrice == null) {
        out.extraOpenQuestions.push(
          `Preis für Item "${it.name}" liegt nicht als Zahl vor — STORIA klärt das individuell.`,
        );
      }
      out.suggested_items.push({
        menu_item_id: it.id,
        name: it.name,
        qty,
        unit: typeof s.unit === "string" ? s.unit : null,
        unit_price: unitPrice,
        subtotal,
      });
    }
  }

  if (Array.isArray(raw.custom_items)) {
    for (const c of raw.custom_items as RawCustomItem[]) {
      const label = typeof c?.label === "string" ? c.label.trim() : "";
      if (!label) continue;
      out.custom_items.push({
        label,
        note: typeof c.note === "string" ? c.note : null,
      });
    }
  }

  return out;
}

/* -------- AI Gateway call -------- */

async function callAiGateway(
  apiKey: string,
  lang: Lang,
  history: { role: "user" | "assistant"; content: string }[],
  currentExtraction: Extracted,
  uploadedFiles: number,
  knowledgeContext: string,
  catalog: CatalogSnippet | null,
  trace: Trace,
): Promise<{
  reply: string;
  intent: Intent;
  extracted: Partial<Extracted>;
  suggestedNextQuestion?: string;
  requestSubmitConfirmation?: boolean;
  draftSuggestions?: RawDraftSuggestions;
} | null> {
  const catalogBlock = catalog ? buildCatalogPromptBlock(catalog) : "";
  const draftGuardrails =
    "\n\nDRAFT-REGELN (KI-Entwurf, NICHT verbindliches Angebot):\n" +
    "- Bei Catering-/Menü-Brainstorming darfst du in draftSuggestions Pakete oder Items aus der KATALOG-Liste vorschlagen. NUR IDs aus dem Katalog. Keine eigenen IDs erfinden.\n" +
    "- Niemals Preise oder Summen in draftSuggestions zurückgeben. Preise werden serverseitig berechnet.\n" +
    "- Wenn Preise oder Mindestmengen unklar sind, schreibe einen Hinweis in extracted.openQuestions, statt zu raten.\n" +
    "- Verboten zu sagen: \"Hier ist Ihr Angebot\", \"Gesamtpreis verbindlich\", \"Sie können jetzt buchen\", \"Zahlung jetzt\", \"Angebot wurde erstellt\".\n" +
    "- Erlaubt: \"unverbindlicher Entwurf\", \"Preisorientierung\", \"vorbehaltlich Prüfung und Freigabe durch STORIA\", \"STORIA erstellt nach Prüfung das verbindliche Angebot\".\n" +
    "- Spreche immer von einem Entwurf, niemals von einem fertigen Angebot.";
  const systemMessage = {
    role: "system",
    content:
      systemPrompt(lang) +
      draftGuardrails +
      `\n\nKONTEXT (aktuelle Extraktion, JSON): ${JSON.stringify(currentExtraction)}\n` +
      `KONTEXT (clientState.uploadedFiles.count): ${uploadedFiles}` +
      (catalogBlock ? `\n\n${catalogBlock}` : "") +
      (knowledgeContext
        ? `\n\n${knowledgeContext}`
        : "\n\nVERFÜGBARE QUELLEN: (keine passenden öffentlichen Quellen gefunden — bei Sachfragen ausdrücklich auf das STORIA-Team verweisen, niemals Preise/Liefer-/Zahlungs-/AGB-Aussagen erfinden)"),
  };

  traceStep(trace, "AI call start", `history=${history.length} catalog=${catalog ? "yes" : "no"}`);
  const res = await fetchWithTimeout(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
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
    },
    AI_GATEWAY_TIMEOUT_MS,
    "ai_gateway_timeout",
  );
  traceStep(trace, "AI call end", `status=${res.status}`, "ai_call_ms");

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
      requestSubmitConfirmation:
        args.requestSubmitConfirmation === true ? true : false,
      draftSuggestions:
        args.draftSuggestions && typeof args.draftSuggestions === "object"
          ? (args.draftSuggestions as RawDraftSuggestions)
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

function timeoutMessageForLanguage(lang: Lang): string {
  return lang === "en"
    ? "This is taking too long. Please try again."
    : "Das dauert gerade zu lange. Bitte versuchen Sie es erneut.";
}

/* -------- Confirmation intent detection (deterministic) -------- */

type ConfirmIntent = "yes" | "no" | "unclear";

function normalizeConfirmText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const YES_TOKENS = new Set([
  "ja", "jo", "jep", "yep", "yes", "yeah", "ok", "okay", "okey", "k",
  "passt", "geht", "gerne", "klar", "sicher", "los", "send", "sende",
  "senden", "schick", "schicken", "verschick", "verschicken",
  "abschicken", "abschick", "absenden", "abgeschickt", "übermitteln",
  "uebermitteln", "uebermittle", "übermittle", "submit", "go",
  "confirm", "confirmed", "bestätigen", "bestaetigen", "bestätigt",
  "bestaetigt", "einverstanden", "alright", "sure",
]);

const NO_TOKENS = new Set([
  "nein", "nö", "noe", "no", "nope", "stop", "warte", "wait", "moment",
  "later", "spaeter", "später", "halt", "noch", "ändern", "aendern",
  "change", "edit", "bearbeiten", "abbrechen", "cancel", "nicht",
  "not", "hold", "keine", "keiner", "keinen", "none", "nichts", "nothing",
]);

const YES_PHRASES = [
  "ja bitte", "ja gerne", "ja senden", "ja schick", "ja verschick",
  "ja abschicken", "ja übermitteln", "ja uebermitteln",
  "bitte senden", "bitte schicken", "bitte verschicken",
  "bitte abschicken", "bitte übermitteln", "bitte uebermitteln",
  "kannst du senden", "kannst du schicken", "kannst du abschicken",
  "los gehts", "los geht's", "passt so", "passt für mich",
  "yes please", "please send", "go ahead", "send it", "submit it",
  "fire away", "sounds good",
];

const NO_PHRASES = [
  "noch nicht", "nicht jetzt", "warte noch", "moment noch",
  "ich möchte noch", "ich moechte noch", "ich will noch",
  "ich möchte ändern", "ich moechte aendern", "noch ändern",
  "noch aendern", "not yet", "not now", "hold on", "wait a moment",
  "let me change",
];

function detectConfirmationIntent(text: string): ConfirmIntent {
  const t = normalizeConfirmText(text);
  if (!t) return "unclear";
  for (const p of NO_PHRASES) if (t.includes(p)) return "no";
  for (const p of YES_PHRASES) if (t.includes(p)) return "yes";
  const tokens = t.split(" ").filter(Boolean);
  if (tokens.length === 0) return "unclear";
  // Pure short answers like "ja", "ok", "yes", "nein" — first 3 tokens.
  const head = tokens.slice(0, 3);
  const hasNo = head.some((w) => NO_TOKENS.has(w));
  if (hasNo) return "no";
  const hasYes = head.some((w) => YES_TOKENS.has(w));
  // Require the message to be reasonably short to count a bare token as yes,
  // to avoid grabbing "ja" inside a long re-edit.
  if (hasYes && tokens.length <= 6) return "yes";
  return "unclear";
}

function dietaryAnswerFromSendTurn(text: string, lang: Lang): string | null {
  const normalized = normalizeConfirmText(text);
  if (!normalized) return null;
  const tokens = normalized.split(" ").filter(Boolean);
  const saysNone = tokens.some((w) =>
    ["nein", "keine", "keiner", "keinen", "nichts", "no", "none", "nothing"].includes(w),
  );
  if (saysNone) return lang === "en" ? "none" : "keine";
  if (/\b(vegan|vegetarisch|vegetarian|allerg|unvertr|intoler|gluten|laktose|lactose|nuss|nut)\b/i.test(text)) {
    return text.trim().slice(0, 500);
  }
  return null;
}

async function persistDietaryAnswerBeforeSubmit(
  supabase: SupaClient,
  conversationId: string,
  message: string,
  lang: Lang,
): Promise<void> {
  const dietaryAnswer = dietaryAnswerFromSendTurn(message, lang);
  if (!dietaryAnswer) return;
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
  extraction = mergeExtraction(extraction, {
    dietaryRequirements: [dietaryAnswer],
    originalUserText: message,
  });
  await supabase.from("ai_extractions").insert({
    conversation_id: conversationId,
    extracted: extraction,
    missing_fields: computeMissing(extraction),
    confidence: {},
  });
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
  const trace = createTrace(action);
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
    return await handleSubmitInquiry(supabase, incomingConvId, language, cors, trace);
  }

  // -------- load_state branch (reload restore) --------
  if (action === "load_state") {
    if (!incomingConvId) {
      return jsonResponse({ error: "conversation_required" }, 400, cors);
    }
    traceStep(trace, "conversation loaded", "load_state");
    return await handleLoadState(supabase, incomingConvId, cors);
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
  traceStep(trace, "conversation load start", incomingConvId ? "existing=true" : "existing=false");

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
  traceStep(trace, "conversation loaded", `status=${conversationStatus}`, "conversation_load_ms");

  // 1a. Already-submitted short circuit. Do NOT call AI, do NOT mutate status,
  // but persist the user message so the transcript stays accurate.
  if (conversationStatus === "submitted") {
    const { data: convRow } = await supabase
      .from("ai_conversations")
      .select("inquiry_id")
      .eq("id", conversationId)
      .maybeSingle();
    const inquiryId =
      convRow && typeof convRow.inquiry_id === "string"
        ? convRow.inquiry_id
        : null;
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      metadata: { uploadedFilesCount, post_submit: true },
    });
    const replyAlready =
      language === "en"
        ? "Your request has already been sent to STORIA. The team will get back to you with a binding offer."
        : "Diese Anfrage wurde bereits an STORIA übermittelt. Das Team meldet sich mit einem verbindlichen Angebot.";
    await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: replyAlready,
      metadata: { event: "already_submitted" },
    });
    return jsonResponse(
      {
        conversationId,
        reply: replyAlready,
        intent: "inquiry",
        extracted: {},
        missingFields: [],
        readyToSubmit: true,
        awaitingConfirmation: false,
        alreadySubmitted: true,
        submittedInquiryId: inquiryId,
      },
      200,
      cors,
    );
  }

  // 1b. Chat-side submit trigger: if the conversation is ready, the previous
  // assistant turn asked for confirmation, and the user clearly agreed, run
  // the SAME server-side handleSubmitInquiry that the CTA uses.
  if (conversationStatus === "ready_to_submit") {
    const { data: lastAssistant } = await supabase
      .from("ai_messages")
      .select("metadata, created_at")
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const awaiting =
      lastAssistant?.metadata &&
      typeof lastAssistant.metadata === "object" &&
      (lastAssistant.metadata as Record<string, unknown>).awaiting_confirmation ===
        true;
    const intent = detectConfirmationIntent(message);
    if (awaiting) {
      if (intent === "yes") {
        // Persist the user's confirmation in the transcript.
        await supabase.from("ai_messages").insert({
          conversation_id: conversationId,
          role: "user",
          content: message,
          metadata: { uploadedFilesCount, confirmation: "yes" },
        });
        await persistDietaryAnswerBeforeSubmit(
          supabase,
          conversationId,
          message,
          language,
        );
        const submitRes = await handleSubmitInquiry(
          supabase,
          conversationId,
          language,
          cors,
          trace,
        );
        // handleSubmitInquiry returns Response with success or submit_failed.
        // We re-wrap into the chat response shape so the client can reuse the
        // same handler. Keep the original status code on errors.
        let submitPayload: Record<string, unknown> = {};
        try {
          submitPayload = await submitRes.clone().json();
        } catch {
          submitPayload = {};
        }
        const ok = submitPayload?.success === true;
        return jsonResponse(
          {
            conversationId,
            reply:
              typeof submitPayload?.reply === "string"
                ? submitPayload.reply
                : ok
                  ? language === "en"
                    ? "Thank you. Your request has been submitted to STORIA."
                    : "Vielen Dank. Ihre Anfrage wurde an STORIA übermittelt."
                  : language === "en"
                    ? "The request could not be sent right now. Please try again."
                    : "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut.",
            intent: "inquiry",
            extracted: {},
            missingFields: Array.isArray(submitPayload?.missingFields)
              ? submitPayload.missingFields
              : [],
            readyToSubmit: true,
            awaitingConfirmation: false,
            triggeredFromChat: true,
            submitSuccess: ok,
            submittedInquiryId:
              ok && typeof submitPayload?.inquiryId === "string"
                ? submitPayload.inquiryId
                : null,
            submitError:
              !ok && typeof submitPayload?.error === "string"
                ? submitPayload.error
                : null,
          },
          ok ? 200 : 502,
          cors,
        );
      }
      // "no" or "unclear": fall through to normal AI flow. We pass a hint to
      // the system via an extra message so the model knows confirmation was
      // declined/unclear and should not re-issue the same question on top.
    } else if (intent === "yes" && dietaryAnswerFromSendTurn(message, language)) {
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: message,
        metadata: { uploadedFilesCount, confirmation: "yes", dietary_answer: true },
      });
      await persistDietaryAnswerBeforeSubmit(
        supabase,
        conversationId,
        message,
        language,
      );
      const submitRes = await handleSubmitInquiry(
        supabase,
        conversationId,
        language,
        cors,
        trace,
      );
      let submitPayload: Record<string, unknown> = {};
      try {
        submitPayload = await submitRes.clone().json();
      } catch {
        submitPayload = {};
      }
      const ok = submitPayload?.success === true;
      return jsonResponse(
        {
          conversationId,
          reply:
            typeof submitPayload?.reply === "string"
              ? submitPayload.reply
              : ok
                ? language === "en"
                  ? "Thank you. Your request has been submitted to STORIA."
                  : "Vielen Dank. Ihre Anfrage wurde an STORIA übermittelt."
                : language === "en"
                  ? "The request could not be sent right now. Please try again."
                  : "Die Anfrage konnte gerade nicht übermittelt werden. Bitte versuchen Sie es erneut.",
          intent: "inquiry",
          extracted: {},
          missingFields: Array.isArray(submitPayload?.missingFields)
            ? submitPayload.missingFields
            : [],
          readyToSubmit: true,
          awaitingConfirmation: false,
          triggeredFromChat: true,
          submitSuccess: ok,
          submittedInquiryId:
            ok && typeof submitPayload?.inquiryId === "string"
              ? submitPayload.inquiryId
              : null,
          submitError:
            !ok && typeof submitPayload?.error === "string"
              ? submitPayload.error
              : null,
        },
        ok ? 200 : 502,
        cors,
      );
    }
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
  traceStep(trace, "extraction start");
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
  traceStep(trace, "extraction end", `missing=${computeMissing(currentExtraction).join("|") || "none"}`, "extraction_ms");

  // 4b. Knowledge lookup (safe sources only)
  traceStep(trace, "knowledge start");
  const knowledgeContext = await withTimeout(
    lookupKnowledge(supabase, message),
    KNOWLEDGE_TIMEOUT_MS,
    "knowledge_lookup_timeout",
  ).catch((e) => {
    console.error("knowledge_lookup_timeout_or_failed", (e as Error).message);
    return "";
  });
  traceStep(trace, "knowledge end", knowledgeContext ? "matched=true" : "matched=false", "knowledge_lookup_ms");

  // 4c. Catalog snippet disabled in normal chat fast-path. Draft persistence
  // is no longer allowed to add a catalog DB read to every message.
  let catalog: CatalogSnippet | null = null;

  // 5. Call AI gateway
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  let reply = "";
  let intent: Intent = "inquiry";
  let suggestedNextQuestion: string | undefined;
  let nextExtraction = currentExtraction;
  let rawDraftSuggestions: RawDraftSuggestions | undefined;
  let aiAwaitingConfirmation = false;

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
        catalog,
        trace,
      );
      if (aiResult) {
        reply = aiResult.reply || fallbackReply(language, computeMissing(currentExtraction));
        intent = aiResult.intent;
        suggestedNextQuestion = aiResult.suggestedNextQuestion;
        aiAwaitingConfirmation = aiResult.requestSubmitConfirmation === true;
        const extractedClean: Partial<Extracted> = { ...aiResult.extracted };
        if (!emailLooksValid(extractedClean.email)) extractedClean.email = null;
        extractedClean.originalUserText = message;
        nextExtraction = mergeExtraction(currentExtraction, extractedClean);
        rawDraftSuggestions = aiResult.draftSuggestions;
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
      traceEnd(trace, { error: err });
      return jsonResponse(
        {
          error: err === "ai_gateway_timeout" ? "ai_timeout" : "ai_unavailable",
          reply: timeoutMessageForLanguage(language),
        },
        err === "ai_gateway_timeout" ? 504 : 502,
        cors,
      );
    }
  }

  const missingFields = computeMissing(nextExtraction);
  const readyToSubmit = missingFields.length === 0;

  // 6. Persist assistant message + extraction + status
  await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: reply,
    metadata: {
      intent,
      missingFields,
      awaiting_confirmation:
        readyToSubmit === true &&
        Boolean(
          // Only trust the model's request when fields are truly complete.
          aiAwaitingConfirmation,
        ),
    },
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

  // 7. Persist unverbindlicher KI-Draft (Step 1: backend-only persistence).
  // The draft is NEVER a binding offer; final approval happens only in
  // Maestro by STORIA staff. Pricing is computed deterministically here,
  // never by the model.
  if (readyToSubmit || hasUsableDraftSuggestions(rawDraftSuggestions)) {
    try {
      traceStep(trace, "draft start");
      const resolved = resolveDraftFromSuggestions(
        rawDraftSuggestions,
        catalog,
        nextExtraction.guestCount,
      );
      await withTimeout(
        upsertConversationDraft(
          supabase,
          conversationId,
          nextExtraction,
          resolved,
        ),
        DRAFT_TIMEOUT_MS,
        "draft_timeout",
      );
      traceStep(trace, "draft end", "", "draft_ms");
    } catch (e) {
      // Never block the chat response on draft persistence.
      console.error("draft_upsert_failed", (e as Error).message);
      traceStep(trace, "draft end", "error=true", "draft_ms");
    }
  } else {
    trace.timings.draft_ms = 0;
  }

  // 7b. submitAfterProcessing: if the CTA was clicked while the composer
  // still held additional text, the client sends that text as a normal user
  // message with this flag set. After the AI has fully processed/extracted
  // it, if all required fields are present we run the SAME server-side
  // handleSubmitInquiry that the CTA path uses — so the user only needs one
  // click and the late addition is never lost.
  if (body.submitAfterProcessing === true && readyToSubmit) {
    const submitRes = await handleSubmitInquiry(
      supabase,
      conversationId,
      language,
      cors,
      trace,
    );
    let submitPayload: Record<string, unknown> = {};
    try {
      submitPayload = await submitRes.clone().json();
    } catch {
      submitPayload = {};
    }
    const ok = submitPayload?.success === true;
    return jsonResponse(
      {
        conversationId,
        reply:
          typeof submitPayload?.reply === "string"
            ? submitPayload.reply
            : reply,
        intent,
        extracted: nextExtraction,
        missingFields: Array.isArray(submitPayload?.missingFields)
          ? submitPayload.missingFields
          : missingFields,
        readyToSubmit: true,
        awaitingConfirmation: false,
        triggeredFromChat: true,
        submitSuccess: ok,
        submittedInquiryId:
          ok && typeof submitPayload?.inquiryId === "string"
            ? submitPayload.inquiryId
            : null,
        submitError:
          !ok && typeof submitPayload?.error === "string"
            ? submitPayload.error
            : null,
      },
      ok ? 200 : 502,
      cors,
    );
  }

  const responseBody = {
      conversationId,
      reply,
      intent,
      extracted: nextExtraction,
      missingFields,
      readyToSubmit,
      requiresConfirmation: false,
      awaitingConfirmation:
        readyToSubmit === true && Boolean(aiAwaitingConfirmation),
      suggestedNextQuestion,
    };
  traceEnd(trace, { readyToSubmit, triggered_submit: false });
  return jsonResponse(responseBody, 200, cors);
});

// Suppress unused-warning for REQUIRED_FIELDS (kept for clarity / future use)
void REQUIRED_FIELDS;

/* ============================================================
 * Draft persistence (ai_conversations.metadata.draft)
 * ============================================================ */

async function upsertConversationDraft(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conversationId: string,
  extraction: Extracted,
  resolved: {
    suggested_packages: DraftPackageSuggestion[];
    suggested_items: DraftItemSuggestion[];
    custom_items: { label: string; note?: string | null }[];
    extraOpenQuestions: string[];
  },
): Promise<void> {
  const { data: row } = await supabase
    .from("ai_conversations")
    .select("metadata")
    .eq("id", conversationId)
    .maybeSingle();

  const metadata =
    row?.metadata && typeof row.metadata === "object"
      ? ({ ...(row.metadata as Record<string, unknown>) })
      : ({} as Record<string, unknown>);

  const prevDraft: Partial<Draft> = isDraftLike(metadata.draft)
    ? (metadata.draft as Partial<Draft>)
    : {};

  const base = emptyDraft(MODEL);

  // If the model returned suggestions this turn, replace previous ones
  // (chat is iterative — newest proposal wins). Otherwise keep previous.
  const suggested_packages =
    resolved.suggested_packages.length > 0
      ? resolved.suggested_packages
      : Array.isArray(prevDraft.suggested_packages)
        ? prevDraft.suggested_packages
        : base.suggested_packages;
  const suggested_items =
    resolved.suggested_items.length > 0
      ? resolved.suggested_items
      : Array.isArray(prevDraft.suggested_items)
        ? prevDraft.suggested_items
        : base.suggested_items;
  const custom_items =
    resolved.custom_items.length > 0
      ? resolved.custom_items
      : Array.isArray(prevDraft.custom_items)
        ? prevDraft.custom_items
        : base.custom_items;

  const summary =
    typeof extraction.summary === "string" && extraction.summary.trim().length > 0
      ? extraction.summary.trim()
      : (typeof prevDraft.summary === "string" ? prevDraft.summary : "");

  const fromExtraction = Array.isArray(extraction.openQuestions)
    ? extraction.openQuestions.filter((q) => typeof q === "string" && q.trim().length > 0)
    : [];
  const open_questions = Array.from(
    new Set([...fromExtraction, ...resolved.extraOpenQuestions]),
  );

  const estimate = computeEstimate(suggested_packages, suggested_items);

  // Preserve a non-draft status (submitted/adopted/discarded) once set
  // upstream — Step 1 does not change status itself.
  const status =
    prevDraft.status === "submitted" ||
    prevDraft.status === "adopted" ||
    prevDraft.status === "discarded"
      ? prevDraft.status
      : base.status;

  const draft: Draft = {
    ...base,
    status,
    summary,
    open_questions,
    suggested_packages,
    suggested_items,
    custom_items,
    estimate,
    generated_at: new Date().toISOString(),
    model: MODEL,
  };

  metadata.draft = draft;

  await supabase
    .from("ai_conversations")
    .update({ metadata })
    .eq("id", conversationId);
}

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

/**
 * Returns the ISO date only if it's today or in the future.
 * Past dates are dropped (returns null) so we never store a wrong year
 * in v2_events.date. The original text remains visible in messageText.
 */
function safeFutureIso(s: string | null | undefined): string | null {
  if (!isIsoDate(s)) return null;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  return (s as string) >= todayIso ? (s as string) : null;
}

async function handleSubmitInquiry(
  supabase: SupaClient,
  conversationId: string,
  language: Lang,
  cors: Record<string, string>,
  trace?: Trace,
): Promise<Response> {
  if (trace) traceStep(trace, "submit start");
  // Load conversation
  const { data: conv, error: convErr } = await supabase
    .from("ai_conversations")
    .select("id, status, inquiry_id, metadata")
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
    if (trace) traceStep(trace, "submit end", `missing=${missingFields.join("|")}`);
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
    preferredDate: safeFutureIso(extraction.preferredDate) ?? undefined,
    timeSlot: extraction.timeSlot ?? undefined,
    message: messageText,
    source: "ai_intake_bar",
  };

  // Server-to-server call to receive-event-inquiry
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  let inquiryId: string | null = null;
  try {
    if (trace) traceStep(trace, "submit receive-event start");
    const res = await fetchWithTimeout(
      `${supaUrl}/functions/v1/receive-event-inquiry`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      SUBMIT_FETCH_TIMEOUT_MS,
      "receive_event_inquiry_timeout",
    );
    if (trace) traceStep(trace, "submit receive-event end", `status=${res.status}`, "receive_event_ms");
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
    if (trace) traceStep(trace, "submit end", `error=${(e as Error).message}`);
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
    if (trace) traceStep(trace, "submit end", "error=missing_inquiry_id");
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

  // Mirror AI draft snapshot into v2_events.metadata.ai_draft (best-effort, non-blocking)
  try {
    const convMetadata =
      conv.metadata && typeof conv.metadata === "object"
        ? (conv.metadata as Record<string, unknown>)
        : {};
    const draftData = convMetadata.draft;
    if (draftData && typeof draftData === "object") {
      const { data: eventRow } = await supabase
        .from("v2_events")
        .select("id, metadata")
        .eq("id", inquiryId)
        .maybeSingle();
      if (eventRow) {
        const existingMeta =
          eventRow.metadata && typeof eventRow.metadata === "object"
            ? (eventRow.metadata as Record<string, unknown>)
            : {};
        const snapshot = {
          version: 1,
          source: "ai_catering_assistant",
          conversation_id: conversationId,
          status: "submitted",
          draft: draftData,
          submitted_at: new Date().toISOString(),
          disclaimer:
            "Unverbindlicher Entwurf — vorbehaltlich Prüfung und Freigabe durch STORIA.",
        };
        const nextMeta = { ...existingMeta, ai_draft: snapshot };
        const { error: metaErr } = await supabase
          .from("v2_events")
          .update({ metadata: nextMeta })
          .eq("id", inquiryId);
        if (metaErr) {
          console.error("ai_draft_mirror_failed", metaErr.message);
        }
      }
    }
  } catch (e) {
    // Never block the inquiry submission on the draft mirror.
    console.error("ai_draft_mirror_exception", (e as Error).message);
  }

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

  if (trace) {
    trace.timings.submit_ms = Date.now() - trace.last + (trace.timings.receive_event_ms ?? 0);
    traceStep(trace, "submit end", `inquiryId=${inquiryId}`);
    traceEnd(trace, { inquiryId, success: true });
  }

  return jsonResponse(
    { success: true, inquiryId, reply: successReply },
    200,
    cors,
  );
}

/* ============================================================
 * load_state — reload-restore for the AI Intake Bar
 * ============================================================ */

async function handleLoadState(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  conversationId: string,
  cors: Record<string, string>,
): Promise<Response> {
  const { data: conv, error: convErr } = await supabase
    .from("ai_conversations")
    .select("id, status, inquiry_id, language")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr || !conv) {
    return jsonResponse({ error: "conversation_not_found" }, 404, cors);
  }

  const { data: msgs } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at, metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  const messages = (msgs ?? [])
    .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
    .map((m: { id: string; role: string; content: string; created_at: string }) => ({
      id: String(m.id),
      role: m.role,
      content: String(m.content ?? ""),
      createdAt: new Date(m.created_at).getTime(),
    }));

  // Awaiting confirmation = latest assistant message had the flag set AND
  // there is no later user message (last message is the assistant question).
  let awaitingConfirmation = false;
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === "assistant") {
      const raw = (msgs ?? []).find(
        (m: { id: string }) => String(m.id) === last.id,
      ) as { metadata?: Record<string, unknown> } | undefined;
      if (
        raw?.metadata &&
        typeof raw.metadata === "object" &&
        (raw.metadata as Record<string, unknown>).awaiting_confirmation === true
      ) {
        awaitingConfirmation = true;
      }
    }
  }

  const { data: latest } = await supabase
    .from("ai_extractions")
    .select("extracted, missing_fields")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let extracted: Extracted = emptyExtraction();
  if (latest?.extracted && typeof latest.extracted === "object") {
    extracted = mergeExtraction(extracted, latest.extracted as Partial<Extracted>);
  }
  const missingFields = Array.isArray(latest?.missing_fields)
    ? (latest!.missing_fields as string[])
    : computeMissing(extracted);
  const readyToSubmit = missingFields.length === 0;

  return jsonResponse(
    {
      conversationId,
      status: conv.status,
      submittedInquiryId:
        typeof conv.inquiry_id === "string" ? conv.inquiry_id : null,
      language: conv.language ?? "de",
      messages,
      extracted,
      missingFields,
      readyToSubmit,
      awaitingConfirmation: conv.status === "submitted" ? false : awaitingConfirmation,
    },
    200,
    cors,
  );
}