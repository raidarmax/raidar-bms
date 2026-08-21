import { supabase } from './supabase';

export type SegmentId =
  | 'owners'
  | 'motorcycles'
  | 'riders'
  | 'fines'
  | 'incidents'
  | 'tracking'
  | 'rider_notifications'
  | 'police_officers';

export type SegmentMeta = {
  id: SegmentId;
  label: string;
  description: string;
  defaultCount: number;
  maxCount: number;
};

export const SEGMENTS: SegmentMeta[] = [
  { id: 'owners', label: 'Owners', description: 'Boda-boda owners with Kenyan names, phones, and IDs.', defaultCount: 20, maxCount: 500 },
  { id: 'motorcycles', label: 'Motorcycles', description: 'Registered bikes with make/model, insurance and NTSA inspection.', defaultCount: 20, maxCount: 500 },
  { id: 'riders', label: 'Riders', description: 'Riders linked to owners; some assigned to motorcycles, some unassigned.', defaultCount: 30, maxCount: 500 },
  { id: 'fines', label: 'Fines', description: 'Traffic fines with realistic offences, dates and payment status.', defaultCount: 25, maxCount: 500 },
  { id: 'incidents', label: 'Incidents', description: 'Reported incidents against bikes with locations and statuses.', defaultCount: 15, maxCount: 300 },
  { id: 'tracking', label: 'Tracking Pings', description: 'GPS traces along Nairobi corridors for demo bikes.', defaultCount: 200, maxCount: 5000 },
  { id: 'rider_notifications', label: 'Rider Notifications', description: 'In-app notifications shown on the rider dashboard.', defaultCount: 20, maxCount: 500 },
  { id: 'police_officers', label: 'Police Officers', description: 'Demo officers attached to real police stations (inactive by default).', defaultCount: 5, maxCount: 100 },
];

const FIRST_NAMES = [
  'Amani', 'Baraka', 'Chege', 'Daudi', 'Elias', 'Faraji', 'Gitau', 'Hassan', 'Ibrahim', 'Juma',
  'Kamau', 'Lemuel', 'Mwangi', 'Njoroge', 'Otieno', 'Peter', 'Quresh', 'Rashid', 'Simba', 'Tumaini',
  'Uhuru', 'Victor', 'Wafula', 'Xavier', 'Yusuf', 'Zawadi', 'Ali', 'Boniface', 'Charles', 'David',
  'Kevin', 'Brian', 'Dennis', 'Fredrick', 'George', 'Henry', 'Isaac', 'John', 'Kelvin', 'Lawrence',
];

const LAST_NAMES = [
  'Kariuki', 'Ochieng', 'Mutua', 'Wambui', 'Kimani', 'Njeri', 'Odhiambo', 'Barasa', 'Mburu', 'Cheruiyot',
  'Kiplagat', 'Wanjiku', 'Achieng', 'Kiprop', 'Musyoka', 'Nyambura', 'Onyango', 'Wekesa', 'Waweru', 'Rono',
  'Mbogo', 'Kilonzo', 'Njuguna', 'Ndegwa', 'Owino', 'Kibet', 'Karanja', 'Muriuki', 'Njoki', 'Cherop',
];

const FEMALE_FIRST_NAMES = [
  'Aisha', 'Beatrice', 'Catherine', 'Diana', 'Esther', 'Faith', 'Grace', 'Halima', 'Irene', 'Jane',
  'Kadzo', 'Lucy', 'Mary', 'Nyawira', 'Onyi', 'Patience', 'Ruth', 'Salome', 'Tabitha', 'Winnie',
];

const BIKE_MAKES = ['Bajaj', 'TVS', 'Boxer', 'Honda', 'Yamaha', 'Haojue', 'Sonlink', 'Captain'];
const BIKE_MODELS: Record<string, string[]> = {
  Bajaj: ['Boxer 100', 'Boxer 150', 'Pulsar 150', 'Discover 125'],
  TVS: ['HLX 125', 'HLX 150', 'Star City', 'Apache 160'],
  Boxer: ['BM 100', 'BM 150'],
  Honda: ['Ace 110', 'CB 125', 'CG 125'],
  Yamaha: ['Crux 110', 'YBR 125'],
  Haojue: ['DK 150', 'HJ 125'],
  Sonlink: ['SL 125', 'SL 150'],
  Captain: ['C 100', 'C 150'],
};

const OFFENCE_LOCATIONS = [
  'Moi Avenue near GPO',
  'Thika Superhighway junction',
  'Waiyaki Way',
  'Ngong Road roundabout',
  'Jogoo Road opposite City Stadium',
  'Mombasa Road, Nyayo',
  'Kenyatta Avenue',
  'Uhuru Highway near Nyayo Stadium',
  'Enterprise Road',
  'Landhies Road',
];

const INCIDENT_TYPES = ['theft', 'accident', 'harassment', 'reckless_driving', 'traffic_violation', 'speeding', 'no_helmet', 'overloading', 'other'];
const INCIDENT_DESCRIPTIONS: Record<string, string[]> = {
  theft: [
    'Motorcycle stolen from parking area outside supermarket.',
    'Rider assaulted and bike taken at gunpoint late at night.',
    'Bike stolen while parked at stage overnight.',
  ],
  accident: [
    'Collided with a matatu at the junction; minor injuries reported.',
    'Skidded on wet road and hit the kerb; bike damaged.',
    'Rear-ended by a lorry at the roundabout.',
  ],
  harassment: [
    'Rider reported being harassed by unknown persons demanding cash.',
    'Passenger refused to pay fare and threatened the rider.',
  ],
  reckless_driving: [
    'Bike observed overtaking dangerously on Thika Road.',
    'Rider seen running a red light near GPO.',
  ],
  traffic_violation: [
    'Bike caught operating outside authorized zone.',
    'Rider ignored traffic marshal instructions at junction.',
  ],
  speeding: ['Bike clocked at excessive speed on the highway.'],
  no_helmet: ['Rider and passenger both spotted without helmets.'],
  overloading: ['Bike carrying more than the permitted number of passengers.'],
  other: ['Miscellaneous incident reported by member of the public.'],
};

const NOTIFICATION_TEMPLATES: Array<{ type: string; title: string; message: string }> = [
  { type: 'assignment', title: 'Bike Assigned', message: 'You have been assigned a motorcycle. Please review the details.' },
  { type: 'compliance', title: 'License Expiring Soon', message: 'Your driving license expires in 30 days. Renew to stay compliant.' },
  { type: 'payment', title: 'Payment Received', message: 'Your annual compliance fee payment has been confirmed.' },
  { type: 'general', title: 'System Update', message: 'The Boda Management System has been updated with new features.' },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randKenyanPhone(): string {
  const prefix = Math.random() < 0.5 ? '7' : '1';
  let rest = '';
  for (let i = 0; i < 8; i++) rest += String(randInt(0, 9));
  return `+254${prefix}${rest}`;
}

function randNationalId(): string {
  let id = '';
  for (let i = 0; i < 8; i++) id += String(randInt(0, 9));
  return id;
}

function randPlate(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l1 = letters[randInt(0, letters.length - 1)];
  const l2 = letters[randInt(0, letters.length - 1)];
  const l3 = letters[randInt(0, letters.length - 1)];
  const d1 = randInt(0, 9);
  const d2 = randInt(0, 9);
  const d3 = randInt(0, 9);
  const l4 = letters[randInt(0, letters.length - 1)];
  return `K${l1}${l2}${l3} ${d1}${d2}${d3}${l4}`;
}

function batchShard(): string {
  return String(Date.now()).slice(-6);
}

function padSeq(seq: number, width: number): string {
  return String(seq).padStart(width, '0');
}

function uniquePhone(shard: string, seq: number): string {
  const prefix = seq % 2 === 0 ? '7' : '1';
  const tail = padSeq(seq, 2);
  return `+254${prefix}${shard}${tail}`;
}

function uniqueNationalId(shard: string, seq: number): string {
  const tail = padSeq(seq, 2);
  return `${shard}${tail}`;
}

function uniquePlate(shard: string, seq: number): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const l1 = letters[randInt(0, letters.length - 1)];
  const l2 = letters[randInt(0, letters.length - 1)];
  const digits = ((Number(shard) + seq) % 1000).toString().padStart(3, '0');
  const l4 = letters[randInt(0, letters.length - 1)];
  return `K${l1}${l2}D ${digits}${l4}`;
}

function uniqueLicense(shard: string, seq: number): string {
  return `DL${shard}${padSeq(seq, 2)}`;
}

function uniqueBmsId(shard: string, seq: number): string {
  return `BMS-${shard}${padSeq(seq, 2)}`;
}

function uniqueServiceNumber(shard: string, seq: number): string {
  return `DEMO-${shard}-${padSeq(seq, 3)}`;
}

function randName(): string {
  const first = Math.random() < 0.25 ? rand(FEMALE_FIRST_NAMES) : rand(FIRST_NAMES);
  return `${first} ${rand(LAST_NAMES)}`;
}

function randDateWithin(daysBack: number, daysForward = 0): Date {
  const now = Date.now();
  const start = now - daysBack * 86400_000;
  const end = now + daysForward * 86400_000;
  return new Date(start + Math.random() * (end - start));
}

function randKraPin(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let pin = 'A';
  for (let i = 0; i < 9; i++) pin += String(randInt(0, 9));
  pin += letters[randInt(0, letters.length - 1)];
  return pin;
}

function stockPhotoOwner(seed: string): string {
  const options = [
    'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg',
    'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg',
    'https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg',
    'https://images.pexels.com/photos/2182970/pexels-photo-2182970.jpeg',
    'https://images.pexels.com/photos/1181673/pexels-photo-1181673.jpeg',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg',
  ];
  const idx = seed.charCodeAt(0) % options.length;
  return `${options[idx]}?auto=compress&cs=tinysrgb&w=300`;
}

function stockPhotoBike(): string {
  const options = [
    'https://images.pexels.com/photos/2611686/pexels-photo-2611686.jpeg',
    'https://images.pexels.com/photos/1119796/pexels-photo-1119796.jpeg',
    'https://images.pexels.com/photos/1413412/pexels-photo-1413412.jpeg',
    'https://images.pexels.com/photos/1715186/pexels-photo-1715186.jpeg',
  ];
  return `${rand(options)}?auto=compress&cs=tinysrgb&w=400`;
}

type SegmentCounts = Record<SegmentId, number>;

export async function getDemoCounts(): Promise<SegmentCounts> {
  const tables: Array<[SegmentId, string]> = [
    ['owners', 'owners'],
    ['motorcycles', 'motorcycles'],
    ['riders', 'riders'],
    ['fines', 'fines'],
    ['incidents', 'incidents'],
    ['tracking', 'tracking_data'],
    ['rider_notifications', 'rider_notifications'],
    ['police_officers', 'police_officers'],
  ];

  const results = await Promise.all(
    tables.map(async ([segment, table]) => {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('demo_seed', true);
      return [segment, count ?? 0] as const;
    })
  );

  return Object.fromEntries(results) as SegmentCounts;
}

type Locality = { county_id: number; constituency_id: number | null; ward_id: number | null };

async function pickLocalities(n: number): Promise<Locality[]> {
  const { data } = await supabase
    .from('kenya_wards')
    .select('id, constituency_id, kenya_constituencies!inner(county_id)')
    .limit(200);
  if (!data || data.length === 0) {
    const { data: counties } = await supabase.from('kenya_counties').select('id').limit(20);
    return Array.from({ length: n }, () => ({
      county_id: (counties && counties.length ? rand(counties).id : 47) as number,
      constituency_id: null,
      ward_id: null,
    }));
  }
  return Array.from({ length: n }, () => {
    const ward = rand(data) as any;
    return {
      county_id: ward.kenya_constituencies.county_id,
      constituency_id: ward.constituency_id,
      ward_id: ward.id,
    };
  });
}

export type GenerateOptions = {
  count: number;
  createdBy?: string;
};

export type GenerateResult = {
  segment: SegmentId;
  created: number;
  message?: string;
};

async function ensureDemoOwners(min: number): Promise<string[]> {
  const { data } = await supabase
    .from('owners')
    .select('id')
    .eq('demo_seed', true)
    .limit(Math.max(min, 200));
  const existing = (data ?? []).map((o) => o.id);
  if (existing.length >= min) return existing;
  const need = min - existing.length;
  const result = await generateOwners({ count: need });
  const { data: fresh } = await supabase
    .from('owners')
    .select('id')
    .eq('demo_seed', true)
    .order('created_at', { ascending: false })
    .limit(result.created);
  return [...existing, ...(fresh ?? []).map((o) => o.id)];
}

async function ensureDemoMotorcycles(min: number): Promise<Array<{ id: string; owner_id: string; registration_number: string }>> {
  const { data } = await supabase
    .from('motorcycles')
    .select('id, owner_id, registration_number')
    .eq('demo_seed', true)
    .limit(Math.max(min, 200));
  const existing = data ?? [];
  if (existing.length >= min) return existing;
  const need = min - existing.length;
  await generateMotorcycles({ count: need });
  const { data: fresh } = await supabase
    .from('motorcycles')
    .select('id, owner_id, registration_number')
    .eq('demo_seed', true)
    .order('created_at', { ascending: false })
    .limit(min);
  return fresh ?? existing;
}

async function ensureDemoRiders(min: number): Promise<Array<{ id: string; name: string; phone_number: string | null; id_number: string; motorcycle_id: string | null; owner_id: string | null }>> {
  const { data } = await supabase
    .from('riders')
    .select('id, name, phone_number, id_number, motorcycle_id, owner_id')
    .eq('demo_seed', true)
    .limit(Math.max(min, 200));
  const existing = data ?? [];
  if (existing.length >= min) return existing;
  const need = min - existing.length;
  await generateRiders({ count: need });
  const { data: fresh } = await supabase
    .from('riders')
    .select('id, name, phone_number, id_number, motorcycle_id, owner_id')
    .eq('demo_seed', true)
    .order('created_at', { ascending: false })
    .limit(min);
  return fresh ?? existing;
}

async function ensureDemoOfficerAndStation(): Promise<{ officerId: string; stationId: string } | null> {
  const { data: stations } = await supabase
    .from('police_stations')
    .select('id')
    .eq('is_active', true)
    .limit(50);
  if (!stations || stations.length === 0) return null;
  const stationId = rand(stations).id as string;

  const { data: officer } = await supabase
    .from('police_officers')
    .select('id, station_id')
    .eq('demo_seed', true)
    .limit(1)
    .maybeSingle();
  if (officer) return { officerId: officer.id, stationId: officer.station_id };

  const { data: created, error } = await supabase
    .from('police_officers')
    .insert({
      service_number: `DEMO-${Date.now().toString().slice(-8)}`,
      national_id: randNationalId(),
      full_name: `Demo Officer ${randName()}`,
      phone_number: randKenyanPhone(),
      rank: 'constable',
      badge_number: `B${randInt(1000, 9999)}`,
      password_hash: '$2a$10$demoseedpasswordhashplaceholderplaceholder',
      station_id: stationId,
      is_active: false,
      is_station_admin: false,
      demo_seed: true,
    })
    .select('id')
    .single();
  if (error || !created) return null;
  return { officerId: created.id, stationId };
}

export async function generateOwners(opts: GenerateOptions): Promise<GenerateResult> {
  const localities = await pickLocalities(opts.count);
  const shard = batchShard();
  const rows = Array.from({ length: opts.count }, (_, i) => {
    const name = randName();
    return {
      full_name: name,
      phone_number: uniquePhone(shard, i),
      national_id: uniqueNationalId(shard, i),
      next_of_kin_name: randName(),
      next_of_kin_phone: uniquePhone(shard, i + opts.count),
      otp_verified: true,
      payment_status: Math.random() < 0.8 ? 'completed' : 'pending',
      kra_pin: randKraPin(),
      kra_pin_verified: Math.random() < 0.7,
      id_verified: true,
      county_id: localities[i].county_id,
      constituency_id: localities[i].constituency_id,
      ward_id: localities[i].ward_id,
      profile_photo_url: stockPhotoOwner(name),
      demo_seed: true,
    };
  });
  const { error, count } = await supabase.from('owners').insert(rows, { count: 'exact' });
  if (error) throw error;
  return { segment: 'owners', created: count ?? rows.length };
}

export async function generateMotorcycles(opts: GenerateOptions): Promise<GenerateResult> {
  const owners = await ensureDemoOwners(Math.min(opts.count, 30));
  const localities = await pickLocalities(opts.count);
  const shard = batchShard();
  const rows = Array.from({ length: opts.count }, (_, i) => {
    const make = rand(BIKE_MAKES);
    const model = rand(BIKE_MODELS[make] || ['Standard']);
    return {
      owner_id: rand(owners),
      registration_number: uniquePlate(shard, i),
      make,
      model,
      status: Math.random() < 0.8 ? 'verified' : 'pending',
      is_compliant: Math.random() < 0.75,
      insurance_policy_number: `IN${randInt(100000, 999999)}`,
      inspection_certificate_number: `NTSA-${randInt(10000, 99999)}`,
      inspection_expiry: randDateWithin(-30, 365).toISOString().slice(0, 10),
      bike_photo_url: stockPhotoBike(),
      county_id: localities[i].county_id,
      constituency_id: localities[i].constituency_id,
      ward_id: localities[i].ward_id,
      operating_area: rand(['CBD', 'Eastlands', 'Westlands', 'South B', 'Ngong', 'Ruiru']),
      demo_seed: true,
    };
  });
  const { error, count } = await supabase.from('motorcycles').insert(rows, { count: 'exact' });
  if (error) throw error;
  return { segment: 'motorcycles', created: count ?? rows.length };
}

export async function generateRiders(opts: GenerateOptions): Promise<GenerateResult> {
  const owners = await ensureDemoOwners(Math.min(opts.count, 30));
  const bikes = await ensureDemoMotorcycles(Math.ceil(opts.count * 0.7));
  const localities = await pickLocalities(opts.count);
  const shard = batchShard();

  const usedBikes = new Set<string>();
  const rows: any[] = [];
  const historyRows: any[] = [];

  for (let i = 0; i < opts.count; i++) {
    const assign = Math.random() < 0.7;
    const availableBikes = bikes.filter((b) => !usedBikes.has(b.id));
    const bike = assign && availableBikes.length > 0 ? rand(availableBikes) : null;
    if (bike) usedBikes.add(bike.id);

    const owner_id = bike?.owner_id ?? rand(owners);
    const name = randName();

    rows.push({
      owner_id,
      name,
      id_number: uniqueNationalId(shard, i),
      phone_number: uniquePhone(shard, i),
      license_number: uniqueLicense(shard, i),
      license_class: rand(['A', 'A1', 'A2']),
      license_expiry: randDateWithin(-60, 730).toISOString().slice(0, 10),
      license_verified: Math.random() < 0.8,
      kra_pin: randKraPin(),
      kra_pin_verified: Math.random() < 0.7,
      id_verified: true,
      sacco_id: `SACCO-${randInt(100, 999)}`,
      stage_name: rand(['Central Stage', 'GPO Stage', 'Kencom Stage', 'Odeon Stage', 'Bus Station Stage']),
      motorcycle_id: bike?.id ?? null,
      assignment_status: bike ? 'Assigned' : 'Unassigned',
      bms_id: uniqueBmsId(shard, i),
      payment_status: Math.random() < 0.75 ? 'completed' : 'pending',
      next_of_kin_name: randName(),
      next_of_kin_phone: uniquePhone(shard, i + opts.count),
      county_id: localities[i].county_id,
      constituency_id: localities[i].constituency_id,
      ward_id: localities[i].ward_id,
      rating_score: randInt(60, 100),
      rating_tier: rand(['excellent', 'good', 'fair']),
      demo_seed: true,
    });
  }

  const { data: inserted, error } = await supabase
    .from('riders')
    .insert(rows)
    .select('id, motorcycle_id, owner_id, name, id_number');
  if (error) throw error;

  for (const rider of inserted ?? []) {
    if (rider.motorcycle_id) {
      historyRows.push({
        rider_id: rider.id,
        motorcycle_id: rider.motorcycle_id,
        owner_id: rider.owner_id,
        rider_name: rider.name,
        rider_id_number: rider.id_number,
        demo_seed: true,
      });
    }
  }
  if (historyRows.length > 0) {
    await supabase.from('rider_history').insert(historyRows);
  }

  return { segment: 'riders', created: inserted?.length ?? rows.length };
}

export async function generateFines(opts: GenerateOptions): Promise<GenerateResult> {
  const riders = await ensureDemoRiders(Math.min(opts.count, 30));
  const { data: offences } = await supabase
    .from('traffic_offences')
    .select('id, offence_name, fine_amount')
    .eq('is_active', true)
    .limit(30);
  if (!offences || offences.length === 0) {
    return { segment: 'fines', created: 0, message: 'No active traffic offences configured.' };
  }
  const officerCtx = await ensureDemoOfficerAndStation();
  if (!officerCtx) {
    return { segment: 'fines', created: 0, message: 'No active police station configured.' };
  }
  const localities = await pickLocalities(opts.count);

  const year = new Date().getFullYear();
  const { count: existingCount } = await supabase
    .from('fines')
    .select('id', { count: 'exact', head: true });
  const baseSeq = (existingCount ?? 0) + 1;

  const rows: any[] = [];
  for (let i = 0; i < opts.count; i++) {
    const rider = rand(riders);
    const offence = rand(offences);
    const issuedAt = randDateWithin(90);
    const paid = Math.random() < 0.4;
    rows.push({
      fine_reference: `FN-${year}-${String(baseSeq + i).padStart(5, '0')}`,
      offence_id: offence.id,
      issued_by_officer_id: officerCtx.officerId,
      station_id: officerCtx.stationId,
      rider_id: rider.id,
      owner_id: rider.owner_id,
      motorcycle_id: rider.motorcycle_id,
      rider_name: rider.name,
      rider_phone: rider.phone_number || randKenyanPhone(),
      rider_national_id: rider.id_number,
      owner_phone: randKenyanPhone(),
      fine_amount: offence.fine_amount,
      location_description: rand(OFFENCE_LOCATIONS),
      county_id: localities[i].county_id,
      constituency_id: localities[i].constituency_id,
      ward_id: localities[i].ward_id,
      status: paid ? 'paid' : (issuedAt.getTime() < Date.now() - 14 * 86400_000 ? 'overdue' : 'issued'),
      issued_at: issuedAt.toISOString(),
      due_date: new Date(issuedAt.getTime() + 14 * 86400_000).toISOString(),
      paid_at: paid ? new Date(issuedAt.getTime() + randInt(1, 13) * 86400_000).toISOString() : null,
      payment_reference: paid ? `PAY-${randInt(100000, 999999)}` : null,
      demo_seed: true,
    });
  }
  const { error, count } = await supabase.from('fines').insert(rows, { count: 'exact' });
  if (error) throw error;
  return { segment: 'fines', created: count ?? rows.length };
}

export async function generateIncidents(opts: GenerateOptions): Promise<GenerateResult> {
  const riders = await ensureDemoRiders(Math.min(opts.count, 20));
  const localities = await pickLocalities(opts.count);
  const rows: any[] = [];
  for (let i = 0; i < opts.count; i++) {
    const rider = rand(riders);
    const type = rand(INCIDENT_TYPES);
    const desc = rand(INCIDENT_DESCRIPTIONS[type] || ['Incident reported.']);
    rows.push({
      motorcycle_id: rider.motorcycle_id,
      rider_id: rider.id,
      owner_id: rider.owner_id,
      incident_type: type,
      description: desc,
      incident_date: randDateWithin(60).toISOString(),
      location: rand(OFFENCE_LOCATIONS),
      status: rand(['pending', 'confirmed', 'ignored', 'appealed', 'resolved']),
      reporter_name: randName(),
      reporter_phone: randKenyanPhone(),
      county_id: localities[i].county_id,
      constituency_id: localities[i].constituency_id,
      ward_id: localities[i].ward_id,
      police_status: 'unassigned',
      demo_seed: true,
    });
  }
  const { data: inserted, error } = await supabase.from('incidents').insert(rows).select('id, rider_id, owner_id');
  if (error) throw error;

  const notifRows: any[] = [];
  for (const inc of inserted ?? []) {
    if (inc.rider_id) notifRows.push({ incident_id: inc.id, user_type: 'rider', user_id: inc.rider_id, demo_seed: true });
    if (inc.owner_id) notifRows.push({ incident_id: inc.id, user_type: 'owner', user_id: inc.owner_id, demo_seed: true });
  }
  if (notifRows.length > 0) {
    await supabase.from('incident_notifications').insert(notifRows);
  }

  return { segment: 'incidents', created: inserted?.length ?? rows.length };
}

export async function generateTracking(opts: GenerateOptions): Promise<GenerateResult> {
  const bikes = await ensureDemoMotorcycles(Math.min(Math.ceil(opts.count / 20), 30));
  if (bikes.length === 0) {
    return { segment: 'tracking', created: 0, message: 'No demo motorcycles available.' };
  }

  const rows: any[] = [];
  const now = Date.now();
  const perBike = Math.max(1, Math.floor(opts.count / bikes.length));

  for (const bike of bikes) {
    const baseLat = -1.286 + (Math.random() - 0.5) * 0.05;
    const baseLng = 36.817 + (Math.random() - 0.5) * 0.05;
    for (let j = 0; j < perBike; j++) {
      const drift = j * 0.0008;
      rows.push({
        motorcycle_id: bike.id,
        latitude: baseLat + drift + (Math.random() - 0.5) * 0.001,
        longitude: baseLng + drift + (Math.random() - 0.5) * 0.001,
        speed: randInt(0, 60),
        heading: randInt(0, 359),
        accuracy: randInt(3, 15),
        recorded_at: new Date(now - (perBike - j) * 60_000).toISOString(),
        demo_seed: true,
      });
      if (rows.length >= opts.count) break;
    }
    if (rows.length >= opts.count) break;
  }

  const chunks: any[][] = [];
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));
  let inserted = 0;
  for (const chunk of chunks) {
    const { count, error } = await supabase.from('tracking_data').insert(chunk, { count: 'exact' });
    if (error) throw error;
    inserted += count ?? chunk.length;
  }
  return { segment: 'tracking', created: inserted };
}

export async function generateRiderNotifications(opts: GenerateOptions): Promise<GenerateResult> {
  const riders = await ensureDemoRiders(Math.min(opts.count, 30));
  const rows = Array.from({ length: opts.count }, () => {
    const rider = rand(riders);
    const t = rand(NOTIFICATION_TEMPLATES);
    return {
      rider_id: rider.id,
      type: t.type,
      title: t.title,
      message: t.message,
      read: Math.random() < 0.4,
      demo_seed: true,
    };
  });
  const { error, count } = await supabase.from('rider_notifications').insert(rows, { count: 'exact' });
  if (error) throw error;
  return { segment: 'rider_notifications', created: count ?? rows.length };
}

export async function generatePoliceOfficers(opts: GenerateOptions): Promise<GenerateResult> {
  const { data: stations } = await supabase
    .from('police_stations')
    .select('id')
    .eq('is_active', true)
    .limit(50);
  if (!stations || stations.length === 0) {
    return { segment: 'police_officers', created: 0, message: 'No active police stations available.' };
  }
  const shard = batchShard();
  const rows = Array.from({ length: opts.count }, (_, i) => ({
    service_number: uniqueServiceNumber(shard, i),
    national_id: uniqueNationalId(shard, i),
    full_name: `Officer ${randName()}`,
    phone_number: uniquePhone(shard, i),
    rank: rand(['constable', 'corporal', 'sergeant', 'inspector']),
    badge_number: `B${randInt(1000, 9999)}`,
    password_hash: '$2a$10$demoseedpasswordhashplaceholderplaceholder',
    station_id: rand(stations).id as string,
    is_station_admin: Math.random() < 0.15,
    is_active: false,
    demo_seed: true,
  }));
  const { error, count } = await supabase.from('police_officers').insert(rows, { count: 'exact' });
  if (error) throw error;
  return { segment: 'police_officers', created: count ?? rows.length };
}

const GENERATORS: Record<SegmentId, (opts: GenerateOptions) => Promise<GenerateResult>> = {
  owners: generateOwners,
  motorcycles: generateMotorcycles,
  riders: generateRiders,
  fines: generateFines,
  incidents: generateIncidents,
  tracking: generateTracking,
  rider_notifications: generateRiderNotifications,
  police_officers: generatePoliceOfficers,
};

export async function generateSegment(segment: SegmentId, opts: GenerateOptions): Promise<GenerateResult> {
  const { data: batch } = await supabase
    .from('demo_batches')
    .insert({
      created_by: opts.createdBy || null,
      segments: { [segment]: opts.count },
      status: 'running',
    })
    .select('id')
    .single();

  try {
    const result = await GENERATORS[segment](opts);
    await supabase
      .from('demo_batches')
      .update({
        counts: { [segment]: result.created },
        status: 'completed',
        completed_at: new Date().toISOString(),
        notes: result.message || null,
      })
      .eq('id', batch?.id);
    return result;
  } catch (err: any) {
    await supabase
      .from('demo_batches')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        notes: err?.message || 'Unknown error',
      })
      .eq('id', batch?.id);
    throw err;
  }
}

const WIPE_ORDER: Array<[SegmentId, string]> = [
  ['tracking', 'tracking_data'],
  ['rider_notifications', 'rider_notifications'],
  ['fines', 'fines'],
  ['incidents', 'incidents'],
  ['riders', 'riders'],
  ['motorcycles', 'motorcycles'],
  ['owners', 'owners'],
  ['police_officers', 'police_officers'],
];

async function wipeIncidentNotifications() {
  await supabase.from('incident_notifications').delete().eq('demo_seed', true);
}
async function wipeRiderHistory() {
  await supabase.from('rider_history').delete().eq('demo_seed', true);
}
async function wipeAssignmentRequests() {
  await supabase.from('assignment_requests').delete().eq('demo_seed', true);
}

export async function wipeSegment(segment: SegmentId): Promise<{ deleted: number }> {
  const table = WIPE_ORDER.find(([s]) => s === segment)?.[1];
  if (!table) return { deleted: 0 };

  if (segment === 'incidents') await wipeIncidentNotifications();
  if (segment === 'riders') {
    await wipeRiderHistory();
    await wipeAssignmentRequests();
    await supabase.from('fines').update({ rider_id: null }).eq('demo_seed', true);
    await supabase.from('incidents').update({ rider_id: null }).eq('demo_seed', true);
  }
  if (segment === 'motorcycles') {
    await supabase.from('riders').update({ motorcycle_id: null }).eq('demo_seed', true);
    await supabase.from('tracking_data').delete().eq('demo_seed', true);
    await supabase.from('rider_history').delete().eq('demo_seed', true);
    await supabase.from('fines').update({ motorcycle_id: null }).eq('demo_seed', true);
    await supabase.from('incidents').update({ motorcycle_id: null }).eq('demo_seed', true);
  }
  if (segment === 'owners') {
    await supabase.from('riders').delete().eq('demo_seed', true);
    await supabase.from('motorcycles').delete().eq('demo_seed', true);
  }
  if (segment === 'police_officers') {
    await supabase.from('fines').delete().eq('demo_seed', true);
  }

  const { count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq('demo_seed', true);
  return { deleted: count ?? 0 };
}

export async function wipeAll(): Promise<Record<SegmentId, number>> {
  await wipeIncidentNotifications();
  await wipeRiderHistory();
  await wipeAssignmentRequests();

  const result: Partial<Record<SegmentId, number>> = {};
  for (const [segment, table] of WIPE_ORDER) {
    const { count } = await supabase.from(table).delete({ count: 'exact' }).eq('demo_seed', true);
    result[segment] = count ?? 0;
  }
  return result as Record<SegmentId, number>;
}

export type DemoBatch = {
  id: string;
  created_by: string | null;
  segments: Record<string, number>;
  counts: Record<string, number>;
  notes: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export async function listBatches(limit = 20): Promise<DemoBatch[]> {
  const { data } = await supabase
    .from('demo_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as DemoBatch[];
}
