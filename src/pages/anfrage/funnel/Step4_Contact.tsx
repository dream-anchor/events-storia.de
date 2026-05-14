import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { contactSchema } from "./funnelSchema";
import { FUNNEL_DE } from "./i18n/de";

type Props = {
  values: { first_name: string; last_name: string; email: string; phone: string; notes: string; gdpr_consent: boolean };
  onChange: (patch: Partial<Props["values"]>) => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  submitting: boolean;
  submitError: string | null;
};

export const Step4_Contact = ({ values, onChange, onSubmit, onBack, submitting, submitError }: Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const r = contactSchema.safeParse(values);
    if (!r.success) {
      const e: Record<string, string> = {};
      for (const i of r.error.issues) e[i.path[0] as string] = i.message;
      setErrors(e); return;
    }
    setErrors({});
    await onSubmit();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">{FUNNEL_DE.step4.heading}</h2>
        <p className="text-muted-foreground mb-5">{FUNNEL_DE.step4.subline}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step4.first_name}</label>
          <Input value={values.first_name} onChange={(e) => onChange({ first_name: e.target.value })} className="h-12" autoComplete="given-name" aria-invalid={!!errors.first_name} />
          {errors.first_name && <p className="text-sm text-destructive mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step4.last_name}</label>
          <Input value={values.last_name} onChange={(e) => onChange({ last_name: e.target.value })} className="h-12" autoComplete="family-name" aria-invalid={!!errors.last_name} />
          {errors.last_name && <p className="text-sm text-destructive mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step4.email}</label>
        <Input type="email" value={values.email} onChange={(e) => onChange({ email: e.target.value })} className="h-12" autoComplete="email" aria-invalid={!!errors.email} />
        {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step4.phone} <span className="text-muted-foreground font-normal">{FUNNEL_DE.common.optional}</span></label>
        <Input type="tel" value={values.phone} onChange={(e) => onChange({ phone: e.target.value })} className="h-12" autoComplete="tel" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{FUNNEL_DE.step4.notes} <span className="text-muted-foreground font-normal">{FUNNEL_DE.common.optional}</span></label>
        <Textarea value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} rows={4} placeholder={FUNNEL_DE.step4.notes_placeholder} maxLength={2000} />
      </div>

      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <Checkbox checked={values.gdpr_consent} onCheckedChange={(v) => onChange({ gdpr_consent: v === true })} className="mt-0.5" aria-invalid={!!errors.gdpr_consent} />
        <span className="text-muted-foreground leading-relaxed">
          {FUNNEL_DE.step4.consent_prefix}
          <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline hover:text-foreground">{FUNNEL_DE.step4.consent_link}</a>{FUNNEL_DE.step4.consent_suffix}
        </span>
      </label>
      {errors.gdpr_consent && <p className="text-sm text-destructive -mt-3">{errors.gdpr_consent}</p>}

      {submitError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive font-medium mb-1">{FUNNEL_DE.common.submit_error_title}</p>
          <p className="text-muted-foreground">
            {submitError} {FUNNEL_DE.common.submit_error_suffix}{" "}
            <a href={FUNNEL_DE.common.phone_href} className="underline font-medium text-foreground">{FUNNEL_DE.common.phone_display}</a>.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onBack} disabled={submitting} className="min-h-[48px]">{FUNNEL_DE.common.zurueck}</Button>
        <Button onClick={submit} disabled={submitting} className="min-h-[48px] px-6">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{FUNNEL_DE.common.senden_loading}</> : FUNNEL_DE.common.senden}
        </Button>
      </div>
    </div>
  );
};