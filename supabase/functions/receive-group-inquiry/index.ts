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

    // Rate limiting: max 5 per email in 60 minutes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("group_inquiries")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email.toLowerCase().trim())
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: inquiry, error: insertError } = await supabase
      .from("group_inquiries")
      .insert({
        company_name: data.companyName || null,
        contact_name: data.contactName,
        email: data.email.toLowerCase().trim(),
        phone: data.phone || null,
        group_size: data.groupSize,
        preferred_date: data.preferredDate || null,
        preferred_date_flexible: data.preferredDateFlexible ?? false,
        arrival_time: data.arrivalTime || null,
        preferred_menu: data.preferredMenu || null,
        message: data.message || null,
        language: data.language || "de",
        source: data.source || "ristorantestoria.de/reisegruppen",
        status: "new",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
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
