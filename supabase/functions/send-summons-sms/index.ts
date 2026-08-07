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

    const {
      summons_id,
      person_phone,
      person_name,
      station_name,
      station_phone,
      summon_date,
      summon_time,
      reason,
      case_number,
    } = await req.json();

    if (!person_phone || !station_name || !summon_date || !reason) {
      return new Response(
        JSON.stringify({ success: false, error: "person_phone, station_name, summon_date, reason are required" }),
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

    const normalized = normalizePhone(person_phone);
    const namePrefix = person_name ? `${person_name}, ` : "";
    const dateStr = new Date(summon_date + "T00:00:00").toLocaleDateString("en-KE", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
    const timeStr = summon_time ? ` at ${summon_time}` : "";
    const caseTag = case_number ? ` (Ref: ${case_number})` : "";
    const contact = station_phone ? ` Contact: ${station_phone}.` : "";
    const trimmedReason = String(reason).slice(0, 200);

    const finalMessage = `POLICE SUMMONS: ${namePrefix}you are required to appear at ${station_name} on ${dateStr}${timeStr}${caseTag}. Reason: ${trimmedReason}.${contact} Failure to attend may result in further action.`.slice(0, 480);

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

    if (summons_id) {
      await supabase
        .from("incident_summons")
        .update({
          sms_sent: success,
          sms_sent_at: success ? new Date().toISOString() : null,
          sms_response: smsResult ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", summons_id);
    }

    return new Response(
      JSON.stringify({
        success,
        response: smsResult,
        sent_message: finalMessage,
        summons_id: summons_id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-summons-sms error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
