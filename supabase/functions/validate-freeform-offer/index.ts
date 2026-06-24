import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * validate-freeform-offer (Red-Team)
 * Vergleicht ein bereits geparstes Programm-JSON 1:1 mit dem Original-Text
 * und meldet jede Abweichung als Finding. Bewusst anderes Modell als der
 * Parser, um Bias zu vermeiden.
 */

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawText: string = typeof body?.rawText === "string" ? body.rawText : "";
    const program = body?.program;

    if (!rawText || rawText.trim().length < 50 || !program || typeof program !== "object") {
      return new Response(
        JSON.stringify({ error: "rawText und program erforderlich." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY ist nicht konfiguriert." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Du bist ein strenger QA-Validator (Red Team) für Catering-Angebote.

AUFGABE:
Vergleiche das gelieferte JSON-Programm 1:1 mit dem Original-Angebotstext.
Melde JEDE Abweichung als Finding via Tool-Call report_findings.

PRÜFKRITERIEN:
1. completeness — Jeder Tag und jede Mahlzeit aus dem Text muss im JSON erscheinen. Keine Sektion / Speise darf fehlen.
2. pricing — Wenn der Text einen Preis nennt, muss er EXAKT (1:1) im passenden Feld stehen:
     • Pauschale "X € netto" → meal.flatPriceNet
     • "ab/ca. X € pro Person" → meal.pricePerPersonNet (NICHT flatPriceNet)
     • Stundensatz "X € pro Stunde" / Pauschale "Anfahrt X €" → additionalServices[] (KEIN taxBreakdown.servicesNet, solange keine Stunden/Mengen im Text)
     • Kalkulationsblock-Zahlen → taxBreakdown / totalsFromText
   WICHTIG: 0 im JSON bedeutet "im Text nicht genannt" und ist NIE ein Finding.
   Flag NUR, wenn der Text eine konkrete Zahl nennt UND das JSON eine ANDERE Nicht-Null-Zahl trägt, oder wenn eine im Text genannte Zahl komplett fehlt (weder im erwarteten Feld noch in additionalServices).
   Wenn meal.pricePerPersonNet > 0 ist, darf meal.flatPriceNet = 0 sein — KEIN Finding.
   Wenn der Text KEINE Gesamtsumme nennt, darf totalsFromText.net/gross = 0 sein — KEIN Finding.
   Wenn der Text KEINE Kalkulations-Sub-Summen nennt, darf taxBreakdown.foodNet/servicesNet = 0 sein — KEIN Finding.
3. guests_dates — guestCount pro Mahlzeit, dateLabel und isoDate müssen korrekt zugeordnet sein.
   Wenn der Text keine Gästezahl nennt, ist guestCount=0 KEIN Finding.
4. notes — Alle HINWEISE-Punkte müssen in notes[] erscheinen; LEISTUNGSUMFANG in scopeOfServices[].
5. additionalServices — Jede Zeile aus dem Text mit Stunden-/Pauschal-/Stück-Preis (Service-Personal, Auf-/Abbau, Anfahrt, Abfahrt, Equipment) muss als Eintrag in additionalServices[] erscheinen.

REGELN:
- severity="critical" bei: Preis-Mismatch (Text-Zahl ≠ JSON-Zahl), komplett fehlender Tag oder fehlende Mahlzeit, im Text genannte Pauschale komplett fehlt.
- severity="warning" bei: fehlende Sektion, fehlende Speise, fehlende Hinweis-Zeile, fehlender Scope-Punkt, fehlende additionalServices-Zeile, falsche Gästezahl.
- ok=true NUR wenn ALLE Prüfkriterien erfüllt sind (keine Findings).
- ok=false wenn mindestens 1 critical Finding ODER ≥3 warnings.
- path: dot/bracket-Notation, z.B. "days[1].meals[0].flatPriceNet".
- expected / actual: wörtlich aus Text bzw. JSON.
- Antworte AUSSCHLIESSLICH per Tool-Call report_findings.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "report_findings",
          description: "Validierungs-Findings für ein Catering-Programm melden",
          parameters: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              summary: { type: "string" },
              findings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    severity: { type: "string", enum: ["critical", "warning"] },
                    category: {
                      type: "string",
                      enum: ["completeness", "pricing", "guests_dates", "notes"],
                    },
                    path: { type: "string" },
                    expected: { type: "string" },
                    actual: { type: "string" },
                    message: { type: "string" },
                  },
                  required: ["severity", "category", "path", "expected", "actual", "message"],
                },
              },
            },
            required: ["ok", "findings", "summary"],
          },
        },
      },
    ];

    const userMsg = `ORIGINAL-TEXT:
\`\`\`
${rawText}
\`\`\`

GEPARSTES JSON:
\`\`\`json
${JSON.stringify(program, null, 2)}
\`\`\``;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "report_findings" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Validator AI Error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit beim Red-Team-Validator." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-Guthaben aufgebraucht (Validator)." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `Validator AI Fehler ${aiRes.status}`, detail: errText.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("Validator: kein Tool-Call", JSON.stringify(aiJson).slice(0, 1000));
      return new Response(
        JSON.stringify({ error: "Validator hat kein Ergebnis geliefert." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: { ok?: boolean; findings?: unknown[]; summary?: string };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Validator JSON-Parse-Fehler:", e);
      return new Response(
        JSON.stringify({ error: "Validator-Antwort konnte nicht geparst werden." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    const hasCritical = findings.some(
      (f: any) => f && f.severity === "critical",
    );
    const warningCount = findings.filter(
      (f: any) => f && f.severity === "warning",
    ).length;
    // Server-seitige Sicherheits-Override: ok nur bei keinen Findings.
    const computedOk = findings.length === 0 ? true : !(hasCritical || warningCount >= 3);
    const ok = typeof parsed.ok === "boolean" ? parsed.ok && computedOk : computedOk;

    return new Response(
      JSON.stringify({
        success: true,
        ok,
        findings,
        summary: parsed.summary ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("validate-freeform-offer Fehler:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unbekannter Fehler" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});