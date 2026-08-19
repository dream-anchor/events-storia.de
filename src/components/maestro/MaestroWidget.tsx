import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const MAESTRO_SCRIPT_SRC = "https://storia.schrittmacher.ai/api/public/widgets/v1/maestro.js";
const MAESTRO_API_BASE = "https://storia.schrittmacher.ai";

/** Widget global an/aus — Fallback auf natives Formular bleibt immer aktiv. */
export const MAESTRO_WIDGET_ENABLED = true;

/** Zeit, nach der ein sichtbarer, aber leerer Container als "nicht gerendert" gilt. */
const RENDER_TIMEOUT_MS = 8000;

/**
 * Merkt sich pro Seitenaufruf, dass das Widget nicht verfügbar ist
 * (z. B. Origin nicht freigeschaltet oder Skript nicht erreichbar),
 * damit weitere Formulare sofort das native Formular zeigen.
 */
let maestroUnavailable = false;
export const isMaestroUnavailable = () => maestroUnavailable;

let scriptFailed = false;
let scanCounter = 0;

/**
 * Der MAESTRO-Loader scannt das DOM nur einmal beim Laden. Container, die
 * später erscheinen (z. B. in einem Dialog), werden deshalb nie gerendert.
 * Wir stoßen daher pro Mount einen neuen Scan an, indem wir den Loader-Guard
 * zurücksetzen und das Skript erneut einhängen (aus dem Cache, kein Traffic).
 */
const requestMaestroScan = (onError: () => void) => {
  if (typeof document === "undefined") return;
  if (scriptFailed) {
    onError();
    return;
  }

  try {
    delete (window as unknown as Record<string, unknown>).__maestroWidgetLoader;
  } catch {
    /* ignore */
  }

  const script = document.createElement("script");
  script.src = `${MAESTRO_SCRIPT_SRC}?s=${++scanCounter}`;
  script.async = false;
  script.addEventListener("error", () => {
    scriptFailed = true;
    onError();
  });
  document.body.appendChild(script);
};

interface MaestroWidgetProps {
  /** MAESTRO widget UUID (data-maestro-widget) */
  widgetId: string;
  className?: string;
  /** Wird aufgerufen, wenn das Widget nicht lädt/rendert → natives Formular anzeigen. */
  onUnavailable?: () => void;
}

/**
 * Renders an externally hosted MAESTRO form widget.
 * The widget script injects natively via Shadow DOM (no iframe) and inherits
 * body font + primary button color from the page.
 *
 * Wichtige Implementierungs-Details:
 * - Der Container bekommt eine Mindesthöhe, damit der IntersectionObserver des
 *   MAESTRO-Skripts (rootMargin 200px) greift. Ein 0px hoher, leerer Container
 *   hat keine Schnittmenge mit dem Viewport → das Skript würde nie rendern.
 * - Der Fallback-Timer startet erst, wenn der Container tatsächlich sichtbar
 *   geworden ist. Below-the-fold Formulare (z. B. Kontaktformular am Seitenende)
 *   laden lazily beim Scrollen und dürfen nicht vorzeitig auf das native
 *   Formular zurückfallen, nur weil der Nutzer noch nicht gescrollt hat.
 */
const MaestroWidget = ({ widgetId, className, onUnavailable }: MaestroWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const failRef = useRef(onUnavailable);
  failRef.current = onUnavailable;

  useEffect(() => {
    let done = false;
    const fail = () => {
      if (done) return;
      done = true;
      maestroUnavailable = true;
      failRef.current?.();
    };

    // Nächster Frame: Container ist dann sicher im DOM.
    const raf = requestAnimationFrame(() => requestMaestroScan(fail));

    // Sichtbarkeits-gesteuerter Fallback: Der Timer startet erst, wenn der
    // Container in den Viewport scrollt (bzw. im Dialog sofort sichtbar ist).
    // Ist er nach RENDER_TIMEOUT_MS noch immer leer → natives Formular.
    let visibleTimer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            if (visibleTimer != null) break;
            visibleTimer = setTimeout(() => {
              const el = containerRef.current;
              const rendered = !!el && (el.shadowRoot != null || el.childElementCount > 0);
              if (!rendered) fail();
            }, RENDER_TIMEOUT_MS);
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    if (containerRef.current) io.observe(containerRef.current);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      if (visibleTimer) clearTimeout(visibleTimer);
      io.disconnect();
    };
  }, [widgetId]);

  return (
    <div
      ref={containerRef}
      data-maestro-widget={widgetId}
      data-maestro-api={MAESTRO_API_BASE}
      className={cn("w-full min-h-[420px]", className)}
    />
  );
};

export default MaestroWidget;
