import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  MainContainer,
  Sidebar,
  ConversationList,
  Conversation,
  ConversationHeader,
  Avatar,
  MessageInput,
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { Loader2, Mail, Paperclip, ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMailThread, type MailThreadItem } from "@/hooks/useMailThread";
import { useIsMobile } from "@/hooks/use-mobile";

interface MailClientProps {
  inquiryId: string;
  customerEmail?: string;
  onSendReply?: (content: string) => Promise<void>;
}

function getInitials(emailOrName: string): string {
  const cleaned = emailOrName.split("@")[0] || emailOrName;
  const parts = cleaned.split(/[._\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

function MailReadingPane({ item }: { item: MailThreadItem }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState(400);
  const hasHtml = !!(item.body_html && item.body_html.trim().length > 0);

  const sanitizedHtml = useMemo(
    () => (hasHtml ? DOMPurify.sanitize(item.body_html as string, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style"] }) : ""),
    [item.body_html, hasHtml]
  );

  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc?.body) {
        const h = Math.min(doc.body.scrollHeight + 24, 1400);
        setIframeHeight(Math.max(h, 280));
      }
    } catch { /* ignore */ }
  };

  const sentAt = item.created_at ? format(parseISO(item.created_at), "EEEE, dd. MMMM yyyy 'um' HH:mm", { locale: de }) : "";
  const isOutbound = item.direction === "outbound";

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border/60">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-foreground leading-snug">
            {item.subject || "(ohne Betreff)"}
          </h2>
          <Badge variant={isOutbound ? "default" : "secondary"} className="shrink-0 gap-1">
            {isOutbound ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
            {isOutbound ? "Gesendet" : "Empfangen"}
          </Badge>
        </div>
        <div className="grid grid-cols-[60px_1fr] gap-y-1 text-sm">
          <div className="text-muted-foreground">Von:</div>
          <div className="font-medium text-foreground break-all">{item.from_email}</div>
          <div className="text-muted-foreground">An:</div>
          <div className="text-foreground break-all">{item.to_email}</div>
          {item.cc_email && (<>
            <div className="text-muted-foreground">CC:</div>
            <div className="text-foreground break-all">{item.cc_email}</div>
          </>)}
          {item.bcc_email && (<>
            <div className="text-muted-foreground">BCC:</div>
            <div className="text-foreground break-all">{item.bcc_email}</div>
          </>)}
          <div className="text-muted-foreground">Datum:</div>
          <div className="text-foreground">{sentAt}</div>
        </div>
        {item.attachments && item.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.attachments.map((att, i) => (
              <Badge key={i} variant="secondary" className="text-xs gap-1">
                <Paperclip className="h-3 w-3" />
                {att.filename}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {hasHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={sanitizedHtml}
            title={`E-Mail ${item.id}`}
            sandbox="allow-same-origin"
            onLoad={handleIframeLoad}
            style={{ width: "100%", height: `${iframeHeight}px`, border: 0, display: "block", background: "white" }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
            {item.body_text || "(kein Inhalt)"}
          </pre>
        )}
      </div>
    </div>
  );
}

export function MailClient({ inquiryId, customerEmail, onSendReply }: MailClientProps) {
  const { items, isLoading } = useMailThread(inquiryId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const isMobile = useIsMobile();

  // Default-Auswahl: jüngste Mail
  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[items.length - 1].id);
    }
  }, [items, selectedId]);

  const selected = items.find(i => i.id === selectedId) || null;

  const handleSend = async (innerHtml: string) => {
    if (!onSendReply) return;
    const text = innerHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) return;
    setIsSending(true);
    try {
      await onSendReply(text);
    } catch {
      toast.error("Versand fehlgeschlagen");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Mail className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Noch keine Nachrichten</p>
        {customerEmail && (
          <p className="text-xs text-muted-foreground/60 mt-1">{customerEmail}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "70vh", minHeight: 480 }} className="rounded-lg overflow-hidden border border-border/60 bg-white">
      <MainContainer responsive>
        <Sidebar position="left" scrollable style={{ minWidth: isMobile ? "100%" : 320, maxWidth: isMobile ? "100%" : 360 }}>
          <ConversationList>
            {[...items].reverse().map((item) => {
              const isOutbound = item.direction === "outbound";
              const senderLabel = isOutbound ? "STORIA" : (item.from_email || "Kunde");
              const time = format(parseISO(item.created_at), "dd.MM. HH:mm", { locale: de });
              const previewBase = item.subject || (item.body_text || "").slice(0, 80);
              const Icon = item.kind === "form_response" ? FileText : Mail;
              return (
                <Conversation
                  key={item.id}
                  active={item.id === selectedId}
                  onClick={() => setSelectedId(item.id)}
                  name={
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 opacity-60 shrink-0" />
                      <span className="truncate">{senderLabel}</span>
                    </span>
                  }
                  info={previewBase}
                  lastSenderName={time}
                >
                  <Avatar
                    name={senderLabel}
                    style={{
                      backgroundColor: isOutbound ? "#fed7aa" : "#e5e7eb",
                      color: isOutbound ? "#9a3412" : "#374151",
                      fontWeight: 600,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                    }}
                  >
                    <span style={{ pointerEvents: "none" }}>{getInitials(senderLabel)}</span>
                  </Avatar>
                </Conversation>
              );
            })}
          </ConversationList>
        </Sidebar>

        <div className="flex flex-col flex-1 bg-white" style={{ minWidth: 0 }}>
          {selected ? (
            <>
              <ConversationHeader>
                <ConversationHeader.Content
                  userName={selected.direction === "outbound" ? "STORIA" : selected.from_email}
                  info={selected.direction === "outbound" ? "Ausgehend" : "Eingehend"}
                />
              </ConversationHeader>
              <MailReadingPane item={selected} />
              {onSendReply && (
                <div className="border-t border-border/60">
                  <MessageInput
                    placeholder="Antwort schreiben…"
                    attachButton={false}
                    onSend={(innerHtml) => handleSend(innerHtml)}
                    sendDisabled={isSending}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Wähle eine Nachricht aus
            </div>
          )}
        </div>
      </MainContainer>
    </div>
  );
}