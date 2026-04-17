/**
 * SaveStatusBadge
 *
 * Zentraler, dezenter Save-Status-Indikator im Admin-Header.
 * Zeigt den Zustand an, der aggregiert aus allen aktiven Editoren kommt.
 *
 * States:
 *   idle    → "Alle Änderungen gespeichert" (grau, unauffällig)
 *   saving  → "Speichere…" (mit kleinem Spinner)
 *   saved   → "Gespeichert" (grün, 2s sichtbar)
 *   error   → "Fehler beim Speichern" (rot, persistent, klickbar für Retry)
 *
 * Wenn keine Editoren aktiv sind (kein Register), ist das Badge unsichtbar.
 */
import { Check, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { useSaveStatus } from "./SaveStatusContext";
import { cn } from "@/lib/utils";

export function SaveStatusBadge() {
  const { status, errorMessage, hasActiveEditors, flushAll } = useSaveStatus();

  // Unsichtbar wenn kein Editor aktiv ist
  if (!hasActiveEditors) return null;

  if (status === 'saving') {
    return (
      <div
        className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground"
        title="Speichere automatisch …"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Speichere …</span>
      </div>
    );
  }

  if (status === 'saved') {
    return (
      <div
        className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 animate-in fade-in-0 duration-200"
        title="Änderungen wurden gespeichert"
      >
        <Check className="h-3 w-3" />
        <span>Gespeichert</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={() => flushAll()}
        className={cn(
          "hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
          "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
          "hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer",
        )}
        title={errorMessage ? `Fehler: ${errorMessage} — Klicken zum erneuten Versuchen` : 'Klicken zum erneuten Versuchen'}
      >
        <CloudOff className="h-3 w-3" />
        <span>Speichern fehlgeschlagen</span>
        <RefreshCw className="h-3 w-3 ml-1" />
      </button>
    );
  }

  // idle: unsichtbar. Das graue "Automatisch gespeichert" war optisch stoerend,
  // weil es zwischen den gruenen "Gespeichert"-Flashes durchflackerte (Blink-Bug).
  // Google-Docs-Prinzip: kein Indikator = alles ruhig, kein Statuswechsel.
  return null;
}
