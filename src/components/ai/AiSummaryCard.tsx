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
  attachmentCount?: number;
}

// Customer-friendly labels for missing required fields (no technical names).
const MISSING_LABELS: Record<AiRequiredField, { de: string; en: string }> = {
  contactName: { de: "Name", en: "Name" },
  email: { de: "E-Mail", en: "Email" },
  guestCount: { de: "Personenanzahl", en: "Number of guests" },
  preferredDate: {
    de: "Datum oder Zeitraum",
    en: "Date or time frame",
  },
};

type RowValue = string | null;

function cleanString(v: unknown): RowValue {
  if (v == null) return null;
  if (typeof v === "boolean") return null;
  if (Array.isArray(v)) {
    const arr = v
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((x) => x.length > 0);
    return arr.length ? arr.join(", ") : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (s === "null" || s === "false" || s === "undefined") return null;
  return s;
}

export function AiSummaryCard({
  extraction,
  missing,
  language,
  attachmentCount = 0,
}: Props) {
  const e = extraction;

  // Customer-readable date/range string.
  const dateValue =
    cleanString(e.preferredDate) ??
    (cleanString(e.dateRange)
      ? language === "de"
        ? `Zeitraum: ${cleanString(e.dateRange)}`
        : `Time frame: ${cleanString(e.dateRange)}`
      : null);

  const place = cleanString(e.locationName);
  const delivery = cleanString(e.deliveryAddress);

  type Row = { label: string; value: RowValue };
  const candidates: Row[] = [
    {
      label: language === "de" ? "Ansprechpartner" : "Contact",
      value: cleanString(e.contactName),
    },
    {
      label: language === "de" ? "E-Mail" : "Email",
      value: cleanString(e.email),
    },
    {
      label: language === "de" ? "Telefon" : "Phone",
      value: cleanString(e.phone),
    },
    {
      label: language === "de" ? "Firma" : "Company",
      value: cleanString(e.companyName),
    },
    {
      label: language === "de" ? "Personenanzahl" : "Guests",
      value: e.guestCount != null ? String(e.guestCount) : null,
    },
    { label: language === "de" ? "Datum / Zeitraum" : "Date / time frame", value: dateValue },
    {
      label: language === "de" ? "Uhrzeit" : "Time",
      value: cleanString(e.timeSlot),
    },
    {
      label: language === "de" ? "Anlass" : "Occasion",
      value: cleanString(e.eventType),
    },
    { label: language === "de" ? "Ort" : "Location", value: place },
    {
      label: language === "de" ? "Lieferadresse" : "Delivery address",
      value: delivery,
    },
    {
      label: language === "de" ? "Speisenwünsche" : "Food preferences",
      value: cleanString(e.foodPreferences),
    },
    {
      label:
        language === "de"
          ? "Besondere Anforderungen"
          : "Special requirements",
      value: cleanString([
        ...(Array.isArray(e.dietaryRequirements) ? e.dietaryRequirements : []),
        ...(Array.isArray(e.serviceNeeds) ? e.serviceNeeds : []),
        ...(Array.isArray(e.equipmentNeeds) ? e.equipmentNeeds : []),
      ]),
    },
  ];

  const rows = candidates.filter((r) => r.value && r.value.length > 0);

  if (attachmentCount > 0) {
    rows.push({
      label: language === "de" ? "Anhänge" : "Attachments",
      value:
        attachmentCount === 1
          ? language === "de"
            ? "1 Datei"
            : "1 file"
          : language === "de"
            ? `${attachmentCount} Dateien`
            : `${attachmentCount} files`,
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-background p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {language === "de" ? "Ihre Anfrage bisher" : "Your request so far"}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {language === "de"
              ? "Noch keine konkreten Angaben erkannt."
              : "No concrete details yet."}
          </p>
        ) : (
          <dl className="space-y-1">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
                <dd
                  className="truncate text-right text-foreground"
                  title={r.value ?? undefined}
                >
                  {r.value}
                </dd>
              </div>
            ))}
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
          {language === "de" ? "Noch benötigt" : "Still needed"}
        </div>
        {missing.length === 0 ? (
          <p className="text-sm text-foreground">
            {language === "de"
              ? "Alle Angaben für die Anfrage liegen vor."
              : "All details for the request are present."}
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-foreground">
              {language === "de"
                ? "Damit STORIA Ihre Anfrage prüfen kann, fehlen noch:"
                : "So STORIA can review your request, we still need:"}
            </p>
            <ul className="space-y-1 text-sm text-foreground">
              {missing.map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-foreground"
                  />
                  {MISSING_LABELS[m]?.[language] ?? m}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}