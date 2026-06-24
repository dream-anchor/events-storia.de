import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Loader2, Send, Play } from "lucide-react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

interface ReviewSettings {
  enabled: boolean;
  delay_business_days: number;
  google_review_url: string;
  bcc_email: string;
  scope_events: boolean;
  scope_orders: boolean;
  last_run_at: string | null;
  last_run_sent_count: number | null;
  last_run_skipped_count: number | null;
  last_run_error: string | null;
}

export function ReviewRequestsCard() {
  const [settings, setSettings] = useState<ReviewSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningDry, setRunningDry] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [sentLast7d, setSentLast7d] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("review_request_settings" as never)
      .select("*")
      .eq("id", true as never)
      .maybeSingle();
    if (!error && data) setSettings(data as unknown as ReviewSettings);

    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { count } = await supabase
      .from("review_request_log" as never)
      .select("id", { count: "exact", head: true })
      .eq("status", "sent" as never)
      .gte("sent_at", since);
    setSentLast7d(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (patch: Partial<ReviewSettings>) => {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await supabase
      .from("review_request_settings" as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ ...patch, updated_at: new Date().toISOString() } as any)
      .eq("id", true as never);
    setSaving(false);
    if (error) {
      toast.error("Speichern fehlgeschlagen: " + error.message);
      load();
    } else {
      toast.success("Gespeichert");
    }
  };

  const runDry = async () => {
    setRunningDry(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-review-requests", {
        body: { mode: "dry", force: true },
      });
      if (error) throw error;
      const d = data as { sent?: number; skipped?: number; targetDate?: string };
      toast.success(`Dry-Run für ${d.targetDate}: ${d.sent ?? 0} würden versendet, ${d.skipped ?? 0} übersprungen.`);
      load();
    } catch (e) {
      toast.error("Dry-Run fehlgeschlagen: " + (e as Error).message);
    } finally {
      setRunningDry(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error("Bitte gültige E-Mail-Adresse eingeben.");
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-review-requests", {
        body: { testRecipient: testEmail },
      });
      if (error) throw error;
      const d = data as { ok?: boolean; provider?: string };
      if (d.ok) toast.success(`Test-Mail an ${testEmail} versendet (${d.provider}).`);
      else toast.error("Versand fehlgeschlagen.");
    } catch (e) {
      toast.error("Test-Versand fehlgeschlagen: " + (e as Error).message);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading || !settings) {
    return (
      <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          Google-Bewertungsanfragen
        </CardTitle>
        <CardDescription>
          Automatischer E-Mail-Versand nach durchgeführtem Catering – bittet Kunden um eine Google-Bewertung.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="reviewEnabled" className="font-medium">Automatischer Versand aktiv</Label>
            <p className="text-sm text-muted-foreground">
              Versand {settings.delay_business_days} Werktage nach Status „abgeschlossen". Wochenenden und bayerische Feiertage werden übersprungen.
            </p>
          </div>
          <Switch
            id="reviewEnabled"
            checked={settings.enabled}
            disabled={saving}
            onCheckedChange={(v) => update({ enabled: v })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <Label className="text-sm">Catering-Lieferungen</Label>
              <p className="text-xs text-muted-foreground">Auslieferungen mit Source „Catering"</p>
            </div>
            <Switch checked={settings.scope_orders} disabled={saving} onCheckedChange={(v) => update({ scope_orders: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div>
              <Label className="text-sm">Events / Location</Label>
              <p className="text-xs text-muted-foreground">Inhouse-Events ohne Catering-Quelle</p>
            </div>
            <Switch checked={settings.scope_events} disabled={saving} onCheckedChange={(v) => update({ scope_events: v })} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="googleUrl">Google-Bewertungs-URL</Label>
            <Input
              id="googleUrl"
              value={settings.google_review_url}
              onChange={(e) => setSettings({ ...settings, google_review_url: e.target.value })}
              onBlur={(e) => update({ google_review_url: e.target.value })}
              className="h-11"
              placeholder="https://g.page/r/..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delayDays">Verzögerung (Werktage)</Label>
            <Input
              id="delayDays" type="number" min={1} max={14}
              value={settings.delay_business_days}
              onChange={(e) => setSettings({ ...settings, delay_business_days: Number(e.target.value) })}
              onBlur={(e) => update({ delay_business_days: Math.max(1, Number(e.target.value) || 2) })}
              className="h-11 max-w-32"
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">Letzter Lauf</Badge>
            <span className="text-muted-foreground">
              {settings.last_run_at ? new Date(settings.last_run_at).toLocaleString("de-DE") : "Noch nie ausgeführt"}
            </span>
            {settings.last_run_at && (
              <>
                <Badge variant="outline">{settings.last_run_sent_count ?? 0} versendet</Badge>
                <Badge variant="outline">{settings.last_run_skipped_count ?? 0} übersprungen</Badge>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary">7-Tage-Bilanz</Badge>
            <span className="text-muted-foreground">{sentLast7d} Bewertungsanfragen versendet</span>
          </div>
          {settings.last_run_error && (
            <p className="text-sm text-destructive">Fehler: {settings.last_run_error}</p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-2">
          <Button variant="outline" onClick={runDry} disabled={runningDry}>
            {runningDry ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Dry-Run jetzt prüfen
          </Button>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="testEmail" className="text-xs">Test-Versand an</Label>
              <Input id="testEmail" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="ihre@email.de" className="h-10 w-64" />
            </div>
            <Button onClick={sendTest} disabled={sendingTest || !testEmail}>
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Test senden
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
