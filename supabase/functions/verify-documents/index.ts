import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type VerifyType = "national_id" | "kra_pin" | "driving_license";

interface VerifyRequest {
  type: VerifyType;
  value: string;
}

interface VerifyResult {
  verified: boolean;
  sandbox: boolean;
  name?: string;
  details?: Record<string, string>;
  error?: string;
}

function validateInput(type: VerifyType, value: string): string | null {
  const v = value.trim();
  switch (type) {
    case "national_id":
      if (!/^\d{7,8}$/.test(v)) return "National ID must be 7 or 8 digits";
      if (/^0+$/.test(v)) return "Invalid ID number";
      break;
    case "kra_pin":
      if (!/^[A-Za-z]\d{9}[A-Za-z]$/.test(v))
        return "KRA PIN must be in format A123456789B";
      break;
    case "driving_license":
      if (v.length < 4) return "Driving license number is too short";
      break;
  }
  return null;
}

async function getGavaConnectToken(clientId: string, clientSecret: string): Promise<string> {
  const baseUrl = Deno.env.get("GAVACONNECT_BASE_URL") ?? "https://developer.go.ke";
  const res = await fetch(`${baseUrl}/api/v1/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) throw new Error(`GavaConnect auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function verifyNationalId(value: string): Promise<VerifyResult> {
  const clientId = Deno.env.get("GAVACONNECT_CLIENT_ID");
  const clientSecret = Deno.env.get("GAVACONNECT_CLIENT_SECRET");

  if (!clientId || !clientSecret) return sandboxNationalId(value);

  try {
    const token = await getGavaConnectToken(clientId, clientSecret);
    const baseUrl = Deno.env.get("GAVACONNECT_BASE_URL") ?? "https://developer.go.ke";
    const res = await fetch(`${baseUrl}/api/v1/iprs/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id_number: value }),
    });

    if (res.status === 404) {
      return { verified: false, sandbox: false, error: "ID not found in IPRS register" };
    }
    if (!res.ok) throw new Error(`IPRS API error: ${res.status}`);

    const data = await res.json();
    return {
      verified: data.status === "valid" || data.valid === true,
      sandbox: false,
      name: data.full_name ?? data.name,
      details: {
        gender: data.gender ?? "",
        dob: data.date_of_birth ?? "",
        citizenship: data.citizenship ?? "Kenyan",
      },
    };
  } catch (err) {
    return { verified: false, sandbox: false, error: (err as Error).message };
  }
}

async function verifyKraPin(value: string): Promise<VerifyResult> {
  const clientId = Deno.env.get("GAVACONNECT_CLIENT_ID");
  const clientSecret = Deno.env.get("GAVACONNECT_CLIENT_SECRET");

  if (!clientId || !clientSecret) return sandboxKraPin(value);

  try {
    const token = await getGavaConnectToken(clientId, clientSecret);
    const baseUrl = Deno.env.get("GAVACONNECT_BASE_URL") ?? "https://developer.go.ke";
    const res = await fetch(`${baseUrl}/api/v1/kra/pin-verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin: value.trim().toUpperCase() }),
    });

    if (res.status === 404) {
      return { verified: false, sandbox: false, error: "KRA PIN not found" };
    }
    if (!res.ok) throw new Error(`KRA API error: ${res.status}`);

    const data = await res.json();
    return {
      verified: data.status === "active" || data.active === true,
      sandbox: false,
      name: data.taxpayer_name ?? data.name,
      details: {
        pin_status: data.pin_status ?? data.status ?? "",
        taxpayer_type: data.taxpayer_type ?? "",
        compliance_status: data.compliance_status ?? "",
      },
    };
  } catch (err) {
    return { verified: false, sandbox: false, error: (err as Error).message };
  }
}

async function verifyDrivingLicense(value: string): Promise<VerifyResult> {
  const ntsaKey = Deno.env.get("NTSA_API_KEY");
  const ntsaUrl = Deno.env.get("NTSA_API_BASE_URL") ?? "https://serviceportal.ntsa.go.ke/api";

  if (!ntsaKey) return sandboxDrivingLicense(value);

  try {
    const res = await fetch(`${ntsaUrl}/v1/license/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ntsaKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ license_number: value.trim().toUpperCase() }),
    });

    if (res.status === 404) {
      return { verified: false, sandbox: false, error: "Driving license not found in NTSA register" };
    }
    if (!res.ok) throw new Error(`NTSA API error: ${res.status}`);

    const data = await res.json();
    return {
      verified: data.status === "valid" || data.valid === true,
      sandbox: false,
      name: data.holder_name ?? data.name,
      details: {
        license_class: data.license_class ?? data.class ?? "",
        expiry_date: data.expiry_date ?? data.valid_until ?? "",
        status: data.status ?? "",
      },
    };
  } catch (err) {
    return { verified: false, sandbox: false, error: (err as Error).message };
  }
}

// Sandbox responses — used when API credentials are not configured
function sandboxNationalId(value: string): VerifyResult {
  if (/^0+$/.test(value.trim())) {
    return { verified: false, sandbox: true, error: "ID not found (sandbox mode)" };
  }
  return {
    verified: true,
    sandbox: true,
    name: "Simulated IPRS record",
    details: { gender: "—", dob: "—", citizenship: "Kenyan" },
  };
}

function sandboxKraPin(value: string): VerifyResult {
  if (!/^[A-Za-z]\d{9}[A-Za-z]$/.test(value.trim())) {
    return { verified: false, sandbox: true, error: "Invalid KRA PIN format (sandbox mode)" };
  }
  return {
    verified: true,
    sandbox: true,
    name: "Simulated KRA record",
    details: { pin_status: "Active", taxpayer_type: "Individual", compliance_status: "Compliant" },
  };
}

function sandboxDrivingLicense(value: string): VerifyResult {
  if (value.trim().length < 4) {
    return { verified: false, sandbox: true, error: "Invalid license number (sandbox mode)" };
  }
  return {
    verified: true,
    sandbox: true,
    name: "Simulated NTSA record",
    details: { license_class: "A, B", expiry_date: "2028-12-31", status: "Valid" },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VerifyRequest = await req.json();
    const { type, value } = body;

    if (!type || !value) {
      return new Response(
        JSON.stringify({ verified: false, sandbox: false, error: "Missing required fields: type, value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validationError = validateInput(type, value);
    if (validationError) {
      return new Response(
        JSON.stringify({ verified: false, sandbox: false, error: validationError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: VerifyResult;
    switch (type) {
      case "national_id":
        result = await verifyNationalId(value);
        break;
      case "kra_pin":
        result = await verifyKraPin(value);
        break;
      case "driving_license":
        result = await verifyDrivingLicense(value);
        break;
      default:
        return new Response(
          JSON.stringify({ verified: false, sandbox: false, error: "Invalid verification type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ verified: false, sandbox: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
