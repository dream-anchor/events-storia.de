import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const MAESTRO_SCRIPT_SRC = "https://storia.schrittmacher.ai/api/public/widgets/v1/maestro.js";

/** Widget global an/aus — Fallback auf natives Formular bleibt immer aktiv. */
export const MAESTRO_WIDGET_ENABLED = true;

/** Zeit, nach der ein leerer Container als "Widget nicht gerendert" gilt. */
const RENDER_TIMEOUT_MS = 4000;

/** Loads the MAESTRO widget loader script exactly once per page. */
const ensureMaestroScript = (onError: () => void) => {
  if (typeof document === "undefined") return;

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${MAESTRO_SCRIPT_SRC}"]`
  );
  if (existing) {
    if (existing.dataset.maestroFailed === "1") onError();
    else existing.addEventListener("error", onError);
    return;
  }

  const script = document.createElement("script");
  script.src = MAESTRO_SCRIPT_SRC;
  script.defer = true;
  script.addEventListener("error", () => {
    script.dataset.maestroFailed = "1";
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
      failRef.current?.();
    };

    ensureMaestroScript(fail);

    const timer = setTimeout(() => {
      const el = containerRef.current;
      const rendered = !!el && (el.shadowRoot != null || el.childElementCount > 0);
      if (!rendered) fail();
    }, RENDER_TIMEOUT_MS);

    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [widgetId]);

  return (
    <div
      ref={containerRef}
      data-maestro-widget={widgetId}
      className={cn("w-full", className)}
    />
  );
};

export default MaestroWidget;
