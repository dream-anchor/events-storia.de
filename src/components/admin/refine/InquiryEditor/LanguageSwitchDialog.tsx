import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Languages } from "lucide-react";
import type { CustomerLang } from "./CustomerLanguageSelector";

const LANG_META: Record<CustomerLang, { flag: string; label: string }> = {
  de: { flag: "🇩🇪", label: "Deutsch" },
  en: { flag: "🇬🇧", label: "Englisch" },
  it: { flag: "🇮🇹", label: "Italienisch" },
  fr: { flag: "🇫🇷", label: "Französisch" },
};

export interface TranslationScope {
  coverLetter: boolean;
  customerMessage: boolean;
  menu: boolean;
  packageDesc: boolean;
}

export interface LanguageSwitchAvailability {
  coverLetter: boolean;
  customerMessage: boolean;
  menu: boolean;
  packageDesc: boolean;
}

interface Props {
  open: boolean;
  currentLang: CustomerLang;
  targetLang: CustomerLang;
  available: LanguageSwitchAvailability;
  onCancel: () => void;
  onConfirm: (scope: TranslationScope, translate: boolean) => Promise<void> | void;
}

export const LanguageSwitchDialog = ({
  open,
  currentLang,
  targetLang,
  available,
  onCancel,
  onConfirm,
}: Props) => {
  const [scope, setScope] = useState<TranslationScope>({
    coverLetter: available.coverLetter,
    customerMessage: available.customerMessage,
    menu: available.menu,
    packageDesc: available.packageDesc,
  });
  const [busy, setBusy] = useState<"none" | "switch" | "translate">("none");

  const handle = async (translate: boolean) => {
    setBusy(translate ? "translate" : "switch");
    try {
      await onConfirm(scope, translate);
    } finally {
      setBusy("none");
    }
  };

  const from = LANG_META[currentLang];
  const to = LANG_META[targetLang];
  const isSameTarget = currentLang === targetLang;

  const items: { key: keyof TranslationScope; label: string; hint: string; show: boolean }[] = [
    {
      key: "coverLetter",
      label: "Anschreiben (Draft)",
      hint: "Aktueller Entwurf des Angebots-Anschreibens wird neu übersetzt.",
      show: available.coverLetter,
    },
    {
      key: "customerMessage",
      label: "AI-Kundennachricht / Kontext",
      hint: "Personalisierter AI-Text für den Kunden.",
      show: available.customerMessage,
    },
    {
      key: "menu",
      label: "Menünamen & Beschreibungen",
      hint: "Übersetzungs-Cache für die ausgewählten Menü-Items wird vorgewärmt.",
      show: available.menu,
    },
    {
      key: "packageDesc",
      label: "Paket-Beschreibung",
      hint: "Übersetzung des aktiven Pakets wird vorgewärmt.",
      show: available.packageDesc,
    },
  ].filter((i) => i.show);

  const anyAvailable = items.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && busy === "none") onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Sprache wechseln auf {to.flag} {to.label}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Aktuell: <span className="font-medium">{from.flag} {from.label}</span> → Neu: <span className="font-medium">{to.flag} {to.label}</span>
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  Bereits <strong>versendete E-Mails</strong> und <strong>abgeschickte Angebotsversionen</strong> bleiben unverändert (immutable). Nur der aktuelle Draft wird angepasst.
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {anyAvailable && !isSameTarget && targetLang !== "de" && (
          <div className="space-y-2 py-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Was soll mit-übersetzt werden?
            </p>
            <div className="space-y-2">
              {items.map((it) => (
                <label
                  key={it.key}
                  className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={scope[it.key]}
                    onCheckedChange={(c) => setScope((s) => ({ ...s, [it.key]: c === true }))}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{it.label}</div>
                    <div className="text-xs text-muted-foreground">{it.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {targetLang === "de" && (
          <p className="text-xs text-muted-foreground">
            Beim Wechsel zurück auf Deutsch wird keine Übersetzung gestartet — die deutschen Originaltexte werden weiterverwendet.
          </p>
        )}

        <AlertDialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy !== "none"}>
            Abbrechen
          </Button>
          <Button variant="outline" onClick={() => handle(false)} disabled={busy !== "none"}>
            {busy === "switch" ? "Wechsle…" : "Nur Sprache wechseln"}
          </Button>
          {targetLang !== "de" && anyAvailable && (
            <Button onClick={() => handle(true)} disabled={busy !== "none"}>
              {busy === "translate" ? "Übersetze…" : "Sprache wechseln & übersetzen"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};