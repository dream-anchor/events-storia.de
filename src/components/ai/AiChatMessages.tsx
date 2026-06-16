import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiIntakeLanguage, AiIntakeMessage } from "@/lib/aiIntake/types";

interface Props {
  messages: AiIntakeMessage[];
  thinking?: boolean;
  language: AiIntakeLanguage;
}

/**
 * Defensive Markdown-Sanitizer für KI-Bar-Nachrichten.
 * Falls das Modell trotz System-Prompt rohes Markdown liefert
 * (z. B. **Datum**, __Name__, ### Überschrift), entfernen wir die
 * Marker, damit der Nutzer keinen rohen Markdown-Code sieht.
 * Es findet KEIN echtes Markdown-Rendering statt — nur Säuberung.
 */
function sanitizeAssistantText(input: string): string {
  if (!input) return input;
  let out = input;
  // **bold** / __bold__  -> bold
  out = out.replace(/\*\*([^\n*]+?)\*\*/g, "$1");
  out = out.replace(/__([^\n_]+?)__/g, "$1");
  // *italic* / _italic_  -> italic  (vorsichtig, keine Worte mit _ in URLs)
  out = out.replace(/(^|[\s(])\*([^\s*][^*\n]*?)\*(?=[\s).,!?:;]|$)/g, "$1$2");
  out = out.replace(/(^|[\s(])_([^\s_][^_\n]*?)_(?=[\s).,!?:;]|$)/g, "$1$2");
  // Markdown-Überschriften ### Title -> Title
  out = out.replace(/^[ \t]{0,3}#{1,6}\s+/gm, "");
  // Codeblock-Zäune entfernen (Inhalt bleibt)
  out = out.replace(/```[a-zA-Z0-9]*\n?/g, "").replace(/```/g, "");
  // Inline-Code `x` -> x
  out = out.replace(/`([^`\n]+)`/g, "$1");
  return out;
}

export function AiChatMessages({ messages, thinking, language }: Props) {
  if (messages.length === 0 && !thinking) {
    return (
      <div className="font-sans rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {language === "de"
          ? "Beschreiben Sie Ihre Veranstaltung — die KI erkennt Datum, Personen und Wünsche automatisch."
          : "Describe your event — the AI will detect date, guests and preferences automatically."}
      </div>
    );
  }

  return (
    <ol className="font-sans space-y-2" aria-live="polite">
      {messages.map((m) => (
        <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          {m.role === "assistant" ? (
            <div className="flex items-start gap-2 max-w-[88%]">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {sanitizeAssistantText(m.content)}
              </p>
            </div>
          ) : (
            <p className="max-w-[88%] rounded-2xl border border-border bg-muted/60 text-foreground px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">
              {m.content}
            </p>
          )}
        </li>
      ))}
      {thinking ? (
        <li className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>{language === "de" ? "Denkt nach …" : "Thinking…"}</span>
        </li>
      ) : null}
    </ol>
  );
}