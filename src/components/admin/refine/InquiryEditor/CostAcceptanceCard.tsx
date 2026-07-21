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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { CostAcceptanceAuditDrawer } from "./CostAcceptanceAuditDrawer";
import { PrivacyBlur } from "@/components/admin/PrivacyBlur";
import { evaluateCostAcceptanceRequirement } from "@/lib/costAcceptanceRequirement";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function runPreflightChecks(
  inquiryId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { data: event } = await (supabase as any)
      .from("v2_events")
      .select(
        "customer_id, company_street, company_postal_code, company_city, billing_address_different, billing_street, billing_postal_code, billing_city, amount_total, date, guest_count",
      )
      .eq("id", inquiryId)
      .maybeSingle();
    if (!event) return { ok: false, message: "Anfrage nicht gefunden." };
    if (!event.customer_id)
      return { ok: false, message: "Kein Kunde an dieser Anfrage." };
    if (!event.date)
      return { ok: false, message: "Veranstaltungsdatum fehlt in Maestro." };
    const guests = Number(event.guest_count);
    if (!Number.isFinite(guests) || guests <= 0)
      return { ok: false, message: "Gästezahl fehlt in Maestro." };

    const { data: customer } = await (supabase as any)
      .from("v2_customers")
      .select("name, email, phone, address_street, address_zip, address_city")
      .eq("id", event.customer_id)
      .maybeSingle();
    if (!customer)
      return { ok: false, message: "Kundenprofil nicht gefunden." };

    const name = String(customer.name ?? "").trim();
    const email = String(customer.email ?? "").trim();
    const phone = String(customer.phone ?? "").trim();

    if (name.length < 2)
      return { ok: false, message: "Kundenname fehlt im Kundenprofil." };
    if (!EMAIL_RE.test(email))
      return {
        ok: false,
        message: "Kunden-E-Mail fehlt oder ist ungültig im Kundenprofil.",
      };
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 20)
      return {
        ok: false,
        message: `Kunden-Mobilnummer ist zu kurz oder ungültig${
          phone ? ` ("${phone}")` : ""
        } — bitte mit Ländervorwahl und mind. 7 Ziffern im Kundenprofil pflegen.`,
      };

    const useBilling = Boolean(event.billing_address_different);
    const street = (
      (useBilling ? event.billing_street : null) ??
      event.company_street ??
      customer.address_street ??
      ""
    )
      .toString()
      .trim();
    const zip = (
      (useBilling ? event.billing_postal_code : null) ??
      event.company_postal_code ??
      customer.address_zip ??
      ""
    )
      .toString()
      .trim();
    const city = (
      (useBilling ? event.billing_city : null) ??
      event.company_city ??
      customer.address_city ??
      ""
    )
      .toString()
      .trim();
    if (!street || !(zip || city))
      return {
        ok: false,
        message:
          "Rechnungsadresse fehlt — bitte Firmenadresse (oder abweichende Rechnungsadresse) an dieser Anfrage pflegen (Straße + PLZ/Ort).",
      };

    // Amount: fallback zu aktiver Offer-Option
    const totalNum = Number(event.amount_total);
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      const { data: opt } = await (supabase as any)
        .from("v2_offer_options")
        .select("amount_total")
        .eq("event_id", inquiryId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const optTotal = Number(opt?.amount_total);
      if (!Number.isFinite(optTotal) || optTotal <= 0)
        return {
          ok: false,
          message:
            "Kein Betrag am Angebot — bitte im Angebot einen Gesamtbetrag hinterlegen.",
        };
    }
    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      message: e?.message ?? "Vorabprüfung fehlgeschlagen.",
    };
  }
}

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
  depositMethod,
  balanceMethod,
  costAcceptanceRequested,
}: {
  inquiryId: string;
  publicOfferUrl?: string | null;
  offerPhase?: string | null;
  lockedAfterSignature?: boolean | null;
  depositMethod?: string | null;
  balanceMethod?: string | null;
  costAcceptanceRequested?: boolean | null;
}) {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [row, setRow] = useState<any>(null);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [requested, setRequested] = useState<boolean>(!!costAcceptanceRequested);
  const [savingRequested, setSavingRequested] = useState(false);
  const [lastSendClientError, setLastSendClientError] = useState<string | null>(null);
  useEffect(() => {
    setRequested(!!costAcceptanceRequested);
  }, [costAcceptanceRequested]);
  const requirement = evaluateCostAcceptanceRequirement({
    requested,
    depositMethod: (depositMethod ?? null) as never,
    balanceMethod: (balanceMethod ?? null) as never,
  });

  async function onToggleRequested(next: boolean) {
    const prev = requested;
    setRequested(next);
    setSavingRequested(true);
    try {
      const patch: Record<string, unknown> = {
        cost_acceptance_requested: next,
      };
      if (next) patch.cost_acceptance_requested_at = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("v2_events")
        .update(patch)
        .eq("id", inquiryId);
      if (error) throw error;
      toast.success(
        next
          ? "Kostenübernahme angefordert — Kunde sieht den Block im Angebot."
          : "Kostenübernahme deaktiviert — Kunde sieht den Block nicht mehr.",
      );
    } catch (e: any) {
      setRequested(prev);
      toast.error(e?.message ?? "Konnte Status nicht speichern.");
    } finally {
      setSavingRequested(false);
    }
  }

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
          let message = text || error.message;
          try {
            const json = JSON.parse(text);
            message = json?.error || text || error.message;
          } catch {
            message = text || error.message;
          }
          throw new Error(message);
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

  async function onAdminSend() {
    setLastSendClientError(null);
    try {
      // Client-side pre-check to prevent silent 409s and give a clear error
      const precheck = await runPreflightChecks(inquiryId);
      if (!precheck.ok) {
        setLastSendClientError(precheck.message);
        toast.error(precheck.message, {
          duration: 8000,
          description:
            "Bitte fehlende Felder im Kundenprofil oder an der Firmenadresse dieser Anfrage ergänzen.",
        });
        return;
      }
      const data = await call("admin-send-cost-acceptance", {
        inquiry_id: inquiryId,
      });
      if (data?.reused) {
        toast.info(
          data.status === "signed"
            ? "Kostenübernahme wurde bereits unterschrieben."
            : "Es läuft bereits eine Kostenübernahme — wird angezeigt.",
        );
      } else {
        toast.success("Kostenübernahme an Kunden verschickt.");
      }
      setRequested(true);
      await loadAll();
    } catch (e: any) {
      const msg = e?.message ?? "Versand fehlgeschlagen";
      setLastSendClientError(msg);
      toast.error(msg, {
        duration: 8000,
        description:
          "Kostenübernahme konnte nicht an eSignatures übergeben werden.",
      });
    }
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
  const blocksSend = ["signed", "signed_pending_pdf", "withdrawn", "cancelled", "expired"].includes(status);
  const canSendEmail = !!row && !!row.sign_page_url && !blocksSend;
  const sendCount = Number(row?.send_count ?? 0);
  const canAdminSend =
    !lockedAfterSignature &&
    (!row ||
      ["draft", "error", "withdrawn", "cancelled", "expired", "declined"].includes(
        status,
      ));

  async function onSendEmail() {
    if (!row?.id) return;
    const mode = sendCount > 0 ? "resend" : "send";
    try {
      await call("send-cost-acceptance-email", {
        cost_acceptance_id: row.id,
        mode,
      });
      toast.success(
        mode === "resend"
          ? "Kostenübernahme erneut per E-Mail versendet."
          : "Kostenübernahme per E-Mail versendet.",
      );
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "E-Mail-Versand fehlgeschlagen");
    }
  }

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
            <Badge
              variant="outline"
              className={
                "text-xs " +
                (requested
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-neutral-50 text-neutral-700")
              }
              title={requirement.reasonDe}
            >
              {requested ? "Angefordert" : "Nicht angefordert"}
            </Badge>
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
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="cost-acceptance-requested" className="text-sm font-medium">
                  Kostenübernahme anfordern
                </Label>
                <p className="text-xs text-muted-foreground">
                  Unabhängig von Anzahlung/Restzahlung. Nur wenn aktiv, sieht der Kunde
                  den Signatur-Block im Angebot und kann elektronisch unterschreiben.
                </p>
              </div>
              <Switch
                id="cost-acceptance-requested"
                checked={requested}
                disabled={savingRequested || !!lockedAfterSignature}
                onCheckedChange={onToggleRequested}
              />
            </div>
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
                  k="Versandt an"
                  v={<PrivacyBlur kind="contact">{row.sent_to ?? "—"}</PrivacyBlur>}
                />
                <Row
                  k="Versandt am"
                  v={
                    row.sent_at
                      ? new Date(row.sent_at).toLocaleString("de-DE")
                      : "—"
                  }
                />
                <Row k="Versandanzahl" v={sendCount > 0 ? String(sendCount) : "—"} />
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

            {row?.last_send_error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Letzter Versandfehler</div>
                  <div className="text-xs mt-0.5 break-words">{row.last_send_error}</div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {canAdminSend && (
                <Button
                  size="sm"
                  onClick={onAdminSend}
                  disabled={busy !== null}
                >
                  {busy === "admin-send-cost-acceptance" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Kostenübernahme an Kunden schicken
                </Button>
              )}
              {publicOfferUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(publicOfferUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-1" /> Public Offer öffnen
                </Button>
              )}
              {canSendEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSendEmail}
                  disabled={busy !== null}
                >
                  {busy === "send-cost-acceptance-email" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 mr-1" />
                  )}
                  {sendCount > 0 ? "Erneut senden" : "Per E-Mail senden"}
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

            {isAdmin && !integration?.template_id && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Es ist noch kein eSignatures-Template konfiguriert. Bitte in den
                Einstellungen unter <em>eSignatures</em> die Template-ID hinterlegen.
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