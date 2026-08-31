import { supabase } from './supabase';

type ExistingOwner = {
  id: string;
  full_name: string;
  phone_number: string;
  national_id: string;
  bike_count: number;
};

function normalizePhone(phone: string): string {
  const stripped = phone.trim().replace(/\s+/g, '').replace(/^\+/, '');
  if (stripped.startsWith('0')) return '+254' + stripped.slice(1);
  if (stripped.startsWith('254')) return '+' + stripped;
  return '+254' + stripped;
}

export async function checkExistingOwner(phone: string): Promise<ExistingOwner | null> {
  const normalizedPhone = normalizePhone(phone);
  const { data: existing } = await supabase
    .from('owners')
    .select('id, full_name, phone_number, national_id')
    .eq('phone_number', normalizedPhone)
    .maybeSingle();

  if (!existing) return null;

  const { count } = await supabase
    .from('motorcycles')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', existing.id);

  return { ...existing, bike_count: count || 0 };
}

export async function registerMotorcycle(params: {
  ownerName: string;
  phone: string;
  nationalId: string;
  plateNumber: string;
  serial: string;
  imei: string;
  existingOwnerId: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { ownerName, phone, nationalId, plateNumber, serial, imei, existingOwnerId } = params;
    const normalizedPhone = normalizePhone(phone);
    const paddedSerial = serial.length === 11 ? '0' + serial : serial;
    const unpaddedSerial = paddedSerial.startsWith('0') ? paddedSerial.slice(1) : paddedSerial;

    let ownerId = existingOwnerId;

    if (!ownerId) {
      const { data: newOwner, error: ownerError } = await supabase
        .from('owners')
        .insert({
          full_name: ownerName.trim(),
          phone_number: normalizedPhone,
          national_id: nationalId.trim(),
          otp_verified: true,
          payment_status: 'pending',
          owner_type: 'individual',
        })
        .select('id')
        .single();

      if (ownerError) throw new Error('Failed to create owner account');
      ownerId = newOwner.id;
    }

    // Find existing tracking device
    let existingDevice: { id: string } | null = null;
    const { data: d1 } = await supabase
      .from('tracking_devices')
      .select('id')
      .eq('device_id', paddedSerial)
      .maybeSingle();
    existingDevice = d1;

    if (!existingDevice) {
      const { data: d2 } = await supabase
        .from('tracking_devices')
        .select('id')
        .eq('device_id', unpaddedSerial)
        .maybeSingle();
      existingDevice = d2;
    }

    if (!existingDevice) {
      const { data: d3 } = await supabase
        .from('tracking_devices')
        .select('id')
        .eq('phone_number', paddedSerial)
        .maybeSingle();
      existingDevice = d3;
    }

    // Create motorcycle
    const { data: newMoto, error: motoError } = await supabase
      .from('motorcycles')
      .insert({
        owner_id: ownerId,
        registration_number: plateNumber.trim().toUpperCase(),
        tracking_device_id: paddedSerial,
        status: 'pending',
      })
      .select('id')
      .single();

    if (motoError) throw new Error('Failed to register motorcycle');

    // Link tracking device
    if (existingDevice) {
      await supabase
        .from('tracking_devices')
        .update({
          device_id: paddedSerial,
          imei: imei || null,
          motorcycle_id: newMoto.id,
          status: 'registered',
        })
        .eq('id', existingDevice.id);
    } else {
      await supabase
        .from('tracking_devices')
        .insert({
          device_id: paddedSerial,
          phone_number: paddedSerial,
          imei: imei || null,
          motorcycle_id: newMoto.id,
          status: 'registered',
        });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
  }
}
