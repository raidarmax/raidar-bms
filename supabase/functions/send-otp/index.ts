import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BULK_KE_API = "https://api.bulk.ke/sms/sendsms";

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 900000 + 100000);
}

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

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return ok({ success: false, error: "Method not allowed" });
  }

  try {
    const { phone } = await req.json();

    if (!phone || typeof phone !== "string") {
      return ok({ success: false, error: "phone is required" });
    }

    const normalizedPhone = normalizePhone(phone);

    if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
      return ok({ success: false, error: "Invalid Kenyan phone number. Use format: 0712345678 or +254712345678" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read SMS credentials and OTP template from system_settings
    const { data: dbSettings } = await supabase
      .from("system_settings")
      .select("category, key, value")
      .or("category.eq.sms,category.eq.templates")
      .in("key", ["bulkke_api_key", "bulkke_sender_name", "otp_expiry_minutes", "otp_message"]);

    const settingsMap: Record<string, string> = {};
    for (const row of dbSettings ?? []) {
      settingsMap[row.key] = row.value;
    }

    const apiKey = settingsMap["bulkke_api_key"] || Deno.env.get("BULKKE_API_KEY");
    const senderName = settingsMap["bulkke_sender_name"] || Deno.env.get("BULKKE_SENDER_NAME") || "SALAMA";
    const expiryMinutes = Number(settingsMap["otp_expiry_minutes"] ?? "10");

    if (!apiKey) {
      console.error("BULKKE_API_KEY is not configured in system_settings or env");
      return ok({ success: false, error: "SMS service is not configured. Please contact support." });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();

    // Invalidate any existing unused OTPs for this phone
    await supabase
      .from("phone_otps")
      .update({ verified: true })
      .eq("phone_number", "+" + normalizedPhone)
      .eq("verified", false);

    const { error: insertError } = await supabase.from("phone_otps").insert({
      phone_number: "+" + normalizedPhone,
      otp_code: otp,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("DB insert error:", insertError);
      return ok({ success: false, error: "Failed to create OTP record" });
    }

    // Build message from template (fall back to hardcoded default)
    const defaultTemplate =
      "Your SALAMA BMS verification code is: {otp}\n\nThis code expires in {expiry_minutes} minutes. Do not share it with anyone.";
    const template = settingsMap["otp_message"] || defaultTemplate;
    const message = applyTemplate(template, {
      otp,
      expiry_minutes: String(expiryMinutes),
    });

    const smsRes = await fetch(BULK_KE_API, {
      method: "POST",
      headers: {
        "h_api_key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile: normalizedPhone,
        sender_name: senderName,
        message,
        service_id: 0,
        response_type: "json",
      }),
    });

    const smsData = await smsRes.json();
    const smsResult = Array.isArray(smsData) ? smsData[0] : smsData;

    if (String(smsResult?.status_code) !== "1000") {
      console.error("bulk.ke SMS error:", JSON.stringify(smsResult));
      return ok({
        success: false,
        error: smsResult?.status_desc ?? "SMS delivery failed. Please try again.",
      });
    }

    return ok({ success: true });
  } catch (err) {
    console.error("send-otp error:", err);
    return ok({ success: false, error: (err as Error).message });
  }
});
