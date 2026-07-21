import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileSignature, Loader2, Save, RefreshCw } from "lucide-react";

const DEFAULT_TEMPLATE_ID = "0f9f9ad4-02a8-4678-889a-52d3b4bd459e";

interface IntegrationStatus {
  has_api_key: boolean;
  has_webhook_secret: boolean;
  template_id: string | null;
  template_version: string | null;
  current_template_version: string;
  webhook_url: string | null;
}

export function ESignaturesSettingsCard() {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [templateId, setTemplateId] = useState<string>("");

  async function load() {
    setLoading(true);
    const { data } = await supabase.functions.invoke(
      "esignatures-integration-status",
    );
    const s = (data as IntegrationStatus) ?? null;
    setStatus(s);
    setTemplateId(s?.template_id ?? DEFAULT_TEMPLATE_ID);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function call(name: string, body?: Record<string, unknown>) {
    setBusy(name);
    try {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error) {
        const ctx = (error as any)?.context;
        if (ctx instanceof Response) {
          const text = await ctx.text();
          try {
            const json = JSON.parse(text);
            throw new Error(json?.error || text || error.message);
          } catch (e) {
            if (e instanceof Error && e.message !== error.message) throw e;
            throw new Error(text || error.message);
          }
        }
        throw error;
      }
      return data;
    } finally {
      setBusy(null);
    }
  }

  async function onSaveTemplateId() {
    try {
      await call("set-esignatures-template-id", { template_id: templateId });
      toast.success("Template-ID gespeichert.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Konnte Template-ID nicht speichern.");
    }
  }

  async function onSync() {
    try {
      const data = await call("sync-esignatures-template");
      toast.success(
        data?.status === "unchanged"
          ? "Keine Änderung — Template aktuell."
          : `Template synchronisiert (v${data?.template_version}).`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync fehlgeschlagen");
    }
  }

  async function onInit() {
    try {
      const data = await call("create-esignatures-cost-acceptance-template");
      toast.success(
        data?.status === "unchanged"
          ? "Template ist bereits eingerichtet."
          : `Template angelegt (v${data?.template_version}).`,
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Setup fehlgeschlagen");
    }
  }

  const versionOk =
    !!status?.template_version &&
    status?.template_version === status?.current_template_version;

  return (
    <Card className="rounded-xl border border-border/60 bg-white dark:bg-gray-900">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-primary" />
          eSignatures — Kostenübernahme
        </CardTitle>
        <CardDescription>
          Zentrale Konfiguration für die digitale Kostenübernahme via
          eSignatures.com.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lädt…
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <StatusRow label="API-Key" ok={!!status?.has_api_key} />
              <StatusRow
                label="Webhook-Secret"
                ok={!!status?.has_webhook_secret}
              />
              <StatusRow
                label="Template hinterlegt"
                ok={!!status?.template_id}
              />
              <StatusRow
                label={`Version aktuell (v${status?.current_template_version ?? "?"})`}
                ok={versionOk}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esign-template-id">Template-ID</Label>
              <div className="flex gap-2">
                <Input
                  id="esign-template-id"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder={DEFAULT_TEMPLATE_ID}
                  disabled={!isAdmin || busy !== null}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={onSaveTemplateId}
                  disabled={!isAdmin || busy !== null || !templateId.trim()}
                >
                  {busy === "set-esignatures-template-id" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Speichern
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Aktuelle ID:{" "}
                <code className="text-[11px]">
                  {status?.template_id ?? "—"}
                </code>
              </p>
            </div>

            {status?.webhook_url && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Webhook-URL (in eSignatures.com hinterlegen)
                </Label>
                <code className="block break-all rounded-md border bg-muted/40 px-2 py-1.5 text-[11px]">
                  {status.webhook_url}
                </code>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={onInit}
                disabled={busy !== null || !isAdmin}
              >
                {busy === "create-esignatures-cost-acceptance-template" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                Template initialisieren
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={busy !== null || !isAdmin}
              >
                {busy === "sync-esignatures-template" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Template synchronisieren
              </Button>
            </div>

            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Nur Admins können Template-ID und Synchronisation ändern.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        variant="outline"
        className={
          ok
            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
            : "border-red-300 text-red-700 bg-red-50"
        }
      >
        {ok ? "ja" : "nein"}
      </Badge>
    </div>
  );
}