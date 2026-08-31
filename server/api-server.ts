import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { DatabaseService } from './database-service';
import { DeviceManager } from './device-manager';
import { MessageHandlers, MessageIds } from '../src/lib/gprs-protocol';

interface AuthRequest extends Request {
  apiClient?: any;
}

export class APIServer {
  private app: express.Application;
  private dbService: DatabaseService;
  private deviceManager: DeviceManager;
  private port: number;

  constructor(deviceManager: DeviceManager, port: number = 3000) {
    this.app = express();
    this.dbService = deviceManager.getDBService();
    this.deviceManager = deviceManager;
    this.port = port;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  private async authenticateAPI(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    try {
      const { data: apiClient, error } = await this.dbService['supabase']
        .from('api_clients')
        .select('*')
        .eq('api_key', apiKey)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !apiClient) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      await this.dbService['supabase']
        .from('api_clients')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', apiClient.id);

      req.apiClient = apiClient;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.get('/api/devices', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { data, error } = await this.dbService['supabase']
          .from('tracking_devices')
          .select('*, vehicles(*)')
          .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ devices: data });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch devices' });
      }
    });

    this.app.get('/api/devices/:deviceId', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { deviceId } = req.params;

        const { data, error } = await this.dbService['supabase']
          .from('tracking_devices')
          .select('*, vehicles(*)')
          .eq('device_id', deviceId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }

        res.json({ device: data });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch device' });
      }
    });

    this.app.get('/api/devices/:deviceId/location', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { deviceId } = req.params;

        const device = await this.dbService.getDeviceById(deviceId);
        if (!device) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }

        const location = await this.dbService.getLatestLocation(device.id);

        if (!location) {
          res.status(404).json({ error: 'No location data available' });
          return;
        }

        res.json({ location });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch location' });
      }
    });

    this.app.get('/api/devices/:deviceId/location/history', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { deviceId } = req.params;
        const { start, end, limit } = req.query;

        const device = await this.dbService.getDeviceById(deviceId);
        if (!device) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }

        const startTime = start ? new Date(start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endTime = end ? new Date(end as string) : new Date();
        const limitNum = limit ? parseInt(limit as string) : 1000;

        const locations = await this.dbService.getLocationHistory(device.id, startTime, endTime, limitNum);

        res.json({
          locations,
          count: locations.length,
          start: startTime,
          end: endTime
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch location history' });
      }
    });

    this.app.get('/api/devices/:deviceId/alarms', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { deviceId } = req.params;
        const { status } = req.query;

        const device = await this.dbService.getDeviceById(deviceId);
        if (!device) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }

        let query = this.dbService['supabase']
          .from('device_alarms')
          .select('*')
          .eq('device_id', device.id)
          .order('created_at', { ascending: false });

        if (status) {
          query = query.eq('status', status);
        }

        const { data: alarms, error } = await query;

        if (error) throw error;

        res.json({ alarms });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alarms' });
      }
    });

    this.app.post('/api/devices/:deviceId/alarms/:alarmId/acknowledge', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { alarmId } = req.params;

        await this.dbService.acknowledgeAlarm(alarmId, req.apiClient.id);

        res.json({ success: true, message: 'Alarm acknowledged' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to acknowledge alarm' });
      }
    });

    this.app.post('/api/devices/:deviceId/commands', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { deviceId } = req.params;
        const { commandType, parameters } = req.body;

        const device = await this.dbService.getDeviceById(deviceId);
        if (!device) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }

        let commandBuffer: Buffer;
        let commandId: number;

        switch (commandType) {
          case 'set_parameters':
            commandBuffer = MessageHandlers.createSetTerminalParametersCommand(
              device.phone_number,
              1,
              parameters
            );
            commandId = MessageIds.SET_TERMINAL_PARAMETERS;
            break;

          default:
            res.status(400).json({ error: 'Invalid command type' });
            return;
        }

        const command = await this.dbService.saveCommand(
          device.id,
          commandType,
          commandId,
          parameters,
          commandBuffer,
          req.apiClient.id,
          7
        );

        const session = this.deviceManager.getTCPServer().getSessionByPhone(device.phone_number);
        if (session && session.authenticated) {
          const success = this.deviceManager.getTCPServer().sendCommandToDevice(device.phone_number, commandBuffer);

          if (success) {
            await this.dbService.updateCommandStatus(command.id, 'sent');
          }
        }

        res.json({
          success: true,
          command: {
            id: command.id,
            status: command.status,
            created_at: command.created_at
          }
        });
      } catch (error) {
        console.error('Command error:', error);
        res.status(500).json({ error: 'Failed to send command' });
      }
    });

    this.app.get('/api/devices/:deviceId/commands', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { deviceId } = req.params;

        const device = await this.dbService.getDeviceById(deviceId);
        if (!device) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }

        const { data: commands, error } = await this.dbService['supabase']
          .from('device_commands')
          .select('*')
          .eq('device_id', device.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        res.json({ commands });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch commands' });
      }
    });

    this.app.get('/api/devices/:deviceId/commands/:commandId', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { commandId } = req.params;

        const { data: command, error } = await this.dbService['supabase']
          .from('device_commands')
          .select('*')
          .eq('id', commandId)
          .maybeSingle();

        if (error) throw error;

        if (!command) {
          res.status(404).json({ error: 'Command not found' });
          return;
        }

        res.json({ command });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch command' });
      }
    });

    this.app.get('/api/geofences', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { data: geofences, error } = await this.dbService['supabase']
          .from('geofences')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ geofences });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch geofences' });
      }
    });

    this.app.post('/api/geofences', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { name, type, coordinates, attributes, devices } = req.body;

        const { data: maxGeofence } = await this.dbService['supabase']
          .from('geofences')
          .select('geofence_id')
          .order('geofence_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        const geofenceId = (maxGeofence?.geofence_id || 0) + 1;

        const { data: geofence, error } = await this.dbService['supabase']
          .from('geofences')
          .insert({
            name,
            geofence_id: geofenceId,
            type: type || 'polygon',
            coordinates,
            attributes: attributes || {},
            devices: devices || []
          })
          .select()
          .single();

        if (error) throw error;

        res.json({ geofence });
      } catch (error) {
        console.error('Geofence creation error:', error);
        res.status(500).json({ error: 'Failed to create geofence' });
      }
    });

    this.app.delete('/api/geofences/:geofenceId', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { geofenceId } = req.params;

        const { error } = await this.dbService['supabase']
          .from('geofences')
          .delete()
          .eq('id', geofenceId);

        if (error) throw error;

        res.json({ success: true, message: 'Geofence deleted' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete geofence' });
      }
    });

    this.app.get('/api/stats/overview', this.authenticateAPI.bind(this), async (req: AuthRequest, res: Response) => {
      try {
        const { count: deviceCount } = await this.dbService['supabase']
          .from('tracking_devices')
          .select('*', { count: 'exact', head: true });

        const { count: onlineCount } = await this.dbService['supabase']
          .from('tracking_devices')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'online');

        const { count: activeAlarmsCount } = await this.dbService['supabase']
          .from('device_alarms')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        res.json({
          total_devices: deviceCount || 0,
          online_devices: onlineCount || 0,
          active_alarms: activeAlarmsCount || 0,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });

    this.app.get('/api/debug', (req: Request, res: Response) => {
      const tcp = this.deviceManager.getTCPServer();
      res.json({
        timestamp: new Date().toISOString(),
        active_sessions: tcp.getActiveSessions(),
        recent_packets: tcp.getRawPacketLog(),
      });
    });

    this.app.get('/api/debug/blocked', async (req: Request, res: Response) => {
      try {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
        const { data, error } = await this.dbService['supabase']
          .from('blocked_connections')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        const bySource: Record<string, number> = {};
        const byReason: Record<string, number> = {};
        for (const row of data || []) {
          const ip = (row.remote_address as string).split(':').slice(-2, -1)[0] || row.remote_address;
          bySource[ip] = (bySource[ip] || 0) + 1;
          byReason[row.reason] = (byReason[row.reason] || 0) + 1;
        }

        res.json({
          timestamp: new Date().toISOString(),
          count: data?.length || 0,
          summary: { by_source: bySource, by_reason: byReason },
          recent: data,
        });
      } catch (error) {
        console.error('Blocked connections query error:', error);
        res.status(500).json({ error: 'Failed to fetch blocked connections' });
      }
    });
  }

  start(): Promise<void> {
    const maxRetries = 5;
    const retryDelay = 2000;

    const attempt = (retryCount: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const server = this.app.listen(this.port, () => {
          console.log(`API Server listening on port ${this.port}`);
          resolve();
        });
        server.once('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE' && retryCount < maxRetries) {
            console.log(`API port ${this.port} in use, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})...`);
            setTimeout(() => {
              attempt(retryCount + 1).then(resolve, reject);
            }, retryDelay);
          } else {
            reject(error);
          }
        });
      });
    };

    return attempt(0);
  }
}
