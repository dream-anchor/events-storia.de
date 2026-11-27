// HTTP-Schicht von lexoffice-positions-report; Abhängigkeiten werden hereingereicht (testbar).
import { getCorsHeaders } from "./cors.ts";
import { type Deps, fetchVouchers, LexofficeAuthError, parseRequest } from "./lexofficePositions.ts";

export interface HandlerDeps extends Omit<Deps, "apiKey"> {
  /** Liefert die Rolle des Aufrufers; wirft einen Fehler mit status 401/403 ohne gültige Anmeldung. */
  authorize: (req: Request) => Promise<{ role: string }>;
  apiKey: () => string | undefined;
}

export function createHandler(deps: HandlerDeps) {
  return async (req: Request): Promise<Response> => {
    const cors = getCorsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });

    try {
      const { role } = await deps.authorize(req);
      if (role !== "admin") return json({ error: "Keine Berechtigung" }, 403);
      if (req.method !== "POST") return json({ error: "Nur POST" }, 405);

      let requests;
      try {
        requests = parseRequest(await req.json());
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "Ungültige Anfrage" }, 400);
      }

      const apiKey = deps.apiKey();
      if (!apiKey) return json({ error: "LEXOFFICE_API_KEY nicht konfiguriert" }, 500);

      return json({ results: await fetchVouchers(requests, { apiKey, fetch: deps.fetch, sleep: deps.sleep }) });
    } catch (e) {
      const status = (e as { status?: unknown })?.status;
      if (status === 401 || status === 403) return json({ error: (e as Error).message }, status);
      if (e instanceof LexofficeAuthError) return json({ error: e.message }, 502);
      const message = e instanceof Error ? e.message : String(e);
      console.error("[lexoffice-positions-report]", message);
      return json({ error: message }, 500);
    }
  };
}
