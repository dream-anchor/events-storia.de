import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string | null;
}

interface AiMessageRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface ConversationMeta {
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (r === "user" || r === "customer") return "Kunde";
  if (r === "assistant" || r === "ai") return "KI-Assistent";
  if (r === "system") return "System";
  if (r === "tool") return "Tool";
  return role;
}

export function AiConversationSheet({ open, onOpenChange, conversationId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-conversation-full", conversationId],
    enabled: open && !!conversationId,
    queryFn: async (): Promise<{ meta: ConversationMeta | null; messages: AiMessageRow[] }> => {
      const [convRes, msgRes] = await Promise.all([
        supabase
          .from("ai_conversations")
          .select("status, created_at, updated_at")
          .eq("id", conversationId!)
          .maybeSingle(),
        supabase
          .from("ai_messages")
          .select("id, role, content, created_at, metadata")
          .eq("conversation_id", conversationId!)
          .order("created_at", { ascending: true }),
      ]);
      if (convRes.error) throw convRes.error;
      if (msgRes.error) throw msgRes.error;
      return {
        meta: (convRes.data as ConversationMeta | null) ?? null,
        messages: (msgRes.data as AiMessageRow[] | null) ?? [],
      };
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-neutral-500" />
            KI-Konversation
          </SheetTitle>
          <SheetDescription asChild>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {data?.meta?.status && (
                <div>Status: <span className="font-medium text-foreground/80">{data.meta.status}</span></div>
              )}
              {data?.meta?.created_at && (
                <div>Gestartet: {formatTimestamp(data.meta.created_at)}</div>
              )}
              {conversationId && (
                <div className="opacity-60 truncate font-mono text-[10px]">ID: {conversationId}</div>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4 font-sans">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Konversation wird geladen …
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Konversation konnte nicht geladen werden.
            </div>
          )}
          {!isLoading && !error && data && data.messages.length === 0 && (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Für diese Anfrage wurde keine KI-Konversation gefunden.
            </div>
          )}
          {!isLoading && !error && data && data.messages.length > 0 && (
            <ol className="space-y-4">
              {data.messages
                .filter((m) => {
                  const r = m.role.toLowerCase();
                  return r === "user" || r === "customer" || r === "assistant" || r === "ai";
                })
                .map((m) => {
                  const r = m.role.toLowerCase();
                  const isUser = r === "user" || r === "customer";
                  return (
                    <li key={m.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {isUser ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                        <span className="font-semibold text-foreground/70">{roleLabel(m.role)}</span>
                        <span>·</span>
                        <span>{formatTimestamp(m.created_at)}</span>
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                          isUser
                            ? "bg-muted/60 text-foreground border border-border"
                            : "bg-foreground text-background",
                        )}
                      >
                        {m.content}
                      </div>
                      {(() => {
                        const md = m.metadata as { attachments?: Array<{ name?: string; url?: string }> } | null;
                        const atts = md?.attachments;
                        if (!atts || atts.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {atts.map((a, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {a.url ? (
                                  <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                                    {a.name || "Anhang"}
                                  </a>
                                ) : (
                                  a.name || "Anhang"
                                )}
                              </Badge>
                            ))}
                          </div>
                        );
                      })()}
                    </li>
                  );
                })}
            </ol>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}