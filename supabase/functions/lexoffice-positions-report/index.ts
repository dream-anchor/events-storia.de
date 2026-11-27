// Nur lesend: Rechnungs-/Angebotspositionen aus Lexoffice für die USt-Prüfung. Nur Rolle "admin".
// Aufruf (POST, mit Anmelde-Token eines Admins):
//   { "vouchers": [ { "id": "<Lexoffice-ID>", "type": "invoice" | "downpayment" | "quotation" } ] }
// Höchstens 10 Belege je Aufruf. Kein Schreibzugriff auf Datenbank oder Lexoffice.
import { requireAuth } from "../_shared/auth.ts";
import { createHandler } from "../_shared/lexofficePositionsHandler.ts";

Deno.serve(createHandler({
  authorize: requireAuth,
  apiKey: () => Deno.env.get("LEXOFFICE_API_KEY"),
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}));
