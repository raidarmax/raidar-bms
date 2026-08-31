import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, type PoliceOfficerWithStation } from './supabase';

const SESSION_KEY = '@bms_police_session_v3';
const LEGACY_SESSION_KEYS = ['@bms_police_session', '@bms_police_session_v2'];

const SUPABASE_URL = 'https://aydvtcllqozxvowjtpxd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5ZHZ0Y2xscW96eHZvd2p0cHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0ODg1MTksImV4cCI6MjA3ODA2NDUxOX0.ogtHmjP8-n8nRqCPOLLYgVl0QJyathPHwNrclS-Gn28';

const EDGE_BASE = `${SUPABASE_URL}/functions/v1/police-auth`;

async function callEdge<T = any>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${EDGE_BASE}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    throw new Error('Cannot reach server. Please check your internet connection.');
  }

  let payload: any;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Server returned invalid response (status ${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Login failed (status ${response.status}).`);
  }
  return payload as T;
}

async function saveSession(officer: PoliceOfficerWithStation): Promise<void> {
  const payload = { id: officer.id, service_number: officer.service_number };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
  for (const k of LEGACY_SESSION_KEYS) await AsyncStorage.removeItem(k);
}

async function getSavedSessionId(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.id || null;
  } catch {
    return null;
  }
}

export const PoliceAuth = {
  async login(serviceNumber: string, password: string): Promise<PoliceOfficerWithStation> {
    await clearSession();

    const trimmed = serviceNumber.trim().toUpperCase();
    if (!trimmed) throw new Error('Please enter your service number.');
    if (!password) throw new Error('Please enter your password.');

    const { officer } = await callEdge<{ officer: PoliceOfficerWithStation }>('login', {
      service_number: trimmed,
      password,
    });

    if (!officer || !officer.id) {
      throw new Error('Login failed. Please try again.');
    }

    await saveSession(officer);
    return officer;
  },

  async restoreSession(): Promise<PoliceOfficerWithStation | null> {
    const id = await getSavedSessionId();
    if (!id) return null;

    try {
      const { officer } = await callEdge<{ officer: PoliceOfficerWithStation | null }>('get-officer', {
        officer_id: id,
      });
      if (!officer) {
        await clearSession();
        return null;
      }
      return officer;
    } catch {
      await clearSession();
      return null;
    }
  },

  async logout(officerId?: string) {
    if (officerId) {
      const supabase = getSupabase();
      await supabase.from('police_activity_logs').insert({
        officer_id: officerId,
        action_type: 'logout',
        target_type: null,
        target_id: null,
        details: { source: 'mobile_app' },
      });
    }
    await clearSession();
  },

  async logActivity(
    officerId: string,
    actionType: string,
    targetType: string | null,
    targetId: string | null,
    details?: Record<string, unknown>,
  ) {
    const supabase = getSupabase();
    await supabase.from('police_activity_logs').insert({
      officer_id: officerId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      details: details ?? null,
    });
  },

  async logVerification(params: {
    officerId: string;
    stationId: string;
    verificationType: string;
    documentValue: string;
    subjectType: string | null;
    subjectId: string | null;
    result: string;
    resultDetails: Record<string, unknown>;
  }) {
    const supabase = getSupabase();
    await supabase.from('police_verification_logs').insert({
      officer_id: params.officerId,
      station_id: params.stationId,
      verification_type: params.verificationType,
      document_value: params.documentValue,
      subject_type: params.subjectType,
      subject_id: params.subjectId,
      verification_result: params.result,
      result_details: params.resultDetails,
    });
  },
};
