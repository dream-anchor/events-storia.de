/**
 * Admin-Download für das signierte PDF einer Kostenübernahme.
 * Gibt eine kurz gültige signed URL aus dem privaten Bucket zurück.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
    const { cost_acceptance_id } = await req.json();
    if (!cost_acceptance_id) throw new Error("cost_acceptance_id fehlt");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: row } = await supabase
      .from("cost_acceptances")
      .select("signed_pdf_storage_path")
      .eq("id", cost_acceptance_id)
      .maybeSingle();
    if (!row?.signed_pdf_storage_path) {
      throw new Error("Kein signiertes PDF vorhanden");
    }
    const { data: signed, error } = await supabase.storage
      .from("cost-acceptances")
      .createSignedUrl(row.signed_pdf_storage_path, 300);
    if (error || !signed) throw error ?? new Error("Signed URL failed");

    return new Response(JSON.stringify({ url: signed.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});