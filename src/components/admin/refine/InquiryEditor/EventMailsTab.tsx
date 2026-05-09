import { useMemo, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import {
  Mail,
  MailX,
  MoreVertical,
  Plus,
  Paperclip,
  Download,
  Trash2,
  Archive,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventEmails, type EventEmail } from "@/hooks/useEventEmails";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  contactEmail?: string | null;
  contactName?: string | null;
  eventName?: string | null;
};

function formatBytes(b: number | null | undefined) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+|@/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

export default function EventMailsTab({
  eventId,
  contactEmail,
  contactName,
  eventName,
}: Props) {
  const [includeHidden, setIncludeHidden] = useState(false);
  const { emails, filters, loading, refetch } = useEventEmails(eventId, includeHidden);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <FilterManagement
        eventId={eventId}
        filters={filters}
        contactEmail={contactEmail ?? null}
        contactName={contactName ?? null}
        eventName={eventName ?? null}
        onChanged={refetch}
        onOpenCustom={() => setCustomDialogOpen(true)}
      />

      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-muted-foreground">
          {loading ? "Lade…" : `${emails.length} E-Mail${emails.length === 1 ? "" : "s"}`}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Switch checked={includeHidden} onCheckedChange={setIncludeHidden} />
          {includeHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Ausgeblendete anzeigen
        </label>
      </div>

      <div className="space-y-3">
        {emails.length === 0 && !loading && (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Noch keine Mails diesem Event zugeordnet.
              {contactEmail && (
                <div className="mt-3">
                  Tipp: <strong>„Alle Mails von {contactEmail}"</strong> oben.
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {emails.map((email) => (
          <MailRow key={`${email.source}-${email.id}`} email={email} eventId={eventId} onChanged={refetch} />
        ))}
      </div>

      <CustomFilterDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        eventId={eventId}
        onCreated={refetch}
      />
    </div>
  );
}

/* --------------------------- Filter Management --------------------------- */

function FilterManagement({
  eventId,
  filters,
  contactEmail,
  contactName,
  eventName,
  onChanged,
  onOpenCustom,
}: {
  eventId: string;
  filters: ReturnType<typeof useEventEmails>["filters"];
  contactEmail: string | null;
  contactName: string | null;
  eventName: string | null;
  onChanged: () => void;
  onOpenCustom: () => void;
}) {
  const addFilter = async (
    filter_type: "from_email" | "subject_contains",
    filter_value: string,
    label: string
  ) => {
    if (!filter_value.trim()) return;
    const { error } = await supabase.functions.invoke("add-event-email-filter", {
      body: { event_id: eventId, filter_type, filter_value: filter_value.trim(), label },
    });
    if (error) toast.error(`Filter konnte nicht hinzugefügt werden: ${error.message}`);
    else {
      toast.success("Filter hinzugefügt — Mails werden zugeordnet.");
      onChanged();
    }
  };

  const removeFilter = async (filterId: string) => {
    const { error } = await supabase.functions.invoke("remove-event-email-filter", {
      body: { filter_id: filterId },
    });
    if (error) toast.error(`Filter konnte nicht entfernt werden: ${error.message}`);
    else {
      toast.success("Filter entfernt.");
      onChanged();
    }
  };

  return (
    <Card className="rounded-2xl border border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Mail-Filter für dieses Event
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {filters.length === 0 && (
            <span className="text-xs text-muted-foreground">
              Noch keine Filter — füge unten welche hinzu, um Mails automatisch zuzuordnen.
            </span>
          )}
          {filters.map((f) => (
            <Badge
              key={f.id}
              variant="secondary"
              className="rounded-full pl-3 pr-1 py-1 gap-1 text-xs font-normal bg-muted/60 hover:bg-muted"
            >
              {f.filter_type === "from_email" && <>Von: <strong>{f.filter_value}</strong></>}
              {f.filter_type === "subject_contains" && <>Betreff enthält: „{f.filter_value}"</>}
              {f.filter_type === "thread_root" && <>Thread: {f.label || f.filter_value.slice(0, 12)}</>}
              <button
                onClick={() => removeFilter(f.id)}
                className="ml-1 rounded-full hover:bg-destructive/10 p-0.5"
                title="Filter entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {contactEmail && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() =>
                addFilter(
                  "from_email",
                  contactEmail,
                  `Kontakt: ${contactName || contactEmail}`
                )
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Alle Mails von {contactEmail}
            </Button>
          )}
          {eventName && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
              onClick={() =>
                addFilter("subject_contains", eventName, `Betreff: ${eventName}`)
              }
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Mails mit Betreff „{eventName}"
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs"
            onClick={onOpenCustom}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Benutzerdefinierter Filter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomFilterDialog({
  open,
  onOpenChange,
  eventId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  eventId: string;
  onCreated: () => void;
}) {
  const [type, setType] = useState<"from_email" | "subject_contains">("from_email");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("add-event-email-filter", {
      body: {
        event_id: eventId,
        filter_type: type,
        filter_value: value.trim(),
        label: label.trim() || null,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Filter hinzugefügt.");
    setValue("");
    setLabel("");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Benutzerdefinierter Filter</DialogTitle>
          <DialogDescription>
            Lege fest, welche Mails diesem Event automatisch zugeordnet werden.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Typ</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="from_email">Von E-Mail-Adresse</SelectItem>
                <SelectItem value="subject_contains">Betreff enthält</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Wert</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === "from_email" ? "name@firma.de" : "Hochzeit Müller"}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Anzeigename des Filters"
              className="rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={busy || !value.trim()}>
            Filter anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------- Mail Row -------------------------------- */

function MailRow({
  email,
  eventId,
  onChanged,
}: {
  email: EventEmail;
  eventId: string;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | "remove" | "archive">(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachments, setAttachments] = useState<
    { id: string; filename: string; size_bytes: number | null; storage_path: string; mime_type: string | null }[]
  >([]);
  const [loadedAttachments, setLoadedAttachments] = useState(false);

  const isOutboundResend = email.source === "outbound";
  const isOutboundManual = email.source === "outbound_manual";
  const isOutbound = isOutboundResend || isOutboundManual;
  const isDeletedOnServer = email.imap_status === "deleted_on_server";
  const isMoved = email.imap_status === "moved";

  const sanitizedHtml = useMemo(() => {
    if (!email.body_html) return null;
    // Basic safety: strip script tags. Iframe sandbox does the rest.
    return email.body_html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }, [email.body_html]);

  const loadAttachments = async () => {
    if (loadedAttachments || isOutbound) return;
    const { data } = await supabase
      .from("email_attachments")
      .select("id, filename, size_bytes, storage_path, mime_type")
      .eq("email_id", email.id)
      .eq("is_inline", false);
    setAttachments(data ?? []);
    setLoadedAttachments(true);
  };

  const handleExpand = () => {
    if (!expanded && email.has_attachments) void loadAttachments();
    setExpanded((e) => !e);
  };

  const downloadAttachment = async (path: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from("email-attachments")
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Download fehlgeschlagen");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadEml = async () => {
    if (isOutbound) return;
    const { data, error } = await supabase
      .from("inbox_emails")
      .select("raw_mime, subject")
      .eq("id", email.id)
      .single();
    if (error || !data) {
      toast.error("Original-Mail nicht gefunden");
      return;
    }
    const blob = new Blob([data.raw_mime ?? ""], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.subject || "mail").replace(/[^\w-]+/g, "_").slice(0, 60)}.eml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const removeFromEvent = async () => {
    if (isOutbound) {
      toast.info("Versendete Mails können nicht entfernt werden.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.functions.invoke("remove-email-from-event", {
      body: { event_id: eventId, email_id: email.id, reason: reason.trim() || null },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Mail aus Event entfernt.");
      setConfirmAction(null);
      setReason("");
      onChanged();
    }
  };

  const archiveGlobally = async () => {
    if (isOutbound) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("archive-email-globally", {
      body: { email_id: email.id, reason: reason.trim() || "archived_in_maestro" },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("In Maestro archiviert.");
      setConfirmAction(null);
      setReason("");
      onChanged();
    }
  };

  const restoreToEvent = async () => {
    const { error } = await supabase.functions.invoke("restore-email-to-event", {
      body: { event_id: eventId, email_id: email.id },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Mail wiederhergestellt.");
      onChanged();
    }
  };

  const unarchiveGlobally = async () => {
    const { error } = await supabase.functions.invoke("unarchive-email-globally", {
      body: { email_id: email.id },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Mail wieder eingeblendet.");
      onChanged();
    }
  };

  return (
    <>
    <div
      className={cn(
        "rounded-2xl border bg-white transition-shadow",
        "hover:shadow-sm",
        isDeletedOnServer && "opacity-70 border-amber-200 bg-amber-50/30",
        email.is_excluded && "opacity-60 border-dashed",
        email.is_hidden && "opacity-50"
      )}
    >
      <button
        type="button"
        onClick={handleExpand}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
          {isOutbound ? <ArrowRight className="h-4 w-4" /> : initials(email.from_name, email.from_email)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold truncate">
              {isOutboundResend
                ? "Maestro → Kunde"
                : isOutboundManual
                  ? "Manuell gesendet"
                  : email.from_name || email.from_email || "Unbekannt"}
            </span>
            {!isOutbound && email.from_name && email.from_email && (
              <span className="text-xs text-muted-foreground truncate">{email.from_email}</span>
            )}
            <Badge variant="outline" className="ml-auto rounded-full text-[10px] uppercase tracking-wide">
              {isOutboundResend ? "Gesendet" : isOutboundManual ? "Manuell" : "Eingehend"}
            </Badge>
          </div>
          <div className="text-sm text-foreground/80 truncate mt-0.5">
            {email.subject || <span className="italic text-muted-foreground">(kein Betreff)</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span title={format(new Date(email.date_at), "Pp", { locale: de })}>
              {formatDistanceToNow(new Date(email.date_at), { addSuffix: true, locale: de })}
            </span>
            {email.has_attachments && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {email.attachment_count}
              </span>
            )}
            {email.is_excluded && <span className="text-destructive">· entfernt</span>}
            {email.is_hidden && <span>· ausgeblendet</span>}
            {isOutboundManual && (
              <span className="italic">· manuell aus Mailclient gesendet</span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            {!isOutbound && !email.is_excluded && (
              <DropdownMenuItem onClick={() => setConfirmAction("remove")}>
                <Trash2 className="h-4 w-4 mr-2" />
                Aus diesem Event entfernen
              </DropdownMenuItem>
            )}
            {!isOutbound && email.is_excluded && (
              <DropdownMenuItem onClick={restoreToEvent}>
                <RotateCcw className="h-4 w-4 mr-2" />
                In Event wiederherstellen
              </DropdownMenuItem>
            )}
            {!isOutbound && !email.is_hidden && (
              <DropdownMenuItem onClick={() => setConfirmAction("archive")}>
                <Archive className="h-4 w-4 mr-2" />
                In Maestro archivieren
              </DropdownMenuItem>
            )}
            {!isOutbound && email.is_hidden && (
              <DropdownMenuItem onClick={unarchiveGlobally}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Aus Archiv wiederherstellen
              </DropdownMenuItem>
            )}
            {!isOutbound && <DropdownMenuSeparator />}
            {!isOutbound && (
              <DropdownMenuItem onClick={downloadEml}>
                <Download className="h-4 w-4 mr-2" />
                Original-Mail (.eml)
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {isDeletedOnServer && (
            <div className="flex items-start gap-2 text-xs rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Diese Mail wurde
                {email.status_changed_at &&
                  ` am ${format(new Date(email.status_changed_at), "Pp", { locale: de })}`}
                {" "}im Postfach gelöscht. Sie ist nur noch in Maestro archiviert.
              </span>
            </div>
          )}
          {isMoved && (
            <div className="flex items-start gap-2 text-xs rounded-xl bg-muted border px-3 py-2">
              <MailX className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Mail wurde verschoben nach: <strong>{email.imap_folder}</strong></span>
            </div>
          )}

          {sanitizedHtml ? (
            <iframe
              title={`mail-${email.id}`}
              className="w-full min-h-[200px] rounded-xl border bg-white"
              srcDoc={sanitizedHtml}
              sandbox="allow-same-origin"
              style={{ height: 400 }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-sans text-foreground/90 bg-muted/30 rounded-xl p-3 border">
              {email.body_text || <span className="text-muted-foreground italic">Kein Inhalt</span>}
            </pre>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {attachments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => downloadAttachment(a.storage_path, a.filename)}
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/40 hover:bg-muted px-3 py-1.5 text-xs"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[220px]">{a.filename}</span>
                  {a.size_bytes ? (
                    <span className="text-muted-foreground">({formatBytes(a.size_bytes)})</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    <Dialog
      open={confirmAction !== null}
      onOpenChange={(o) => {
        if (!o) {
          setConfirmAction(null);
          setReason("");
        }
      }}
    >
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {confirmAction === "remove"
              ? "Mail aus Event entfernen"
              : "In Maestro archivieren"}
          </DialogTitle>
          <DialogDescription>
            {confirmAction === "remove"
              ? "Diese Mail wird aus dem Verlauf dieses Events entfernt. Sie bleibt in Maestro für andere Events und im Archiv erhalten."
              : "Diese Mail wird in allen Event-Verläufen verborgen. Sie bleibt in der Datenbank gespeichert und kann jederzeit wieder eingeblendet werden."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">Grund (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. falsche Zuordnung"
            className="rounded-xl"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmAction(null);
              setReason("");
            }}
            disabled={busy}
          >
            Abbrechen
          </Button>
          <Button
            onClick={confirmAction === "remove" ? removeFromEvent : archiveGlobally}
            disabled={busy}
          >
            Bestätigen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}