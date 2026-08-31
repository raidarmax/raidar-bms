import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LocationData, TerminalRegistration, MessageHandlers } from '../src/lib/gprs-protocol';

function sanitizeForJson(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeForJson(v);
    }
    return out;
  }
  return value;
}

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async registerDevice(registration: TerminalRegistration, phoneNumber: string, authCode: string) {
    const { data: existingDevice } = await this.supabase
      .from('tracking_devices')
      .select('id')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (existingDevice) {
      const { data, error } = await this.supabase
        .from('tracking_devices')
        .update({
          device_id: phoneNumber,
          phone_number: phoneNumber,
          imei: registration.terminalId,
          authentication_code: authCode,
          status: 'online',
          last_connection: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('phone_number', phoneNumber)
        .select()
        .single();

      if (error) {
        console.error('Error updating device:', error);
        throw error;
      }

      return data;
    }

    let vehicleId = null;
    if (registration.licensePlate) {
      const { data: vehicle } = await this.supabase
        .from('vehicles')
        .select('id')
        .eq('registration_number', registration.licensePlate)
        .maybeSingle();

      if (!vehicle) {
        const { data: newVehicle, error: vehicleError } = await this.supabase
          .from('vehicles')
          .insert({
            registration_number: registration.licensePlate,
            owner_info: {
              province_id: registration.provinceId,
              city_id: registration.cityId,
              plate_color: registration.licensePlateColor
            }
          })
          .select()
          .single();

        if (vehicleError) {
          console.error('Error creating vehicle:', vehicleError);
        } else {
          vehicleId = newVehicle.id;
        }
      } else {
        vehicleId = vehicle.id;
      }
    }

    const { data, error } = await this.supabase
      .from('tracking_devices')
      .insert({
        device_id: phoneNumber,
        phone_number: phoneNumber,
        imei: registration.terminalId,
        vehicle_id: vehicleId,
        authentication_code: authCode,
        status: 'online',
        last_connection: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
        terminal_parameters: {
          manufacturer_id: registration.manufacturerId,
          terminal_model: registration.terminalModel
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Error registering device:', error);
      throw error;
    }

    return data;
  }

  async updateDeviceStatus(deviceId: string, status: 'online' | 'offline' | 'suspended') {
    const { error } = await this.supabase
      .from('tracking_devices')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error updating device status:', error);
    }
  }

  async updateHeartbeat(deviceId: string) {
    const { error } = await this.supabase
      .from('tracking_devices')
      .update({
        last_heartbeat: new Date().toISOString(),
        status: 'online'
      })
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error updating heartbeat:', error);
    }
  }

  async getDeviceByPhoneNumber(phoneNumber: string) {
    const { data, error } = await this.supabase
      .from('tracking_devices')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error) {
      console.error('Error fetching device:', error);
      return null;
    }

    return data;
  }

  async autoRegisterDevice(phoneNumber: string, terminalId?: string) {
    const { data: existing } = await this.supabase
      .from('tracking_devices')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await this.supabase
      .from('tracking_devices')
      .insert({
        device_id: phoneNumber,
        phone_number: phoneNumber,
        imei: terminalId || null,
        status: 'online',
        last_connection: new Date().toISOString(),
        last_heartbeat: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error auto-registering device:', error);
      throw error;
    }

    return data;
  }

  async fixDeviceId(id: string, correctDeviceId: string) {
    await this.supabase
      .from('tracking_devices')
      .update({ device_id: correctDeviceId })
      .eq('id', id);
    await this.supabase
      .from('motorcycles')
      .update({ tracking_device_id: correctDeviceId })
      .eq('tracking_device_id', id);
  }

  async getDeviceById(deviceId: string) {
    const { data, error } = await this.supabase
      .from('tracking_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching device:', error);
      return null;
    }

    return data;
  }

  async logMessage(entry: {
    sessionId?: string;
    remoteAddress?: string;
    phoneNumber?: string;
    messageId?: number;
    serialNumber?: number;
    bodyLength?: number;
    bodyHex?: string;
    parseStatus: 'parsed' | 'parse_failed' | 'unhandled' | 'location_saved' | 'location_dropped' | 'batch_expanded';
    parseNote?: string;
  }) {
    const { error } = await this.supabase.from('gps_message_log').insert({
      session_id: entry.sessionId ?? null,
      remote_address: entry.remoteAddress ?? null,
      phone_number: entry.phoneNumber ?? null,
      message_id: entry.messageId ?? null,
      message_id_hex: entry.messageId != null ? '0x' + entry.messageId.toString(16).padStart(4, '0') : null,
      serial_number: entry.serialNumber ?? null,
      body_length: entry.bodyLength ?? null,
      body_hex: entry.bodyHex ?? null,
      parse_status: entry.parseStatus,
      parse_note: entry.parseNote ?? null,
    });

    if (error) {
      console.error('[logMessage] insert failed:', error);
    }
  }

  async saveLocation(
    deviceUuid: string,
    locationData: LocationData,
    rawMessage: Buffer,
    motorcycleId?: string | null
  ) {
    const { error } = await this.supabase
      .from('device_locations')
      .insert({
        device_id: deviceUuid,
        timestamp: locationData.timestamp.toISOString(),
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        altitude: locationData.altitude,
        speed: locationData.speed,
        heading: locationData.heading,
        satellites: locationData.satellites || 0,
        odometer: locationData.odometer?.toString() || '0',
        positioning_status: MessageHandlers.getPositioningStatus(locationData.statusFlags),
        acc_status: MessageHandlers.getACCStatus(locationData.statusFlags),
        alarm_flags: locationData.alarmFlags.toString(),
        status_flags: locationData.statusFlags.toString(),
        additional_info: sanitizeForJson(locationData.additionalInfo || {}),
        raw_message: rawMessage
      });

    if (error) {
      console.error('[saveLocation] device_locations insert failed:', error);
      throw error;
    }

    // tracking_data is populated automatically by the
    // device_locations_sync_tracking_data trigger — do not double-insert here.
    void motorcycleId;

    const alarms = MessageHandlers.extractAlarms(locationData.alarmFlags);
    if (alarms.length > 0) {
      const { data: locationRecord } = await this.supabase
        .from('device_locations')
        .select('id')
        .eq('device_id', deviceUuid)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      for (const alarm of alarms) {
        await this.saveAlarm(deviceUuid, locationRecord?.id, alarm);
      }
    }
  }

  async saveAlarm(
    deviceUuid: string,
    locationId: string | undefined,
    alarm: { code: number; name: string; severity: string; description: string }
  ) {
    const { error } = await this.supabase
      .from('device_alarms')
      .insert({
        device_id: deviceUuid,
        location_id: locationId,
        alarm_type: alarm.name,
        alarm_code: alarm.code,
        severity: alarm.severity,
        description: alarm.description,
        status: 'active'
      });

    if (error) {
      console.error('Error saving alarm:', error);
    }
  }

  async recordConnection(deviceUuid: string, ipAddress: string) {
    const { data, error } = await this.supabase
      .from('device_connections')
      .insert({
        device_id: deviceUuid,
        ip_address: ipAddress,
        connection_start: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording connection:', error);
      return null;
    }

    return data;
  }

  async closeConnection(connectionId: string, reason?: string) {
    const { error } = await this.supabase
      .from('device_connections')
      .update({
        connection_end: new Date().toISOString(),
        disconnect_reason: reason
      })
      .eq('id', connectionId);

    if (error) {
      console.error('Error closing connection:', error);
    }
  }

  async saveCommand(
    deviceUuid: string,
    commandType: string,
    commandId: number,
    commandData: any,
    rawRequest: Buffer,
    createdBy?: string,
    priority: number = 5
  ) {
    const { data, error } = await this.supabase
      .from('device_commands')
      .insert({
        device_id: deviceUuid,
        command_type: commandType,
        command_id: commandId,
        command_data: commandData,
        raw_request: rawRequest,
        priority,
        status: 'queued',
        created_by: createdBy
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving command:', error);
      throw error;
    }

    return data;
  }

  async updateCommandStatus(
    commandId: string,
    status: 'sent' | 'acknowledged' | 'failed' | 'timeout',
    responseData?: any,
    rawResponse?: Buffer,
    errorMessage?: string
  ) {
    const updateData: any = {
      status
    };

    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    } else if (status === 'acknowledged') {
      updateData.acknowledged_at = new Date().toISOString();
      updateData.response_data = responseData;
      updateData.raw_response = rawResponse;
    } else if (status === 'failed' || status === 'timeout') {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('device_commands')
      .update(updateData)
      .eq('id', commandId);

    if (error) {
      console.error('Error updating command status:', error);
    }
  }

  async getPendingCommands(deviceUuid: string) {
    const { data, error } = await this.supabase
      .from('device_commands')
      .select('*')
      .eq('device_id', deviceUuid)
      .in('status', ['queued', 'sent'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending commands:', error);
      return [];
    }

    return data || [];
  }

  async getLatestLocation(deviceUuid: string) {
    const { data, error } = await this.supabase
      .from('device_locations')
      .select('*')
      .eq('device_id', deviceUuid)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest location:', error);
      return null;
    }

    return data;
  }

  async getLocationHistory(
    deviceUuid: string,
    startTime: Date,
    endTime: Date,
    limit: number = 1000
  ) {
    const { data, error } = await this.supabase
      .from('device_locations')
      .select('*')
      .eq('device_id', deviceUuid)
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString())
      .order('timestamp', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching location history:', error);
      return [];
    }

    return data || [];
  }

  async getActiveAlarms(deviceUuid: string) {
    const { data, error } = await this.supabase
      .from('device_alarms')
      .select('*')
      .eq('device_id', deviceUuid)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active alarms:', error);
      return [];
    }

    return data || [];
  }

  async acknowledgeAlarm(alarmId: string, acknowledgedBy?: string) {
    const { error } = await this.supabase
      .from('device_alarms')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy
      })
      .eq('id', alarmId);

    if (error) {
      console.error('Error acknowledging alarm:', error);
    }
  }

  async resolveAlarm(alarmId: string) {
    const { error } = await this.supabase
      .from('device_alarms')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', alarmId);

    if (error) {
      console.error('Error resolving alarm:', error);
    }
  }

  async logBlockedConnection(info: {
    remoteAddress: string;
    reason: string;
    firstBytesHex: string;
    firstBytesAscii: string;
    byteLength: number;
  }) {
    const { error } = await this.supabase.from('blocked_connections').insert({
      remote_address: info.remoteAddress,
      reason: info.reason,
      first_bytes_hex: info.firstBytesHex,
      first_bytes_ascii: info.firstBytesAscii,
      byte_length: info.byteLength,
    });

    if (error) {
      console.error('Error logging blocked connection:', error);
    }
  }
}
