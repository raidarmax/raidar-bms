import { supabase, type IncidentResolution } from './supabase';

export type LogResolutionInput = {
  incidentId: string;
  actionType: string;
  actorType: 'admin' | 'officer' | 'system' | 'rider' | 'reporter';
  actorId?: string | null;
  actorName?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  metadata?: Record<string, any>;
};

export async function logIncidentResolution(input: LogResolutionInput) {
  const { error } = await supabase.from('incident_resolutions').insert({
    incident_id: input.incidentId,
    action_type: input.actionType,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error('logIncidentResolution failed', error);
}

export async function fetchIncidentResolutions(incidentId: string): Promise<IncidentResolution[]> {
  const { data, error } = await supabase
    .from('incident_resolutions')
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchIncidentResolutions failed', error);
    return [];
  }
  return (data || []) as IncidentResolution[];
}

export const IGNORE_REASONS: { value: string; label: string }[] = [
  { value: 'duplicate', label: 'Duplicate report' },
  { value: 'not_credible', label: 'Not credible / insufficient info' },
  { value: 'outside_jurisdiction', label: 'Outside our jurisdiction' },
  { value: 'malicious', label: 'Malicious / harassment' },
  { value: 'other', label: 'Other' },
];

export const RESOLUTION_OUTCOMES: { value: string; label: string; description: string }[] = [
  { value: 'fined', label: 'Fined', description: 'A traffic fine has been issued to the offender.' },
  { value: 'warning', label: 'Warning issued', description: 'The rider was warned but not fined.' },
  { value: 'no_action', label: 'No action required', description: 'Case reviewed; no violation found or minor issue.' },
  { value: 'unfounded', label: 'Unfounded / dismissed', description: 'Allegation could not be substantiated.' },
  { value: 'referred_court', label: 'Referred to court', description: 'Escalated to the judicial process.' },
  { value: 'custodial', label: 'Custodial action', description: 'Suspect held in custody / referred for prosecution.' },
  { value: 'other', label: 'Other', description: 'Any other resolution — describe in the summary.' },
];
