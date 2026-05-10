import { useState, useMemo, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Pencil, Trash2, Send, Search, AlertTriangle, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useDraftsInbox, type DraftEmail } from "@/hooks/useUnassignedInbox";
import { MailComposer } from "@/components/admin/shared/MailComposer";

type EventLite = {
  id: string;
  number: string | null;
  date: string | null;
  occasion: string | null;
  status: string;
  customer: { id: string; name: string; email: string } | null;
};

export function DraftsView() {
  const drafts = useDraftsInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = drafts.data ?? [];
  const selected = useMemo(
    () => list.find((d) => d.id === selectedId) ?? null,
    [list, selectedId],
  );

  useEffect(() => {
    if (list.length > 0 && !selected) setSelectedId(list[0].id);
    if (list.length === 0) setSelectedId(null);
  }, [list, selected]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[60vh]">
      <div className="rounded-2xl border bg-white overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
        <div className="overflow-y-auto divide-y">
          {list.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              <Pencil className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Keine Entwürfe.
            </div>
          )}
          {list.map((d) => {
            const recipient = d.to_emails?.[0] ?? "(noch kein Empfänger)";
            const tsRaw = d.date_sent || d.updated_at;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "w-full text-left p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors",
                  selectedId === d.id && "bg-muted/70",
                )}
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                  ✏️
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <strong className="truncate text-sm">An: {recipient}</strong>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(tsRaw), { addSuffix: true, locale: de })}
                    </span>
                  </div>
                  <div className="text-sm text-foreground/80 truncate">
                    {d.subject || (
                      <span className="italic text-muted-foreground">(ohne Betreff)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase border-amber-300 text-amber-700"
                    >
                      Entwurf
                    </Badge>
                    <span className="truncate">{d.body_text?.slice(0, 80) ?? ""}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
        {selected ? (
          <DraftDetail draft={selected} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Wähle einen Entwurf aus der Liste.
          </div>
        )}
      </div>
    </div>
  );
}

function DraftDetail({ draft }: { draft: DraftEmail }) {
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const sanitizedHtml = useMemo(() => {
    if (!draft.body_html) return null;
    return draft.body_html.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "",
    );
  }, [draft.body_html]);

  const tsRaw = draft.date_sent || draft.updated_at;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b space-y-2">
        <div className="grid grid-cols-[60px_1fr] gap-y-1 text-sm">
          <div className="text-muted-foreground">An:</div>
          <div className="break-all">{draft.to_emails?.join(", ") || "—"}</div>
          {draft.cc_emails?.length > 0 && (
            <>
              <div className="text-muted-foreground">CC:</div>
              <div className="break-all">{draft.cc_emails.join(", ")}</div>
            </>
          )}
          <div className="text-muted-foreground">Betreff:</div>
          <div className="font-semibold">
            {draft.subject || (
              <span className="italic text-muted-foreground">(ohne Betreff)</span>
            )}
          </div>
          <div className="text-muted-foreground">Bearbeitet:</div>
          <div>{format(new Date(tsRaw), "Pp", { locale: de })}</div>
        </div>
        <div className="flex items-start gap-2 text-xs rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Entwurf aus dem Mailclient. In Maestro nur lesend. Beim Weiterschreiben wird der
            Server-Entwurf nach erfolgreichem Versand automatisch gelöscht.
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="rounded-full" onClick={() => setComposerOpen(true)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            In Maestro weiterschreiben
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Server-Entwurf löschen
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sanitizedHtml ? (
          <iframe
            title={`draft-${draft.id}`}
            className="w-full min-h-[400px] rounded-xl border bg-white"
            srcDoc={sanitizedHtml}
            sandbox="allow-same-origin"
            style={{ height: 500 }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/30 rounded-xl p-3 border">
            {draft.body_text || (
              <span className="italic text-muted-foreground">Kein Inhalt</span>
            )}
          </pre>
        )}
      </div>

      <ContinueDraftDialog
        draft={draft}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onSent={() => {
          qc.invalidateQueries({ queryKey: ["drafts-inbox"] });
        }}
      />
      <DeleteDraftDialog
        draft={draft}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          qc.invalidateQueries({ queryKey: ["drafts-inbox"] });
        }}
      />
    </div>
  );
}

function DeleteDraftDialog({
  draft,
  open,
  onOpenChange,
  onDeleted,
}: {
  draft: DraftEmail;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("delete-imap-draft", {
      body: { email_id: draft.id },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Entwurf auf dem Mailserver gelöscht.");
    onDeleted();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Server-Entwurf löschen?</DialogTitle>
          <DialogDescription>
            Diese Draft wird im IONOS-Mailserver dauerhaft gelöscht. Diese Aktion ist{" "}
            <strong>nicht rückgängig zu machen</strong> — auch nicht in Apple Mail.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Endgültig löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContinueDraftDialog({
  draft,
  open,
  onOpenChange,
  onSent,
}: {
  draft: DraftEmail;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onSent: () => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EventLite[]>([]);
  const [chosen, setChosen] = useState<EventLite | null>(null);
  const [suggestion, setSuggestion] = useState<EventLite | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setChosen(null);
      setSuggestion(null);
      return;
    }
    void loadSuggestion();
    void runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.id]);

  const loadSuggestion = async () => {
    const recipient = draft.to_emails?.[0];
    if (!recipient) {
      setSuggestion(null);
      return;
    }
    const { data } = await supabase
      .from("v2_customers")
      .select("id, name, email, v2_events(id, number, date, occasion, status)")
      .ilike("email", recipient)
      .limit(1)
      .maybeSingle();
    if (!data) {
      setSuggestion(null);
      return;
    }
    const events = ((data as any).v2_events ?? []).filter(
      (e: any) => !["cancelled", "completed", "archived"].includes(e.status),
    );
    if (events.length === 1) {
      const ev = events[0];
      setSuggestion({
        id: ev.id,
        number: ev.number,
        date: ev.date,
        occasion: ev.occasion,
        status: ev.status,
        customer: { id: data.id, name: data.name, email: data.email },
      });
    }
  };

  const runSearch = async (q: string) => {
    let query = supabase
      .from("v2_events")
      .select("id, number, date, occasion, status, v2_customers!inner(id, name, email)")
      .not("status", "in", "(cancelled,completed,archived)")
      .order("date", { ascending: false })
      .limit(20);
    const { data } = await query;
    let mapped: EventLite[] = (data ?? []).map((e: any) => ({
      id: e.id,
      number: e.number,
      date: e.date,
      occasion: e.occasion,
      status: e.status,
      customer: e.v2_customers
        ? { id: e.v2_customers.id, name: e.v2_customers.name, email: e.v2_customers.email }
        : null,
    }));
    if (q.trim()) {
      const lower = q.toLowerCase();
      mapped = mapped.filter(
        (m) =>
          m.number?.toLowerCase().includes(lower) ||
          m.occasion?.toLowerCase().includes(lower) ||
          m.customer?.name?.toLowerCase().includes(lower) ||
          m.customer?.email?.toLowerCase().includes(lower),
      );
    }
    setResults(mapped);
  };

  const handleSend = async (payload: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    html: string;
    text: string;
  }) => {
    if (!chosen) {
      toast.error("Bitte ein Event wählen.");
      return;
    }
    setSending(true);
    try {
      const ccArr = payload.cc ? payload.cc.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const bccArr = payload.bcc ? payload.bcc.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
      const { data, error } = await supabase.functions.invoke("send-offer-email", {
        body: {
          inquiryId: chosen.id,
          to: payload.to,
          emailSubject: payload.subject,
          emailHtml: payload.html,
          emailContent: payload.text,
          cc: ccArr,
          bcc: bccArr,
          isReply: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Server-Draft löschen
      await supabase.functions.invoke("delete-imap-draft", { body: { email_id: draft.id } });
      toast.success("Mail gesendet und Server-Entwurf gelöscht.");
      onSent();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entwurf in Maestro weiterschreiben</DialogTitle>
          <DialogDescription>
            Wähle ein Event und schreibe den Entwurf fertig. Beim Senden wird die Draft auf dem
            Mailserver automatisch gelöscht.
          </DialogDescription>
        </DialogHeader>

        {!chosen && (
          <div className="space-y-3">
            {suggestion && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Vorschlag
                </div>
                <button
                  onClick={() => setChosen(suggestion)}
                  className="w-full text-left rounded-xl border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="text-sm font-semibold">
                    {suggestion.number || suggestion.id.slice(0, 8)}
                    {suggestion.occasion && (
                      <span className="text-muted-foreground font-normal">
                        {" "}· {suggestion.occasion}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {suggestion.date ? format(new Date(suggestion.date), "dd.MM.yyyy", { locale: de }) : "—"}
                    {suggestion.customer
                      ? ` · ${suggestion.customer.name} (${suggestion.customer.email})`
                      : ""}
                  </div>
                </button>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Event-Suche
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    void runSearch(e.target.value);
                  }}
                  placeholder="Kundenname, Eventnummer, Anlass…"
                  className="rounded-xl pl-9"
                />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1.5">
                {results.length === 0 && (
                  <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                    Keine Ergebnisse.
                  </div>
                )}
                {results.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setChosen(ev)}
                    className="w-full text-left rounded-xl border p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="text-sm font-semibold">
                      {ev.number || ev.id.slice(0, 8)}
                      {ev.occasion && (
                        <span className="text-muted-foreground font-normal"> · {ev.occasion}</span>
                      )}
                      <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                        {ev.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ev.date ? format(new Date(ev.date), "dd.MM.yyyy", { locale: de }) : "—"}
                      {ev.customer ? ` · ${ev.customer.name} (${ev.customer.email})` : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {chosen && (
          <div className="space-y-3">
            <div className="rounded-xl border p-3 flex items-start gap-3">
              <div className="flex-1">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Event
                </div>
                <div className="text-sm font-semibold">
                  {chosen.number || chosen.id.slice(0, 8)}
                  {chosen.occasion && (
                    <span className="text-muted-foreground font-normal"> · {chosen.occasion}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {chosen.date ? format(new Date(chosen.date), "dd.MM.yyyy", { locale: de }) : "—"}
                  {chosen.customer ? ` · ${chosen.customer.name} (${chosen.customer.email})` : ""}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setChosen(null)}>
                Ändern
              </Button>
            </div>

            <div className="rounded-xl border-amber-200 border bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Du schreibst an einem Entwurf weiter, der ursprünglich aus Apple Mail stammt. Beim
                Senden wird der Entwurf auf dem Mailserver automatisch gelöscht.
              </span>
            </div>

            <MailComposer
              defaultTo={draft.to_emails?.[0] ?? ""}
              defaultSubject={draft.subject ?? ""}
              defaultBody={draft.body_html ?? (draft.body_text ? `<p>${draft.body_text.replace(/\n/g, "<br/>")}</p>` : "")}
              fromLabel="info@events-storia.de"
              isSending={sending}
              onSend={handleSend}
              onCancel={() => onOpenChange(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}