import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileSignature, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "./types";
import type { PublicInquiry, PublicOfferOption } from "./types";
import {
  evaluateCostAcceptanceRequirement,
  type DepositMethod,
  type BalanceMethod,
} from "@/lib/costAcceptanceRequirement";
import { cleanDisplayText } from "@/types/inquiryRecord";

interface Props {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
  /** Wenn true: Block ist Pflicht für verbindlichen Vertragsschluss. */
  required?: boolean;
  /** Spätester Termin für die Unterschrift (ISO YYYY-MM-DD) oder null. */
  deadlineIso?: string | null;
}

type Step = "loading" | "form" | "signing" | "signed" | "inactive" | "error";

interface AcceptanceRow {
  id: string;
  status: string;
  sign_page_url_embedded: string | null;
  sign_page_url?: string | null;
  signed_at: string | null;
  signed_pdf_storage_path?: string | null;
}

const SIGNING_STATUSES = new Set([
  "pending_signature",
  "sent",
  "viewed",
  "signature_started",
  "signer_signed",
]);
const INACTIVE_STATUSES = new Set(["withdrawn", "cancelled", "expired", "declined"]);

const REQUIRED_KEYS = [
  "berechtigt",
  "kostenuebernahme",
  "zusatzleistungen",
  "rechnungsanschrift",
] as const;

export function CostAcceptanceSection({ inquiry, options, required, deadlineIso }: Props) {
  const chosenOption =
    options.find((o) => o.id === inquiry.selected_option_id) ??
    options[0];

  // Fallback: wenn der Aufrufer kein `required` mitgibt, leiten wir es aus den
  // Zahlungs-Konditionen ab. So funktioniert die Section auch standalone.
  const requirement = useMemo(
    () =>
      evaluateCostAcceptanceRequirement({
        depositMethod: (inquiry as unknown as { deposit_method?: DepositMethod | null }).deposit_method ?? null,
        balanceMethod: (inquiry as unknown as { balance_method?: BalanceMethod | null }).balance_method ?? null,
      }),
    [inquiry],
  );
  const isRequired = required ?? requirement.required;
  const deadlineLabel = deadlineIso
    ? new Date(deadlineIso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  // B2C-Erkennung: echte Firma vorhanden? Der frühere Check
  // `!inquiry.company_name` behandelte den String "null" fälschlich als B2B.
  const companyClean = cleanDisplayText(inquiry.company_name);
  const contactClean = cleanDisplayText(inquiry.contact_name);
  const isB2C = companyClean === null;
  const total = chosenOption?.total_amount ?? 0;

  const [step, setStep] = useState<Step>("loading");
  const [loading, setLoading] = useState(false);
  const [acceptance, setAcceptance] = useState<AcceptanceRow | null>(null);
  const [pendingPdf, setPendingPdf] = useState(false);
  const [inactiveStatus, setInactiveStatus] = useState<string | null>(null);

  const [form, setForm] = useState({
    event_company: companyClean ?? contactClean ?? "",
    event_title: inquiry.event_type ?? "",
    event_date: inquiry.preferred_date ?? "",
    onsite_contact: contactClean ?? "",
    guest_count: Number(inquiry.guest_count ?? "0") || 0,
    invoice_company: companyClean ?? contactClean ?? "",
    invoice_street: "",
    invoice_zip_city: "",
    invoice_reference: "",
    signer_name: contactClean ?? "",
    signer_email: inquiry.email ?? "",
    signer_mobile: "",
    signer_company_name: companyClean ?? "",
  });

  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({
    berechtigt: false,
    kostenuebernahme: false,
    zusatzleistungen: false,
    rechnungsanschrift: false,
    b2c_verbraucherinfo: isB2C ? false : true,
  });

  const allRequiredChecked = useMemo(
    () =>
      REQUIRED_KEYS.every((k) => confirmations[k]) &&
      (!isB2C || confirmations.b2c_verbraucherinfo),
    [confirmations, isB2C],
  );

  const formComplete =
    form.signer_name.trim() &&
    form.signer_email.trim() &&
    form.signer_mobile.trim() &&
    form.invoice_street.trim() &&
    form.invoice_zip_city.trim();

  function applyStatus(row: AcceptanceRow | null) {
    setAcceptance(row);
    if (!row) {
      setPendingPdf(false);
      setInactiveStatus(null);
      setStep("form");
      return;
    }
    const s = row.status;
    if (s === "signed") {
      setPendingPdf(false);
      setInactiveStatus(null);
      setStep("signed");
      return;
    }
    if (s === "signed_pending_pdf") {
      setPendingPdf(true);
      setInactiveStatus(null);
      setStep("signed");
      return;
    }
    if (INACTIVE_STATUSES.has(s)) {
      setInactiveStatus(s);
      setStep("inactive");
      return;
    }
    if (s === "error") {
      setStep("error");
      return;
    }
    if (SIGNING_STATUSES.has(s)) {
      if (row.sign_page_url_embedded) {
        setStep("signing");
      } else {
        setStep("error");
      }
      return;
    }
    // draft / unknown → Formular
    setStep("form");
  }

  // Beim Mount: bestehenden Status laden, damit Reload nicht beim Formular landet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "get-public-cost-acceptance-state",
          { body: { inquiry_id: inquiry.id, offer_slug: inquiry.offer_slug ?? null } },
        );
        if (cancelled) return;
        if (error) {
          setStep("form");
          return;
        }
        const row = (data as any)?.acceptance ?? null;
        applyStatus(row);
      } catch {
        if (!cancelled) setStep("form");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiry.id]);

  // Realtime: wenn Webhook das Doc signed setzt
  useEffect(() => {
    if (!acceptance?.id) return;
    const channel = supabase
      .channel(`cost-acceptance-${acceptance.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cost_acceptances",
          filter: `id=eq.${acceptance.id}`,
        },
        (payload) => {
          const next = payload.new as AcceptanceRow;
          applyStatus(next);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [acceptance?.id]);

  // Sanftes Polling während aktive Signatur läuft (Fallback falls Realtime stumm).
  useEffect(() => {
    if (step !== "signing") return;
    const interval: ReturnType<typeof setInterval> = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke(
          "get-public-cost-acceptance-state",
          { body: { inquiry_id: inquiry.id, offer_slug: inquiry.offer_slug ?? null } },
        );
        const row = (data as any)?.acceptance ?? null;
        if (row) applyStatus(row);
      } catch {
        /* ignore */
      }
    }, 12000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, inquiry.id]);

  async function handleSign() {
    if (!allRequiredChecked || !formComplete) {
      toast.error("Bitte alle Pflichtfelder und Bestätigungen ausfüllen.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-cost-acceptance-from-public-offer",
        {
          body: {
            inquiry_id: inquiry.id,
            offer_slug: inquiry.offer_slug ?? null,
            offer_option_id: chosenOption?.id,
            is_b2b: !isB2C,
            signer: {
              name: form.signer_name,
              email: form.signer_email,
              mobile: form.signer_mobile,
              company_name: form.signer_company_name,
            },
            event: {
              company: form.event_company,
              title: form.event_title,
              date: form.event_date,
              onsite_contact: form.onsite_contact,
              guest_count: form.guest_count,
            },
            invoice: {
              company: form.invoice_company,
              street: form.invoice_street,
              zip_city: form.invoice_zip_city,
              reference: form.invoice_reference,
            },
            confirmations,
          },
        },
      );
      if (error) throw error;
      const resp = (data ?? {}) as {
        cost_acceptance_id?: string;
        status?: string;
        sign_page_url_embedded?: string | null;
        sign_page_url?: string | null;
        reused?: boolean;
      };
      const respStatus = resp.status ?? "pending_signature";
      if (respStatus === "signed" || respStatus === "signed_pending_pdf") {
        applyStatus({
          id: resp.cost_acceptance_id ?? "",
          status: respStatus,
          sign_page_url_embedded: resp.sign_page_url_embedded ?? null,
          sign_page_url: resp.sign_page_url ?? null,
          signed_at: null,
        });
        return;
      }
      if (resp.sign_page_url_embedded) {
        applyStatus({
          id: resp.cost_acceptance_id ?? "",
          status: respStatus,
          sign_page_url_embedded: resp.sign_page_url_embedded,
          sign_page_url: resp.sign_page_url ?? null,
          signed_at: null,
        });
        return;
      }
      // Reused/erfolgreich, aber ohne URL und nicht signed → kein leeres iframe
      setStep("error");
      toast.error(
        "Signaturfenster konnte nicht geladen werden. Bitte kontaktieren Sie STORIA.",
      );
    } catch (err) {
      toast.error(
        `Konnte Kostenübernahme nicht starten: ${(err as Error).message}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-3 mb-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Kostenübernahme verbindlich bestätigen
                </h2>
                {isRequired ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                    <AlertTriangle className="h-3 w-3" />
                    Verbindlich vor dem Event erforderlich
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                    Optional
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                Bezugnehmend auf Angebot{" "}
                <strong>{chosenOption?.option_label ?? "–"}</strong> über{" "}
                <strong>{formatCurrency(total)}</strong> brutto.
              </p>
              {isRequired && (
                <p className="mt-2 text-sm text-amber-900">
                  {requirement.reasonDe}
                  {deadlineLabel && (
                    <> Bitte spätestens bis <strong>{deadlineLabel}</strong> unterschreiben.</>
                  )}
                </p>
              )}
            </div>
          </div>

          {step === "loading" && (
            <div className="flex items-center gap-2 text-sm text-neutral-600 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Status wird geprüft…
            </div>
          )}

          {step === "form" && (
            <CostAcceptanceForm
              form={form}
              setForm={setForm}
              confirmations={confirmations}
              setConfirmations={setConfirmations}
              isB2C={isB2C}
              onSubmit={handleSign}
              disabled={!allRequiredChecked || !formComplete || loading}
              loading={loading}
            />
          )}

          {step === "signing" && acceptance?.sign_page_url_embedded && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <Lock className="h-4 w-4" />
                Sicheres Signatur-Fenster — bitte den Anweisungen folgen.
              </div>
              <iframe
                title="Kostenübernahme digital unterschreiben"
                src={acceptance.sign_page_url_embedded}
                className="h-[820px] w-full rounded-xl border border-neutral-200"
              />
              {acceptance.sign_page_url && (
                <p className="text-xs text-neutral-600">
                  Falls das Signaturfenster nicht lädt,{" "}
                  <a
                    href={acceptance.sign_page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline text-neutral-900"
                  >
                    hier in neuem Tab öffnen
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </p>
              )}
            </div>
          )}

          {step === "signed" && (
            <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <CheckCircle2 className="h-6 w-6 text-neutral-900" />
              <div>
                <h3 className="font-semibold text-neutral-900">
                  Kostenübernahme erfolgreich unterschrieben
                </h3>
                <p className="mt-1 text-sm text-neutral-700">
                  Du erhältst eine Kopie des unterschriebenen Dokuments per
                  E-Mail. Vielen Dank für Ihr Vertrauen.
                </p>
                {pendingPdf && (
                  <p className="mt-2 text-xs text-neutral-600">
                    Die Unterschrift ist eingegangen. Das signierte PDF wird noch verarbeitet.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "inactive" && (
            <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <AlertTriangle className="h-6 w-6 text-neutral-900" />
              <div>
                <h3 className="font-semibold text-neutral-900">
                  Diese Kostenübernahme ist nicht mehr aktiv
                </h3>
                <p className="mt-1 text-sm text-neutral-700">
                  Bitte kontaktieren Sie STORIA unter{" "}
                  <a href="mailto:info@events-storia.de" className="underline">
                    info@events-storia.de
                  </a>
                  {inactiveStatus ? ` (Status: ${inactiveStatus}).` : "."}
                </p>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <AlertTriangle className="h-6 w-6 text-neutral-900" />
              <div>
                <h3 className="font-semibold text-neutral-900">
                  Signatur derzeit nicht verfügbar
                </h3>
                <p className="mt-1 text-sm text-neutral-700">
                  Es ist ein Problem mit der digitalen Kostenübernahme aufgetreten.
                  Bitte kontaktieren Sie uns unter{" "}
                  <a href="mailto:info@events-storia.de" className="underline">
                    info@events-storia.de
                  </a>{" "}
                  — wir kümmern uns umgehend darum.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type FormState = {
  event_company: string;
  event_title: string;
  event_date: string;
  onsite_contact: string;
  guest_count: number;
  invoice_company: string;
  invoice_street: string;
  invoice_zip_city: string;
  invoice_reference: string;
  signer_name: string;
  signer_email: string;
  signer_mobile: string;
  signer_company_name: string;
};

function CostAcceptanceForm(
  props: {
    form: FormState;
    setForm: Dispatch<SetStateAction<FormState>>;
    confirmations: Record<string, boolean>;
    setConfirmations: Dispatch<SetStateAction<Record<string, boolean>>>;
    isB2C: boolean;
    onSubmit: () => void;
    disabled: boolean;
    loading: boolean;
  },
) {
  const { form, setForm, confirmations, setConfirmations, isB2C } = props;
  const set = (k: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }) as FormState);
  const check = (k: string) => (v: boolean) =>
    setConfirmations((c) => ({ ...c, [k]: v }));

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-neutral-900">
          Rechnungsanschrift
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Firma" value={form.invoice_company} onChange={set("invoice_company")} />
          <Field label="Straße / Hausnummer" value={form.invoice_street} onChange={set("invoice_street")} />
          <Field label="PLZ / Ort" value={form.invoice_zip_city} onChange={set("invoice_zip_city")} />
          <Field label="Kostenstelle / Referenz (optional)" value={form.invoice_reference} onChange={set("invoice_reference")} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-neutral-900">
          Unterzeichner
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name" value={form.signer_name} onChange={set("signer_name")} />
          <Field label="Firma" value={form.signer_company_name} onChange={set("signer_company_name")} />
          <Field label="E-Mail" type="email" value={form.signer_email} onChange={set("signer_email")} />
          <Field label="Mobilnummer (für SMS-Verifikation)" type="tel" value={form.signer_mobile} onChange={set("signer_mobile")} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-neutral-900">
          Pflicht-Bestätigungen
        </legend>
        <CheckRow
          checked={confirmations.berechtigt}
          onChange={check("berechtigt")}
          label="Ich bestätige, zur Abgabe dieser Kostenübernahme berechtigt zu sein."
        />
        <CheckRow
          checked={confirmations.kostenuebernahme}
          onChange={check("kostenuebernahme")}
          label="Ich bestätige die Kostenübernahme für das referenzierte Angebot einschließlich der dort aufgeführten Leistungen."
        />
        <CheckRow
          checked={confirmations.zusatzleistungen}
          onChange={check("zusatzleistungen")}
          label="Ich akzeptiere, dass Zusatzleistungen, Mehrverbrauch sowie vor Ort beauftragte Änderungen oder Erweiterungen gesondert berechnet werden."
        />
        <CheckRow
          checked={confirmations.rechnungsanschrift}
          onChange={check("rechnungsanschrift")}
          label="Ich bestätige die angegebene Rechnungsanschrift."
        />
        {isB2C && (
          <CheckRow
            checked={confirmations.b2c_verbraucherinfo}
            onChange={check("b2c_verbraucherinfo")}
            label="Ich habe Leistungsbeschreibung, Gesamtpreis, Zahlungsbedingungen und Verbraucherinformationen zur Kenntnis genommen."
          />
        )}
      </fieldset>

      <div className="flex">
        <Button
          onClick={props.onSubmit}
          disabled={props.disabled}
          className="min-h-[48px] px-6"
        >
          {props.loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileSignature className="mr-2 h-4 w-4" />
          )}
          Kostenübernahme jetzt digital unterschreiben
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-neutral-700">{label}</Label>
      <Input type={type} value={value} onChange={onChange} />
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} className="mt-0.5" />
      <span className="text-sm leading-relaxed text-neutral-800">{label}</span>
    </label>
  );
}