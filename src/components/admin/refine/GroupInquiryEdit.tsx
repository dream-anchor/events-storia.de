import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useOne, useUpdate } from "@refinedev/core";
import { ArrowLeft, Loader2, Mail, Phone, FileText, ExternalLink } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GroupInquiry } from "./GroupInquiriesList";

const STATUS_OPTIONS = [
  { value: "new", label: "Neu" },
  { value: "in_progress", label: "In Bearbeitung" },
  { value: "offer_sent", label: "Angebot gesendet" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "archived", label: "Archiviert" },
];

export const GroupInquiryEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { result, query } = useOne<GroupInquiry>({
    resource: "group_inquiries",
    id: id!,
  });
  const inquiry = result as GroupInquiry | undefined;
  const isLoading = query.isLoading;

  const { mutate: update, mutation } = useUpdate();
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!inquiry) return;
    setNotes(inquiry.internal_notes ?? "");
    setStatus(inquiry.status);
    setSignedUrl(null);
    if (inquiry.travel_plan_url) {
      supabase.storage
        .from("group-inquiry-uploads")
        .createSignedUrl(inquiry.travel_plan_url, 3600)
        .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
    }
  }, [inquiry]);

  const back = () => navigate("/admin/inquiries");

  const save = () => {
    if (!inquiry) return;
    update(
      {
        resource: "group_inquiries",
        id: inquiry.id,
        values: {
          status,
          internal_notes: notes,
          responded_at:
            status !== "new" && !inquiry.responded_at
              ? new Date().toISOString()
              : inquiry.responded_at,
        },
      },
      {
        onSuccess: () => {
          toast.success("Aktualisiert");
          back();
        },
        onError: (e: any) =>
          toast.error("Fehler: " + (e?.message ?? "unbekannt")),
      },
    );
  };

  if (isLoading) {
    return (
      <AdminLayout activeTab="inquiries">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!inquiry) {
    return (
      <AdminLayout activeTab="inquiries">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Anfrage nicht gefunden</p>
          <Button variant="link" onClick={back}>
            Zurück zur Übersicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="inquiries" title="Reisegruppen-Anfrage">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={back}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {inquiry.contact_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {inquiry.company_name && <span>{inquiry.company_name} · </span>}
              Eingegangen{" "}
              {new Date(inquiry.created_at).toLocaleString("de-DE")}
            </p>
          </div>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-6 space-y-6">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <a
                  href={`mailto:${inquiry.email}`}
                  className="flex items-center gap-1.5 hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" /> {inquiry.email}
                </a>
              </div>
              {inquiry.phone && (
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground">
                    Telefon
                  </Label>
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="flex items-center gap-1.5 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {inquiry.phone}
                  </a>
                </div>
              )}
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">
                  Gruppengröße
                </Label>
                <div>{inquiry.group_size} Personen</div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Sprache</Label>
                <div>{inquiry.language?.toUpperCase() ?? "—"}</div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">
                  Wunschdatum
                </Label>
                <div>
                  {inquiry.preferred_date
                    ? new Date(inquiry.preferred_date).toLocaleDateString(
                        "de-DE",
                      )
                    : "—"}
                  {inquiry.preferred_date_flexible && (
                    <span className="text-muted-foreground"> (flexibel)</span>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">
                  Ankunftszeit
                </Label>
                <div>{inquiry.arrival_time ?? "—"}</div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">
                  Wunschmenü
                </Label>
                <div>{inquiry.preferred_menu ?? "—"}</div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">Quelle</Label>
                <div className="truncate">{inquiry.source ?? "—"}</div>
              </div>
            </section>

            {inquiry.message && (
              <section>
                <Label className="text-xs text-muted-foreground">
                  Nachricht
                </Label>
                <div className="mt-1 p-3 rounded-lg bg-muted text-sm whitespace-pre-wrap">
                  {inquiry.message}
                </div>
              </section>
            )}

            {inquiry.travel_plan_url && (
              <section>
                <Label className="text-xs text-muted-foreground">
                  Reiseplan
                </Label>
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
                    <span className="text-sm text-muted-foreground">
                      Lade Link…
                    </span>
                  )}
                </div>
              </section>
            )}

            {(inquiry.utm_source || inquiry.utm_campaign) && (
              <section className="text-xs text-muted-foreground border-t pt-3">
                UTM: {inquiry.utm_source ?? "—"} /{" "}
                {inquiry.utm_medium ?? "—"} /{" "}
                {inquiry.utm_campaign ?? "—"}
              </section>
            )}

            <section className="space-y-2 max-w-sm">
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

            <div className="flex justify-start gap-2 pt-2">
              <Button onClick={save} disabled={mutation?.isPending}>
                Speichern
              </Button>
              <Button variant="ghost" onClick={back}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default GroupInquiryEdit;