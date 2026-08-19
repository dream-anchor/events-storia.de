import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const MAESTRO_SCRIPT_SRC = "https://api.maestro.cloud/api/public/widgets/v1/maestro.js";

/** Loads the MAESTRO widget loader script exactly once per page. */
const ensureMaestroScript = () => {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${MAESTRO_SCRIPT_SRC}"]`)) return;

  const script = document.createElement("script");
  script.src = MAESTRO_SCRIPT_SRC;
  script.defer = true;
  document.body.appendChild(script);
};

interface MaestroWidgetProps {
  /** MAESTRO widget UUID (data-maestro-widget) */
  widgetId: string;
  className?: string;
}

/**
 * Renders an externally hosted MAESTRO form widget.
 * The widget script injects natively via Shadow DOM (no iframe) and inherits
 * body font + primary button color from the page.
 */
const MaestroWidget = ({ widgetId, className }: MaestroWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureMaestroScript();
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
