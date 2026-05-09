import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Mail,
  Inbox as InboxIcon,
  Paperclip,
  Pin,
  Plus,
  Ban,
  RotateCcw,
  Search,
  AlertTriangle,
  EyeOff,
  Sparkles,
  RefreshCw,
  Check,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useUnassignedInbox,
  useUnassignedInboxCount,
  useHiddenInbox,
  useBlocklist,
  type UnassignedEmail,
} from "@/hooks/useUnassignedInbox";
import { AdminLayout } from "@/components/admin/refine/AdminLayout";

type Tab = "open" | "hidden" | "blocked";

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+|@/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function parseAnlassFromSubject(s: string | null | undefined) {
  if (!s) return "";
  const lower = s.toLowerCase();
  const map: Record<string, string> = {
    geburtstag: "Geburtstag",
    hochzeit: "Hochzeit",
    firmenfeier: "Firmenfeier",
    weihnachtsfeier: "Weihnachtsfeier",
    sommerfest: "Sommerfest",
    taufe: "Taufe",
    konfirmation: "Konfirmation",
    jubiläum: "Jubiläum",
    catering: "Catering",
  };
  for (const k of Object.keys(map)) {
    if (lower.includes(k)) return map[k];
  }
  return "";
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type SuggestedEventInfo = {
  id: string;
  date: string | null;
  occasion: string | null;
  guest_count: number | null;
  customer_name: string | null;
};

function useSuggestedEvents(ids: string[]) {
  const key = [...new Set(ids)].sort().join(",");
  return useQuery({
    queryKey: ["suggested-events", key],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, SuggestedEventInfo>> => {
      const unique = [...new Set(ids)];
      const { data } = await supabase
        .from("v2_events")
        .select("id, date, occasion, guest_count, v2_customers(name)")
        .in("id", unique);
      const map: Record<string, SuggestedEventInfo> = {};
      for (const r of data ?? []) {
        map[(r as any).id] = {
          id: (r as any).id,
          date: (r as any).date,
          occasion: (r as any).occasion,
          guest_count: (r as any).guest_count,
          customer_name: (r as any).v2_customers?.name ?? null,
        };
      }
      return map;
    },
  });
}

function suggestionBadgeClasses(
  category: string | null,
  confidence: string | null,
): string {
  if (category === "match") {
    if (confidence === "high") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (confidence === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-muted text-muted-foreground";
  }
  if (category === "new_inquiry") return "bg-blue-100 text-blue-800 border-blue-200";
  if (category === "irrelevant") return "bg-red-50 text-red-700 border-red-200 opacity-80";
  return "bg-muted text-muted-foreground";
}

export default function Posteingang() {
  const [tab, setTab] = useState<Tab>("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [onlySuggestions, setOnlySuggestions] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const qcOuter = useQueryClient();

  const open = useUnassignedInbox();
  const hidden = useHiddenInbox();
  const blocklist = useBlocklist();
  const { data: openCount } = useUnassignedInboxCount();

  const rawList: UnassignedEmail[] =
    tab === "open" ? open.data ?? [] : tab === "hidden" ? hidden.data ?? [] : [];

  const list = useMemo(() => {
    const filtered = onlySuggestions
      ? rawList.filter((e) => !!e.suggestion_category)
      : rawList;
    const confRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return [...filtered].sort((a, b) => {
      const ar = a.suggestion_category ? confRank[a.suggestion_confidence ?? "low"] ?? 3 : 4;
      const br = b.suggestion_category ? confRank[b.suggestion_confidence ?? "low"] ?? 3 : 4;
      if (ar !== br) return ar - br;
      return new Date(b.date_received).getTime() - new Date(a.date_received).getTime();
    });
  }, [rawList, onlySuggestions]);

  const suggestedIds = useMemo(
    () => list.map((e) => e.suggested_event_id).filter((x): x is string => !!x),
    [list],
  );
  const { data: suggestedEvents } = useSuggestedEvents(suggestedIds);

  const runBulkSuggest = async () => {
    setBulkBusy(true);
    const { data, error } = await supabase.functions.invoke("bulk-suggest-mappings", {
      body: {},
    });
    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `${data?.processed ?? 0} Mails analysiert, ${data?.with_suggestion ?? 0} Vorschläge generiert${data?.remaining ? ` (${data.remaining} weitere offen)` : ""}.`,
    );
    qcOuter.invalidateQueries({ queryKey: ["unassigned-inbox"] });
  };

  const selected = useMemo(() => list.find((e) => e.id === selectedId) ?? null, [list, selectedId]);

  // auto-select first
  useEffect(() => {
    if (list.length > 0 && !selected) setSelectedId(list[0].id);
    if (list.length === 0) setSelectedId(null);
  }, [list, selected]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (assignOpen || createOpen || ignoreOpen) return;
      const t = ev.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!list.length) return;
      const idx = list.findIndex((e) => e.id === selectedId);
      if (ev.key === "j") {
        ev.preventDefault();
        setSelectedId(list[Math.min(list.length - 1, idx + 1)].id);
      } else if (ev.key === "k") {
        ev.preventDefault();
        setSelectedId(list[Math.max(0, idx - 1)].id);
      } else if (ev.key === "e" && tab === "open") {
        ev.preventDefault();
        setAssignOpen(true);
      } else if (ev.key === "n" && tab === "open") {
        ev.preventDefault();
        setCreateOpen(true);
      } else if (ev.key === "i" && tab === "open") {
        ev.preventDefault();
        setIgnoreOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [list, selectedId, tab, assignOpen, createOpen, ignoreOpen]);

  return (
    <AdminLayout
      activeTab="posteingang"
      title="Posteingang"
      showCreateButton={false}
    >
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <InboxIcon className="h-6 w-6" />
              Posteingang
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {openCount ?? 0} nicht zugeordnete Nachricht{(openCount ?? 0) === 1 ? "" : "en"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "open" && (
              <>
                <Button
                  size="sm"
                  variant={onlySuggestions ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setOnlySuggestions((v) => !v)}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Nur Vorschläge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={runBulkSuggest}
                  disabled={bulkBusy}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-1.5", bulkBusy && "animate-spin")} />
                  Vorschläge generieren
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground hidden md:block">
            Tastatur: <kbd className="px-1.5 py-0.5 bg-muted rounded">j</kbd>/
            <kbd className="px-1.5 py-0.5 bg-muted rounded">k</kbd> Navigation ·{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded">e</kbd> Zuordnen ·{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded">n</kbd> Neu ·{" "}
            <kbd className="px-1.5 py-0.5 bg-muted rounded">i</kbd> Ignorieren
          </div>

      <div className="flex gap-1 border-b">
        <TabBtn active={tab === "open"} onClick={() => setTab("open")}>
          Offen <Badge variant="secondary" className="ml-2">{openCount ?? 0}</Badge>
        </TabBtn>
        <TabBtn active={tab === "hidden"} onClick={() => setTab("hidden")}>
          Ignoriert <Badge variant="secondary" className="ml-2">{hidden.data?.length ?? 0}</Badge>
        </TabBtn>
        <TabBtn active={tab === "blocked"} onClick={() => setTab("blocked")}>
          Geblockte Absender <Badge variant="secondary" className="ml-2">{blocklist.data?.length ?? 0}</Badge>
        </TabBtn>
      </div>

      {tab === "blocked" ? (
        <BlocklistView />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[60vh]">
          {/* List */}
          <div className="rounded-2xl border bg-white overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
            <div className="overflow-y-auto divide-y">
              {list.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {tab === "open" ? "Keine offenen Mails." : "Keine ignorierten Mails."}
                </div>
              )}
              {list.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedId(email.id)}
                  className={cn(
                    "w-full text-left p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors",
                    selectedId === email.id && "bg-muted/70"
                  )}
                >
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials(email.from_name, email.from_email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-sm">
                        {email.from_name || email.from_email}
                      </strong>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(email.date_received), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-foreground/80 truncate">
                      {email.subject || <span className="italic text-muted-foreground">(kein Betreff)</span>}
                    </div>
                    {email.suggestion_category && (
                      <div className="mt-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border",
                            suggestionBadgeClasses(email.suggestion_category, email.suggestion_confidence),
                          )}
                        >
                          <Sparkles className="h-3 w-3" />
                          {email.suggestion_category === "match" &&
                            `→ ${suggestedEvents?.[email.suggested_event_id ?? ""]?.customer_name ?? "Event"}${
                              suggestedEvents?.[email.suggested_event_id ?? ""]?.date
                                ? ` · ${format(new Date(suggestedEvents![email.suggested_event_id!].date!), "dd.MM.yy", { locale: de })}`
                                : ""
                            }`}
                          {email.suggestion_category === "new_inquiry" && "+ Neue Anfrage?"}
                          {email.suggestion_category === "irrelevant" && "✕ Vermutlich irrelevant"}
                          {email.suggestion_category === "unclear" && "? Unklar"}
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-2">
                      {email.has_attachments && <Paperclip className="h-3 w-3" />}
                      <span className="truncate">{email.body_text?.slice(0, 100)}</span>
                      {email.imap_status === "deleted_on_server" && (
                        <Badge variant="outline" className="ml-auto text-amber-700 border-amber-300">
                          Gelöscht
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="rounded-2xl border bg-white overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
            {selected ? (
              <MailDetail
                email={selected}
                tab={tab}
                suggestedEvent={
                  selected.suggested_event_id
                    ? suggestedEvents?.[selected.suggested_event_id] ?? null
                    : null
                }
                onAssign={() => setAssignOpen(true)}
                onCreate={() => setCreateOpen(true)}
                onIgnore={() => setIgnoreOpen(true)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Wähle eine Mail aus der Liste.
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <>
          <AssignDialog
            open={assignOpen}
            onOpenChange={setAssignOpen}
            email={selected}
          />
          <CreateInquiryDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            email={selected}
          />
          <IgnoreDialog
            open={ignoreOpen}
            onOpenChange={setIgnoreOpen}
            email={selected}
          />
        </>
      )}
      </div>
    </AdminLayout>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Mail Detail ------------------------------ */

function MailDetail({
  email,
  tab,
  suggestedEvent,
  onAssign,
  onCreate,
  onIgnore,
}: {
  email: UnassignedEmail;
  tab: Tab;
  suggestedEvent: SuggestedEventInfo | null;
  onAssign: () => void;
  onCreate: () => void;
  onIgnore: () => void;
}) {
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const sanitizedHtml = useMemo(() => {
    if (!email.body_html) return null;
    return email.body_html.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );
  }, [email.body_html]);

  const restore = async () => {
    const { error } = await supabase.functions.invoke("unarchive-email-globally", {
      body: { email_id: email.id },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Mail wieder eingeblendet.");
      qc.invalidateQueries({ queryKey: ["hidden-inbox"] });
      qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
      qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
    }
  };

  const acceptSuggestion = async () => {
    if (!email.suggestion_category) return;
    setAccepting(true);
    try {
      if (email.suggestion_category === "match" && email.suggested_event_id) {
        const { data, error } = await supabase.functions.invoke("assign-inbox-email-to-event", {
          body: {
            email_id: email.id,
            event_id: email.suggested_event_id,
            create_filter: true,
          },
        });
        if (error) throw error;
        if (data?.warning === "multiple_open_events") {
          // Fall back to single-link to avoid cross-contamination
          const { error: e2 } = await supabase.functions.invoke("assign-inbox-email-to-event", {
            body: {
              email_id: email.id,
              event_id: email.suggested_event_id,
              create_filter: false,
            },
          });
          if (e2) throw e2;
        }
        toast.success("Mail dem Event zugeordnet.");
      } else if (email.suggestion_category === "irrelevant") {
        const { error } = await supabase.functions.invoke("ignore-inbox-email", {
          body: { email_id: email.id, ignore_sender: false },
        });
        if (error) throw error;
        toast.success("Mail ignoriert.");
      } else if (email.suggestion_category === "new_inquiry") {
        onCreate();
        return;
      } else {
        onAssign();
        return;
      }
      qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
      qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
      qc.invalidateQueries({ queryKey: ["hidden-inbox"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b space-y-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm">
              <strong>{email.from_name || email.from_email}</strong>{" "}
              {email.from_name && (
                <span className="text-muted-foreground">&lt;{email.from_email}&gt;</span>
              )}
            </div>
            <h2 className="text-base font-semibold truncate mt-0.5">
              {email.subject || <span className="italic text-muted-foreground">(kein Betreff)</span>}
            </h2>
            <div className="text-xs text-muted-foreground mt-1">
              {format(new Date(email.date_received), "Pp", { locale: de })}
              {email.has_attachments && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {email.attachment_count}
                </span>
              )}
            </div>
          </div>
        </div>

        {email.imap_status === "deleted_on_server" && (
          <div className="flex items-start gap-2 text-xs rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900 mt-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Wurde im Postfach gelöscht — nur in Maestro archiviert verfügbar.</span>
          </div>
        )}
        {tab === "hidden" && (
          <div className="flex items-start gap-2 text-xs rounded-xl bg-muted border px-3 py-2 mt-2">
            <EyeOff className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Ignoriert{email.hidden_reason ? ` (${email.hidden_reason})` : ""}.
            </span>
          </div>
        )}

        {tab === "open" && email.suggestion_category && (
          <div className="rounded-xl border bg-muted/30 p-3 mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" />
              Vorschlag {email.suggestion_method === "llm" ? "(KI-analysiert)" : "(automatisch erkannt)"}
              {email.suggestion_confidence && (
                <Badge variant="outline" className="text-[10px] uppercase ml-auto">
                  {email.suggestion_confidence}
                </Badge>
              )}
            </div>
            <div className="text-sm">
              {email.suggestion_category === "match" && suggestedEvent && (
                <p>
                  Diese Mail gehört vermutlich zu{" "}
                  <strong>{suggestedEvent.customer_name ?? "Event"}</strong>
                  {suggestedEvent.date ? ` (${format(new Date(suggestedEvent.date), "dd.MM.yyyy", { locale: de })})` : ""}
                  {suggestedEvent.occasion ? ` · ${suggestedEvent.occasion}` : ""}.
                </p>
              )}
              {email.suggestion_category === "new_inquiry" && (
                <p>Diese Mail wirkt wie eine neue Eventanfrage.</p>
              )}
              {email.suggestion_category === "irrelevant" && (
                <p>Diese Mail wirkt wie Spam, Werbung oder Lieferantenkommunikation.</p>
              )}
              {email.suggestion_category === "unclear" && (
                <p>Keine eindeutige Zuordnung möglich.</p>
              )}
              {email.suggestion_reasoning && (
                <p className="text-xs text-muted-foreground mt-1">
                  Begründung: {email.suggestion_reasoning}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={acceptSuggestion}
                disabled={accepting}
                className="rounded-full"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Vorschlag annehmen
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-3">
          {tab === "open" && (
            <>
              <Button onClick={onAssign} size="sm" className="rounded-full">
                <Pin className="h-4 w-4 mr-1.5" />
                Zu existierender Anfrage zuordnen
              </Button>
              <Button onClick={onCreate} size="sm" variant="outline" className="rounded-full">
                <Plus className="h-4 w-4 mr-1.5" />
                Neue Anfrage anlegen
              </Button>
              <Button onClick={onIgnore} size="sm" variant="ghost" className="rounded-full">
                <Ban className="h-4 w-4 mr-1.5" />
                Ignorieren
              </Button>
            </>
          )}
          {tab === "hidden" && (
            <Button onClick={restore} size="sm" variant="outline" className="rounded-full">
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Wieder einblenden
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {sanitizedHtml ? (
          <iframe
            title={`mail-${email.id}`}
            className="w-full min-h-[400px] rounded-xl border bg-white"
            srcDoc={sanitizedHtml}
            sandbox="allow-same-origin"
            style={{ height: 500 }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/30 rounded-xl p-3 border">
            {email.body_text || (
              <span className="italic text-muted-foreground">Kein Inhalt</span>
            )}
          </pre>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Assign Dialog ----------------------------- */

type EventSearchResult = {
  id: string;
  number: string | null;
  date: string | null;
  guest_count: number | null;
  occasion: string | null;
  status: string;
  customer: { id: string; name: string; email: string } | null;
};

function AssignDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  email: UnassignedEmail;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [suggestion, setSuggestion] = useState<EventSearchResult | null>(null);
  const [chosen, setChosen] = useState<EventSearchResult | null>(null);
  const [filterMode, setFilterMode] = useState<"with_filter" | "single">("with_filter");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<{ events: EventSearchResult[]; choice: "with_filter" | "single" } | null>(null);

  // Reset on open/email change
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setChosen(null);
    setFilterMode("with_filter");
    setConflict(null);
    void loadSuggestion();
    void runSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email.id]);

  const loadSuggestion = async () => {
    const { data } = await supabase
      .from("v2_customers")
      .select("id, name, email, v2_events(id, number, date, guest_count, occasion, status)")
      .ilike("email", email.from_email)
      .limit(1)
      .maybeSingle();
    if (!data) {
      setSuggestion(null);
      return;
    }
    const events = ((data as any).v2_events ?? []).filter(
      (e: any) => !["cancelled", "completed", "archived"].includes(e.status)
    );
    if (events.length > 0) {
      const ev = events[0];
      setSuggestion({
        id: ev.id,
        number: ev.number,
        date: ev.date,
        guest_count: ev.guest_count,
        occasion: ev.occasion,
        status: ev.status,
        customer: { id: data.id, name: data.name, email: data.email },
      });
    } else setSuggestion(null);
  };

  const runSearch = async (q: string) => {
    let query = supabase
      .from("v2_events")
      .select("id, number, date, guest_count, occasion, status, v2_customers!inner(id, name, email)")
      .not("status", "in", "(cancelled,completed,archived)")
      .order("date", { ascending: false })
      .limit(20);
    if (q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(
        `number.ilike.${term},occasion.ilike.${term}`
      );
    }
    const { data, error } = await query;
    if (error) return;
    let mapped: EventSearchResult[] = (data ?? []).map((e: any) => ({
      id: e.id,
      number: e.number,
      date: e.date,
      guest_count: e.guest_count,
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
          m.customer?.email?.toLowerCase().includes(lower) ||
          m.date?.includes(lower)
      );
    }
    setResults(mapped);
  };

  const confirm = async (force = false) => {
    if (!chosen) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("assign-inbox-email-to-event", {
      body: {
        email_id: email.id,
        event_id: chosen.id,
        create_filter: filterMode === "with_filter",
        force,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.warning === "multiple_open_events") {
      const sibling = (data.sibling_events || []) as any[];
      setConflict({
        events: sibling.map((s) => ({
          id: s.id,
          number: s.number ?? null,
          date: s.date ?? s.datum ?? null,
          guest_count: s.guest_count ?? null,
          occasion: s.occasion ?? null,
          status: s.status,
          customer: null,
        })),
        choice: filterMode,
      });
      return;
    }
    toast.success("Mail dem Event zugeordnet.");
    qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
    qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Zu welcher Anfrage gehört diese Mail?</DialogTitle>
            <DialogDescription>
              Wähle ein bestehendes Event aus oder lege eine neue Anfrage an.
            </DialogDescription>
          </DialogHeader>

          {!chosen && (
            <>
              {suggestion && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Vorschlag
                  </div>
                  <EventCard
                    ev={suggestion}
                    hint="Auto-Erkennung: Diese E-Mail-Adresse ist als Kontakt hinterlegt."
                    onClick={() => setChosen(suggestion)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Suche
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      void runSearch(e.target.value);
                    }}
                    placeholder="Kundenname, Datum, Eventnummer oder Anlass…"
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
                    <EventCard key={ev.id} ev={ev} onClick={() => setChosen(ev)} />
                  ))}
                </div>
              </div>
            </>
          )}

          {chosen && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Gewähltes Event
              </div>
              <EventCard ev={chosen} active />
              <button
                onClick={() => setChosen(null)}
                className="text-xs text-muted-foreground hover:underline"
              >
                ← Andere Anfrage wählen
              </button>

              <div className="rounded-xl border p-3 space-y-3">
                <RadioGroup value={filterMode} onValueChange={(v) => setFilterMode(v as any)}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="with_filter" className="mt-1" />
                    <div>
                      <div className="text-sm font-semibold">
                        Alle Mails von {email.from_email} zu diesem Event zuordnen{" "}
                        <span className="text-muted-foreground font-normal">(empfohlen)</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Auch zukünftige Mails dieses Absenders landen automatisch hier.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <RadioGroupItem value="single" className="mt-1" />
                    <div>
                      <div className="text-sm font-semibold">Nur diese eine Mail</div>
                      <div className="text-xs text-muted-foreground">
                        Andere Mails von {email.from_email} bleiben im Posteingang.
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Abbrechen
            </Button>
            <Button onClick={() => confirm(false)} disabled={!chosen || busy}>
              Zuordnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Mehrere offene Anfragen</DialogTitle>
            <DialogDescription>
              Es gibt {conflict?.events.length ?? 0} weitere offene Anfrage
              {(conflict?.events.length ?? 0) === 1 ? "" : "n"} von {email.from_email}. Ein
              Auto-Filter würde alle Mails dieses Absenders dem gewählten Event zuordnen.
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
            {conflict?.events.map((e) => (
              <li key={e.id} className="rounded-lg border px-3 py-2">
                {e.number || e.id.slice(0, 8)} ·{" "}
                {e.date ? format(new Date(e.date), "dd.MM.yyyy", { locale: de }) : "—"} ·{" "}
                {e.occasion || "—"}
              </li>
            ))}
          </ul>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={async () => {
                setFilterMode("single");
                setConflict(null);
                // re-run with create_filter=false
                setBusy(true);
                const { error } = await supabase.functions.invoke("assign-inbox-email-to-event", {
                  body: { email_id: email.id, event_id: chosen!.id, create_filter: false },
                });
                setBusy(false);
                if (error) toast.error(error.message);
                else {
                  toast.success("Nur diese Mail zugeordnet.");
                  qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
                  qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
                  onOpenChange(false);
                }
              }}
              variant="outline"
              disabled={busy}
            >
              Nur diese Mail zuordnen
            </Button>
            <Button onClick={() => confirm(true)} disabled={busy}>
              Filter trotzdem anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventCard({
  ev,
  hint,
  onClick,
  active,
}: {
  ev: EventSearchResult;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full text-left rounded-xl border p-3 hover:bg-muted/40 transition-colors",
        active && "border-foreground bg-muted/40",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span>{ev.number || ev.id.slice(0, 8)}</span>
        {ev.occasion && <span className="text-muted-foreground font-normal">· {ev.occasion}</span>}
        <Badge variant="outline" className="ml-auto text-[10px] uppercase">
          {ev.status}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        {ev.date ? format(new Date(ev.date), "dd.MM.yyyy", { locale: de }) : "Ohne Datum"}
        {ev.guest_count ? ` · ${ev.guest_count} Gäste` : ""}
        {ev.customer ? ` · ${ev.customer.name} (${ev.customer.email})` : ""}
      </div>
      {hint && <div className="text-xs text-foreground/70 mt-1">{hint}</div>}
    </button>
  );
}

/* -------------------------- Create Inquiry Dialog ------------------------ */

function CreateInquiryDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  email: UnassignedEmail;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [anlass, setAnlass] = useState("");
  const [datum, setDatum] = useState("");
  const [gaeste, setGaeste] = useState("");
  const [eventName, setEventName] = useState("");
  const [createFilter, setCreateFilter] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(email.from_name || nameFromEmail(email.from_email));
    setAnlass(parseAnlassFromSubject(email.subject));
    setEventName(email.subject || "");
    setDatum("");
    setGaeste("");
    setCreateFilter(true);
  }, [open, email]);

  const submit = async () => {
    if (!datum || !gaeste) {
      toast.error("Datum und Gäste sind erforderlich.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-inquiry-from-inbox-email", {
      body: {
        email_id: email.id,
        event_data: {
          datum,
          gaeste: Number(gaeste),
          anlass: anlass || undefined,
          name: eventName || undefined,
        },
        create_filter: createFilter,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data?.ok) {
      toast.error(data?.error || "Konnte Anfrage nicht anlegen.");
      return;
    }
    toast.success("Anfrage angelegt.");
    qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
    qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
    onOpenChange(false);
    if (data.redirect_url) navigate(data.redirect_url);
    else if (data.event_id) navigate(`/admin/events/${data.event_id}/edit`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Neue Anfrage aus dieser Mail anlegen</DialogTitle>
          <DialogDescription>
            Die Mail wird automatisch dem neuen Event zugeordnet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kontakt-Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">Kontakt-Mail</Label>
              <Input value={email.from_email} readOnly className="rounded-xl bg-muted/40" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Anlass</Label>
            <Input
              value={anlass}
              onChange={(e) => setAnlass(e.target.value)}
              placeholder="Geburtstag, Hochzeit, Firmenfeier…"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Datum *</Label>
              <Input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Gäste *</Label>
              <Input
                type="number"
                value={gaeste}
                onChange={(e) => setGaeste(e.target.value)}
                className="rounded-xl"
                min={1}
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Event-Name</Label>
            <Input
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Default: Mail-Betreff</p>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
            <Checkbox checked={createFilter} onCheckedChange={(v) => setCreateFilter(!!v)} className="mt-0.5" />
            <span>
              Auto-Filter anlegen{" "}
              <span className="text-muted-foreground">
                (alle Mails von {email.from_email} → neues Event)
              </span>
            </span>
          </label>

          <details className="rounded-xl border p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Ursprüngliche Mail</summary>
            <pre className="whitespace-pre-wrap font-sans text-xs mt-2 max-h-40 overflow-y-auto">
              {email.body_text || "(kein Inhalt)"}
            </pre>
          </details>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={busy}>
            Anfrage anlegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Ignore Dialog ---------------------------- */

function IgnoreDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  email: UnassignedEmail;
}) {
  const qc = useQueryClient();
  const [blockSender, setBlockSender] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setBlockSender(false);
      setReason("");
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("ignore-inbox-email", {
      body: {
        email_id: email.id,
        ignore_sender: blockSender,
        reason: reason || (blockSender ? "sender_blocklisted" : "manually ignored"),
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(blockSender ? "Mail ignoriert + Absender geblockt." : "Mail ignoriert.");
    qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
    qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
    qc.invalidateQueries({ queryKey: ["hidden-inbox"] });
    qc.invalidateQueries({ queryKey: ["sender-blocklist"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Mail ignorieren</DialogTitle>
          <DialogDescription>
            Diese Mail wird aus dem Posteingang ausgeblendet. Sie bleibt in der Datenbank gespeichert.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={blockSender} onCheckedChange={(v) => setBlockSender(!!v)} className="mt-0.5" />
            <span>
              Künftige Mails von <strong>{email.from_email}</strong> automatisch ignorieren
            </span>
          </label>
          <div>
            <Label className="text-xs">Notiz (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Newsletter, Spam, Lieferant…"
              className="rounded-xl"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={busy}>
            Ignorieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Blocklist View --------------------------- */

function BlocklistView() {
  const { data, isLoading } = useBlocklist();
  const qc = useQueryClient();

  const unblock = async (fromEmail: string) => {
    // Find any hidden email of this sender to use as anchor
    const { data: anchor } = await supabase
      .from("inbox_emails")
      .select("id")
      .ilike("from_email", fromEmail)
      .eq("hidden_reason", "sender_blocklisted")
      .limit(1)
      .maybeSingle();
    if (!anchor) {
      // direct delete from blocklist
      const { error } = await supabase
        .from("email_sender_blocklist")
        .delete()
        .eq("from_email", fromEmail);
      if (error) toast.error(error.message);
      else {
        toast.success("Absender entsperrt.");
        qc.invalidateQueries({ queryKey: ["sender-blocklist"] });
      }
      return;
    }
    const { error } = await supabase.functions.invoke("restore-ignored-email", {
      body: { email_id: anchor.id, unblock_sender: true },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Absender entsperrt — Mails wieder sichtbar.");
      qc.invalidateQueries({ queryKey: ["sender-blocklist"] });
      qc.invalidateQueries({ queryKey: ["unassigned-inbox"] });
      qc.invalidateQueries({ queryKey: ["unassigned-inbox-count"] });
      qc.invalidateQueries({ queryKey: ["hidden-inbox"] });
    }
  };

  return (
    <div className="rounded-2xl border bg-white">
      {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Lade…</div>}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <div className="p-10 text-center text-sm text-muted-foreground">
          <Ban className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Keine geblockten Absender.
        </div>
      )}
      <ul className="divide-y">
        {(data ?? []).map((b) => (
          <li key={b.from_email} className="flex items-center gap-3 p-3">
            <Ban className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{b.from_email}</div>
              <div className="text-xs text-muted-foreground">
                Geblockt {format(new Date(b.blocked_at), "Pp", { locale: de })}
                {b.reason ? ` · ${b.reason}` : ""}
              </div>
            </div>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => unblock(b.from_email)}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Entsperren
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}