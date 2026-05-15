import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/refine/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { toast } from "sonner";

type Project = "events_storia" | "ristorante_storia";

interface SystemError {
  id: string;
  project: Project;
  source: string;
  severity: "warning" | "error" | "critical";
  message: string;
  payload: any;
  url: string | null;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

const PROJECT_LABEL: Record<Project, string> = {
  events_storia: "events-storia.de",
  ristorante_storia: "ristorantestoria.de",
};

const severityStyle = (s: SystemError["severity"]) => {
  if (s === "critical") return "bg-neutral-900 text-white";
  if (s === "error") return "bg-neutral-200 text-neutral-900";
  return "bg-neutral-100 text-neutral-700";
};

export default function SystemHealth() {
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [activeTab, setActiveTab] = useState<Project>("events_storia");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("system_errors" as any)
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(200);
    if (!showResolved) q = q.is("resolved_at", null);
    const { data, error } = await q;
    if (error) toast.error("Fehler beim Laden", { description: error.message });
    else setErrors((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("system_errors_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_errors" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResolved]);

  const grouped = useMemo(() => {
    const g: Record<Project, SystemError[]> = { events_storia: [], ristorante_storia: [] };
    errors.forEach((e) => g[e.project]?.push(e));
    return g;
  }, [errors]);

  const counts = useMemo(() => {
    const c: Record<Project, { open: number; critical: number }> = {
      events_storia: { open: 0, critical: 0 },
      ristorante_storia: { open: 0, critical: 0 },
    };
    errors.forEach((e) => {
      if (e.resolved_at) return;
      c[e.project].open++;
      if (e.severity === "critical") c[e.project].critical++;
    });
    return c;
  }, [errors]);

  const resolve = async (err: SystemError) => {
    const note = window.prompt("Notiz zur Lösung (optional):") ?? undefined;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("system_errors" as any)
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: user?.email ?? "unknown",
        resolution_note: note ?? null,
      })
      .eq("id", err.id);
    if (error) toast.error("Konnte nicht aktualisieren", { description: error.message });
    else toast.success("Als gelöst markiert");
  };

  const projectStatus = (p: Project) => {
    const c = counts[p];
    if (c.critical > 0) return { label: "Kritisch", color: "bg-neutral-900 text-white" };
    if (c.open > 0) return { label: `${c.open} offen`, color: "bg-neutral-200 text-neutral-900" };
    return { label: "Stabil", color: "bg-white text-neutral-700 border border-neutral-200" };
  };

  return (
    <AdminLayout activeTab="system-health" title="System-Health" showSearch={false} showCreateButton={false}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">System-Health</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live-Übersicht aller Production-Fehler aus events-storia.de und ristorantestoria.de.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
              {showResolved ? "Nur offene" : "Auch gelöste"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(PROJECT_LABEL) as Project[]).map((p) => {
            const s = projectStatus(p);
            return (
              <Card key={p} className="p-5 rounded-2xl border-neutral-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Projekt</div>
                    <div className="text-lg font-semibold">{PROJECT_LABEL[p]}</div>
                  </div>
                  <Badge className={`${s.color} rounded-full px-3 py-1`}>{s.label}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Offen</div>
                    <div className="text-xl font-medium">{counts[p].open}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Kritisch</div>
                    <div className="text-xl font-medium">{counts[p].critical}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Project)}>
          <TabsList className="rounded-2xl">
            <TabsTrigger value="events_storia" className="rounded-xl">events-storia.de</TabsTrigger>
            <TabsTrigger value="ristorante_storia" className="rounded-xl">ristorantestoria.de</TabsTrigger>
          </TabsList>

          {(Object.keys(PROJECT_LABEL) as Project[]).map((p) => (
            <TabsContent key={p} value={p} className="mt-4 space-y-3">
              {grouped[p].length === 0 ? (
                <Card className="p-10 text-center rounded-2xl border-neutral-200">
                  <CheckCircle2 className="size-8 mx-auto text-neutral-400" />
                  <div className="mt-3 text-sm text-muted-foreground">Keine Fehler gemeldet.</div>
                </Card>
              ) : (
                grouped[p].map((e) => (
                  <Card key={e.id} className="p-4 rounded-2xl border-neutral-200">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${severityStyle(e.severity)} rounded-full px-2 py-0.5 text-xs`}>
                            {e.severity.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{e.source}</span>
                          {e.count > 1 && (
                            <Badge variant="outline" className="rounded-full text-xs">×{e.count}</Badge>
                          )}
                          {e.resolved_at && (
                            <Badge variant="outline" className="rounded-full text-xs">gelöst</Badge>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-medium break-words">{e.message}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Zuletzt: {formatDistanceToNow(new Date(e.last_seen), { addSuffix: true, locale: de })}
                          {e.url && <> · <span className="font-mono">{e.url}</span></>}
                        </div>
                        {e.payload && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer">Payload</summary>
                            <pre className="mt-1 text-xs bg-neutral-50 p-2 rounded-lg overflow-auto max-h-48">
                              {JSON.stringify(e.payload, null, 2)}
                            </pre>
                          </details>
                        )}
                        {e.resolution_note && (
                          <div className="mt-2 text-xs text-muted-foreground italic">
                            Notiz: {e.resolution_note}
                          </div>
                        )}
                      </div>
                      {!e.resolved_at && (
                        <Button size="sm" variant="outline" onClick={() => resolve(e)}>
                          Als gelöst
                        </Button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AdminLayout>
  );
}