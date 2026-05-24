// Temporal-Polyfill MUSS als allererstes geladen werden (iOS Safari hat kein Temporal),
// damit Libraries wie @schedule-x/calendar beim Auswerten globalThis.Temporal vorfinden.
// Achtung: `@js-temporal/polyfill@0.5` setzt `globalThis.Temporal` NICHT automatisch —
// wir müssen den Named Export selbst auf das globale Objekt heben, sonst knallt iOS Safari
// mit "Can't find variable: Temporal".
import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";

if (typeof (globalThis as unknown as { Temporal?: unknown }).Temporal === "undefined") {
  // @ts-expect-error – Temporal ist in den TS-Libs noch nicht typisiert
  globalThis.Temporal = Temporal;
  // @ts-expect-error – toTemporalInstant ist eine Stage-3-Erweiterung von Date.prototype
  Date.prototype.toTemporalInstant = toTemporalInstant;
}
import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { reportError } from "./lib/reportError";

// Cleanup: alte Service Worker entfernen, die im Cache stale JS-Bundles
// halten und auf Mobile zur weißen Seite führen können (vor allem im Maestro).
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister().catch(() => undefined)))
    .catch(() => undefined);
}

// Globale Fehler-Listener — meldet uncaught errors an System-Health
if (typeof window !== "undefined" && import.meta.env.PROD) {
  window.addEventListener("error", (event) => {
    reportError({
      source: "frontend:window.error",
      severity: "error",
      message: event.message || String(event.error),
      payload: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportError({
      source: "frontend:unhandledrejection",
      severity: "error",
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);
