import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const MAESTRO_SCRIPT_SRC = "https://storia.schrittmacher.ai/api/public/widgets/v1/maestro.js";
const MAESTRO_API_BASE = "https://storia.schrittmacher.ai";

/** Widget global an/aus — Fallback auf natives Formular bleibt immer aktiv. */
export const MAESTRO_WIDGET_ENABLED = true;

/** Zeit, nach der ein leerer Container als "Widget nicht gerendert" gilt. */
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

    // Nächster Frame: Container ist dann sicher im DOM und sichtbar.
    const raf = requestAnimationFrame(() => requestMaestroScan(fail));

    const timer = setTimeout(() => {
      const el = containerRef.current;
      const rendered = !!el && (el.shadowRoot != null || el.childElementCount > 0);
      if (!rendered) fail();
    }, RENDER_TIMEOUT_MS);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [widgetId]);

  return (
    <div
      ref={containerRef}
      data-maestro-widget={widgetId}
      data-maestro-api={MAESTRO_API_BASE}
      className={cn("w-full", className)}
    />
  );
};

export default MaestroWidget;
