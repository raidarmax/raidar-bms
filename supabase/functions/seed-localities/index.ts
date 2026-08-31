import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch all county data from Kenya Data API
    const apiUrl =
      "https://kenyaareadata.vercel.app/api/areas?apiKey=keyPub1569gsvndc123kg9sjhg";
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(
        `Kenya Data API returned ${response.status}: ${await response.text()}`
      );
    }

    const data: Record<string, Record<string, string[]>> = await response.json();

    // Load existing counties from DB to map names -> IDs
    const { data: counties, error: countiesErr } = await supabase
      .from("kenya_counties")
      .select("id, county_name");
    if (countiesErr) throw new Error(`Failed to load counties: ${countiesErr.message}`);

    const countyMap = new Map<string, number>();
    for (const c of counties!) {
      countyMap.set(c.county_name.toLowerCase(), c.id);
    }

    // Handle naming variations between API and our DB
    const nameAliases: Record<string, string> = {
      "tharaka - nithi": "tharaka nithi",
      "murang'a": "muranga",
      "elgeyo/marakwet": "elgeyo marakwet",
      "nairobi city": "nairobi",
    };
    for (const [alias, canonical] of Object.entries(nameAliases)) {
      const id = countyMap.get(canonical);
      if (id) countyMap.set(alias, id);
    }

    // Track stats
    let constituenciesInserted = 0;
    let wardsInserted = 0;
    let constituenciesSkipped = 0;
    let wardsSkipped = 0;
    const unmatchedCounties: string[] = [];

    // Get existing max IDs to assign new sequential IDs
    const { data: maxConstRes } = await supabase
      .from("kenya_constituencies")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    let nextConstId = (maxConstRes && maxConstRes.length > 0 ? maxConstRes[0].id : 0) + 1;

    const { data: maxWardRes } = await supabase
      .from("kenya_wards")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    let nextWardId = (maxWardRes && maxWardRes.length > 0 ? maxWardRes[0].id : 0) + 1;

    // Load existing constituencies and wards for dedup
    const { data: existingConsts } = await supabase
      .from("kenya_constituencies")
      .select("id, constituency_name, county_id");
    const constLookup = new Map<string, number>();
    for (const c of existingConsts || []) {
      constLookup.set(`${c.county_id}::${c.constituency_name.toLowerCase()}`, c.id);
    }

    const { data: existingWards } = await supabase
      .from("kenya_wards")
      .select("id, ward_name, constituency_id");
    const wardLookup = new Set<string>();
    for (const w of existingWards || []) {
      wardLookup.add(`${w.constituency_id}::${w.ward_name.toLowerCase()}`);
    }

    // Process API data
    const constituencyBatch: { id: number; constituency_name: string; county_id: number }[] = [];
    const wardBatch: { id: number; ward_name: string; constituency_id: number }[] = [];

    for (const [countyName, constituencies] of Object.entries(data)) {
      const countyId = countyMap.get(countyName.toLowerCase());
      if (!countyId) {
        unmatchedCounties.push(countyName);
        continue;
      }

      for (const [constName, wards] of Object.entries(constituencies)) {
        const constKey = `${countyId}::${constName.toLowerCase()}`;
        let constId = constLookup.get(constKey);

        if (!constId) {
          constId = nextConstId++;
          constituencyBatch.push({
            id: constId,
            constituency_name: constName,
            county_id: countyId,
          });
          constLookup.set(constKey, constId);
          constituenciesInserted++;
        } else {
          constituenciesSkipped++;
        }

        for (const wardName of wards) {
          const wardKey = `${constId}::${wardName.toLowerCase()}`;
          if (!wardLookup.has(wardKey)) {
            wardBatch.push({
              id: nextWardId++,
              ward_name: wardName,
              constituency_id: constId,
            });
            wardLookup.add(wardKey);
            wardsInserted++;
          } else {
            wardsSkipped++;
          }
        }
      }
    }

    // Insert in batches (Supabase limit ~1000 per call)
    const BATCH_SIZE = 500;

    for (let i = 0; i < constituencyBatch.length; i += BATCH_SIZE) {
      const batch = constituencyBatch.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("kenya_constituencies").insert(batch);
      if (error) throw new Error(`Constituency insert failed at batch ${i}: ${error.message}`);
    }

    for (let i = 0; i < wardBatch.length; i += BATCH_SIZE) {
      const batch = wardBatch.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("kenya_wards").insert(batch);
      if (error) throw new Error(`Ward insert failed at batch ${i}: ${error.message}`);
    }

    const result = {
      success: true,
      stats: {
        counties_in_api: Object.keys(data).length,
        counties_matched: Object.keys(data).length - unmatchedCounties.length,
        constituencies_inserted: constituenciesInserted,
        constituencies_existing: constituenciesSkipped,
        wards_inserted: wardsInserted,
        wards_existing: wardsSkipped,
        unmatched_counties: unmatchedCounties,
      },
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
