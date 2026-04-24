import { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { Loader2, Send, Paperclip, CheckCircle2, Clock, AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface EmailMessage {
  id: string;
  inquiry_id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: Array<{ filename: string }>;
  resend_message_id: string | null;
  resend_status: string | null;
  in_reply_to: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  queued:    { label: "Zugestellt (wartend)", icon: Clock,         color: "text-amber-600" },
  sent:      { label: "Versendet",            icon: CheckCircle2,  color: "text-blue-600" },
  delivered: { label: "Zugestellt",           icon: CheckCircle2,  color: "text-green-600" },
  opened:    { label: "Geöffnet",             icon: CheckCircle2,  color: "text-green-700" },
  bounced:   { label: "Zurückgekehrt",        icon: AlertCircle,   color: "text-red-600" },
  failed:    { label: "Fehlgeschlagen",       icon: AlertCircle,   color: "text-red-600" },
  delivered_inbound: { label: "Eingegangen", icon: CheckCircle2,  color: "text-green-600" },
};

interface ConversationThreadProps {
  inquiryId: string;
  customerEmail?: string;
  onSendReply?: (content: string) => Promise<void>;
}

export function ConversationThread({ inquiryId, customerEmail, onSendReply }: ConversationThreadProps) {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("email_messages" as never)
      .select("*")
      .eq("inquiry_id", inquiryId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as EmailMessage[]);
    }
    setIsLoading(false);
  }, [inquiryId]);

  useEffect(() => {
    loadMessages();

    // Real-time subscription für neue Nachrichten
    const channel = supabase
      .channel(`v2_event_emails:${inquiryId}`)
      .on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "v2_event_emails",
          filter: `event_id=eq.${inquiryId}`,
        } as never,
        (payload: { new: Record<string, unknown> }) => {
          // v2_event_emails uses event_id; map to inquiry_id for UI consistency
          const row = payload.new as Record<string, unknown>;
          const mapped = { ...row, inquiry_id: row.event_id } as unknown as EmailMessage;
          setMessages(prev => [...prev, mapped]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [inquiryId, loadMessages]);

  const handleSend = async () => {
    if (!replyText.trim() || !onSendReply) return;
    setIsSending(true);
    try {
      await onSendReply(replyText.trim());
      setReplyText("");
      await loadMessages();
    } catch {
      toast.error("Versand fehlgeschlagen");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Nachrichten-Liste */}
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Mail className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Nachrichten</p>
          {customerEmail && (
            <p className="text-xs text-muted-foreground/60 mt-1">{customerEmail}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      )}

      {/* Antwort-Textarea */}
      {onSendReply && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          <Textarea
            placeholder="Antwort schreiben…"
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            rows={3}
            className="resize-none text-sm"
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">⌘↵ zum Senden</p>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!replyText.trim() || isSending}
              className="gap-1.5"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Senden
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: EmailMessage }) {
  const [expanded, setExpanded] = useState(false);
  const hasHtml = !!(message.body_html && message.body_html.trim().length > 0);
  const [viewMode, setViewMode] = useState<"html" | "text">(hasHtml ? "html" : "text");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(300);
  const isOutbound = message.direction === "outbound";
  const sentAt = message.created_at
    ? format(parseISO(message.created_at), "dd. MMM, HH:mm", { locale: de })
    : "";

  const statusKey = isOutbound ? (message.resend_status || "queued") : "delivered_inbound";
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.queued;
  const StatusIcon = statusCfg.icon;

  const preview = (message.body_text || "").slice(0, 120).replace(/\n/g, " ");

  const sanitizedHtml = hasHtml
    ? DOMPurify.sanitize(message.body_html as string, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style"] })
    : "";

  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) {
        const h = Math.min(doc.body.scrollHeight + 20, 800);
        setIframeHeight(Math.max(h, 200));
      }
    } catch {
      // ignore cross-origin (shouldn't happen with srcDoc)
    }
  };

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 cursor-pointer transition-colors ${
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        }`}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold opacity-70">
            {isOutbound ? "STORIA" : message.from_email}
          </span>
          <span className="text-[10px] opacity-50">{sentAt}</span>
          {isOutbound && (
            <StatusIcon className={`h-3 w-3 ${statusCfg.color} opacity-80`} />
          )}
          {expanded && hasHtml && (
            <div
              className="ml-auto flex items-center gap-0.5 rounded-full bg-background/20 p-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setViewMode("html")}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  viewMode === "html"
                    ? "bg-background text-foreground font-semibold"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setViewMode("text")}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  viewMode === "text"
                    ? "bg-background text-foreground font-semibold"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                Text
              </button>
            </div>
          )}
        </div>

        {/* Betreff (falls vorhanden und vom Standard abweichend) */}
        {message.subject && message.subject !== "Ihr Angebot von STORIA Events" && (
          <p className="text-[11px] font-semibold opacity-80 mb-1">{message.subject}</p>
        )}

        {/* Vorschau / Volltext */}
        {!expanded ? (
          <p className="text-sm leading-relaxed line-clamp-3">{preview}</p>
        ) : viewMode === "html" && hasHtml ? (
          <div
            className="mt-1 rounded-lg overflow-hidden bg-white border border-black/10"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              ref={iframeRef}
              srcDoc={sanitizedHtml}
              title={`E-Mail ${message.id}`}
              sandbox="allow-same-origin"
              onLoad={handleIframeLoad}
              style={{ width: "100%", height: `${iframeHeight}px`, border: 0, display: "block" }}
            />
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.body_text || ""}
          </p>
        )}

        {/* Anhänge */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.attachments.map((att, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-[10px] gap-1 py-0.5"
              >
                <Paperclip className="h-2.5 w-2.5" />
                {att.filename}
              </Badge>
            ))}
          </div>
        )}

        {((message.body_text || "").length > 120 || hasHtml) && (
          <p className="text-[10px] opacity-50 mt-1">
            {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
          </p>
        )}
      </div>
    </div>
  );
}
