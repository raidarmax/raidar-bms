import Constants from 'expo-constants';
import { supabase } from './supabase';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = (extra as { supabaseUrl?: string }).supabaseUrl;

export type DocumentKind = 'national_id' | 'driving_license' | 'insurance' | 'logbook' | 'inspection';

export type DocumentValidationResult = {
  overall_status: 'passed' | 'warning' | 'failed';
  confidence: number;
  extracted: Record<string, string>;
  markers: Array<{ field: string; ok: boolean; note: string }>;
  raw?: unknown;
};

export async function validateDocument(params: {
  kind: DocumentKind;
  file: { uri: string; name: string; mimeType?: string };
  officerId: string;
  stationId: string;
  subjectType?: string | null;
  subjectId?: string | null;
}): Promise<DocumentValidationResult> {
  if (!supabaseUrl) throw new Error('Supabase URL missing.');

  const form = new FormData();
  form.append('kind', params.kind);
  form.append('officer_id', params.officerId);
  form.append('station_id', params.stationId);
  if (params.subjectType) form.append('subject_type', params.subjectType);
  if (params.subjectId) form.append('subject_id', params.subjectId);
  form.append('file', {
    uri: params.file.uri,
    name: params.file.name,
    type: params.file.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(`${supabaseUrl}/functions/v1/verify-documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Validation failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as Partial<DocumentValidationResult> & Record<string, unknown>;

  return {
    overall_status: json.overall_status ?? 'warning',
    confidence: json.confidence ?? 0,
    extracted: (json.extracted as Record<string, string>) ?? {},
    markers: (json.markers as DocumentValidationResult['markers']) ?? [],
    raw: json,
  };
}

export function documentLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'national_id':
      return 'National ID';
    case 'driving_license':
      return 'Driving License';
    case 'insurance':
      return 'Insurance Certificate';
    case 'logbook':
      return 'Logbook';
    case 'inspection':
      return 'NTSA Inspection';
  }
}
