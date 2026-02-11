import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DOMAIN = "events-storia.de";
const INDEXNOW_KEY = Deno.env.get("INDEXNOW_KEY") || "";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";

interface IndexNowRequest {
  urlList: string[];
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!INDEXNOW_KEY) {
      console.error("[IndexNow] INDEXNOW_KEY not set in environment");
      return new Response(
        JSON.stringify({ error: "INDEXNOW_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { urlList } = (await req.json()) as IndexNowRequest;

    if (!urlList || !Array.isArray(urlList) || urlList.length === 0) {
      return new Response(
        JSON.stringify({ error: "urlList must be a non-empty array of URLs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure all URLs are absolute
    const absoluteUrls = urlList.map((url) =>
      url.startsWith("http") ? url : `https://${DOMAIN}${url}`
    );

    // Cap at 10,000 URLs per IndexNow spec
    const batch = absoluteUrls.slice(0, 10000);

    const payload = {
      host: DOMAIN,
      key: INDEXNOW_KEY,
      keyLocation: `https://${DOMAIN}/${INDEXNOW_KEY}.txt`,
      urlList: batch,
    };

    console.log(`[IndexNow] Submitting ${batch.length} URLs to IndexNow...`);

    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const statusCode = response.status;
    const responseText = await response.text();

    // Log response per spec
    const statusMessages: Record<number, string> = {
      200: "OK — URLs submitted successfully",
      202: "Accepted — URLs received, will be processed later",
      400: "Bad Request — invalid format",
      403: "Forbidden — key not valid or does not match",
      422: "Unprocessable Entity — URLs don't belong to host or key not found at keyLocation",
      429: "Too Many Requests — rate limited",
    };

    const statusMessage =
      statusMessages[statusCode] || `Unknown status: ${statusCode}`;
    console.log(
      `[IndexNow] Response: ${statusCode} — ${statusMessage}`,
      responseText ? `Body: ${responseText}` : ""
    );

    return new Response(
      JSON.stringify({
        success: statusCode === 200 || statusCode === 202,
        statusCode,
        statusMessage,
        urlsSubmitted: batch.length,
        response: responseText || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[IndexNow] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
