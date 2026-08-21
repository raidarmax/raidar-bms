import net from 'net';
import { ProtocolParser, MessageHandlers, MessageIds, LocationData, TerminalRegistration } from '../src/lib/gprs-protocol';

const HOST = process.env.SIM_HOST || '127.0.0.1';
const PORT = parseInt(process.env.SIM_PORT || process.env.TCP_PORT || '8888');
const PHONE_NUMBER = process.env.SIM_PHONE || '254700000001';
const TERMINAL_ID = process.env.SIM_TERMINAL_ID || 'SIM0001';
const INTERVAL_MS = parseInt(process.env.SIM_INTERVAL_MS || '5000');
const CONTINUOUS = (process.env.SIM_CONTINUOUS || '').toLowerCase() === 'true'
  || process.env.SIM_CONTINUOUS === '1';
const TOTAL_PINGS = CONTINUOUS
  ? Number.POSITIVE_INFINITY
  : parseInt(process.env.SIM_TOTAL_PINGS || '20');
const RECONNECT_DELAY_MS = parseInt(process.env.SIM_RECONNECT_MS || '5000');

let serialNumber = 1;

function buildRegistration(): Buffer {
  const body = Buffer.alloc(37);
  let offset = 0;

  ProtocolParser.writeWord(body, 0, offset); offset += 2;
  ProtocolParser.writeWord(body, 0, offset); offset += 2;

  Buffer.from('SIMUL', 'ascii').copy(body, offset); offset += 5;
  Buffer.from('SIM-MODEL-X1', 'ascii').copy(body, offset); offset += 20;
  Buffer.from(TERMINAL_ID, 'ascii').copy(body, offset); offset += 7;

  ProtocolParser.writeByte(body, 1, offset); offset += 1;
  Buffer.from('KMGV001A', 'utf8').copy(body, offset);

  return ProtocolParser.createMessage(MessageIds.TERMINAL_REGISTER, PHONE_NUMBER, serialNumber++, body);
}

function buildAuth(authCode: string): Buffer {
  const body = Buffer.from(authCode, 'utf8');
  return ProtocolParser.createMessage(MessageIds.TERMINAL_AUTHENTICATION, PHONE_NUMBER, serialNumber++, body);
}

function buildHeartbeat(): Buffer {
  return ProtocolParser.createMessage(MessageIds.TERMINAL_HEARTBEAT, PHONE_NUMBER, serialNumber++, Buffer.alloc(0));
}

function decimalToBcd(n: number): number {
  return ((Math.floor(n / 10) << 4) | (n % 10)) & 0xff;
}

function buildLocation(lat: number, lon: number, speed: number, heading: number): Buffer {
  const now = new Date();

  const body = Buffer.alloc(28);
  let offset = 0;

  ProtocolParser.writeDWord(body, 0, offset); offset += 4;
  ProtocolParser.writeDWord(body, 0x00000003, offset); offset += 4;

  body.writeInt32BE(Math.round(lat * 1000000), offset); offset += 4;
  body.writeInt32BE(Math.round(lon * 1000000), offset); offset += 4;

  ProtocolParser.writeWord(body, 1700, offset); offset += 2;
  ProtocolParser.writeWord(body, Math.round(speed * 10), offset); offset += 2;
  ProtocolParser.writeWord(body, Math.round(heading), offset); offset += 2;

  body[offset++] = decimalToBcd(now.getFullYear() - 2000);
  body[offset++] = decimalToBcd(now.getMonth() + 1);
  body[offset++] = decimalToBcd(now.getDate());
  body[offset++] = decimalToBcd(now.getHours());
  body[offset++] = decimalToBcd(now.getMinutes());
  body[offset++] = decimalToBcd(now.getSeconds());

  return ProtocolParser.createMessage(MessageIds.LOCATION_INFO_REPORT, PHONE_NUMBER, serialNumber++, body);
}

function parseResponsePhone(buf: Buffer): string | null {
  const msg = ProtocolParser.parseMessage(buf);
  if (!msg) return null;
  return msg.header.phoneNumber;
}

function extractAuthCode(buf: Buffer): string | null {
  const msg = ProtocolParser.parseMessage(buf);
  if (!msg || msg.header.messageId !== MessageIds.TERMINAL_REGISTER_RESPONSE) return null;
  if (msg.body.length < 3) return null;
  const result = msg.body[2];
  if (result !== 0) {
    console.error(`Registration failed, result code: ${result}`);
    return null;
  }
  return msg.body.slice(3).toString('utf8');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log(`[SIM] Connecting to ${HOST}:${PORT} ...`);

  const socket = net.connect(PORT, HOST);
  let authCode: string | null = null;
  let pingsSent = 0;
  let buffer = Buffer.alloc(0);

  socket.on('connect', () => {
    console.log('[SIM] Connected, sending registration ...');
    socket.write(buildRegistration());
  });

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);

    while (buffer.length > 0) {
      if (buffer[0] !== 0x7e) {
        const next = buffer.indexOf(0x7e);
        if (next === -1) { buffer = Buffer.alloc(0); break; }
        buffer = buffer.slice(next);
      }
      const end = buffer.indexOf(0x7e, 1);
      if (end === -1) break;

      const frame = buffer.slice(0, end + 1);
      buffer = buffer.slice(end + 1);

      const msg = ProtocolParser.parseMessage(frame);
      if (!msg) continue;

      console.log(`[SIM] RX msgId=0x${msg.header.messageId.toString(16)} serial=${msg.header.serialNumber}`);

      if (msg.header.messageId === MessageIds.TERMINAL_REGISTER_RESPONSE) {
        const code = extractAuthCode(frame);
        if (code) {
          authCode = code;
          console.log(`[SIM] Got auth code, sending authentication ...`);
          socket.write(buildAuth(code));
        }
      } else if (msg.header.messageId === MessageIds.PLATFORM_GENERAL_RESPONSE) {
        if (!authCode) continue;
        if (pingsSent === 0) {
          console.log('[SIM] Authenticated, starting location pings ...');
        }
      }
    }
  });

  socket.on('error', (err) => {
    console.error('[SIM] Socket error:', err.message);
  });

  socket.on('close', () => {
    console.log('[SIM] Connection closed');
  });

  while (socket.readyState !== 'open') {
    await sleep(100);
    if (socket.destroyed) { console.error('[SIM] Could not connect'); return; }
  }

  while (!authCode) {
    await sleep(200);
    if (socket.destroyed) { console.error('[SIM] Disconnected before auth'); return; }
  }

  await sleep(500);

  const baseLat = -1.286389;
  const baseLon = 36.817223;

  for (let i = 0; i < TOTAL_PINGS; i++) {
    if (socket.destroyed) break;

    const lat = baseLat + (Math.random() - 0.5) * 0.01;
    const lon = baseLon + (Math.random() - 0.5) * 0.01;
    const speed = 10 + Math.random() * 50;
    const heading = Math.floor(Math.random() * 360);

    const locMsg = buildLocation(lat, lon, speed, heading);
    socket.write(locMsg);
    pingsSent++;
    const total = Number.isFinite(TOTAL_PINGS) ? String(TOTAL_PINGS) : 'inf';
    console.log(`[SIM] Ping ${pingsSent}/${total} -> lat=${lat.toFixed(6)} lon=${lon.toFixed(6)} speed=${speed.toFixed(1)}km/h`);

    if (i % 3 === 0 && i > 0) {
      socket.write(buildHeartbeat());
    }

    await sleep(INTERVAL_MS);
  }

  console.log(`[SIM] Done. Sent ${pingsSent} location pings.`);
  socket.end();
}

async function main() {
  if (CONTINUOUS) {
    console.log(`[SIM] Continuous mode enabled - will auto-reconnect after ${RECONNECT_DELAY_MS}ms if the connection drops.`);
  }
  for (;;) {
    try {
      await run();
    } catch (err) {
      console.error('[SIM] Session error:', err);
    }
    if (!CONTINUOUS) return;
    console.log(`[SIM] Reconnecting in ${RECONNECT_DELAY_MS}ms...`);
    await sleep(RECONNECT_DELAY_MS);
  }
}

main().catch(err => {
  console.error('[SIM] Fatal:', err);
  process.exit(1);
});
