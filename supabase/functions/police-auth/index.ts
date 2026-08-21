import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@3.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/police-auth\/?/, "").replace(/^\//, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (path === "login" && req.method === "POST") {
      const { service_number, password } = await req.json();

      if (!service_number || typeof service_number !== "string") {
        return json({ error: "Service number is required." }, 400);
      }
      if (!password || typeof password !== "string") {
        return json({ error: "Password is required." }, 400);
      }

      const trimmed = service_number.trim().toUpperCase();

      const { data: officers, error: qErr } = await supabase
        .from("police_officers")
        .select("*, station:police_stations(*)")
        .eq("service_number", trimmed)
        .limit(1);

      if (qErr) {
        return json({ error: "Server error. Please try again." }, 500);
      }

      const officer = officers && officers.length > 0 ? officers[0] : null;
      if (!officer) {
        return json({ error: "Invalid service number or password." }, 401);
      }

      if (!officer.is_active) {
        return json({ error: "Account is deactivated. Contact your station admin." }, 403);
      }

      if (officer.locked_until && new Date(officer.locked_until) > new Date()) {
        const minutesLeft = Math.ceil(
          (new Date(officer.locked_until).getTime() - Date.now()) / 60000,
        );
        return json({ error: `Account locked. Try again in ${minutesLeft} minutes.` }, 403);
      }

      const valid = await bcrypt.compare(password, officer.password_hash);

      if (!valid) {
        const attempts = (officer.failed_login_attempts ?? 0) + 1;
        const update: Record<string, unknown> = { failed_login_attempts: attempts };
        if (attempts >= 5) {
          update.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        }
        await supabase.from("police_officers").update(update).eq("id", officer.id);
        if (attempts >= 5) {
          return json({ error: "Too many failed attempts. Account locked for 30 minutes." }, 403);
        }
        return json({ error: "Invalid service number or password." }, 401);
      }

      await supabase
        .from("police_officers")
        .update({
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: new Date().toISOString(),
        })
        .eq("id", officer.id);

      await supabase.from("police_activity_logs").insert({
        officer_id: officer.id,
        action_type: "login",
        target_type: null,
        target_id: null,
        details: { source: "mobile_app" },
      });

      const { password_hash: _ph, ...safeOfficer } = officer;
      return json({ officer: safeOfficer });
    }

    if (path === "get-officer" && req.method === "POST") {
      const { officer_id } = await req.json();
      if (!officer_id || typeof officer_id !== "string") {
        return json({ error: "officer_id is required." }, 400);
      }

      const { data: officers, error: qErr } = await supabase
        .from("police_officers")
        .select("*, station:police_stations(*)")
        .eq("id", officer_id)
        .limit(1);

      if (qErr) return json({ error: "Server error." }, 500);
      const officer = officers && officers.length > 0 ? officers[0] : null;
      if (!officer || !officer.is_active) return json({ officer: null });

      const { password_hash: _ph, ...safeOfficer } = officer;
      return json({ officer: safeOfficer });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: (err as Error).message || "Server error" }, 500);
  }
});
