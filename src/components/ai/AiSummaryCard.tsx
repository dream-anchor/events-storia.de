import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AiIntakeExtraction,
  AiIntakeLanguage,
  AiRequiredField,
} from "@/lib/aiIntake/types";

interface Props {
  extraction: AiIntakeExtraction;
  missing: AiRequiredField[];
  language: AiIntakeLanguage;
}

const LABELS: Record<string, { de: string; en: string }> = {
  contactName: { de: "Ansprechpartner", en: "Contact" },
  email: { de: "E-Mail", en: "Email" },
  phone: { de: "Telefon", en: "Phone" },
  companyName: { de: "Firma", en: "Company" },
  preferredDate: { de: "Datum", en: "Date" },
  dateRange: { de: "Zeitraum", en: "Time frame" },
  timeSlot: { de: "Uhrzeit", en: "Time" },
  guestCount: { de: "Personen", en: "Guests" },
  eventType: { de: "Anlass", en: "Event" },
  locationName: { de: "Ort", en: "Location" },
  deliveryAddress: { de: "Lieferadresse", en: "Delivery address" },
  budget: { de: "Budget", en: "Budget" },
  foodPreferences: { de: "Speisenwünsche", en: "Menu" },
  dietaryRequirements: { de: "Ernährung", en: "Dietary" },
  serviceNeeds: { de: "Service", en: "Service" },
  equipmentNeeds: { de: "Equipment", en: "Equipment" },
  summary: { de: "Zusammenfassung", en: "Summary" },
  notes: { de: "Notizen", en: "Notes" },
};

export function AiSummaryCard({ extraction, missing, language }: Props) {
  const known = Object.entries(extraction).filter(([, v]) => {
    if (v == null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-background p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {language === "de" ? "Erkannte Angaben" : "Detected details"}
        </div>
        {known.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {language === "de" ? "Noch keine Angaben erkannt." : "No details yet."}
          </p>
        ) : (
          <dl className="space-y-1">
            {known.map(([key, value]) => {
              const display = Array.isArray(value)
                ? value.join(", ")
                : String(value);
              return (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <dt className="shrink-0 text-muted-foreground">
                    {LABELS[key]?.[language] ?? key}
                  </dt>
                  <dd
                    className="truncate text-right text-foreground"
                    title={display}
                  >
                    {display}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </div>

      <div
        className={cn(
          "rounded-2xl border p-3.5",
          missing.length === 0
            ? "border-border bg-background"
            : "border-foreground/20 bg-muted/40",
        )}
      >
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {language === "de" ? "Fehlende Pflichtangaben" : "Missing required"}
        </div>
        {missing.length === 0 ? (
          <p className="text-sm text-foreground">
            {language === "de"
              ? "Alle Pflichtangaben liegen vor."
              : "All required information is present."}
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-foreground">
            {missing.map((m) => (
              <li key={m} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-foreground"
                />
                {LABELS[m]?.[language] ?? m}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}