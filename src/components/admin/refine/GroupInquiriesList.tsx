import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useList, useUpdate } from "@refinedev/core";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Users, Mail, Phone, FileText, ExternalLink, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "new", label: "Neu" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "offer_sent", label: "Angebot gesendet" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "archived", label: "Archiviert" },
];

const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

const statusColor = (s: string) => {
  switch (s) {
    case "new":
      return "bg-foreground text-background";
    case "in_progress":
      return "bg-muted text-foreground";
    case "offer_sent":
      return "bg-muted text-foreground";
    case "confirmed":
      return "bg-foreground text-background";
    case "rejected":
    case "archived":
      return "bg-muted/50 text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
};

interface GroupInquiry {
  id: string;
  external_id?: string | null;
  contact_name: string;
  company_name?: string | null;
  email: string;
  phone?: string | null;
  group_size: number;
  preferred_date?: string | null;
  preferred_date_flexible?: boolean;
  arrival_time?: string | null;
  preferred_menu?: string | null;
  message?: string | null;
  language?: string | null;
  source?: string | null;
  status: string;
  internal_notes?: string | null;
  travel_plan_url?: string | null;
  travel_plan_filename?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  responded_at?: string | null;
  created_at: string;
}

export const GroupInquiriesList = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GroupInquiry | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { result, query } = useList<GroupInquiry>({
    resource: "group_inquiries",
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 200 },
  });

  const items = (result?.data ?? []) as GroupInquiry[];

  // Auto-open detail sheet when ?id= is in the URL (deep-link from Anfragen-Liste)
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || items.length === 0) return;
    const match = items.find((i) => i.id === id);
    if (match && (!selected || selected.id !== id)) {
      setSelected(match);
    }
  }, [searchParams, items, selected]);

  const handleSheetChange = (open: boolean) => {
    if (!open) {
      setSelected(null);
      if (searchParams.get("id")) {
        searchParams.delete("id");
        setSearchParams(searchParams, { replace: true });
      }
    }
  };

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          i.contact_name?.toLowerCase().includes(q) ||
          i.email?.toLowerCase().includes(q) ||
          i.company_name?.toLowerCase().includes(q) ||
          i.preferred_menu?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    STATUS_OPTIONS.forEach((o) => (c[o.value] = 0));
    items.forEach((i) => {
      c[i.status] = (c[i.status] ?? 0) + 1;
    });
    return c;
  }, [items]);

  return (
    <AdminLayout activeTab="reisegruppen" title="Reisegruppen-Anfragen" showCreateButton={false}>
      <div className="space-y-4 max-w-7xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Reisegruppen-Anfragen</h1>
            <p className="text-sm text-muted-foreground">
              Anfragen von ristorantestoria.de/reisegruppen
            </p>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche Name, Email, Firma…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">Alle ({counts.all})</TabsTrigger>
            {STATUS_OPTIONS.map((o) => (
              <TabsTrigger key={o.value} value={o.value}>
                {o.label} ({counts[o.value] ?? 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {query?.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Lade…</div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="py-12 text-center text-muted-foreground">
              Keine Anfragen in dieser Kategorie.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((i) => (
              <Card
                key={i.id}
                className="rounded-2xl cursor-pointer hover:border-foreground/30 transition-colors"
                onClick={() => setSelected(i)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{i.contact_name}</span>
                      {i.company_name && (
                        <span className="text-sm text-muted-foreground">· {i.company_name}</span>
                      )}
                      <Badge className={statusColor(i.status)}>{statusLabel(i.status)}</Badge>
                      {i.travel_plan_url && (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="h-3 w-3" /> Reiseplan
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {i.group_size}
                      </span>
                      {i.preferred_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(i.preferred_date).toLocaleDateString("de-DE")}
                          {i.preferred_date_flexible && " (flex)"}
                        </span>
                      )}
                      {i.preferred_menu && <span>Menü {i.preferred_menu}</span>}
                      <span>{i.language?.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(i.created_at).toLocaleDateString("de-DE")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <GroupInquiryDetail
        inquiry={selected}
        onClose={() => setSelected(null)}
        onUpdated={() => query?.refetch?.()}
      />
    </AdminLayout>
  );
};

function GroupInquiryDetail({
  inquiry,
  onClose,
  onUpdated,
}: {
  inquiry: GroupInquiry | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { mutate: update, mutation } = useUpdate();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useMemo(() => {
    if (inquiry) {
      setNotes(inquiry.internal_notes ?? "");
      setStatus(inquiry.status);
      setSignedUrl(null);
      if (inquiry.travel_plan_url) {
        supabase.storage
          .from("group-inquiry-uploads")
          .createSignedUrl(inquiry.travel_plan_url, 3600)
          .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
      }
    }
  }, [inquiry]);

  const save = () => {
    if (!inquiry) return;
    update(
      {
        resource: "group_inquiries",
        id: inquiry.id,
        values: {
          status,
          internal_notes: notes,
          responded_at: status !== "new" && !inquiry.responded_at ? new Date().toISOString() : inquiry.responded_at,
        },
      },
      {
        onSuccess: () => {
          toast.success("Aktualisiert");
          onUpdated();
          onClose();
        },
        onError: (e: any) => toast.error("Fehler: " + (e?.message ?? "unbekannt")),
      }
    );
  };

  return (
    <Sheet open={!!inquiry} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {inquiry && (
          <>
            <SheetHeader>
              <SheetTitle>{inquiry.contact_name}</SheetTitle>
              <SheetDescription>
                {inquiry.company_name && <span>{inquiry.company_name} · </span>}
                Eingegangen {new Date(inquiry.created_at).toLocaleString("de-DE")}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 mt-6">
              <section className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1.5 hover:underline">
                    <Mail className="h-3.5 w-3.5" /> {inquiry.email}
                  </a>
                </div>
                {inquiry.phone && (
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Telefon</Label>
                    <a href={`tel:${inquiry.phone}`} className="flex items-center gap-1.5 hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {inquiry.phone}
                    </a>
                  </div>
                )}
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Gruppengröße</Label>
                  <div>{inquiry.group_size} Personen</div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Sprache</Label>
                  <div>{inquiry.language?.toUpperCase() ?? "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Wunschdatum</Label>
                  <div>
                    {inquiry.preferred_date
                      ? new Date(inquiry.preferred_date).toLocaleDateString("de-DE")
                      : "—"}
                    {inquiry.preferred_date_flexible && (
                      <span className="text-muted-foreground"> (flexibel)</span>
                    )}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Ankunftszeit</Label>
                  <div>{inquiry.arrival_time ?? "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Wunschmenü</Label>
                  <div>{inquiry.preferred_menu ?? "—"}</div>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">Quelle</Label>
                  <div className="truncate">{inquiry.source ?? "—"}</div>
                </div>
              </section>

              {inquiry.message && (
                <section>
                  <Label className="text-xs text-muted-foreground">Nachricht</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap">
                    {inquiry.message}
                  </div>
                </section>
              )}

              {inquiry.travel_plan_url && (
                <section>
                  <Label className="text-xs text-muted-foreground">Reiseplan</Label>
                  <div className="mt-1">
                    {signedUrl ? (
                      <a
                        href={signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        {inquiry.travel_plan_filename ?? "Reiseplan herunterladen"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">Lade Link…</span>
                    )}
                  </div>
                </section>
              )}

              {(inquiry.utm_source || inquiry.utm_campaign) && (
                <section className="text-xs text-muted-foreground border-t pt-3">
                  UTM: {inquiry.utm_source ?? "—"} / {inquiry.utm_medium ?? "—"} /{" "}
                  {inquiry.utm_campaign ?? "—"}
                </section>
              )}

              <section className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-2">
                <Label>Interne Notizen</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={5}
                  placeholder="Notizen für Team…"
                />
              </section>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={onClose}>
                  Abbrechen
                </Button>
                <Button onClick={save} disabled={mutation?.isPending}>
                  Speichern
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}