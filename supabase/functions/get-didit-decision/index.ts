import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json().catch(() => ({ session_id: "" }));
    if (!session_id || typeof session_id !== "string") {
      return json({ error: "session_id is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("category", "identity_kyc");

    const settings = new Map<string, string>();
    for (const row of settingsRows ?? []) settings.set(row.key, (row.value as string) ?? "");

    const apiKey = settings.get("didit_api_key")?.trim();
    if (!apiKey) return json({ error: "Didit API key is not configured" }, 500);

    const baseUrl = (settings.get("didit_api_base_url") ?? "https://verification.didit.me").replace(/\/$/, "");

    const res = await fetch(`${baseUrl}/v3/session/${encodeURIComponent(session_id)}/decision/`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
    const text = await res.text();
    let payload: Record<string, unknown> = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text }; }

    if (!res.ok) return json({ error: "Didit rejected retrieval", status: res.status, details: payload }, 502);

    const status = typeof payload.status === "string" ? payload.status : "Updated";
    const decision = typeof payload.decision === "string" ? payload.decision : null;

    await supabase
      .from("identity_verifications")
      .update({
        status,
        decision,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", session_id);

    return json({ status, decision, payload }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
