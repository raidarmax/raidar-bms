import { supabase } from './supabase';

function normalizePhone(phone: string): string {
  const stripped = phone.trim().replace(/\s+/g, '');
  if (stripped.startsWith('+254')) return stripped;
  if (stripped.startsWith('0')) return '+254' + stripped.slice(1);
  return '+254' + stripped;
}

export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { phone },
    });
    if (error) throw new Error(error.message ?? 'SMS service unavailable');
    return data as { success: boolean; error?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send OTP';
    return { success: false, error: message };
  }
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);
  const { data: record, error } = await supabase
    .from('phone_otps')
    .select('id')
    .eq('phone_number', normalizedPhone)
    .eq('otp_code', code)
    .eq('verified', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !record) return false;

  await supabase
    .from('phone_otps')
    .update({ verified: true })
    .eq('id', record.id);

  return true;
}
