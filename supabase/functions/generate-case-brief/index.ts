import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Brief = {
  priority: "critical" | "high" | "medium" | "low";
  priority_reason: string;
  headline: string;
  narrative: string[];
  key_facts: { label: string; value: string }[];
  red_flags: string[];
  next_steps: string[];
  generated_at: string;
};

const isoDaysAgo = (iso: string | null | undefined) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
};

const humanTime = (iso: string | null | undefined) => {
  if (!iso) return "unknown time";
  try {
    return new Date(iso).toLocaleString("en-KE", {
      weekday: "short", day: "numeric", month: "short",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso;
  }
};

const humanDate = (iso: string | null | undefined) => {
  if (!iso) return "unknown date";
  try {
    return new Date(iso).toLocaleDateString("en-KE", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
};

const VIOLENT_TYPES = new Set([
  "robbery", "assault", "hijacking", "armed_robbery", "attack",
  "violence", "carjacking", "kidnapping",
]);
const SERIOUS_TYPES = new Set([
  "theft", "reckless_driving", "hit_and_run", "traffic_accident",
  "accident", "dangerous_driving",
]);

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

    const { incident_id } = await req.json();
    if (!incident_id) {
      return new Response(
        JSON.stringify({ success: false, error: "incident_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: incident, error: incErr } = await supabase
      .from("incidents")
      .select("*")
      .eq("id", incident_id)
      .maybeSingle();
    if (incErr) throw incErr;
    if (!incident) {
      return new Response(
        JSON.stringify({ success: false, error: "Incident not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [
      riderRes, ownerRes, motoRes,
      evidenceRes, timelineRes, summonsRes, poiRes, finesRes,
      stationRes,
    ] = await Promise.all([
      incident.rider_id
        ? supabase.from("riders").select("*").eq("id", incident.rider_id).maybeSingle()
        : Promise.resolve({ data: null }),
      incident.owner_id
        ? supabase.from("owners").select("*").eq("id", incident.owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
      incident.motorcycle_id
        ? supabase.from("motorcycles").select("*").eq("id", incident.motorcycle_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("incident_evidence").select("id, uploaded_by").eq("incident_id", incident_id),
      supabase.from("incident_resolutions").select("id, action_type, created_at").eq("incident_id", incident_id),
      supabase.from("incident_summons").select("id, status, sms_sent").eq("incident_id", incident_id),
      supabase.from("incident_persons_of_interest").select("id, full_name, relationship, linked_rider_id").eq("incident_id", incident_id),
      supabase.from("fines").select("id, status, fine_amount").eq("incident_id", incident_id),
      incident.assigned_station_id
        ? supabase.from("police_stations").select("station_name, county_id").eq("id", incident.assigned_station_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const rider = riderRes?.data as any;
    const owner = ownerRes?.data as any;
    const moto = motoRes?.data as any;
    const evidence = (evidenceRes.data as any[]) || [];
    const timeline = (timelineRes.data as any[]) || [];
    const summons = (summonsRes.data as any[]) || [];
    const pois = (poiRes.data as any[]) || [];
    const caseFines = (finesRes.data as any[]) || [];
    const station = stationRes?.data as any;

    let riderPriorIncidents = 0;
    let riderUnpaidFines = 0;
    let motoPriorIncidents = 0;

    if (rider?.id) {
      const [{ count: riderCount }, { data: riderFineData }] = await Promise.all([
        supabase.from("incidents").select("id", { count: "exact", head: true })
          .eq("rider_id", rider.id).neq("id", incident_id),
        supabase.from("fines").select("id, status").eq("rider_id", rider.id).neq("status", "paid"),
      ]);
      riderPriorIncidents = riderCount || 0;
      riderUnpaidFines = (riderFineData || []).length;
    }
    if (moto?.id) {
      const { count } = await supabase.from("incidents").select("id", { count: "exact", head: true })
        .eq("motorcycle_id", moto.id).neq("id", incident_id);
      motoPriorIncidents = count || 0;
    }

    const incType = String(incident.incident_type || "").toLowerCase().replace(/[\s-]/g, "_");
    const daysOpen = isoDaysAgo(incident.created_at) ?? 0;
    const officerEvidence = evidence.filter((e) => e.uploaded_by === "officer").length;
    const riderEvidence = evidence.filter((e) => e.uploaded_by === "rider").length;
    const reporterEvidence = evidence.filter((e) => e.uploaded_by === "reporter").length;
    const openSummons = summons.filter((s) => s.status === "pending").length;
    const attendedSummons = summons.filter((s) => s.status === "attended").length;
    const noShowSummons = summons.filter((s) => s.status === "no_show").length;
    const linkedPois = pois.filter((p) => p.linked_rider_id).length;
    const suspectPois = pois.filter((p) => (p.relationship || "").includes("suspect") || (p.relationship || "").includes("actual_rider")).length;
    const unpaidCaseFines = caseFines.filter((f) => f.status !== "paid").length;
    const totalCaseFineAmount = caseFines.reduce((sum, f) => sum + (Number(f.fine_amount) || 0), 0);

    let priority: Brief["priority"] = "medium";
    const priorityReasons: string[] = [];
    if (VIOLENT_TYPES.has(incType)) {
      priority = "critical";
      priorityReasons.push("violent-crime category");
    } else if (SERIOUS_TYPES.has(incType)) {
      priority = "high";
      priorityReasons.push("serious traffic offence");
    }
    if (riderPriorIncidents >= 3) {
      if (priority !== "critical") priority = "high";
      priorityReasons.push(`rider has ${riderPriorIncidents} prior cases`);
    }
    if (rider?.rating_score !== undefined && rider?.rating_score !== null && rider.rating_score < 2.5) {
      if (priority === "low") priority = "medium";
      priorityReasons.push("rider rating below 2.5");
    }
    if (daysOpen >= 7 && !incident.assigned_officer_id) {
      if (priority === "low") priority = "medium";
      priorityReasons.push(`case unassigned for ${daysOpen} days`);
    }
    if (priority === "medium" && evidence.length === 0 && daysOpen >= 2) {
      priorityReasons.push("no evidence collected yet");
    }
    if (priorityReasons.length === 0) priorityReasons.push("standard case flow");

    const partyLabel = rider?.name || incident.unregistered_details || "an unidentified rider";
    const bikeLabel = moto?.registration_number || "an unregistered motorcycle";
    const locLabel = incident.location || (station?.station_name ? `${station.station_name} area` : "an unrecorded location");
    const reportedWhen = humanTime(incident.incident_date || incident.created_at);
    const typeLabel = String(incident.incident_type || "").replace(/_/g, " ");

    const headline = incident.case_number
      ? `${incident.case_number}: ${typeLabel} involving ${bikeLabel} at ${locLabel}.`
      : `${typeLabel[0]?.toUpperCase() + typeLabel.slice(1)} involving ${bikeLabel} at ${locLabel}.`;

    const narrative: string[] = [];

    narrative.push(
      `This case concerns a reported ${typeLabel} on ${reportedWhen}${incident.location ? ` at ${incident.location}` : ""}. ` +
      `The reporting party ${incident.reporter_name} (${incident.reporter_phone}) alleges that motorcycle ${bikeLabel}` +
      `${moto?.make ? `, a ${moto.make}${moto.model ? " " + moto.model : ""},` : ""} ` +
      `${owner?.full_name ? `owned by ${owner.full_name}, ` : ""}was involved. ` +
      `${incident.description ? `Reporter's account: "${String(incident.description).slice(0, 260)}${String(incident.description).length > 260 ? "\u2026" : ""}"` : "No detailed description was provided by the reporter."}`
    );

    const ridingContext: string[] = [];
    if (rider?.name) {
      ridingContext.push(`The linked rider is ${rider.name}${rider.phone_number ? ` (${rider.phone_number})` : ""}`);
      if (rider?.rating_score !== undefined && rider?.rating_score !== null) {
        ridingContext.push(`with a BMS rating of ${Number(rider.rating_score).toFixed(1)}/5${rider.rating_tier ? ` (${rider.rating_tier})` : ""}`);
      }
      ridingContext.push(riderPriorIncidents === 0 ? "and no prior confirmed cases" : `and ${riderPriorIncidents} prior case${riderPriorIncidents === 1 ? "" : "s"} on file`);
      if (riderUnpaidFines > 0) ridingContext.push(`${riderUnpaidFines} unpaid fine${riderUnpaidFines === 1 ? "" : "s"} outstanding`);
    } else if (incident.unregistered_details || incident.unregistered_bike_details) {
      ridingContext.push("The rider is not linked to any BMS account");
    }
    if (moto?.registration_number) {
      ridingContext.push(`The motorcycle has ${motoPriorIncidents} prior incident${motoPriorIncidents === 1 ? "" : "s"}`);
      if (moto?.insurance_expiry) {
        const days = isoDaysAgo(moto.insurance_expiry);
        if (days !== null && days > 0) ridingContext.push(`insurance expired ${days} day${days === 1 ? "" : "s"} ago`);
      }
    }
    if (ridingContext.length > 0) narrative.push(ridingContext.join(". ") + ".");

    const progress: string[] = [];
    progress.push(
      station?.station_name
        ? `The case is currently held at ${station.station_name}${incident.claimed_by_manager_id ? " under manager ownership" : ""}`
        : "The case has not been routed to a station yet"
    );
    progress.push(
      `${evidence.length === 0 ? "No evidence has been gathered" : `${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} on file (${officerEvidence} officer, ${riderEvidence} rider, ${reporterEvidence} reporter)`}`
    );
    if (summons.length > 0) {
      progress.push(`${summons.length} summons issued\u200a—\u200a${attendedSummons} attended, ${openSummons} pending${noShowSummons > 0 ? `, ${noShowSummons} no-show` : ""}`);
    } else {
      progress.push("no summons have been issued yet");
    }
    if (pois.length > 0) {
      progress.push(`${pois.length} person${pois.length === 1 ? "" : "s"} of interest recorded${linkedPois > 0 ? ` (${linkedPois} linked to existing accounts)` : ""}`);
    }
    if (caseFines.length > 0) {
      progress.push(`${caseFines.length} fine${caseFines.length === 1 ? "" : "s"} issued totalling KES ${totalCaseFineAmount.toLocaleString()}${unpaidCaseFines > 0 ? ` (${unpaidCaseFines} still unpaid)` : ""}`);
    }
    narrative.push(progress.join(". ") + ".");

    const key_facts: Brief["key_facts"] = [];
    key_facts.push({ label: "Type", value: typeLabel });
    key_facts.push({ label: "Reported", value: humanTime(incident.created_at) });
    key_facts.push({ label: "Days open", value: `${daysOpen}` });
    if (locLabel) key_facts.push({ label: "Location", value: locLabel });
    if (rider?.name) key_facts.push({ label: "Rider", value: rider.name });
    if (rider?.rating_score !== undefined && rider?.rating_score !== null) {
      key_facts.push({ label: "Rider rating", value: `${Number(rider.rating_score).toFixed(1)}/5` });
    }
    if (moto?.registration_number) key_facts.push({ label: "Motorcycle", value: moto.registration_number });
    key_facts.push({ label: "Evidence", value: `${evidence.length} item${evidence.length === 1 ? "" : "s"}` });
    key_facts.push({ label: "Summons", value: `${summons.length} issued` });
    if (caseFines.length > 0) key_facts.push({ label: "Fines", value: `KES ${totalCaseFineAmount.toLocaleString()}` });

    const red_flags: string[] = [];
    if (VIOLENT_TYPES.has(incType)) red_flags.push("Violent crime — consider prioritising officer safety and evidence preservation.");
    if (riderPriorIncidents >= 3) red_flags.push(`Rider has ${riderPriorIncidents} prior cases — check for a pattern.`);
    if (riderUnpaidFines > 0) red_flags.push(`Rider has ${riderUnpaidFines} unpaid fine${riderUnpaidFines === 1 ? "" : "s"} on record.`);
    if (rider?.license_expiry) {
      const days = isoDaysAgo(rider.license_expiry);
      if (days !== null && days > 0) red_flags.push(`Rider's licence expired ${days} day${days === 1 ? "" : "s"} ago (${humanDate(rider.license_expiry)}).`);
    }
    if (moto?.insurance_expiry) {
      const days = isoDaysAgo(moto.insurance_expiry);
      if (days !== null && days > 0) red_flags.push(`Motorcycle insurance expired ${days} day${days === 1 ? "" : "s"} ago.`);
    }
    if (moto?.inspection_expiry) {
      const days = isoDaysAgo(moto.inspection_expiry);
      if (days !== null && days > 0) red_flags.push(`NTSA inspection expired ${days} day${days === 1 ? "" : "s"} ago.`);
    }
    if (daysOpen >= 7 && !incident.assigned_officer_id) red_flags.push(`Case has been open for ${daysOpen} days with no officer assigned.`);
    if (evidence.length === 0 && daysOpen >= 2) red_flags.push("No evidence collected — consider requesting photos or witness statements now.");
    if (noShowSummons > 0) red_flags.push(`${noShowSummons} summons no-show${noShowSummons === 1 ? "" : "s"} recorded — escalate.`);
    if (suspectPois > 0) red_flags.push(`${suspectPois} suspect / alternate-rider person${suspectPois === 1 ? "" : "s"} of interest flagged — follow up.`);

    const next_steps: string[] = [];
    if (!incident.assigned_station_id) next_steps.push("Route this case to the nearest police station using auto-assign.");
    if (!incident.assigned_officer_id) next_steps.push("Assign an officer to investigate.");
    if (evidence.length === 0) next_steps.push("Collect photos, statements, or CCTV footage as first-priority evidence.");
    if (rider?.name && openSummons === 0 && summons.length === 0 && incident.police_status !== "resolved" && incident.police_status !== "closed") {
      next_steps.push(`Consider summoning ${rider.name} to give a statement.`);
    }
    if (owner?.full_name && rider?.name && rider?.id_number && owner?.national_id && rider.id_number !== owner.national_id && summons.length === 0) {
      next_steps.push(`Summon the owner (${owner.full_name}) to clarify who was riding at the time.`);
    }
    if (linkedPois > 0) next_steps.push("Cross-check linked person-of-interest accounts against tracking history.");
    if (motoPriorIncidents > 0) next_steps.push(`Review the motorcycle's ${motoPriorIncidents} prior case${motoPriorIncidents === 1 ? "" : "s"} for related patterns.`);
    if (incident.police_status === "resolved") next_steps.push("Close the case once all administrative follow-ups are complete.");
    if (next_steps.length === 0) next_steps.push("Continue standard investigation workflow; no immediate blockers identified.");

    const brief: Brief = {
      priority,
      priority_reason: priorityReasons.join("; "),
      headline,
      narrative,
      key_facts,
      red_flags,
      next_steps,
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, brief }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-case-brief error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
