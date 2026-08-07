import { DeviceManager } from './device-manager';
import { APIServer } from './api-server';

async function startRaidarTracking() {
  console.log('Starting Raidar Tracking Platform...');

  const tcpPort = parseInt(process.env.TCP_PORT || '8443');
  const apiPort = parseInt(process.env.API_PORT || '3000');

  if (tcpPort < 1024) {
    console.warn(`TCP_PORT=${tcpPort} is a privileged port; Node needs root or CAP_NET_BIND_SERVICE to bind it.`);
  }

  const deviceManager = new DeviceManager(tcpPort);
  await deviceManager.start();

  const apiServer = new APIServer(deviceManager, apiPort);
  await apiServer.start();

  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║          RAIDAR TRACKING PLATFORM STARTED             ║
║                                                       ║
║  TCP Server:  port ${tcpPort}                              ║
║  API Server:  port ${apiPort}                              ║
║                                                       ║
║  Ready to receive device connections and API calls    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down Raidar Tracking Platform...`);
    await deviceManager.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startRaidarTracking().catch(error => {
  console.error('Failed to start Raidar Tracking Platform:', error);
  process.exit(1);
});
