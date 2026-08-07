import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BULK_KE_API = "https://api.bulk.ke/sms/sendsms";

function normalizePhone(phone: string): string {
  const stripped = phone.replace(/\s+/g, "").replace(/^\+/, "");
  if (stripped.startsWith("0")) return "254" + stripped.slice(1);
  if (stripped.startsWith("254")) return stripped;
  return "254" + stripped;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { rider_phone, message, incident_id, response_type } = await req.json();

    if (!rider_phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "rider_phone and message are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: dbSettings } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("category", "sms")
      .in("key", ["bulkke_api_key", "bulkke_sender_name"]);

    const settingsMap: Record<string, string> = {};
    for (const row of dbSettings ?? []) {
      settingsMap[row.key] = row.value;
    }

    const apiKey = settingsMap["bulkke_api_key"] || Deno.env.get("BULKKE_API_KEY");
    const senderName = settingsMap["bulkke_sender_name"] || Deno.env.get("BULKKE_SENDER_NAME") || "SALAMA";

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "SMS service is not configured." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalized = normalizePhone(rider_phone);
    const prefix = response_type
      ? `BMS ${String(response_type).toUpperCase()}: `
      : "BMS UPDATE: ";
    const truncated = String(message).slice(0, 480);
    const finalMessage = `${prefix}${truncated}`;

    const smsRes = await fetch(BULK_KE_API, {
      method: "POST",
      headers: { "h_api_key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile: normalized,
        sender_name: senderName,
        message: finalMessage,
        service_id: 0,
        response_type: "json",
      }),
    });

    const smsData = await smsRes.json();
    const smsResult = Array.isArray(smsData) ? smsData[0] : smsData;
    const success = String(smsResult?.status_code) === "1000";

    return new Response(
      JSON.stringify({
        success,
        response: smsResult,
        incident_id: incident_id ?? null,
        sent_message: finalMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-incident-message-sms error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
