import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AdminLoaderProps {
  message?: string;
  /** Show a timeout error after N ms. Set to 0 to disable. Default: 12000. */
  timeoutMs?: number;
}

/**
 * Single unified loading state for the entire admin area.
 * Replaces multiple inconsistent spinners (Maestro logo + bare "Laden..." text).
 *
 * After `timeoutMs` it shows an error state with reload / login buttons so the
 * UI never hangs indefinitely on stalled auth/session checks.
 */
export const AdminLoader = ({
  message = "Maestro wird geladen …",
  timeoutMs = 12000,
}: AdminLoaderProps) => {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!timeoutMs) return;
    const t: ReturnType<typeof setTimeout> = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  if (timedOut) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101922] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="bg-primary size-12 rounded-lg flex items-center justify-center text-white font-bold">
            M
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Maestro</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Maestro konnte nicht vollständig geladen werden. Bitte laden Sie
              die Seite neu oder melden Sie sich erneut an.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition"
            >
              Neu laden
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
              className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition"
            >
              Zur Anmeldung
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101922] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-primary size-12 rounded-lg flex items-center justify-center text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">Maestro</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoader;