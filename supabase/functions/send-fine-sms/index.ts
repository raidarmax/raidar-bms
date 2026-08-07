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

function applyTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, val]) => text.replaceAll(`{${key}}`, val),
    template
  );
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

    const {
      fine_reference,
      rider_phone,
      owner_phone,
      rider_name,
      offence_name,
      fine_amount,
      station_name,
      officer_service_number,
    } = await req.json();

    if (!fine_reference || !rider_phone) {
      return new Response(
        JSON.stringify({ success: false, error: "fine_reference and rider_phone are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read SMS credentials and templates from system_settings
    const { data: dbSettings } = await supabase
      .from("system_settings")
      .select("category, key, value")
      .or("category.eq.sms,category.eq.templates")
      .in("key", ["bulkke_api_key", "bulkke_sender_name", "fine_rider_message", "fine_owner_message"]);

    const settingsMap: Record<string, string> = {};
    for (const row of dbSettings ?? []) {
      settingsMap[row.key] = row.value;
    }

    const apiKey = settingsMap["bulkke_api_key"] || Deno.env.get("BULKKE_API_KEY");
    const senderName = settingsMap["bulkke_sender_name"] || Deno.env.get("BULKKE_SENDER_NAME") || "SALAMA";

    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-KE");

    const templateVarsRider = {
      fine_reference,
      fine_amount: String(fine_amount),
      offence_name,
      due_date: dueDate,
      officer_service_number,
      station_name,
    };

    const templateVarsOwner = {
      fine_reference,
      fine_amount: String(fine_amount),
      rider_name,
      offence_name,
      due_date: dueDate,
      station_name,
    };

    const defaultRiderTemplate =
      'BMS TRAFFIC FINE: You have been issued fine {fine_reference} of KES {fine_amount} for "{offence_name}". Pay within 14 days (by {due_date}) to avoid penalties. Issued by Officer {officer_service_number}, {station_name}.';
    const defaultOwnerTemplate =
      'BMS NOTICE: A fine {fine_reference} of KES {fine_amount} has been issued to {rider_name} riding your motorcycle for "{offence_name}". Due by {due_date}. Station: {station_name}.';

    const riderMessage = applyTemplate(
      settingsMap["fine_rider_message"] || defaultRiderTemplate,
      templateVarsRider
    );
    const ownerMessage = applyTemplate(
      settingsMap["fine_owner_message"] || defaultOwnerTemplate,
      templateVarsOwner
    );

    if (!apiKey) {
      console.error("BULKKE_API_KEY is not configured in system_settings or env");
      return new Response(
        JSON.stringify({ success: false, error: "SMS service is not configured." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ recipient: string; success: boolean; response?: unknown }> = [];

    async function sendSms(phone: string, message: string, recipientType: string) {
      const normalized = normalizePhone(phone);
      const smsRes = await fetch(BULK_KE_API, {
        method: "POST",
        headers: { "h_api_key": apiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: normalized,
          sender_name: senderName,
          message,
          service_id: 0,
          response_type: "json",
        }),
      });
      const smsData = await smsRes.json();
      const smsResult = Array.isArray(smsData) ? smsData[0] : smsData;
      const success = String(smsResult?.status_code) === "1000";

      await supabase.from("fine_sms_logs").insert({
        fine_id: null,
        recipient_type: recipientType,
        phone_number: "+" + normalized,
        message_content: message,
        sms_status: success ? "sent" : "failed",
        bulk_ke_response: smsResult,
      });

      results.push({ recipient: recipientType, success, response: smsResult });
    }

    await sendSms(rider_phone, riderMessage, "rider");

    if (owner_phone && normalizePhone(owner_phone) !== normalizePhone(rider_phone)) {
      await sendSms(owner_phone, ownerMessage, "owner");
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-fine-sms error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
