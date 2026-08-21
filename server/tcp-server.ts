import net from 'net';
import { EventEmitter } from 'events';
import { ProtocolParser, MessageHandlers, MessageIds, ProtocolMessage } from '../src/lib/gprs-protocol';

export interface DeviceSession {
  socket: net.Socket;
  deviceId?: string;
  phoneNumber?: string;
  lastHeartbeat: Date;
  authenticated: boolean;
  serialNumber: number;
  connectedAt: Date;
  lastSeenAt: Date;
  validated: boolean;
  probeBuffer: Buffer;
}

export interface RawPacketLog {
  sessionId: string;
  remoteAddress: string;
  timestamp: Date;
  direction: 'in' | 'out';
  hex: string;
  ascii: string;
  byteLength: number;
  parseError?: string;
}

export interface BlockedConnectionInfo {
  sessionId: string;
  remoteAddress: string;
  reason: 'http_probe' | 'no_protocol_delimiter' | 'oversized_junk';
  firstBytesHex: string;
  firstBytesAscii: string;
  byteLength: number;
}

const PROTOCOL_DELIMITER = 0x7e;
const MAX_PROBE_BYTES = 256;
const HTTP_METHOD_PREFIXES = [
  'GET ', 'POST ', 'HEAD ', 'PUT ', 'DELETE',
  'OPTIONS', 'PATCH ', 'CONNECT', 'TRACE '
];

export class TCPServer extends EventEmitter {
  private server: net.Server;
  private sessions: Map<string, DeviceSession> = new Map();
  private port: number;
  private heartbeatTimeout: number = 180000;
  private rawPacketLog: RawPacketLog[] = [];
  private readonly MAX_PACKET_LOG = 200;

  constructor(port: number = 8888) {
    super();
    this.port = port;
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  start(): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 3000;

    const attempt = (retryCount: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE' && retryCount < maxRetries) {
            console.log(`TCP port ${this.port} in use, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
            this.server.close();
            setTimeout(() => {
              this.server = new net.Server(this.handleConnection.bind(this));
              this.server.on('connection', this.handleConnection.bind(this));
              attempt(retryCount + 1).then(resolve, reject);
            }, retryDelay);
          } else if (error.code === 'EADDRINUSE') {
            console.error(`TCP Server cannot bind port ${this.port} after ${maxRetries} attempts.`);
            reject(error);
          } else if (error.code === 'EACCES') {
            console.error(`TCP Server cannot bind port ${this.port}: permission denied.`);
            reject(error);
          } else {
            console.error('TCP Server error:', error);
            reject(error);
          }
        };

        this.server.once('error', onError);
        this.server.listen({ port: this.port, host: '0.0.0.0', reusePort: false }, () => {
          this.server.removeListener('error', onError);
          const address = this.server.address();
          const bound = typeof address === 'object' && address ? `${address.address}:${address.port}` : String(address);
          console.log(`TCP Server listening on ${bound}`);
          this.startHeartbeatMonitor();
          resolve();
        });
      });
    };

    return attempt(0);
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const session of this.sessions.values()) {
        session.socket.end();
      }
      this.sessions.clear();

      this.server.close(() => {
        console.log('TCP Server stopped');
        resolve();
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    const sessionId = `${socket.remoteAddress}:${socket.remotePort}`;

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 30000);

    const now = new Date();
    const session: DeviceSession = {
      socket,
      lastHeartbeat: now,
      authenticated: false,
      serialNumber: 1,
      connectedAt: now,
      lastSeenAt: now,
      validated: false,
      probeBuffer: Buffer.alloc(0),
    };

    this.sessions.set(sessionId, session);

    console.log(`New connection from ${sessionId}`);

    let buffer = Buffer.alloc(0);

    socket.on('data', (data) => {
      if (!session.validated) {
        session.probeBuffer = Buffer.concat([session.probeBuffer, data]);

        const httpReason = this.detectHttpProbe(session.probeBuffer);
        if (httpReason) {
          this.rejectConnection(sessionId, socket, session, 'http_probe');
          return;
        }

        const delimiterIndex = session.probeBuffer.indexOf(PROTOCOL_DELIMITER);
        if (delimiterIndex === -1) {
          if (session.probeBuffer.length >= MAX_PROBE_BYTES) {
            this.rejectConnection(sessionId, socket, session, 'no_protocol_delimiter');
          }
          return;
        }

        session.validated = true;
        this.emit('connection', { sessionId, session });
        buffer = session.probeBuffer.slice(delimiterIndex);
        session.probeBuffer = Buffer.alloc(0);
        this.logPacket(sessionId, socket.remoteAddress || 'unknown', buffer, 'in');
        console.log(`[${sessionId}] Validated GPS session - accepting protocol traffic`);
      } else {
        console.log(`[${sessionId}] RAW DATA (${data.length} bytes): ${data.toString('hex')}`);
        this.logPacket(sessionId, socket.remoteAddress || 'unknown', data, 'in');
        buffer = Buffer.concat([buffer, data]);
      }

      while (buffer.length > 0) {
        if (buffer[0] !== 0x7e) {
          const nextDelimiter = buffer.indexOf(0x7e);
          if (nextDelimiter === -1) {
            console.warn(`[${sessionId}] No start delimiter 0x7e found in buffer, discarding ${buffer.length} bytes: ${buffer.toString('hex')}`);
            buffer = Buffer.alloc(0);
            break;
          }
          console.warn(`[${sessionId}] Discarding ${nextDelimiter} bytes before start delimiter: ${buffer.slice(0, nextDelimiter).toString('hex')}`);
          buffer = buffer.slice(nextDelimiter);
        }

        const delimiterIndex = buffer.indexOf(0x7e, 1);

        if (delimiterIndex === -1) {
          if (buffer.length > 2048) {
            console.error(`[${sessionId}] Buffer overflow (${buffer.length} bytes), clearing buffer`);
            buffer = Buffer.alloc(0);
          }
          break;
        }

        const messageBuffer = buffer.slice(0, delimiterIndex + 1);
        buffer = buffer.slice(delimiterIndex + 1);

        this.handleMessage(session, messageBuffer, sessionId);
      }
    });

    socket.on('close', () => {
      const duration = Date.now() - session.connectedAt.getTime();
      if (!session.validated && session.probeBuffer.length === 0) {
        console.warn(
          `[${sessionId}] Connection closed after ${duration}ms with NO data received. ` +
          `The device connected but never sent anything. Check: (1) device protocol matches JT/T 808, ` +
          `(2) device is not expecting TLS/SSL, (3) device IP/port config matches this server.`
        );
      } else if (!session.validated) {
        console.warn(
          `[${sessionId}] Connection closed after ${duration}ms during probe phase. ` +
          `Received ${session.probeBuffer.length} bytes but no 0x7e delimiter found. ` +
          `Data: ${session.probeBuffer.toString('hex')} | ASCII: ${session.probeBuffer.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}`
        );
      } else {
        console.log(`Connection closed: ${sessionId}`);
      }
      const wasValidated = session.validated;
      this.sessions.delete(sessionId);
      if (wasValidated) {
        this.emit('disconnect', { sessionId, session });
      }
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${sessionId}:`, error);
      this.sessions.delete(sessionId);
      socket.destroy();
    });
  }

  private detectHttpProbe(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    const head = buffer.slice(0, Math.min(8, buffer.length)).toString('ascii');
    return HTTP_METHOD_PREFIXES.some((prefix) => head.startsWith(prefix));
  }

  private rejectConnection(
    sessionId: string,
    socket: net.Socket,
    session: DeviceSession,
    reason: BlockedConnectionInfo['reason']
  ): void {
    const bytes = session.probeBuffer;
    const preview = bytes.slice(0, Math.min(64, bytes.length));
    const info: BlockedConnectionInfo = {
      sessionId,
      remoteAddress: socket.remoteAddress || 'unknown',
      reason,
      firstBytesHex: preview.toString('hex'),
      firstBytesAscii: preview.toString('ascii').replace(/[^\x20-\x7e]/g, '.'),
      byteLength: bytes.length,
    };

    console.warn(
      `[${sessionId}] Rejecting non-GPS connection (${reason}, ${bytes.length} bytes): ${info.firstBytesAscii}`
    );

    this.emit('blocked', info);
    session.probeBuffer = Buffer.alloc(0);
    this.sessions.delete(sessionId);
    socket.destroy();
  }


  private handleMessage(session: DeviceSession, messageBuffer: Buffer, sessionId: string): void {
    console.log(`[${sessionId}] Message frame (${messageBuffer.length} bytes): ${messageBuffer.toString('hex')}`);

    const message = ProtocolParser.parseMessage(messageBuffer);

    if (!message) {
      console.error(`[${sessionId}] Failed to parse message (${messageBuffer.length} bytes): ${messageBuffer.toString('hex')}`);
      this.emit('messageLog', {
        sessionId,
        remoteAddress: session.socket.remoteAddress,
        phoneNumber: session.phoneNumber,
        bodyLength: messageBuffer.length,
        bodyHex: messageBuffer.toString('hex'),
        parseStatus: 'parse_failed' as const,
        parseNote: 'ProtocolParser returned null',
      });
      return;
    }

    session.lastHeartbeat = new Date();
    session.lastSeenAt = session.lastHeartbeat;

    if (!session.phoneNumber && message.header.phoneNumber) {
      session.phoneNumber = message.header.phoneNumber;
    }

    console.log(`Received message ID: 0x${message.header.messageId.toString(16)} from ${session.phoneNumber || 'unknown'}`);

    this.emit('messageLog', {
      sessionId,
      remoteAddress: session.socket.remoteAddress,
      phoneNumber: session.phoneNumber ?? message.header.phoneNumber,
      messageId: message.header.messageId,
      serialNumber: message.header.serialNumber,
      bodyLength: message.body.length,
      bodyHex: message.body.toString('hex'),
      parseStatus: 'parsed' as const,
    });

    switch (message.header.messageId) {
      case MessageIds.TERMINAL_REGISTER:
        this.handleTerminalRegister(session, message, sessionId);
        break;

      case MessageIds.TERMINAL_AUTHENTICATION:
        this.handleTerminalAuthentication(session, message, sessionId);
        break;

      case MessageIds.TERMINAL_HEARTBEAT:
        this.handleTerminalHeartbeat(session, message);
        break;

      case MessageIds.LOCATION_INFO_REPORT:
        this.handleLocationReport(session, message);
        break;

      case MessageIds.LOCATION_BATCH_UPLOAD:
        this.handleLocationBatchUpload(session, message, sessionId);
        break;

      case MessageIds.TERMINAL_GENERAL_RESPONSE:
        this.handleTerminalResponse(session, message);
        break;

      case MessageIds.TERMINAL_UNREGISTER:
        this.handleTerminalUnregister(session, message);
        break;

      default:
        console.log(`Unhandled message ID: 0x${message.header.messageId.toString(16)}`);
        this.emit('messageLog', {
          sessionId,
          remoteAddress: session.socket.remoteAddress,
          phoneNumber: session.phoneNumber,
          messageId: message.header.messageId,
          serialNumber: message.header.serialNumber,
          bodyLength: message.body.length,
          bodyHex: message.body.toString('hex'),
          parseStatus: 'unhandled' as const,
          parseNote: `no handler for 0x${message.header.messageId.toString(16)}`,
        });
        this.sendGeneralResponse(session, message, 0);
    }
  }

  private handleTerminalRegister(session: DeviceSession, message: ProtocolMessage, sessionId: string): void {
    const registration = MessageHandlers.parseTerminalRegistration(message.body);

    if (!registration) {
      console.error('Failed to parse terminal registration');
      return;
    }

    session.phoneNumber = message.header.phoneNumber;
    session.deviceId = registration.terminalId;

    console.log(`Terminal registration: ${registration.terminalId}, Serial: ${session.phoneNumber}, Plate: ${registration.licensePlate}`);

    this.emit('register', {
      sessionId,
      session,
      registration
    });

    const authCode = this.generateAuthenticationCode();
    const response = MessageHandlers.createTerminalRegisterResponse(
      session.phoneNumber,
      session.serialNumber++,
      message.header.serialNumber,
      0,
      authCode
    );

    session.socket.write(response);
  }

  private handleTerminalAuthentication(session: DeviceSession, message: ProtocolMessage, sessionId: string): void {
    const authCode = message.body.toString('utf8');

    session.phoneNumber = message.header.phoneNumber;
    session.authenticated = true;

    console.log(`Terminal authenticated: serial=${session.phoneNumber}, Auth code: ${authCode}`);

    this.emit('authenticate', {
      sessionId,
      session,
      authCode
    });

    this.sendGeneralResponse(session, message, 0);
  }

  private handleTerminalHeartbeat(session: DeviceSession, message: ProtocolMessage): void {
    session.lastHeartbeat = new Date();

    this.emit('heartbeat', {
      session,
      timestamp: session.lastHeartbeat
    });

    this.sendGeneralResponse(session, message, 0);
  }

  private handleLocationReport(session: DeviceSession, message: ProtocolMessage): void {
    const locationData = MessageHandlers.parseLocationInfo(message.body);

    if (!locationData) {
      console.error('Failed to parse location data');
      return;
    }

    console.log(`Location from serial=${session.phoneNumber}: ${locationData.latitude}, ${locationData.longitude}, Speed: ${locationData.speed} km/h`);

    this.emit('location', {
      session,
      locationData,
      rawMessage: message
    });

    this.sendGeneralResponse(session, message, 0);
  }

  private handleLocationBatchUpload(session: DeviceSession, message: ProtocolMessage, sessionId: string): void {
    const body = message.body;
    if (body.length < 3) {
      console.error(`[${sessionId}] Batched location upload body too short (${body.length} bytes)`);
      this.emit('messageLog', {
        sessionId,
        remoteAddress: session.socket.remoteAddress,
        phoneNumber: session.phoneNumber,
        messageId: message.header.messageId,
        serialNumber: message.header.serialNumber,
        bodyLength: body.length,
        bodyHex: body.toString('hex'),
        parseStatus: 'parse_failed' as const,
        parseNote: 'batch body < 3 bytes',
      });
      this.sendGeneralResponse(session, message, 1);
      return;
    }

    const itemCount = ProtocolParser.readWord(body, 0);
    const uploadType = ProtocolParser.readByte(body, 2);
    let offset = 3;
    let parsed = 0;
    let failed = 0;

    console.log(`[${sessionId}] Batched location upload: count=${itemCount} type=${uploadType}`);

    for (let i = 0; i < itemCount && offset + 2 <= body.length; i++) {
      const itemLength = ProtocolParser.readWord(body, offset);
      offset += 2;

      if (offset + itemLength > body.length) {
        failed++;
        break;
      }

      const itemBody = body.slice(offset, offset + itemLength);
      offset += itemLength;

      const locationData = MessageHandlers.parseLocationInfo(itemBody);
      if (!locationData) {
        failed++;
        continue;
      }

      parsed++;
      this.emit('location', {
        session,
        locationData,
        rawMessage: { header: message.header, body: itemBody } as ProtocolMessage,
      });
    }

    this.emit('messageLog', {
      sessionId,
      remoteAddress: session.socket.remoteAddress,
      phoneNumber: session.phoneNumber,
      messageId: message.header.messageId,
      serialNumber: message.header.serialNumber,
      bodyLength: body.length,
      bodyHex: body.toString('hex'),
      parseStatus: 'batch_expanded' as const,
      parseNote: `count=${itemCount} type=${uploadType} parsed=${parsed} failed=${failed}`,
    });

    this.sendGeneralResponse(session, message, 0);
  }

  private handleTerminalResponse(session: DeviceSession, message: ProtocolMessage): void {
    if (message.body.length < 5) {
      return;
    }

    const responseSerialNumber = ProtocolParser.readWord(message.body, 0);
    const responseMessageId = ProtocolParser.readWord(message.body, 2);
    const result = ProtocolParser.readByte(message.body, 4);

    console.log(`Terminal response for message ID 0x${responseMessageId.toString(16)}, Result: ${result}`);

    this.emit('commandResponse', {
      session,
      responseSerialNumber,
      responseMessageId,
      result
    });
  }

  private handleTerminalUnregister(session: DeviceSession, message: ProtocolMessage): void {
    console.log(`Terminal unregister: serial=${session.phoneNumber}`);

    this.emit('unregister', {
      session
    });

    this.sendGeneralResponse(session, message, 0);
  }

  private sendGeneralResponse(session: DeviceSession, message: ProtocolMessage, result: number): void {
    if (!session.phoneNumber) {
      return;
    }

    const response = MessageHandlers.createPlatformGeneralResponse(
      session.phoneNumber,
      session.serialNumber++,
      message.header.serialNumber,
      message.header.messageId,
      result
    );

    session.socket.write(response);
  }

  sendCommandToDevice(phoneNumber: string, commandBuffer: Buffer): boolean {
    for (const session of this.sessions.values()) {
      if (session.phoneNumber === phoneNumber && session.authenticated) {
        session.socket.write(commandBuffer);
        return true;
      }
    }
    return false;
  }

  private generateAuthenticationCode(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private startHeartbeatMonitor(): void {
    setInterval(() => {
      const now = new Date();

      for (const [sessionId, session] of this.sessions.entries()) {
        const timeSinceHeartbeat = now.getTime() - session.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > this.heartbeatTimeout) {
          console.log(`Heartbeat timeout for ${sessionId}, closing connection`);
          session.socket.end();
          this.sessions.delete(sessionId);
        }
      }
    }, 60000);
  }

  getSessionByPhone(phoneNumber: string): DeviceSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.phoneNumber === phoneNumber) {
        return session;
      }
    }
    return undefined;
  }

  getActiveSessions(): { sessionId: string; phoneNumber?: string; remoteAddress?: string; authenticated: boolean; connectedAt: Date; lastSeenAt: Date }[] {
    return Array.from(this.sessions.entries())
      .filter(([, s]) => s.validated)
      .map(([id, s]) => ({
        sessionId: id,
        phoneNumber: s.phoneNumber,
        remoteAddress: s.socket.remoteAddress,
        authenticated: s.authenticated,
        connectedAt: s.connectedAt,
        lastSeenAt: s.lastSeenAt,
      }));
  }

  getRawPacketLog(): RawPacketLog[] {
    return [...this.rawPacketLog].reverse();
  }

  private logPacket(sessionId: string, remoteAddress: string, data: Buffer, direction: 'in' | 'out', parseError?: string): void {
    this.rawPacketLog.push({
      sessionId,
      remoteAddress,
      timestamp: new Date(),
      direction,
      hex: data.toString('hex'),
      ascii: data.toString('ascii').replace(/[^\x20-\x7e]/g, '.'),
      byteLength: data.length,
      parseError,
    });
    if (this.rawPacketLog.length > this.MAX_PACKET_LOG) {
      this.rawPacketLog.shift();
    }
  }
}
