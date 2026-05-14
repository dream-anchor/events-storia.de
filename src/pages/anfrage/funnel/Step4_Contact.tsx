import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { contactSchema } from "./funnelSchema";

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
        <h2 className="text-2xl md:text-3xl font-serif font-semibold mb-2">Wie erreichen wir Sie?</h2>
        <p className="text-muted-foreground mb-5">Wir melden uns innerhalb von 4 Stunden persönlich.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Vorname</label>
          <Input value={values.first_name} onChange={(e) => onChange({ first_name: e.target.value })} className="h-12" autoComplete="given-name" aria-invalid={!!errors.first_name} />
          {errors.first_name && <p className="text-sm text-destructive mt-1">{errors.first_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nachname</label>
          <Input value={values.last_name} onChange={(e) => onChange({ last_name: e.target.value })} className="h-12" autoComplete="family-name" aria-invalid={!!errors.last_name} />
          {errors.last_name && <p className="text-sm text-destructive mt-1">{errors.last_name}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">E-Mail</label>
        <Input type="email" value={values.email} onChange={(e) => onChange({ email: e.target.value })} className="h-12" autoComplete="email" aria-invalid={!!errors.email} />
        {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Telefon <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Input type="tel" value={values.phone} onChange={(e) => onChange({ phone: e.target.value })} className="h-12" autoComplete="tel" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Notiz <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Textarea value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} rows={4} placeholder="Allergien, Wünsche, Rahmenbedingungen…" maxLength={2000} />
      </div>

      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <Checkbox checked={values.gdpr_consent} onCheckedChange={(v) => onChange({ gdpr_consent: v === true })} className="mt-0.5" aria-invalid={!!errors.gdpr_consent} />
        <span className="text-muted-foreground leading-relaxed">
          Ich bin damit einverstanden, dass meine Angaben zur Bearbeitung der Anfrage verwendet werden. Es gilt unsere{" "}
          <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline hover:text-foreground">Datenschutzerklärung</a>.
        </span>
      </label>
      {errors.gdpr_consent && <p className="text-sm text-destructive -mt-3">{errors.gdpr_consent}</p>}

      {submitError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive font-medium mb-1">Senden hat nicht geklappt.</p>
          <p className="text-muted-foreground">
            {submitError} Bitte erneut versuchen oder rufen Sie uns direkt an:{" "}
            <a href="tel:+498951519696" className="underline font-medium text-foreground">089 51519696</a>.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={onBack} disabled={submitting} className="min-h-[48px]">Zurück</Button>
        <Button onClick={submit} disabled={submitting} className="min-h-[48px] px-6">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sende…</> : "Anfrage senden"}
        </Button>
      </div>
    </div>
  );
};