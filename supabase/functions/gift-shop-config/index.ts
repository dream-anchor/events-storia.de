// Öffentlicher Konfig-Endpunkt des Geschenkkorb-Shops. Einzige Quelle der Livegang-Freigabe ist die Server-Env
// GIFT_LEGAL_APPROVED (dieselbe, die create-gift-order für echte Bestellungen prüft); das Frontend zeigt nur an.
// Keine Geheimnisse, kein DB-Zugriff.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve((req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const testMode = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").startsWith("sk_test_");
  // Bestellbar, wenn freigegeben oder im Stripe-Testmodus (identisch zum Gate in create-gift-order)
  const legalApproved = Deno.env.get("GIFT_LEGAL_APPROVED") === "true";
  return json({ legal_approved: legalApproved, orderable: legalApproved || testMode });
});
