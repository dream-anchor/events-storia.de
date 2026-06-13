import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { CheckCircle2, FileSignature, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "./types";
import type { PublicInquiry, PublicOfferOption } from "./types";

interface Props {
  inquiry: PublicInquiry;
  options: PublicOfferOption[];
}

type Step = "form" | "signing" | "signed";

interface AcceptanceRow {
  id: string;
  status: string;
  sign_page_url_embedded: string | null;
  signed_at: string | null;
  signed_pdf_storage_path: string | null;
}

const REQUIRED_KEYS = [
  "berechtigt",
  "kostenuebernahme",
  "zusatzleistungen",
  "rechnungsanschrift",
] as const;

export function CostAcceptanceSection({ inquiry, options }: Props) {
  const chosenOption =
    options.find((o) => o.id === inquiry.selected_option_id) ??
    options[0];

  const isB2C = !inquiry.company_name;
  const total = chosenOption?.total_amount ?? 0;

  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [acceptance, setAcceptance] = useState<AcceptanceRow | null>(null);

  const [form, setForm] = useState({
    event_company: inquiry.company_name ?? inquiry.contact_name,
    event_title: inquiry.event_type ?? "",
    event_date: inquiry.preferred_date ?? "",
    onsite_contact: inquiry.contact_name,
    guest_count: Number(inquiry.guest_count ?? "0") || 0,
    invoice_company: inquiry.company_name ?? inquiry.contact_name,
    invoice_street: "",
    invoice_zip_city: "",
    invoice_reference: "",
    signer_name: inquiry.contact_name,
    signer_email: inquiry.email ?? "",
    signer_mobile: "",
    signer_company_name: inquiry.company_name ?? "",
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
          setAcceptance(next);
          if (next.status === "signed") setStep("signed");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [acceptance?.id]);

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
      setAcceptance({
        id: data.cost_acceptance_id,
        status: "pending_signature",
        sign_page_url_embedded: data.sign_page_url_embedded,
        signed_at: null,
        signed_pdf_storage_path: null,
      });
      setStep("signing");
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
              <h2 className="text-xl font-semibold text-neutral-900">
                Kostenübernahme verbindlich bestätigen
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Bezugnehmend auf Angebot{" "}
                <strong>{chosenOption?.option_label ?? "–"}</strong> über{" "}
                <strong>{formatCurrency(total)}</strong> brutto.
              </p>
            </div>
          </div>

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