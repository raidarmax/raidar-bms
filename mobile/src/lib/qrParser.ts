export type ParsedQR =
  | { kind: 'rider'; identifier: string; raw: string }
  | { kind: 'motorcycle'; identifier: string; raw: string }
  | { kind: 'incident'; identifier: string; raw: string }
  | { kind: 'officer'; identifier: string; raw: string }
  | { kind: 'url'; url: string; params: Record<string, string>; raw: string }
  | { kind: 'unknown'; raw: string };

const BMS_RIDER = /^BMS-\d{4}-\d{5}$/i;
const CASE_REF = /^CASE-\d{4}-\d+$/i;
const OFFICER_REF = /^OFF-\d+/i;

export function parseQR(raw: string): ParsedQR {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  if (BMS_RIDER.test(trimmed)) {
    return { kind: 'rider', identifier: trimmed.toUpperCase(), raw };
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

  if (/^[A-Z]{2,3}\s?\d{3}[A-Z]?$/i.test(trimmed.replace(/[-\s]/g, ' '))) {
    return { kind: 'motorcycle', identifier: trimmed.toUpperCase(), raw };
  }

  return { kind: 'unknown', raw };
}
