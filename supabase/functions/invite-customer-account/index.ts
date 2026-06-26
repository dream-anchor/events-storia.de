import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { DEFAULT_TENANT_ID } from "../_shared/tenant.ts";

interface Body {
  customerEmail: string;
  customerName?: string;
  customerId?: string; // v2_customers.id (optional, wird sonst per email gesucht)
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const { data: ud, error: ue } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !ud.user) throw new Error("Auth failed");
    const { data: role } = await supabase
      .from("user_roles").select("role").eq("user_id", ud.user.id).eq("role", "admin").single();
    if (!role) throw new Error("Admin role required");

    // Mandant des einladenden Admins (Phase 4b). Heute Storia; Fallback Default.
    const { data: callerTenant } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", ud.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const tenantId = callerTenant?.tenant_id ?? DEFAULT_TENANT_ID;

    const body: Body = await req.json();
    const email = (body.customerEmail || "").trim().toLowerCase();
    if (!email) throw new Error("customerEmail required");

    // Kunde ZUERST auflösen + Mandanten-Zugehörigkeit prüfen (vor dem Invite).
    // Verhindert, dass ein Admin einen Kunden eines anderen Mandanten einlädt.
    let customerId = body.customerId ?? null;
    let customerRow: { id: string; tenant_id: string | null } | null = null;
    if (customerId) {
      const { data: c } = await supabase.from("v2_customers")
        .select("id, tenant_id").eq("id", customerId).maybeSingle();
      customerRow = c;
    } else {
      const { data: c } = await supabase.from("v2_customers")
        .select("id, tenant_id").ilike("email", email).maybeSingle();
      customerRow = c;
      customerId = c?.id ?? null;
    }
    if (customerRow && customerRow.tenant_id && customerRow.tenant_id !== tenantId) {
      throw new Error("Kunde gehört nicht zu Ihrem Mandanten");
    }

    const origin = req.headers.get("origin") || "https://events-storia.de";

    // Einladung verschicken (Supabase Auth Admin API)
    const { data: invite, error: invErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/kundenbereich/willkommen`,
      data: { full_name: body.customerName ?? null, source: "maestro_admin_invite" },
    });

    if (invErr) {
      // Wenn der User bereits existiert, kein harter Fehler — geben wir eine sanfte Antwort zurück
      const msg = invErr.message || "";
      if (msg.toLowerCase().includes("already")) {
        return new Response(JSON.stringify({ success: false, alreadyExists: true, error: msg }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw invErr;
    }

    // v2_customers updaten
    if (customerId) {
      await supabase.from("v2_customers").update({
        account_invited_at: new Date().toISOString(),
        account_invited_by: ud.user.email ?? null,
        auth_user_id: invite.user?.id ?? null,
      }).eq("id", customerId);
    }

    // Activity Log (tenant_id im metadata bis activity_logs eine eigene Spalte hat)
    await supabase.from("activity_logs").insert({
      entity_type: "customer",
      entity_id: customerId,
      action: "account_invitation_sent",
      actor_email: ud.user.email,
      metadata: { email, auth_user_id: invite.user?.id ?? null, tenant_id: tenantId },
    });

    return new Response(JSON.stringify({ success: true, userId: invite.user?.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
