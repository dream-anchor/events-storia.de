import { Languages } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CustomerLang = "de" | "en" | "it" | "fr";

const LANGS: { value: CustomerLang; flag: string; label: string; native: string }[] = [
  { value: "de", flag: "🇩🇪", label: "Deutsch", native: "Deutsch" },
  { value: "en", flag: "🇬🇧", label: "Englisch", native: "English" },
  { value: "it", flag: "🇮🇹", label: "Italienisch", native: "Italiano" },
  { value: "fr", flag: "🇫🇷", label: "Französisch", native: "Français" },
];

const BANNER_TEXT: Record<CustomerLang, string> = {
  de: "Angebotslink und alle E-Mails: nur Deutsch.",
  en: "Offer link and all emails: English only.",
  it: "Angebotslink und alle E-Mails: Italienisch + Englisch als Zweitsprache.",
  fr: "Angebotslink und alle E-Mails: Französisch + Englisch als Zweitsprache.",
};

interface Props {
  value: CustomerLang | null | undefined;
  onChange: (lang: CustomerLang) => void;
  disabled?: boolean;
}

export const CustomerLanguageSelector = ({ value, onChange, disabled }: Props) => {
  const current = (value ?? "de") as CustomerLang;
  const meta = LANGS.find((l) => l.value === current)!;

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Languages className="h-3.5 w-3.5" />
        Kundensprache
      </Label>
      <Select value={current} onValueChange={(v) => onChange(v as CustomerLang)} disabled={disabled}>
        <SelectTrigger className="h-11 bg-muted/30 dark:bg-gray-800 border-border/60 rounded-lg">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="text-base leading-none">{meta.flag}</span>
              <span>{meta.label}</span>
              <span className="text-muted-foreground text-xs">({meta.native})</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {LANGS.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{l.flag}</span>
                <span>{l.label}</span>
                <span className="text-muted-foreground text-xs">({l.native})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {BANNER_TEXT[current]}
      </p>
    </div>
  );
};