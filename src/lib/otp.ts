import { supabase } from './supabase';

function normalizePhone(phone: string): string {
  const stripped = phone.trim().replace(/\s+/g, '');
  if (stripped.startsWith('+254')) return stripped;
  if (stripped.startsWith('0')) return '+254' + stripped.slice(1);
  return '+254' + stripped;
}

/**
 * Sends an OTP to the given phone number via the bulk.ke SMS gateway.
 * Retries once on network failure.
 */
export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });

      clearTimeout(timeout);

      if (error) {
        if (attempt < maxAttempts) continue;
        throw new Error(error.message ?? 'SMS service unavailable');
      }

      return data as { success: boolean; error?: string };
    } catch (err) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      if (message.includes('Failed to send a request') || message.includes('FunctionsFetchError')) {
        return { success: false, error: 'Unable to reach the SMS service. Please check your internet connection and try again.' };
      }
      return { success: false, error: message };
    }
  }

  return { success: false, error: 'SMS service is temporarily unavailable. Please try again.' };
}

/**
 * Verifies an OTP against the phone_otps table.
 * Marks the record as verified on success so it cannot be reused.
 */
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
