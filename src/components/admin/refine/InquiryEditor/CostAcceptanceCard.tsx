import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  FileSignature,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { CostAcceptanceAuditDrawer } from "./CostAcceptanceAuditDrawer";
import { PrivacyBlur } from "@/components/admin/PrivacyBlur";

type Status =
  | "draft"
  | "pending_signature"
  | "signature_started"
  | "sent"
  | "viewed"
  | "signer_signed"
  | "signed"
  | "declined"
  | "withdrawn"
  | "cancelled"
  | "expired"
  | "error";

const STATUS_VARIANT: Record<
  Status,
  { label: string; cls: string }
> = {
  draft: { label: "Entwurf", cls: "bg-neutral-100 text-neutral-700" },
  pending_signature: { label: "Wartet auf Signatur", cls: "bg-blue-100 text-blue-700" },
  signature_started: { label: "Signatur gestartet", cls: "bg-blue-100 text-blue-700" },
  sent: { label: "Versendet", cls: "bg-blue-100 text-blue-700" },
  viewed: { label: "Geöffnet", cls: "bg-blue-100 text-blue-700" },
  signer_signed: { label: "Signer signiert", cls: "bg-emerald-50 text-emerald-700" },
  signed: { label: "Unterschrieben", cls: "bg-emerald-100 text-emerald-800" },
  declined: { label: "Abgelehnt", cls: "bg-amber-100 text-amber-800" },
  withdrawn: { label: "Zurückgezogen", cls: "bg-amber-100 text-amber-800" },
  cancelled: { label: "Storniert", cls: "bg-neutral-200 text-neutral-700" },
  expired: { label: "Abgelaufen", cls: "bg-neutral-200 text-neutral-700" },
  error: { label: "Fehler", cls: "bg-red-100 text-red-700" },
};

interface IntegrationStatus {
  has_api_key: boolean;
  has_webhook_secret: boolean;
  template_id: string | null;
  template_version: string | null;
  current_template_version: string;
  webhook_url: string | null;
  supabase_url_available?: boolean;
}

export function CostAcceptanceCard({
  inquiryId,
  publicOfferUrl,
  offerPhase,
  lockedAfterSignature,
}: {
  inquiryId: string;
  publicOfferUrl?: string | null;
  offerPhase?: string | null;
  lockedAfterSignature?: boolean | null;
}) {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [row, setRow] = useState<any>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [{ data }, statusRes] = await Promise.all([
      supabase
        .from("cost_acceptances")
        .select("*")
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.functions.invoke("esignatures-integration-status"),
    ]);
    setRow(data);
    setIntegration((statusRes.data as IntegrationStatus) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (inquiryId) loadAll();
  }, [inquiryId]);

  async function call(name: string, body?: Record<string, unknown>) {
    setBusy(name);
    try {
      const { data, error } = await supabase.functions.invoke(name, { body });
      if (error) {
        const context = (error as any)?.context;
        if (context instanceof Response) {
          const text = await context.text();
          try {
            const json = JSON.parse(text);
            throw new Error(json?.error || text || error.message);
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== text) {
              throw parseError;
            }
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

  async function onInitTemplate() {
    try {
      const data = await call("create-esignatures-cost-acceptance-template");
      toast.success(
        data?.status === "unchanged"
          ? "Template ist bereits eingerichtet."
          : `Template angelegt (v${data?.template_version}).`,
      );
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Setup fehlgeschlagen");
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
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync fehlgeschlagen");
    }
  }

  async function onWithdraw() {
    try {
      await call("withdraw-cost-acceptance", {
        cost_acceptance_id: row.id,
      });
      toast.success("Kostenübernahme zurückgezogen.");
      setConfirmWithdraw(false);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Rückzug fehlgeschlagen");
    }
  }

  async function onDownload() {
    try {
      const data = await call("download-signed-cost-acceptance", {
        cost_acceptance_id: row.id,
      });
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Download fehlgeschlagen");
    }
  }

  async function onReopenSignature() {
    if (!row?.sign_page_url) {
      toast.info(
        "Es liegt aktuell keine offene Signatur-URL vor. Der Kunde kann die Kostenübernahme im Public Offer starten.",
      );
      return;
    }
    window.open(row.sign_page_url, "_blank");
  }

  const status = (row?.status ?? "draft") as Status;
  const statusInfo = STATUS_VARIANT[status] ?? STATUS_VARIANT.draft;
  const isOlderTemplate =
    row?.template_version &&
    integration?.current_template_version &&
    row.template_version !== integration.current_template_version;
  const canWithdraw =
    row?.esignatures_contract_id &&
    !["signed", "withdrawn", "cancelled", "expired"].includes(status);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Kostenübernahme
            </CardTitle>
            <CardDescription>
              Digitale Unterschrift via eSignatures.com — revisionssicher.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={statusInfo.cls + " border-transparent"}>
              {statusInfo.label}
            </Badge>
            {offerPhase && (
              <Badge variant="outline" className="text-xs">
                Offer: {offerPhase}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lädt…
          </div>
        ) : (
          <>
            {lockedAfterSignature && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 flex gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  Event/Angebot ist nach Signatur gesperrt. Änderungen an
                  signaturrelevanten Daten erfordern eine neue Angebotsversion und
                  eine neue Kostenübernahme.
                </div>
              </div>
            )}

            {isOlderTemplate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  Diese Kostenübernahme wurde mit einer älteren Template-Version
                  (v{row.template_version}) erstellt. Bereits unterschriebene
                  Dokumente bleiben unverändert. Neue Änderungen erzeugen eine
                  neue Kostenübernahme.
                </div>
              </div>
            )}

            {row ? (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row k="Angebotsnummer" v={row.offer_number} />
                <Row
                  k="Summe (brutto)"
                  v={
                    row.amount_gross_cents != null ? (
                      <PrivacyBlur kind="money">
                        {(row.amount_gross_cents / 100).toLocaleString("de-DE", {
                          style: "currency",
                          currency: row.currency ?? "EUR",
                        })}
                      </PrivacyBlur>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row
                  k="Signer"
                  v={<PrivacyBlur kind="customer">{row.signer_name ?? "—"}</PrivacyBlur>}
                />
                <Row
                  k="Signer E-Mail"
                  v={<PrivacyBlur kind="contact">{row.signer_email ?? "—"}</PrivacyBlur>}
                />
                <Row
                  k="Signer Mobil"
                  v={<PrivacyBlur kind="contact">{row.signer_mobile ?? "—"}</PrivacyBlur>}
                />
                <Row
                  k="Signer Firma"
                  v={<PrivacyBlur kind="customer">{row.signer_company_name ?? "—"}</PrivacyBlur>}
                />
                <Row k="Contract ID" v={row.esignatures_contract_id ?? "—"} />
                <Row k="Template-ID" v={row.esignatures_template_id ?? "—"} />
                <Row k="Template-Version" v={row.template_version ?? "—"} />
                <Row
                  k="Erstellt"
                  v={
                    row.created_at
                      ? new Date(row.created_at).toLocaleString("de-DE")
                      : "—"
                  }
                />
                <Row
                  k="Unterschrieben"
                  v={
                    row.signed_at
                      ? new Date(row.signed_at).toLocaleString("de-DE")
                      : "—"
                  }
                />
                <Row
                  k="Signiertes PDF"
                  v={row.signed_pdf_storage_path ? "vorhanden" : "—"}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Für dieses Angebot wurde noch keine Kostenübernahme erzeugt. Sie
                wird automatisch angelegt, sobald der Kunde im Public Offer die
                digitale Unterschrift startet.
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {publicOfferUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(publicOfferUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> Public Offer öffnen
                </Button>
              )}
              {row && status !== "signed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReopenSignature}
                  disabled={busy !== null}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Signatur erneut starten
                </Button>
              )}
              {row?.signed_pdf_storage_path && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownload}
                  disabled={busy !== null}
                >
                  <Download className="h-4 w-4 mr-1" /> Signiertes PDF
                </Button>
              )}
              {row && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAuditOpen(true)}
                >
                  <History className="h-4 w-4 mr-1" /> Audit anzeigen
                </Button>
              )}
              {canWithdraw && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmWithdraw(true)}
                  disabled={busy !== null}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Zurückziehen
                </Button>
              )}
            </div>

            {/* Integration Check (Admin only) */}
            {isAdmin && (
              <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
                <div className="text-sm font-medium">Integration Check</div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <CheckRow
                    label="ESIGNATURES_API_KEY"
                    ok={!!integration?.has_api_key}
                  />
                  <CheckRow
                    label="ESIGNATURES_WEBHOOK_SECRET"
                    ok={!!integration?.has_webhook_secret}
                  />
                  <CheckRow
                    label="Template-ID hinterlegt"
                    ok={!!integration?.template_id}
                  />
                  <CheckRow
                    label={`Template-Version aktuell (v${integration?.current_template_version ?? "?"})`}
                    ok={
                      !!integration?.template_version &&
                      integration?.template_version ===
                        integration?.current_template_version
                    }
                  />
                </div>
                {integration?.webhook_url ? (
                  <div className="text-xs space-y-1">
                    <div className="text-muted-foreground">Webhook URL:</div>
                    <code className="block break-all rounded-md bg-background px-2 py-1.5 text-[11px]">
                      {integration.webhook_url}
                    </code>
                    <div className="text-muted-foreground">
                      Diese URL muss in eSignatures.com als Webhook URL hinterlegt
                      sein, falls nicht pro Contract <code>custom_webhook_url</code>{" "}
                      verwendet wird.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                    SUPABASE_URL nicht verfügbar. Bitte Function-URL aus dem
                    Supabase Dashboard kopieren und in eSignatures.com hinterlegen.
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onInitTemplate}
                    disabled={busy !== null}
                  >
                    {busy === "create-esignatures-cost-acceptance-template" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    )}
                    Template initialisieren
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onSync}
                    disabled={busy !== null}
                  >
                    {busy === "sync-esignatures-template" && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    )}
                    Template synchronisieren
                  </Button>
                </div>
                {integration?.template_id && (
                  <p className="text-xs text-muted-foreground">
                    Template ist bereits eingerichtet · ID{" "}
                    <code className="text-[11px]">{integration.template_id}</code>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      <CostAcceptanceAuditDrawer
        open={auditOpen}
        onOpenChange={setAuditOpen}
        events={(row?.webhook_events ?? []) as any[]}
        contractId={row?.esignatures_contract_id}
      />

      <AlertDialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kostenübernahme zurückziehen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Kostenübernahme kann danach nicht mehr unterschrieben werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={onWithdraw}>
              Zurückziehen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/30 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium truncate max-w-[60%]">{v}</span>
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
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