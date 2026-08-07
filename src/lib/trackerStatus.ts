import { supabase } from './supabase';

export type TrackerStatus =
  | { kind: 'no_tracker' }
  | { kind: 'not_detected'; deviceId: string }
  | { kind: 'offline'; deviceId: string; lastSeen: string; minutesAgo: number }
  | { kind: 'awaiting_fix'; deviceId: string; lastSeen: string }
  | { kind: 'live_stationary'; deviceId: string; lastSeen: string; lastFix: string }
  | { kind: 'live_moving'; deviceId: string; lastSeen: string; lastFix: string };

export type LiveLocation = {
  id: string;
  motorcycle_id: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recorded_at: string;
};

const OFFLINE_THRESHOLD_MINUTES = 5;
const FIX_STALE_THRESHOLD_MINUTES = 5;
const MOVING_SPEED_THRESHOLD_KMH = 3;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function accuracyFromSatellites(sats: number | null): number | null {
  if (sats == null || !Number.isFinite(sats) || sats < 4) return null;
  if (sats >= 12) return 3;
  if (sats >= 10) return 5;
  if (sats >= 8) return 8;
  if (sats >= 6) return 15;
  return 30;
}

export function statusLabel(status: TrackerStatus): string {
  switch (status.kind) {
    case 'no_tracker': return 'No tracker assigned';
    case 'not_detected': return 'Tracker not yet detected';
    case 'offline': return `Offline (last seen ${formatMinutesAgo(status.minutesAgo)})`;
    case 'awaiting_fix': return 'Connected — waiting for GPS fix';
    case 'live_stationary': return 'Live — stationary';
    case 'live_moving': return 'Live — moving';
  }
}

export function statusTone(status: TrackerStatus): 'success' | 'warning' | 'neutral' | 'muted' {
  switch (status.kind) {
    case 'live_moving':
    case 'live_stationary':
      return 'success';
    case 'awaiting_fix':
      return 'warning';
    case 'offline':
      return 'warning';
    case 'not_detected':
      return 'neutral';
    case 'no_tracker':
      return 'muted';
  }
}

function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'unknown';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds} sec ago`;
  return formatMinutesAgo(Math.floor(seconds / 60));
}

export async function fetchTrackerStatus(
  motorcycleId: string,
  motorcycleTrackerId: string | null,
): Promise<{ status: TrackerStatus; latestFix: LiveLocation | null }> {
  const [deviceRes, fixRes] = await Promise.all([
    supabase
      .from('tracking_devices')
      .select('id, device_id, status, last_heartbeat, last_connection')
      .eq('motorcycle_id', motorcycleId)
      .order('last_heartbeat', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('tracking_data')
      .select('*')
      .eq('motorcycle_id', motorcycleId)
      .order('recorded_at', { ascending: false })
      .limit(2),
  ]);

  const device = deviceRes.data;
  const rawFixes = (fixRes.data ?? []) as Record<string, unknown>[];
  const rawFix = rawFixes[0] ?? null;
  const prevFix = rawFixes[1] ?? null;

  let satellites: number | null = null;
  if (device?.id) {
    const { data: latestDeviceLoc } = await supabase
      .from('device_locations')
      .select('satellites')
      .eq('device_id', device.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestDeviceLoc && latestDeviceLoc.satellites != null) {
      satellites = Number(latestDeviceLoc.satellites);
      if (!Number.isFinite(satellites)) satellites = null;
    }
  }

  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const rawLat = rawFix ? toNumber(rawFix.latitude) : null;
  const rawLng = rawFix ? toNumber(rawFix.longitude) : null;
  const rawSpeed = rawFix ? toNumber(rawFix.speed) : null;
  const rawHeading = rawFix ? toNumber(rawFix.heading) : null;
  const rawAccuracy = rawFix ? toNumber(rawFix.accuracy) : null;

  const prevLat = prevFix ? toNumber(prevFix.latitude) : null;
  const prevLng = prevFix ? toNumber(prevFix.longitude) : null;
  const prevRecordedAt = prevFix?.recorded_at ? String(prevFix.recorded_at) : null;
  const currentRecordedAt = rawFix?.recorded_at ? String(rawFix.recorded_at) : null;

  let derivedSpeed: number | null = null;
  let derivedHeading: number | null = null;
  if (
    rawLat != null && rawLng != null &&
    prevLat != null && prevLng != null &&
    prevRecordedAt && currentRecordedAt
  ) {
    const distanceM = haversineMeters(prevLat, prevLng, rawLat, rawLng);
    const seconds = Math.max(
      0.001,
      (new Date(currentRecordedAt).getTime() - new Date(prevRecordedAt).getTime()) / 1000
    );
    if (seconds > 0 && distanceM > 2) {
      derivedSpeed = (distanceM / seconds) * 3.6;
      derivedHeading = bearingDegrees(prevLat, prevLng, rawLat, rawLng);
    } else if (seconds > 0) {
      derivedSpeed = 0;
    }
  }

  const fixAgeMs = currentRecordedAt ? Date.now() - new Date(currentRecordedAt).getTime() : Infinity;
  const fixIsStale = fixAgeMs > OFFLINE_THRESHOLD_MINUTES * 60 * 1000;

  let finalSpeed: number | null;
  if (fixIsStale) {
    finalSpeed = 0;
  } else if (derivedSpeed != null && derivedSpeed < MOVING_SPEED_THRESHOLD_KMH) {
    finalSpeed = 0;
  } else if (rawSpeed != null && rawSpeed >= 0.5 && derivedSpeed == null) {
    finalSpeed = rawSpeed;
  } else if (derivedSpeed != null) {
    finalSpeed = derivedSpeed;
  } else {
    finalSpeed = rawSpeed;
  }

  const isMoving = (finalSpeed ?? 0) >= MOVING_SPEED_THRESHOLD_KMH;
  const finalHeading = isMoving && derivedHeading != null
    ? derivedHeading
    : (rawHeading != null ? rawHeading : derivedHeading);

  const derivedAccuracy = accuracyFromSatellites(satellites);
  const finalAccuracy = rawAccuracy != null ? rawAccuracy : derivedAccuracy;

  const latestFix: LiveLocation | null = rawFix
    ? {
        id: String(rawFix.id ?? ''),
        motorcycle_id: String(rawFix.motorcycle_id ?? ''),
        latitude: rawLat ?? 0,
        longitude: rawLng ?? 0,
        speed: finalSpeed,
        heading: finalHeading,
        accuracy: finalAccuracy,
        recorded_at: currentRecordedAt ?? '',
      }
    : null;

  const hasValidCoords =
    latestFix !== null &&
    Number.isFinite(latestFix.latitude) &&
    Number.isFinite(latestFix.longitude) &&
    !(latestFix.latitude === 0 && latestFix.longitude === 0);
  const usableFix = hasValidCoords ? latestFix : null;

  if (!device) {
    if (!motorcycleTrackerId || motorcycleTrackerId.trim() === '') {
      return { status: { kind: 'no_tracker' }, latestFix: null };
    }
    return { status: { kind: 'not_detected', deviceId: motorcycleTrackerId }, latestFix: usableFix };
  }

  const deviceId: string = device.device_id ?? motorcycleTrackerId ?? '';
  const now = Date.now();

  const heartbeatMs = device.last_heartbeat ? new Date(device.last_heartbeat).getTime() : 0;
  const connectionMs = device.last_connection ? new Date(device.last_connection).getTime() : 0;
  const fixMs = latestFix ? new Date(latestFix.recorded_at).getTime() : 0;

  const lastSeenMs = Math.max(heartbeatMs, connectionMs, fixMs);
  const lastSeenIso = lastSeenMs > 0 ? new Date(lastSeenMs).toISOString() : null;
  const lastSeenMinutesAgo = lastSeenMs > 0 ? Math.floor((now - lastSeenMs) / 60000) : Infinity;

  if (lastSeenMs === 0 || !lastSeenIso) {
    return { status: { kind: 'not_detected', deviceId }, latestFix: usableFix };
  }

  if (lastSeenMinutesAgo > OFFLINE_THRESHOLD_MINUTES) {
    return {
      status: { kind: 'offline', deviceId, lastSeen: lastSeenIso, minutesAgo: lastSeenMinutesAgo },
      latestFix: usableFix,
    };
  }

  if (!usableFix) {
    return { status: { kind: 'awaiting_fix', deviceId, lastSeen: lastSeenIso }, latestFix: null };
  }

  const fixAgeMinutes = Math.floor((now - fixMs) / 60000);
  if (fixAgeMinutes > FIX_STALE_THRESHOLD_MINUTES) {
    return { status: { kind: 'awaiting_fix', deviceId, lastSeen: lastSeenIso }, latestFix: usableFix };
  }

  const speed = usableFix.speed ?? 0;
  const kind = speed > MOVING_SPEED_THRESHOLD_KMH ? 'live_moving' : 'live_stationary';
  return {
    status: { kind, deviceId, lastSeen: lastSeenIso, lastFix: usableFix.recorded_at },
    latestFix: usableFix,
  };
}
