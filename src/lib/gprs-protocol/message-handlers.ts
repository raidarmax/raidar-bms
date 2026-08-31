import { ProtocolParser } from './parser';
import { LocationData, TerminalRegistration, MessageIds, AlarmFlags } from './types';

export class MessageHandlers {
  static parseLocationInfo(body: Buffer): LocationData | null {
    if (body.length < 28) {
      return null;
    }

    let offset = 0;

    const alarmFlags = BigInt(ProtocolParser.readDWord(body, offset));
    offset += 4;

    const statusFlags = BigInt(ProtocolParser.readDWord(body, offset));
    offset += 4;

    // Latitude/longitude can be encoded two ways: signed int32 (negative for
    // South/West) or unsigned with the hemisphere in status flags (bit 2 = South,
    // bit 3 = West). Read as signed so both styles work: if the value is already
    // negative the sign is baked in; if it's positive and the flag is set, negate.
    const latitudeRaw = body.readInt32BE(offset);
    offset += 4;
    const isSouth = (statusFlags & 0x04n) !== 0n;
    let latitude = latitudeRaw / 1000000;
    if (latitude > 0 && isSouth) latitude = -latitude;

    const longitudeRaw = body.readInt32BE(offset);
    offset += 4;
    const isWest = (statusFlags & 0x08n) !== 0n;
    let longitude = longitudeRaw / 1000000;
    if (longitude > 0 && isWest) longitude = -longitude;

    const altitude = ProtocolParser.readWord(body, offset);
    offset += 2;

    const speedRaw = ProtocolParser.readWord(body, offset);
    offset += 2;
    const speed = speedRaw / 10;

    const heading = ProtocolParser.readWord(body, offset);
    offset += 2;

    const year = ProtocolParser.readByte(body, offset);
    offset += 1;
    const month = ProtocolParser.readByte(body, offset);
    offset += 1;
    const day = ProtocolParser.readByte(body, offset);
    offset += 1;
    const hour = ProtocolParser.readByte(body, offset);
    offset += 1;
    const minute = ProtocolParser.readByte(body, offset);
    offset += 1;
    const second = ProtocolParser.readByte(body, offset);
    offset += 1;

    const timestamp = new Date(
      2000 + this.bcdToDecimal(year),
      this.bcdToDecimal(month) - 1,
      this.bcdToDecimal(day),
      this.bcdToDecimal(hour),
      this.bcdToDecimal(minute),
      this.bcdToDecimal(second)
    );

    const additionalInfo: Record<string, any> = {};

    while (offset < body.length) {
      if (offset + 2 > body.length) break;

      const infoId = ProtocolParser.readByte(body, offset);
      offset += 1;

      const infoLength = ProtocolParser.readByte(body, offset);
      offset += 1;

      if (offset + infoLength > body.length) break;

      const infoData = body.slice(offset, offset + infoLength);
      offset += infoLength;

      this.parseAdditionalInfo(infoId, infoData, additionalInfo);
    }

    return {
      alarmFlags,
      statusFlags,
      latitude,
      longitude,
      altitude,
      speed,
      heading,
      timestamp,
      satellites: additionalInfo.satellites,
      odometer: additionalInfo.odometer,
      additionalInfo
    };
  }

  static parseAdditionalInfo(
    infoId: number,
    data: Buffer,
    result: Record<string, any>
  ): void {
    switch (infoId) {
      case 0x01:
        if (data.length >= 4) {
          result.odometer = BigInt(ProtocolParser.readDWord(data, 0));
        }
        break;
      case 0x02:
        if (data.length >= 2) {
          result.fuelLevel = ProtocolParser.readWord(data, 0) / 10;
        }
        break;
      case 0x03:
        if (data.length >= 2) {
          result.recordedSpeed = ProtocolParser.readWord(data, 0) / 10;
        }
        break;
      case 0x04:
        if (data.length >= 2) {
          result.alarmEventId = ProtocolParser.readWord(data, 0);
        }
        break;
      case 0x11:
        if (data.length >= 1) {
          result.overspeedAlarmExtra = {
            type: ProtocolParser.readByte(data, 0),
            areaId: data.length >= 5 ? ProtocolParser.readDWord(data, 1) : undefined
          };
        }
        break;
      case 0x12:
        if (data.length >= 6) {
          result.inOutAreaAlarm = {
            type: ProtocolParser.readByte(data, 0),
            areaId: ProtocolParser.readDWord(data, 1),
            direction: ProtocolParser.readByte(data, 5)
          };
        }
        break;
      case 0x25:
        if (data.length >= 4) {
          result.extendedVehicleSignal = ProtocolParser.readDWord(data, 0);
        }
        break;
      case 0x2A:
        if (data.length >= 2) {
          result.ioStatus = ProtocolParser.readWord(data, 0);
        }
        break;
      case 0x2B:
        if (data.length >= 4) {
          result.analogValue = ProtocolParser.readDWord(data, 0);
        }
        break;
      case 0x30:
        if (data.length >= 1) {
          result.wirelessSignalStrength = ProtocolParser.readByte(data, 0);
        }
        break;
      case 0x31:
        if (data.length >= 1) {
          result.satellites = ProtocolParser.readByte(data, 0);
        }
        break;
    }
  }

  static parseTerminalRegistration(body: Buffer): TerminalRegistration | null {
    if (body.length < 37) {
      return null;
    }

    let offset = 0;

    const provinceId = ProtocolParser.readWord(body, offset);
    offset += 2;

    const cityId = ProtocolParser.readWord(body, offset);
    offset += 2;

    const manufacturerId = body.slice(offset, offset + 5).toString('ascii').replace(/\0/g, '');
    offset += 5;

    const terminalModel = body.slice(offset, offset + 20).toString('ascii').replace(/\0/g, '');
    offset += 20;

    // JT/T 808: terminal ID is variable length (1-12 bytes).
    // Derive it from the body length: body = province(2) + city(2) + mfr(5) +
    // model(20) + terminalId(variable) + plateColor(1) + plate(remaining)
    const terminalIdLength = body.length - offset - 1;
    const terminalId = body.slice(offset, offset + terminalIdLength).toString('ascii').replace(/\0/g, '');
    offset += terminalIdLength;

    const licensePlateColor = ProtocolParser.readByte(body, offset);
    offset += 1;

    const licensePlate = body.slice(offset).toString('utf8').replace(/\0/g, '');

    return {
      provinceId,
      cityId,
      manufacturerId,
      terminalModel,
      terminalId,
      licensePlateColor,
      licensePlate
    };
  }

  static createPlatformGeneralResponse(
    phoneNumber: string,
    serialNumber: number,
    responseSerialNumber: number,
    responseMessageId: number,
    result: number
  ): Buffer {
    const body = Buffer.alloc(5);
    let offset = 0;

    ProtocolParser.writeWord(body, responseSerialNumber, offset);
    offset += 2;

    ProtocolParser.writeWord(body, responseMessageId, offset);
    offset += 2;

    ProtocolParser.writeByte(body, result, offset);

    return ProtocolParser.createMessage(
      MessageIds.PLATFORM_GENERAL_RESPONSE,
      phoneNumber,
      serialNumber,
      body
    );
  }

  static createTerminalRegisterResponse(
    phoneNumber: string,
    serialNumber: number,
    responseSerialNumber: number,
    result: number,
    authenticationCode?: string
  ): Buffer {
    const authCodeBuffer = authenticationCode
      ? Buffer.from(authenticationCode, 'utf8')
      : Buffer.alloc(0);

    const body = Buffer.alloc(3 + authCodeBuffer.length);
    let offset = 0;

    ProtocolParser.writeWord(body, responseSerialNumber, offset);
    offset += 2;

    ProtocolParser.writeByte(body, result, offset);
    offset += 1;

    if (authCodeBuffer.length > 0) {
      authCodeBuffer.copy(body, offset);
    }

    return ProtocolParser.createMessage(
      MessageIds.TERMINAL_REGISTER_RESPONSE,
      phoneNumber,
      serialNumber,
      body
    );
  }

  static createSetTerminalParametersCommand(
    phoneNumber: string,
    serialNumber: number,
    parameters: Record<number, any>
  ): Buffer {
    const paramBuffers: Buffer[] = [];

    for (const [paramId, value] of Object.entries(parameters)) {
      const id = parseInt(paramId);
      const paramBuffer = this.encodeParameter(id, value);
      if (paramBuffer) {
        paramBuffers.push(paramBuffer);
      }
    }

    const totalLength = paramBuffers.reduce((sum, buf) => sum + buf.length, 0);
    const body = Buffer.alloc(1 + totalLength);
    let offset = 0;

    ProtocolParser.writeByte(body, paramBuffers.length, offset);
    offset += 1;

    for (const paramBuffer of paramBuffers) {
      paramBuffer.copy(body, offset);
      offset += paramBuffer.length;
    }

    return ProtocolParser.createMessage(
      MessageIds.SET_TERMINAL_PARAMETERS,
      phoneNumber,
      serialNumber,
      body
    );
  }

  static encodeParameter(paramId: number, value: any): Buffer | null {
    const idBuffer = Buffer.alloc(4);
    ProtocolParser.writeDWord(idBuffer, paramId, 0);

    let valueBuffer: Buffer;

    if (typeof value === 'number') {
      if (value <= 0xFF) {
        valueBuffer = Buffer.alloc(1);
        ProtocolParser.writeByte(valueBuffer, value, 0);
      } else if (value <= 0xFFFF) {
        valueBuffer = Buffer.alloc(2);
        ProtocolParser.writeWord(valueBuffer, value, 0);
      } else {
        valueBuffer = Buffer.alloc(4);
        ProtocolParser.writeDWord(valueBuffer, value, 0);
      }
    } else if (typeof value === 'string') {
      valueBuffer = Buffer.from(value, 'utf8');
    } else {
      return null;
    }

    const lengthBuffer = Buffer.alloc(1);
    ProtocolParser.writeByte(lengthBuffer, valueBuffer.length, 0);

    return Buffer.concat([idBuffer, lengthBuffer, valueBuffer]);
  }

  static extractAlarms(alarmFlags: bigint): Array<{ code: number; name: string; severity: string; description: string }> {
    const alarms = [];

    for (let i = 0; i < 32; i++) {
      if ((alarmFlags & (1n << BigInt(i))) !== 0n) {
        const alarmInfo = AlarmFlags[i];
        if (alarmInfo) {
          alarms.push(alarmInfo);
        }
      }
    }

    return alarms;
  }

  static getPositioningStatus(statusFlags: bigint): boolean {
    return (statusFlags & (1n << 1n)) !== 0n;
  }

  static getACCStatus(statusFlags: bigint): boolean {
    return (statusFlags & 1n) !== 0n;
  }

  private static bcdToDecimal(bcd: number): number {
    return ((bcd >> 4) * 10) + (bcd & 0x0F);
  }
}
