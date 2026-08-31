import { ProtocolMessage, MessageHeader, BodyAttributes, PackageInfo } from './types';

export class ProtocolParser {
  private static readonly IDENTIFIER = 0x7e;
  private static readonly ESCAPE_BYTE = 0x7d;
  private static readonly ESCAPE_0x7E = 0x02;
  private static readonly ESCAPE_0x7D = 0x01;

  static unescape(buffer: Buffer): Buffer {
    const result: number[] = [];
    let i = 0;

    while (i < buffer.length) {
      if (buffer[i] === this.ESCAPE_BYTE && i + 1 < buffer.length) {
        if (buffer[i + 1] === this.ESCAPE_0x7E) {
          result.push(0x7e);
          i += 2;
        } else if (buffer[i + 1] === this.ESCAPE_0x7D) {
          result.push(0x7d);
          i += 2;
        } else {
          result.push(buffer[i]);
          i++;
        }
      } else {
        result.push(buffer[i]);
        i++;
      }
    }

    return Buffer.from(result);
  }

  static escape(buffer: Buffer): Buffer {
    const result: number[] = [];

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0x7e) {
        result.push(this.ESCAPE_BYTE, this.ESCAPE_0x7E);
      } else if (buffer[i] === 0x7d) {
        result.push(this.ESCAPE_BYTE, this.ESCAPE_0x7D);
      } else {
        result.push(buffer[i]);
      }
    }

    return Buffer.from(result);
  }

  static calculateChecksum(buffer: Buffer): number {
    let checksum = 0;
    for (let i = 0; i < buffer.length; i++) {
      checksum ^= buffer[i];
    }
    return checksum;
  }

  static parseMessage(rawBuffer: Buffer): ProtocolMessage | null {
    if (rawBuffer.length < 12) {
      console.error(`Parse error: message too short (${rawBuffer.length} bytes)`);
      return null;
    }

    if (rawBuffer[0] !== this.IDENTIFIER || rawBuffer[rawBuffer.length - 1] !== this.IDENTIFIER) {
      console.error(`Parse error: invalid delimiters. Start: 0x${rawBuffer[0].toString(16)}, End: 0x${rawBuffer[rawBuffer.length - 1].toString(16)}`);
      return null;
    }

    const content = rawBuffer.slice(1, rawBuffer.length - 1);
    const unescaped = this.unescape(content);

    if (unescaped.length < 11) {
      console.error(`Parse error: unescaped content too short (${unescaped.length} bytes)`);
      return null;
    }

    const checkCode = unescaped[unescaped.length - 1];
    const dataToCheck = unescaped.slice(0, unescaped.length - 1);
    const calculatedChecksum = this.calculateChecksum(dataToCheck);

    if (checkCode !== calculatedChecksum) {
      console.error(`Checksum mismatch: expected 0x${calculatedChecksum.toString(16)}, got 0x${checkCode.toString(16)}`);
      return null;
    }

    const header = this.parseHeader(dataToCheck);
    if (!header) {
      return null;
    }

    const headerLength = 12 + (header.bodyAttributes.subPackaged ? 4 : 0);
    const bodyLength = header.bodyAttributes.length;
    const body = dataToCheck.slice(headerLength, headerLength + bodyLength);

    return {
      identifierBit: this.IDENTIFIER,
      header,
      body,
      checkCode
    };
  }

  static parseHeader(buffer: Buffer): MessageHeader | null {
    if (buffer.length < 12) {
      return null;
    }

    let offset = 0;

    const messageId = buffer.readUInt16BE(offset);
    offset += 2;

    const bodyAttributesValue = buffer.readUInt16BE(offset);
    offset += 2;

    const bodyAttributes = this.parseBodyAttributes(bodyAttributesValue);

    const phoneNumber = this.parseBCDPhoneNumber(buffer.slice(offset, offset + 6));
    offset += 6;

    const serialNumber = buffer.readUInt16BE(offset);
    offset += 2;

    let packageInfo: PackageInfo | undefined;
    if (bodyAttributes.subPackaged) {
      const totalPackages = buffer.readUInt16BE(offset);
      offset += 2;
      const packageNumber = buffer.readUInt16BE(offset);
      offset += 2;
      packageInfo = { totalPackages, packageNumber };
    }

    return {
      messageId,
      bodyAttributes,
      phoneNumber,
      serialNumber,
      packageInfo
    };
  }

  static parseBodyAttributes(value: number): BodyAttributes {
    const length = value & 0x03FF;
    const encryption = (value >> 10) & 0x07;
    const subPackaged = ((value >> 13) & 0x01) === 1;
    const reserved = (value >> 14) & 0x03;

    return {
      length,
      encryption,
      subPackaged,
      reserved
    };
  }

  static parseBCDPhoneNumber(buffer: Buffer): string {
    let phoneNumber = '';
    for (let i = 0; i < buffer.length; i++) {
      const high = (buffer[i] >> 4) & 0x0f;
      const low = buffer[i] & 0x0f;
      phoneNumber += high.toString() + low.toString();
    }
    return phoneNumber;
  }

  static createMessage(
    messageId: number,
    phoneNumber: string,
    serialNumber: number,
    body: Buffer,
    encryption: number = 0
  ): Buffer {
    const bodyLength = body.length;
    const bodyAttributes = (bodyLength & 0x03FF) | ((encryption & 0x07) << 10);

    const header = Buffer.alloc(12);
    let offset = 0;

    header.writeUInt16BE(messageId, offset);
    offset += 2;

    header.writeUInt16BE(bodyAttributes, offset);
    offset += 2;

    const phoneBuffer = this.encodeBCDPhoneNumber(phoneNumber);
    phoneBuffer.copy(header, offset);
    offset += 6;

    header.writeUInt16BE(serialNumber, offset);

    const messageContent = Buffer.concat([header, body]);
    const checksum = this.calculateChecksum(messageContent);
    const checkBuffer = Buffer.from([checksum]);

    const fullMessage = Buffer.concat([messageContent, checkBuffer]);
    const escaped = this.escape(fullMessage);

    return Buffer.concat([
      Buffer.from([this.IDENTIFIER]),
      escaped,
      Buffer.from([this.IDENTIFIER])
    ]);
  }

  static encodeBCDPhoneNumber(phoneNumber: string): Buffer {
    const padded = phoneNumber.padStart(12, '0');
    const buffer = Buffer.alloc(6);

    for (let i = 0; i < 6; i++) {
      const high = parseInt(padded[i * 2], 10);
      const low = parseInt(padded[i * 2 + 1], 10);
      buffer[i] = (high << 4) | low;
    }

    return buffer;
  }

  static readDWord(buffer: Buffer, offset: number): number {
    return buffer.readUInt32BE(offset);
  }

  static readWord(buffer: Buffer, offset: number): number {
    return buffer.readUInt16BE(offset);
  }

  static readByte(buffer: Buffer, offset: number): number {
    return buffer.readUInt8(offset);
  }

  static writeDWord(buffer: Buffer, value: number, offset: number): void {
    buffer.writeUInt32BE(value, offset);
  }

  static writeWord(buffer: Buffer, value: number, offset: number): void {
    buffer.writeUInt16BE(value, offset);
  }

  static writeByte(buffer: Buffer, value: number, offset: number): void {
    buffer.writeUInt8(value, offset);
  }
}
