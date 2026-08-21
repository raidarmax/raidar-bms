export type ParsedQR =
  | { kind: 'rider'; identifier: string; raw: string; extras?: Record<string, string> }
  | { kind: 'motorcycle'; identifier: string; raw: string }
  | { kind: 'incident'; identifier: string; raw: string }
  | { kind: 'officer'; identifier: string; raw: string }
  | { kind: 'url'; url: string; params: Record<string, string>; raw: string }
  | { kind: 'unknown'; raw: string };

const BMS_RIDER = /BMS-\d{4}-\d{4,6}/i;
const CASE_REF = /^CASE-\d{4}-\d+$/i;
const OFFICER_REF = /^OFF-\d+/i;

export function normalizePlate(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  const m = cleaned.match(/^(K[A-Z]{2,3})(\d{3})([A-Z])$/);
  if (m) return `${m[1]} ${m[2]}${m[3]}`;
  return cleaned;
}

function parseKeyValuePairs(input: string): Record<string, string> | null {
  if (!input.includes('|') && !input.includes(':')) return null;
  const out: Record<string, string> = {};
  const parts = input.split('|');
  let matched = 0;
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().toUpperCase();
    const value = part.slice(idx + 1).trim();
    if (!key || !value) continue;
    out[key] = value;
    matched++;
  }
  return matched > 0 ? out : null;
}

export function parseQR(raw: string): ParsedQR {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  const pairs = parseKeyValuePairs(trimmed);
  if (pairs) {
    const bmsField = pairs.BMS || pairs.BMS_ID || pairs.RIDER || pairs.RIDER_ID;
    if (bmsField) {
      const m = bmsField.match(BMS_RIDER);
      if (m) {
        return {
          kind: 'rider',
          identifier: m[0].toUpperCase(),
          raw,
          extras: pairs,
        };
      }
    }
    if (pairs.CASE) {
      return { kind: 'incident', identifier: pairs.CASE.toUpperCase(), raw };
    }
    if (pairs.OFFICER) {
      return { kind: 'officer', identifier: pairs.OFFICER.toUpperCase(), raw };
    }
    if (pairs.PLATE) {
      return { kind: 'motorcycle', identifier: normalizePlate(pairs.PLATE), raw };
    }
  }

  const bmsMatch = trimmed.match(BMS_RIDER);
  if (bmsMatch) {
    return { kind: 'rider', identifier: bmsMatch[0].toUpperCase(), raw };
  }
  if (CASE_REF.test(trimmed)) {
    return { kind: 'incident', identifier: trimmed.toUpperCase(), raw };
  }
  if (OFFICER_REF.test(trimmed)) {
    return { kind: 'officer', identifier: trimmed.toUpperCase(), raw };
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.rider_id === 'string') {
        return { kind: 'rider', identifier: obj.rider_id, raw };
      }
      if (typeof obj.motorcycle_id === 'string' || typeof obj.plate === 'string') {
        return {
          kind: 'motorcycle',
          identifier: String(obj.motorcycle_id ?? obj.plate),
          raw,
        };
      }
    } catch {
      // fallthrough
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const params: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return { kind: 'url', url: trimmed, params, raw };
    } catch {
      return { kind: 'unknown', raw };
    }
  }

  const plateCandidate = trimmed.replace(/[\s-]+/g, '').toUpperCase();
  if (/^K[A-Z]{2,3}\d{3}[A-Z]$/.test(plateCandidate)) {
    return { kind: 'motorcycle', identifier: normalizePlate(trimmed), raw };
  }

  return { kind: 'unknown', raw };
}
