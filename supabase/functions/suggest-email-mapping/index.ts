// AI-gestützte Mapping-Vorschläge für eingehende Mails.
// Stufe 1: deterministische Heuristiken (Thread-Match, Customer-Match, Datum, Gäste, Anlass, Spam).
// Stufe 2: Claude Haiku Klassifikation, falls Heuristiken keinen klaren Treffer liefern.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type Suggestion = {
  suggested_event_id: string | null;
  suggestion_category: "match" | "new_inquiry" | "irrelevant" | "unclear";
  suggestion_confidence: "high" | "medium" | "low";
  suggestion_reasoning: string;
  suggestion_method: "heuristic" | "llm";
};

const SPAM_PATTERNS = [
  /no[-_.]?reply@/i,
  /noreply@/i,
  /newsletter@/i,
  /mailer-daemon@/i,
  /^bounce@/i,
  /postmaster@/i,
];
const SPAM_SUBJECT = /(newsletter|abonnier|unsubscribe|werbung|sale\b|rabatt-aktion)/i;

const ANLASS_KEYWORDS: Record<string, string[]> = {
  Geburtstag: ["geburtstag"],
  Hochzeit: ["hochzeit"],
  Firmenfeier: ["firmenfeier", "firmenevent", "firmen-event"],
  Weihnachtsfeier: ["weihnachtsfeier", "xmas", "christmas"],
  Taufe: ["taufe"],
  Konfirmation: ["konfirmation", "kommunion"],
  Polterabend: ["polterabend"],
  Sommerfest: ["sommerfest"],
  Jubiläum: ["jubilä", "jubilae"],
};

function extractDates(text: string): string[] {
  const out = new Set<string>();
  const re = /\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})\b/g;
  let m;
  while ((m = re.exec(text))) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2024 && y <= 2030) {
      out.add(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }
  return Array.from(out);
}

function extractGuests(text: string): number | null {
  const m = text.match(/\b(\d{1,3})\s*(personen|gäste|gaeste|pax|leute)\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractAnlass(subject: string): string | null {
  const s = (subject || "").toLowerCase();
  for (const [label, kws] of Object.entries(ANLASS_KEYWORDS)) {
    if (kws.some((kw) => s.includes(kw))) return label;
  }
  return null;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

async function runHeuristics(email: any): Promise<Suggestion | null> {
  // Spam first
  if (email.from_email && SPAM_PATTERNS.some((p) => p.test(email.from_email))) {
    return {
      suggested_event_id: null,
      suggestion_category: "irrelevant",
      suggestion_confidence: "high",
      suggestion_reasoning: `Absender-Muster (${email.from_email}) deutet auf automatische Mail.`,
      suggestion_method: "heuristic",
    };
  }
  if (email.subject && SPAM_SUBJECT.test(email.subject)) {
    return {
      suggested_event_id: null,
      suggestion_category: "irrelevant",
      suggestion_confidence: "high",
      suggestion_reasoning: `Betreff "${email.subject}" wirkt wie Newsletter/Werbung.`,
      suggestion_method: "heuristic",
    };
  }

  // Thread match (in_reply_to / references)
  const refs: string[] = [];
  if (email.in_reply_to) refs.push(email.in_reply_to);
  if (Array.isArray(email.references_headers)) refs.push(...email.references_headers);
  if (refs.length > 0) {
    const { data: parents } = await admin
      .from("inbox_emails")
      .select("id, message_id, event_email_links!inner(event_id, is_excluded)")
      .in("message_id", refs)
      .limit(5);
    for (const p of parents ?? []) {
      const link = (p as any).event_email_links?.find((l: any) => !l.is_excluded);
      if (link?.event_id) {
        return {
          suggested_event_id: link.event_id,
          suggestion_category: "match",
          suggestion_confidence: "high",
          suggestion_reasoning: "Antwort auf eine bereits zugeordnete Mail (Thread-Match).",
          suggestion_method: "heuristic",
        };
      }
    }
  }

  // Customer match
  const fromEmail = (email.from_email || "").toLowerCase();
  let openEvents: any[] = [];
  if (fromEmail) {
    const { data: customers } = await admin
      .from("v2_customers")
      .select("id")
      .ilike("email", fromEmail);
    const ids = (customers ?? []).map((c: any) => c.id);
    if (ids.length > 0) {
      const { data: events } = await admin
        .from("v2_events")
        .select("id, date, guest_count, occasion, status")
        .in("customer_id", ids)
        .eq("archived", false)
        .not("status", "in", "(cancelled,completed)");
      openEvents = events ?? [];
    }
  }

  if (openEvents.length === 1) {
    return {
      suggested_event_id: openEvents[0].id,
      suggestion_category: "match",
      suggestion_confidence: "high",
      suggestion_reasoning: `Kunde hat genau eine offene Eventanfrage (${openEvents[0].date ?? "ohne Datum"}).`,
      suggestion_method: "heuristic",
    };
  }

  if (openEvents.length >= 2 && openEvents.length <= 3) {
    // Rank by date proximity to today + 30
    const target = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const ranked = [...openEvents].sort((a, b) => {
      const da = a.date ? daysBetween(a.date, target) : 9999;
      const db = b.date ? daysBetween(b.date, target) : 9999;
      return da - db;
    });
    return {
      suggested_event_id: ranked[0].id,
      suggestion_category: "match",
      suggestion_confidence: "medium",
      suggestion_reasoning: `Kunde hat ${openEvents.length} offene Anfragen — wahrscheinlichste nach Datum-Nähe.`,
      suggestion_method: "heuristic",
    };
  }

  // Date / guest / occasion enrichment when no customer match or many open
  const text = `${email.subject ?? ""}\n${(email.body_text ?? "").slice(0, 4000)}`;
  const dates = extractDates(text);
  const guests = extractGuests(text);
  const anlass = extractAnlass(email.subject ?? "");

  if (dates.length > 0) {
    const { data: candidates } = await admin
      .from("v2_events")
      .select("id, date, guest_count, occasion, status")
      .in("date", dates)
      .eq("archived", false)
      .not("status", "in", "(cancelled,completed)");
    const matches = (candidates ?? []).filter((c: any) => {
      let score = 1;
      if (guests && c.guest_count && Math.abs(c.guest_count - guests) <= 5) score++;
      if (anlass && c.occasion && c.occasion.toLowerCase().includes(anlass.toLowerCase())) score++;
      return score >= 1;
    });
    if (matches.length === 1) {
      const reasonParts = [`Datumstreffer (${matches[0].date})`];
      if (guests) reasonParts.push(`Gästezahl ~${guests}`);
      if (anlass) reasonParts.push(`Anlass ${anlass}`);
      return {
        suggested_event_id: matches[0].id,
        suggestion_category: "match",
        suggestion_confidence: guests || anlass ? "medium" : "low",
        suggestion_reasoning: reasonParts.join(", ") + ".",
        suggestion_method: "heuristic",
      };
    }
  }

  return null;
}

async function runLLM(email: any): Promise<Suggestion> {
  if (!ANTHROPIC_API_KEY) {
    return {
      suggested_event_id: null,
      suggestion_category: "unclear",
      suggestion_confidence: "low",
      suggestion_reasoning: "Keine Heuristik passte; LLM nicht konfiguriert.",
      suggestion_method: "llm",
    };
  }

  // Top 20 open events by date proximity to today
  const { data: events } = await admin
    .from("v2_events")
    .select("id, date, guest_count, occasion, status, customer_id, v2_customers(name, email)")
    .eq("archived", false)
    .not("status", "in", "(cancelled,completed)")
    .order("date", { ascending: true })
    .limit(40);

  const today = Date.now();
  const top = (events ?? [])
    .map((e: any) => ({ ...e, _dist: e.date ? Math.abs(new Date(e.date).getTime() - today) : Infinity }))
    .sort((a, b) => a._dist - b._dist)
    .slice(0, 20);

  const eventLines = top
    .map(
      (e: any) =>
        `- Event ${e.id}: ${e.date ?? "ohne Datum"}, ${e.guest_count ?? "?"} Gäste, Anlass: ${e.occasion ?? "—"}, Kontakt: ${(e.v2_customers as any)?.name ?? ""} <${(e.v2_customers as any)?.email ?? ""}>`,
    )
    .join("\n");

  const { data: corrections } = await admin
    .from("email_classification_feedback")
    .select("from_email, subject, suggested_category, suggested_event_id, actual_category, actual_event_id")
    .eq("was_correct", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const sample = (corrections ?? []).sort(() => Math.random() - 0.5).slice(0, 3);
  const corrText = sample
    .map(
      (c: any) =>
        `- Mail von ${c.from_email}, Subject "${c.subject ?? ""}": Vorschlag war ${c.suggested_category}/${c.suggested_event_id ?? "null"}, korrekt war ${c.actual_category}/${c.actual_event_id ?? "null"}.`,
    )
    .join("\n");

  const userPrompt = [
    `Eingehende Mail:`,
    `From: ${email.from_name ?? ""} <${email.from_email ?? ""}>`,
    `Subject: ${email.subject ?? ""}`,
    `Body (gekürzt): ${(email.body_text ?? "").slice(0, 2000)}`,
    ``,
    `Offene Eventanfragen in Maestro (max 20, sortiert nach Datum-Nähe zu heute):`,
    eventLines || "(keine offenen Events)",
    ``,
    sample.length ? `Frühere Korrekturen durch den Operator (zum Lernen):\n${corrText}\n` : ``,
    `Klassifiziere die eingehende Mail. Antworte als JSON:`,
    `{`,
    `  "match_event_id": "uuid_oder_null",`,
    `  "category": "match" | "new_inquiry" | "irrelevant" | "unclear",`,
    `  "confidence": "high" | "medium" | "low",`,
    `  "reasoning": "max 2 Sätze, deutsch, was hat den Ausschlag gegeben"`,
    `}`,
  ].join("\n");

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system:
          "Du bist ein Klassifikations-Assistent für eingehende Mails an einen Event-Caterer. Deine Aufgabe ist es, eingehende Mails den richtigen Eventanfragen zuzuordnen oder als neue Anfrage / irrelevant zu klassifizieren. Antworte ausschließlich als JSON.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Claude error", resp.status, txt);
      return {
        suggested_event_id: null,
        suggestion_category: "unclear",
        suggestion_confidence: "low",
        suggestion_reasoning: `Klassifikation fehlgeschlagen (${resp.status}).`,
        suggestion_method: "llm",
      };
    }

    const data = await resp.json();
    const content = data?.content?.[0]?.text ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    const allowedIds = new Set(top.map((e: any) => e.id));
    let matchId: string | null = parsed.match_event_id ?? null;
    if (matchId && !allowedIds.has(matchId)) matchId = null;

    const cat = ["match", "new_inquiry", "irrelevant", "unclear"].includes(parsed.category)
      ? parsed.category
      : "unclear";
    const conf = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";

    return {
      suggested_event_id: cat === "match" ? matchId : null,
      suggestion_category: cat,
      suggestion_confidence: conf,
      suggestion_reasoning: String(parsed.reasoning ?? "").slice(0, 500),
      suggestion_method: "llm",
    };
  } catch (e) {
    console.error("LLM call failed:", (e as Error).message);
    return {
      suggested_event_id: null,
      suggestion_category: "unclear",
      suggestion_confidence: "low",
      suggestion_reasoning: "Klassifikation fehlgeschlagen.",
      suggestion_method: "llm",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { email_id, force_llm } = body ?? {};
    if (!email_id) {
      return new Response(JSON.stringify({ ok: false, error: "email_id required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: email } = await admin
      .from("inbox_emails")
      .select("id, from_email, from_name, subject, body_text, in_reply_to, references_headers, is_hidden")
      .eq("id", email_id)
      .maybeSingle();
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "email not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (email.is_hidden) {
      return new Response(JSON.stringify({ ok: true, skipped: "hidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already linked?
    const { data: existingLink } = await admin
      .from("event_email_links")
      .select("id")
      .eq("email_id", email_id)
      .eq("is_excluded", false)
      .limit(1)
      .maybeSingle();
    if (existingLink) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_linked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let suggestion: Suggestion | null = null;
    if (!force_llm) suggestion = await runHeuristics(email);
    if (!suggestion) suggestion = await runLLM(email);

    await admin
      .from("inbox_emails")
      .update({
        suggested_event_id: suggestion.suggested_event_id,
        suggestion_category: suggestion.suggestion_category,
        suggestion_confidence: suggestion.suggestion_confidence,
        suggestion_reasoning: suggestion.suggestion_reasoning,
        suggestion_method: suggestion.suggestion_method,
        suggestion_generated_at: new Date().toISOString(),
      })
      .eq("id", email_id);

    return new Response(
      JSON.stringify({ ok: true, suggestion, method: suggestion.suggestion_method }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-email-mapping:", (e as Error).message);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});