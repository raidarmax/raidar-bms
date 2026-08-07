import bcrypt from 'bcryptjs';
import * as SecureStore from 'expo-secure-store';
import { supabase, type PoliceOfficerWithStation } from './supabase';

const SESSION_KEY = 'raidar_police_session';

bcrypt.setRandomFallback((len: number) => {
  const bytes = new Array<number>(len);
  for (let i = 0; i < len; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
});

export const PoliceAuth = {
  async login(serviceNumber: string, password: string): Promise<PoliceOfficerWithStation> {
    const { data: officer, error } = await supabase
      .from('police_officers')
      .select('*, station:police_stations(*)')
      .eq('service_number', serviceNumber.trim())
      .maybeSingle();

    if (error) throw new Error('Login failed. Please try again.');
    if (!officer) throw new Error('Invalid service number or password.');
    if (!officer.is_active) throw new Error('Account is deactivated. Contact your station admin.');

    if (officer.locked_until && new Date(officer.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(officer.locked_until).getTime() - Date.now()) / 60000,
      );
      throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
    }

    const valid = await bcrypt.compare(password, officer.password_hash);
    if (!valid) {
      const attempts = (officer.failed_login_attempts ?? 0) + 1;
      const update: Record<string, unknown> = { failed_login_attempts: attempts };
      if (attempts >= 5) {
        update.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }
      await supabase.from('police_officers').update(update).eq('id', officer.id);
      if (attempts >= 5) {
        throw new Error('Too many failed attempts. Account locked for 30 minutes.');
      }
      throw new Error('Invalid service number or password.');
    }

    await supabase
      .from('police_officers')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', officer.id);

    await this.logActivity(officer.id, 'login', null, null, { source: 'mobile' });

    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(officer));
    return officer as PoliceOfficerWithStation;
  },

  async restoreSession(): Promise<PoliceOfficerWithStation | null> {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PoliceOfficerWithStation;
    } catch {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
  },

  async logout(officerId?: string) {
    if (officerId) {
      await this.logActivity(officerId, 'logout', null, null, { source: 'mobile' });
    }
    await SecureStore.deleteItemAsync(SESSION_KEY);
  },

  async logActivity(
    officerId: string,
    actionType: string,
    targetType: string | null,
    targetId: string | null,
    details?: Record<string, unknown>,
  ) {
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
