export interface ProtocolMessage {
  identifierBit: number;
  header: MessageHeader;
  body: Buffer;
  checkCode: number;
}

export interface MessageHeader {
  messageId: number;
  bodyAttributes: BodyAttributes;
  phoneNumber: string;
  serialNumber: number;
  packageInfo?: PackageInfo;
}

export interface BodyAttributes {
  length: number;
  encryption: number;
  subPackaged: boolean;
  reserved: number;
}

export interface PackageInfo {
  totalPackages: number;
  packageNumber: number;
}

export interface LocationData {
  alarmFlags: bigint;
  statusFlags: bigint;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  timestamp: Date;
  satellites?: number;
  odometer?: bigint;
  additionalInfo?: Record<string, any>;
}

export interface TerminalRegistration {
  provinceId: number;
  cityId: number;
  manufacturerId: string;
  terminalModel: string;
  terminalId: string;
  licensePlateColor: number;
  licensePlate: string;
}

export interface AlarmFlag {
  code: number;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export const AlarmFlags: Record<number, AlarmFlag> = {
  0: { code: 0, name: 'emergency', severity: 'critical', description: 'Emergency alarm' },
  1: { code: 1, name: 'overspeed', severity: 'high', description: 'Overspeed alarm' },
  2: { code: 2, name: 'fatigue_driving', severity: 'high', description: 'Fatigue driving alarm' },
  3: { code: 3, name: 'dangerous_driving', severity: 'high', description: 'Dangerous driving behavior' },
  4: { code: 4, name: 'gnss_malfunction', severity: 'medium', description: 'GNSS module malfunction' },
  5: { code: 5, name: 'gnss_antenna_disconnect', severity: 'medium', description: 'GNSS antenna disconnected' },
  6: { code: 6, name: 'gnss_antenna_short', severity: 'medium', description: 'GNSS antenna short circuit' },
  7: { code: 7, name: 'power_undervoltage', severity: 'medium', description: 'Main power undervoltage' },
  8: { code: 8, name: 'power_off', severity: 'high', description: 'Main power off' },
  9: { code: 9, name: 'lcd_malfunction', severity: 'low', description: 'LCD display malfunction' },
  10: { code: 10, name: 'tts_malfunction', severity: 'low', description: 'TTS module malfunction' },
  11: { code: 11, name: 'camera_malfunction', severity: 'medium', description: 'Camera malfunction' },
  18: { code: 18, name: 'day_driving_timeout', severity: 'high', description: 'Day driving time out' },
  19: { code: 19, name: 'parking_timeout', severity: 'medium', description: 'Parking timeout' },
  20: { code: 20, name: 'enter_area', severity: 'medium', description: 'Entering area alarm' },
  21: { code: 21, name: 'exit_area', severity: 'medium', description: 'Exiting area alarm' },
  22: { code: 22, name: 'driving_time_insufficient', severity: 'medium', description: 'Driving time insufficient' },
  23: { code: 23, name: 'route_deviation', severity: 'medium', description: 'Route deviation alarm' },
  24: { code: 24, name: 'vehicle_vss_malfunction', severity: 'medium', description: 'Vehicle VSS malfunction' },
  25: { code: 25, name: 'vehicle_fuel_abnormal', severity: 'high', description: 'Vehicle fuel abnormal' },
  26: { code: 26, name: 'vehicle_theft', severity: 'critical', description: 'Vehicle theft alarm' },
  27: { code: 27, name: 'illegal_ignition', severity: 'high', description: 'Illegal ignition' },
  28: { code: 28, name: 'illegal_displacement', severity: 'high', description: 'Illegal displacement' },
  29: { code: 29, name: 'collision', severity: 'critical', description: 'Collision alarm' },
  30: { code: 30, name: 'rollover', severity: 'critical', description: 'Rollover alarm' }
};

export const MessageIds = {
  TERMINAL_GENERAL_RESPONSE: 0x0001,
  PLATFORM_GENERAL_RESPONSE: 0x8001,
  TERMINAL_HEARTBEAT: 0x0002,
  TERMINAL_REGISTER: 0x0100,
  TERMINAL_REGISTER_RESPONSE: 0x8100,
  TERMINAL_UNREGISTER: 0x0003,
  TERMINAL_AUTHENTICATION: 0x0102,
  QUERY_TERMINAL_PARAMETERS: 0x8104,
  QUERY_TERMINAL_PARAMETERS_RESPONSE: 0x0104,
  TERMINAL_CONTROL: 0x8105,
  QUERY_TERMINAL_ATTRIBUTES: 0x8107,
  QUERY_TERMINAL_ATTRIBUTES_RESPONSE: 0x0107,
  LOCATION_INFO_REPORT: 0x0200,
  LOCATION_BATCH_UPLOAD: 0x0704,
  QUERY_LOCATION_INFO: 0x8201,
  QUERY_LOCATION_INFO_RESPONSE: 0x0201,
  TEMPORARY_LOCATION_TRACKING: 0x8202,
  VEHICLE_CONTROL: 0x8500,
  VEHICLE_CONTROL_RESPONSE: 0x0500,
  SET_POLYGON_AREA: 0x8604,
  DELETE_POLYGON_AREA: 0x8605,
  SET_TERMINAL_PARAMETERS: 0x8103,
  RSA_PUBLIC_KEY: 0x8A00
} as const;

export type MessageIdType = typeof MessageIds[keyof typeof MessageIds];

export const EncryptionType = {
  NONE: 0b000,
  RSA: 0b001
} as const;
