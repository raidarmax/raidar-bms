import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Signature, X-Timestamp",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const rawBody = await req.text();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRows } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("category", "identity_kyc");

    const settings = new Map<string, string>();
    for (const row of settingsRows ?? []) {
      settings.set(row.key as string, (row.value as string) ?? "");
    }

    const webhookSecret = settings.get("didit_webhook_secret")?.trim() ?? "";
    if (webhookSecret) {
      const provided = req.headers.get("x-signature") ?? req.headers.get("x-didit-signature") ?? "";
      const expected = await hmacSha256Hex(webhookSecret, rawBody);
      if (!provided || !timingSafeEqual(provided.replace(/^sha256=/, ""), expected)) {
        return json({ error: "Invalid signature" }, 401);
      }
    }

    let payload: Record<string, unknown> = {};
    try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const sessionId = pickString(payload, ["session_id", "sessionId", "id"]);
    const vendorData = pickString(payload, ["vendor_data", "vendorData"]);
    const status = pickString(payload, ["status", "session_status"]);
    const decision = pickString(payload, ["decision", "final_decision"]);

    if (!sessionId && !vendorData) {
      return json({ error: "Payload missing session_id and vendor_data" }, 400);
    }

    const extracted = extractIdentityFields(payload);
    const riskFlags = extractRiskFlags(payload);
    const faceMatch = extractNumber(payload, ["face_match_score", "faceMatchScore", "face_match", "similarity_score"]);
    const liveness = extractNumber(payload, ["liveness_score", "livenessScore"]);
    const documentType = pickString(payload, ["document_type", "documentType", "id_type"]);

    const update: Record<string, unknown> = {
      status: status ?? "Updated",
      decision: decision ?? null,
      document_type: documentType ?? null,
      extracted_data: extracted,
      risk_flags: riskFlags,
      face_match_score: faceMatch,
      liveness_score: liveness,
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    };

    const query = supabase.from("identity_verifications").update(update);
    const filtered = sessionId
      ? query.eq("session_id", sessionId)
      : query.eq("vendor_data", vendorData!);

    const { data: rows, error: updateError } = await filtered.select();
    if (updateError) throw updateError;

    if (rows && rows.length > 0 && (status?.toLowerCase() === "approved" || decision?.toLowerCase() === "approved")) {
      for (const row of rows) {
        await applyApprovalToSubject(supabase, row, extracted);
      }
    }

    return json({ ok: true, matched: rows?.length ?? 0 }, 200);
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

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function extractNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return null;
}

function extractIdentityFields(payload: Record<string, unknown>): Record<string, unknown> {
  const idBlocks = (payload.id_verifications as unknown[] | undefined) ?? [];
  const first = Array.isArray(idBlocks) && idBlocks.length > 0 ? idBlocks[0] as Record<string, unknown> : null;
  const decisionData = first?.decision as Record<string, unknown> | undefined;
  const info = (decisionData?.document_data ?? first?.document_data ?? {}) as Record<string, unknown>;
  const inline = (payload.document_data ?? payload.extracted ?? {}) as Record<string, unknown>;
  return { ...inline, ...info };
}

function extractRiskFlags(payload: Record<string, unknown>): unknown[] {
  const warnings = payload.warnings;
  if (Array.isArray(warnings)) return warnings;
  const aml = payload.aml_screenings;
  if (Array.isArray(aml)) return aml;
  return [];
}

async function applyApprovalToSubject(
  supabase: ReturnType<typeof createClient>,
  row: Record<string, unknown>,
  extracted: Record<string, unknown>,
) {
  const subjectType = row.subject_type as string;
  const subjectId = row.subject_id as string | null;
  if (!subjectId) return;

  const idNumber = (extracted.document_number ?? extracted.id_number ?? extracted.national_id ?? extracted.number) as string | undefined;

  if (subjectType === "owner") {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (idNumber) updates.national_id = idNumber;
    await supabase.from("owners").update(updates).eq("id", subjectId);
  } else if (subjectType === "rider") {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (idNumber) updates.national_registration_number = idNumber;
    await supabase.from("riders").update(updates).eq("id", subjectId);
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
