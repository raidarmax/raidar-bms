import { TCPServer, DeviceSession, BlockedConnectionInfo } from './tcp-server';
import { DatabaseService } from './database-service';
import { ProtocolMessage } from '../src/lib/gprs-protocol';

export class DeviceManager {
  private tcpServer: TCPServer;
  private dbService: DatabaseService;
  private connectionMap: Map<string, string> = new Map();

  constructor(port: number = 8888) {
    this.tcpServer = new TCPServer(port);
    this.dbService = new DatabaseService();
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    await this.tcpServer.start();
    console.log('Device Manager started');
  }

  async stop(): Promise<void> {
    await this.tcpServer.stop();
    console.log('Device Manager stopped');
  }

  private setupEventHandlers(): void {
    this.tcpServer.on('connection', async ({ sessionId, session }) => {
      console.log(`Device connected: ${sessionId}`);

      const device = await this.dbService.getDeviceByPhoneNumber(session.phoneNumber || '');
      if (device) {
        const connection = await this.dbService.recordConnection(
          device.id,
          session.socket.remoteAddress || 'unknown'
        );
        if (connection) {
          this.connectionMap.set(sessionId, connection.id);
        }
      }
    });

    this.tcpServer.on('disconnect', async ({ sessionId, session }) => {
      console.log(`Device disconnected: ${sessionId}`);

      if (session.deviceId) {
        await this.dbService.updateDeviceStatus(session.deviceId, 'offline');
      }

      const connectionId = this.connectionMap.get(sessionId);
      if (connectionId) {
        await this.dbService.closeConnection(connectionId, 'client_disconnect');
        this.connectionMap.delete(sessionId);
      }
    });

    this.tcpServer.on('blocked', (info: BlockedConnectionInfo) => {
      void this.dbService.logBlockedConnection({
        remoteAddress: info.remoteAddress,
        reason: info.reason,
        firstBytesHex: info.firstBytesHex,
        firstBytesAscii: info.firstBytesAscii,
        byteLength: info.byteLength,
      });
    });

    this.tcpServer.on('messageLog', (entry) => {
      void this.dbService.logMessage(entry);
    });

    this.tcpServer.on('register', async ({ session, registration }) => {
      console.log(`Device registration: ${registration.terminalId}`);

      try {
        const authCode = Math.random().toString(36).substring(2, 15);
        const device = await this.dbService.registerDevice(
          registration,
          session.phoneNumber!,
          authCode
        );

        console.log(`Device registered successfully: ${device.id}`);
      } catch (error) {
        console.error('Failed to register device:', error);
      }
    });

    this.tcpServer.on('authenticate', async ({ session, authCode }) => {
      console.log(`Device authenticated: serial=${session.phoneNumber}`);

      let device = await this.dbService.getDeviceByPhoneNumber(session.phoneNumber!);
      if (!device) {
        try {
          device = await this.dbService.autoRegisterDevice(session.phoneNumber!, session.deviceId);
          console.log(`[authenticate] auto-registered device: id=${device.id} device_id=${device.device_id}`);
        } catch (err) {
          console.error(`[authenticate] auto-register failed for serial ${session.phoneNumber}:`, err);
          return;
        }
      }
      if (device.device_id !== device.phone_number) {
        await this.dbService.fixDeviceId(device.id, device.phone_number);
        device.device_id = device.phone_number;
      }
      await this.dbService.updateDeviceStatus(device.device_id, 'online');
      session.deviceId = device.device_id;

      await this.processPendingCommands(device.id, session);
    });

    this.tcpServer.on('heartbeat', async ({ session }) => {
      if (session.deviceId) {
        await this.dbService.updateHeartbeat(session.deviceId);
      }
    });

    this.tcpServer.on('location', async ({ session, locationData, rawMessage }) => {
      if (!session.phoneNumber) {
        console.warn(`[location] dropped — session has no serial number yet (session ${session.socket.remoteAddress}:${session.socket.remotePort}). The device must send a Register (0x0100) or Authentication (0x0102) first.`);
        return;
      }

      let device = await this.dbService.getDeviceByPhoneNumber(session.phoneNumber);
      if (!device) {
        console.log(`[location] no tracking_devices row for serial ${session.phoneNumber} — auto-registering device.`);
        try {
          device = await this.dbService.autoRegisterDevice(session.phoneNumber, session.deviceId);
          console.log(`[location] auto-registered device: id=${device.id} device_id=${device.device_id}`);
        } catch (err) {
          console.error(`[location] auto-register failed for serial ${session.phoneNumber}:`, err);
          return;
        }
      }

      const positioning = ((locationData as { statusFlags?: bigint }).statusFlags ?? 0n) & 2n;
      console.log(
        `[location] serial=${session.phoneNumber} device_row=${device.id} motorcycle=${device.motorcycle_id ?? 'none'} ` +
        `lat=${locationData.latitude} lng=${locationData.longitude} speed=${locationData.speed}km/h ` +
        `sats=${locationData.satellites ?? 0} positioning_bit=${positioning ? 'valid' : 'INVALID'}`
      );

      try {
        await this.dbService.saveLocation(
          device.id,
          locationData,
          (rawMessage as ProtocolMessage).body,
          device.motorcycle_id ?? null
        );

        if (!device.motorcycle_id) {
          console.warn(`[location] saved to device_locations but NOT to tracking_data — device ${device.device_id} is not linked to a motorcycle, so the map will not show it.`);
        }
      } catch (error) {
        console.error('[location] save failed:', error);
      }
    });

    this.tcpServer.on('commandResponse', async ({ session, responseSerialNumber, responseMessageId, result }) => {
      if (!session.phoneNumber) {
        return;
      }

      const device = await this.dbService.getDeviceByPhoneNumber(session.phoneNumber);
      if (!device) {
        return;
      }

      const commands = await this.dbService.getPendingCommands(device.id);
      const matchingCommand = commands.find(
        cmd => cmd.command_id === responseMessageId && cmd.status === 'sent'
      );

      if (matchingCommand) {
        const status = result === 0 ? 'acknowledged' : 'failed';
        await this.dbService.updateCommandStatus(
          matchingCommand.id,
          status,
          { result },
          undefined,
          result !== 0 ? `Command failed with code ${result}` : undefined
        );

        console.log(`Command ${matchingCommand.id} ${status}`);
      }
    });

    this.tcpServer.on('unregister', async ({ session }) => {
      if (session.deviceId) {
        await this.dbService.updateDeviceStatus(session.deviceId, 'suspended');
        console.log(`Device unregistered: ${session.deviceId}`);
      }
    });
  }

  private async processPendingCommands(deviceUuid: string, session: DeviceSession): Promise<void> {
    const commands = await this.dbService.getPendingCommands(deviceUuid);

    for (const command of commands) {
      if (command.status === 'queued' && command.raw_request) {
        const success = this.tcpServer.sendCommandToDevice(
          session.phoneNumber!,
          Buffer.from(command.raw_request)
        );

        if (success) {
          await this.dbService.updateCommandStatus(command.id, 'sent');
          console.log(`Command ${command.id} sent to device`);
        }
      }
    }
  }

  getTCPServer(): TCPServer {
    return this.tcpServer;
  }

  getDBService(): DatabaseService {
    return this.dbService;
  }
}
