import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type SubjectType = "owner" | "rider" | "officer" | "prospect" | "business";

type CreateSessionPayload = {
  subject_type: SubjectType;
  subject_id?: string | null;
  role?: "rider" | "owner" | "business";
  vendor_data?: string;
  callback?: string;
  language?: string;
  contact_details?: {
    email?: string;
    phone?: string;
    send_notification_emails?: boolean;
  };
  expected_details?: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    id_country?: string;
    expected_document_types?: string[];
  };
  metadata?: Record<string, unknown>;
  created_by?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = (await req.json()) as CreateSessionPayload;
    if (!body?.subject_type) {
      return json({ error: "subject_type is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("category", "identity_kyc");

    if (settingsError) throw settingsError;

    const settings = new Map<string, string>();
    for (const row of settingsRows ?? []) {
      settings.set(row.key as string, (row.value as string) ?? "");
    }

    const enabled = (settings.get("didit_enabled") ?? "true").toLowerCase() === "true";
    if (!enabled) {
      return json({ error: "Didit KYC is disabled in system settings" }, 400);
    }

    const apiKey = settings.get("didit_api_key")?.trim();
    if (!apiKey) return json({ error: "Didit API key is not configured" }, 500);

    const baseUrl = (settings.get("didit_api_base_url") ?? "https://verification.didit.me").replace(/\/$/, "");

    const role = body.role ?? (body.subject_type === "rider" ? "rider" : body.subject_type === "business" ? "business" : "owner");
    const workflowKey =
      role === "rider" ? "didit_workflow_id_rider"
      : role === "business" ? "didit_workflow_id_business"
      : "didit_workflow_id_owner";

    const workflowId = settings.get(workflowKey)?.trim();
    if (!workflowId) {
      return json({ error: `Didit workflow is not configured (${workflowKey}). Set it in Admin Settings.` }, 500);
    }

    const vendorData = body.vendor_data?.trim() || `${body.subject_type}:${body.subject_id ?? crypto.randomUUID()}`;

    const diditPayload: Record<string, unknown> = {
      workflow_id: workflowId,
      vendor_data: vendorData,
      language: body.language ?? "en",
    };

    if (body.callback) diditPayload.callback = body.callback;
    if (body.contact_details) diditPayload.contact_details = body.contact_details;
    if (body.expected_details) diditPayload.expected_details = body.expected_details;
    if (body.metadata) diditPayload.metadata = body.metadata;

    const diditRes = await fetch(`${baseUrl}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(diditPayload),
    });

    const diditText = await diditRes.text();
    let didit: Record<string, unknown> = {};
    try { didit = diditText ? JSON.parse(diditText) : {}; } catch { didit = { raw: diditText }; }

    if (!diditRes.ok) {
      return json({
        error: "Didit rejected the session request",
        status: diditRes.status,
        details: didit,
      }, 502);
    }

    const sessionId = String(didit.session_id ?? "");
    const sessionUrl = String(didit.url ?? "");
    const sessionToken = didit.session_token ? String(didit.session_token) : null;

    if (!sessionId || !sessionUrl) {
      return json({ error: "Didit response missing session_id or url", details: didit }, 502);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("identity_verifications")
      .insert({
        subject_type: body.subject_type,
        subject_id: body.subject_id ?? null,
        vendor_data: vendorData,
        session_id: sessionId,
        session_url: sessionUrl,
        session_token: sessionToken,
        workflow_id: workflowId,
        status: (didit.status as string) ?? "Not Started",
        raw_payload: didit,
        created_by: body.created_by ?? null,
      })
      .select()
      .maybeSingle();

    if (insertError) throw insertError;

    return json({
      session_id: sessionId,
      url: sessionUrl,
      session_token: sessionToken,
      verification_id: inserted?.id ?? null,
      vendor_data: vendorData,
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
