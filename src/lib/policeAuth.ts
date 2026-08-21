import bcrypt from 'bcryptjs';
import { supabase, type PoliceOfficer, type PoliceOfficerWithStation } from './supabase';

export class PoliceAuthService {
  static async validateCredentials(serviceNumber: string, password: string): Promise<PoliceOfficerWithStation> {
    const { data: officers, error } = await supabase
      .from('police_officers')
      .select('*, station:police_stations(*)')
      .eq('service_number', serviceNumber);

    if (error) throw new Error('Login failed. Please try again.');
    const officer = officers && officers.length > 0 ? officers[0] : null;
    if (!officer) throw new Error('Invalid service number or password.');
    if (!officer.is_active) throw new Error('Account is deactivated. Contact your station admin.');

    if (officer.locked_until && new Date(officer.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(officer.locked_until).getTime() - Date.now()) / 60000);
      throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
    }

    const isValidPassword = await bcrypt.compare(password, officer.password_hash);

    if (!isValidPassword) {
      const attempts = officer.failed_login_attempts + 1;
      const updateData: any = { failed_login_attempts: attempts };

      if (attempts >= 5) {
        updateData.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }

      await supabase
        .from('police_officers')
        .update(updateData)
        .eq('id', officer.id);

      if (attempts >= 5) {
        throw new Error('Account locked due to too many failed attempts. Try again in 30 minutes.');
      }
      throw new Error('Invalid service number or password.');
    }

    return officer as PoliceOfficerWithStation;
  }

  static async completeLogin(officerId: string): Promise<void> {
    await supabase
      .from('police_officers')
      .update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', officerId);

    await this.logActivity(officerId, 'login', null, null, { success: true });
  }

  static async login(serviceNumber: string, password: string): Promise<PoliceOfficerWithStation> {
    const officer = await this.validateCredentials(serviceNumber, password);
    await this.completeLogin(officer.id);
    return officer;
  }

  static async changePassword(officerId: string, currentPassword: string, newPassword: string): Promise<void> {
    const { data: officer } = await supabase
      .from('police_officers')
      .select('password_hash')
      .eq('id', officerId)
      .maybeSingle();

    if (!officer) throw new Error('Officer not found.');

    const isValid = await bcrypt.compare(currentPassword, officer.password_hash);
    if (!isValid) throw new Error('Current password is incorrect.');

    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');

    const hash = await bcrypt.hash(newPassword, 10);
    await supabase
      .from('police_officers')
      .update({ password_hash: hash, must_change_password: false })
      .eq('id', officerId);
  }

  static async registerOfficer(data: {
    service_number: string;
    national_id: string;
    full_name: string;
    phone_number: string;
    email?: string;
    rank: string;
    badge_number?: string;
    station_id: string;
    is_station_admin?: boolean;
    id_verified?: boolean;
    registered_by: string;
  }): Promise<PoliceOfficer> {
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1';
    const hash = await bcrypt.hash(tempPassword, 10);

    const { data: officer, error } = await supabase
      .from('police_officers')
      .insert({
        ...data,
        password_hash: hash,
        must_change_password: true,
        is_station_admin: data.is_station_admin || false,
        id_verified: data.id_verified || false,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('service_number')) throw new Error('Service number already registered.');
      if (error.message.includes('national_id')) throw new Error('National ID already registered.');
      throw new Error('Registration failed: ' + error.message);
    }

    return { ...officer, _tempPassword: tempPassword } as PoliceOfficer & { _tempPassword: string };
  }

  static async logActivity(
    officerId: string,
    actionType: string,
    targetType: string | null,
    targetId: string | null,
    details?: any
  ): Promise<void> {
    await supabase.from('police_activity_logs').insert({
      officer_id: officerId,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      details: details || null,
    });
  }

  static async logVerification(
    officerId: string,
    stationId: string,
    verificationType: string,
    documentValue: string,
    subjectType: string | null,
    subjectId: string | null,
    result: string,
    resultDetails: any
  ): Promise<void> {
    await supabase.from('police_verification_logs').insert({
      officer_id: officerId,
      station_id: stationId,
      verification_type: verificationType,
      document_value: documentValue,
      subject_type: subjectType,
      subject_id: subjectId,
      verification_result: result,
      result_details: resultDetails,
    });
  }
}

export const POLICE_RANKS = [
  { value: 'constable', label: 'Constable' },
  { value: 'corporal', label: 'Corporal' },
  { value: 'sergeant', label: 'Sergeant' },
  { value: 'senior_sergeant', label: 'Senior Sergeant' },
  { value: 'inspector', label: 'Inspector' },
  { value: 'chief_inspector', label: 'Chief Inspector' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'senior_superintendent', label: 'Senior Superintendent' },
  { value: 'commissioner', label: 'Commissioner' },
];
