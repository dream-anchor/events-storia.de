// Temporal-Polyfill MUSS als allererstes geladen werden (iOS Safari hat kein Temporal),
// damit Libraries wie @schedule-x/calendar beim Auswerten globalThis.Temporal vorfinden.
import "@js-temporal/polyfill";
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
