import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://ristorantestoria.de",
  "https://www.ristorantestoria.de",
  "https://events-storia.de",
  "https://www.events-storia.de",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const isLocalhost = origin.startsWith("http://localhost:");
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isLocalhost;
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

interface GroupInquiryRequest {
  companyName?: string;
  contactName: string;
  email: string;
  phone?: string;
  groupSize: number;
  preferredDate?: string;
  preferredDateFlexible?: boolean;
  arrivalTime?: string;
  preferredMenu?: string;
  message?: string;
  language?: string;
  source?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: GroupInquiryRequest = await req.json();

    // Validate required fields
    if (!data.contactName || !data.email || !data.groupSize) {
      return new Response(
        JSON.stringify({ error: "contactName, email und groupSize sind erforderlich" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (typeof data.groupSize !== "number" || data.groupSize < 1) {
      return new Response(
        JSON.stringify({ error: "groupSize muss eine positive Zahl sein" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limiting: max 5 group-event inquiries per email in 60 minutes
    const email = data.email.toLowerCase().trim();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rlCustomers } = await supabase
      .from("v2_customers")
      .select("id")
      .ilike("email", email);
    const rlIds = (rlCustomers ?? []).map((c: any) => c.id);
    let count = 0;
    if (rlIds.length > 0) {
      const { count: c } = await supabase
        .from("v2_events")
        .select("id", { count: "exact", head: true })
        .eq("service_type", "group")
        .in("customer_id", rlIds)
        .gte("created_at", oneHourAgo);
      count = c ?? 0;
    }

    if (count >= 5) {
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Kunde finden (per E-Mail) oder anlegen
    let customerId: string | null = null;
    {
      const { data: existing } = await supabase
        .from("v2_customers")
        .select("id")
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: created, error: cErr } = await supabase
          .from("v2_customers")
          .insert({
            name: data.contactName || email,
            company: data.companyName || null,
            email,
            phone: data.phone || null,
          })
          .select("id")
          .single();
        if (cErr) throw new Error(`Customer error: ${cErr.message}`);
        customerId = created!.id;
      }
    }

    const { data: inquiry, error: insertError } = await supabase
      .from("v2_events")
      .insert({
        customer_id: customerId,
        status: "inquiry",
        service_type: "group",
        source: "reisegruppen",
        date: data.preferredDate || null,
        event_time: data.arrivalTime || null,
        guest_count: data.groupSize,
        occasion: "Reisegruppe",
        customer_notes: data.message || null,
        language: data.language || "de",
        arrival_time: data.arrivalTime || null,
        preferred_menu: data.preferredMenu || null,
        preferred_date_flexible: data.preferredDateFlexible ?? false,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    const { error: markerError } = await supabase
      .from("v2_events")
      .update({ source_inquiry_id: inquiry.id })
      .eq("id", inquiry.id);

    if (markerError) {
      console.error("Compatibility marker error:", markerError);
      throw new Error(`Database error: ${markerError.message}`);
    }

    console.log("Group inquiry saved:", inquiry.id);

    return new Response(
      JSON.stringify({ success: true, id: inquiry.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in receive-group-inquiry:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
