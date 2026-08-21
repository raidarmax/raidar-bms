import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  Loader2,
  Link2,
  Bike,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  X,
  Phone,
  Hash,
  Activity,
  Clock,
  Trash2,
} from 'lucide-react';
import { supabase, type Motorcycle, type Owner } from '../lib/supabase';

type TrackingDevice = {
  id: string;
  device_id: string;
  phone_number: string | null;
  imei: string | null;
  motorcycle_id: string | null;
  status: string | null;
  last_connection: string | null;
  last_heartbeat: string | null;
  created_at: string;
};

type DeviceWithLocation = TrackingDevice & {
  latest_location?: {
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: string;
  } | null;
};

type OwnerLite = {
  id: string;
  full_name: string;
  phone_number: string;
};

type Props = {
  onDataChanged?: () => void;
};

export default function DeviceManagement({ onDataChanged }: Props) {
  const [devices, setDevices] = useState<DeviceWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkingDevice, setLinkingDevice] = useState<DeviceWithLocation | null>(null);
  const [registeringDevice, setRegisteringDevice] = useState<DeviceWithLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'unlinked' | 'all'>('unlinked');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracking_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const deviceRows = (data || []) as TrackingDevice[];

      const enriched: DeviceWithLocation[] = await Promise.all(
        deviceRows.map(async (d) => {
          const { data: loc } = await supabase
            .from('device_locations')
            .select('latitude, longitude, speed, timestamp')
            .eq('device_id', d.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
          return { ...d, latest_location: loc ?? null };
        })
      );

      setDevices(enriched);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const filteredDevices = devices.filter((d) => {
    if (filter === 'unlinked' && d.motorcycle_id) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.device_id.toLowerCase().includes(q) ||
        (d.phone_number?.toLowerCase().includes(q) ?? false) ||
        (d.imei?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const linkedDevices = devices.filter((d) => d.motorcycle_id);
  const unlinkedDevices = devices.filter((d) => !d.motorcycle_id);

  function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function showSuccess(msg: string) {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  }

  async function handleLink(motorcycle: Motorcycle) {
    if (!linkingDevice) return;
    try {
      const { data: existingTrackers } = await supabase
        .from('tracking_devices')
        .select('id, device_id, status')
        .eq('motorcycle_id', motorcycle.id)
        .neq('id', linkingDevice.id);

      if (existingTrackers && existingTrackers.length > 0) {
        const existing = existingTrackers[0];
        const statusNote = existing.status === 'online' ? ' (currently online and transmitting)' : '';
        const confirmed = confirm(
          `${motorcycle.registration_number} already has tracker ${existing.device_id} assigned${statusNote}.\n\n` +
          `Linking device ${linkingDevice.device_id} will replace it. The old tracker will be unlinked and go back to the unassigned list.\n\n` +
          `Continue?`
        );
        if (!confirmed) return;

        for (const t of existingTrackers) {
          await supabase
            .from('tracking_devices')
            .update({ motorcycle_id: null })
            .eq('id', t.id);
        }
      }

      if (linkingDevice.motorcycle_id) {
        await supabase
          .from('motorcycles')
          .update({ tracking_device_id: null })
          .eq('id', linkingDevice.motorcycle_id);
      }

      const { error: devErr } = await supabase
        .from('tracking_devices')
        .update({ motorcycle_id: motorcycle.id })
        .eq('id', linkingDevice.id);
      if (devErr) throw devErr;

      const { error: bikeErr } = await supabase
        .from('motorcycles')
        .update({ tracking_device_id: linkingDevice.device_id })
        .eq('id', motorcycle.id);
      if (bikeErr) throw bikeErr;

      showSuccess(`Device ${linkingDevice.device_id} linked to ${motorcycle.registration_number}`);
      setLinkingDevice(null);
      await loadDevices();
      onDataChanged?.();
    } catch (err) {
      console.error('Link failed:', err);
      alert('Failed to link device. Please try again.');
    }
  }

  async function handleRegisterNew(owner: OwnerLite, registrationNumber: string) {
    if (!registeringDevice) return;
    try {
      const { data: bike, error: bikeErr } = await supabase
        .from('motorcycles')
        .insert({
          owner_id: owner.id,
          registration_number: registrationNumber.toUpperCase(),
          tracking_device_id: registeringDevice.device_id,
          status: 'pending',
          is_compliant: false,
        })
        .select()
        .single();
      if (bikeErr) throw bikeErr;

      const { error: devErr } = await supabase
        .from('tracking_devices')
        .update({ motorcycle_id: bike.id })
        .eq('id', registeringDevice.id);
      if (devErr) throw devErr;

      showSuccess(`New motorcycle ${registrationNumber.toUpperCase()} registered with device ${registeringDevice.device_id}`);
      setRegisteringDevice(null);
      await loadDevices();
      onDataChanged?.();
    } catch (err) {
      console.error('Register failed:', err);
      alert('Failed to register new motorcycle. Please try again.');
    }
  }

  async function handleDeleteDevice(device: DeviceWithLocation) {
    if (device.motorcycle_id) return;
    if (!confirm(`Delete device ${device.device_id} and ALL its data?\n\nThis removes the device record, all GPS location pings, and all raw message logs. The device will re-register fresh when it reconnects.\n\nThis cannot be undone.`)) return;
    try {
      const deviceId = device.id;
      const phone = device.phone_number;

      const { error: locErr } = await supabase
        .from('device_locations')
        .delete()
        .eq('device_id', deviceId);
      if (locErr) console.warn('device_locations delete warning:', locErr);

      if (phone) {
        const { error: msgErr } = await supabase
          .from('gps_message_log')
          .delete()
          .eq('phone_number', phone);
        if (msgErr) console.warn('gps_message_log delete warning:', msgErr);
      }

      const { error: devErr } = await supabase
        .from('tracking_devices')
        .delete()
        .eq('id', deviceId);
      if (devErr) throw devErr;

      showSuccess(`Device ${device.device_id} and all its data deleted`);
      await loadDevices();
      onDataChanged?.();
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete device. Please try again.');
    }
  }

  async function handleUnlink(device: DeviceWithLocation) {
    if (!device.motorcycle_id) return;
    if (!confirm(`Unlink device ${device.device_id} from its motorcycle?`)) return;
    try {
      await supabase
        .from('motorcycles')
        .update({ tracking_device_id: null })
        .eq('id', device.motorcycle_id);

      const { error } = await supabase
        .from('tracking_devices')
        .update({ motorcycle_id: null })
        .eq('id', device.id);
      if (error) throw error;

      showSuccess(`Device ${device.device_id} unlinked`);
      await loadDevices();
      onDataChanged?.();
    } catch (err) {
      console.error('Unlink failed:', err);
      alert('Failed to unlink device.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {actionSuccess}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Cpu className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{devices.length}</p>
              <p className="text-xs text-slate-500">Total Devices</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{unlinkedDevices.length}</p>
              <p className="text-xs text-slate-500">Unlinked (Need Assignment)</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{linkedDevices.length}</p>
              <p className="text-xs text-slate-500">Linked to Motorcycles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by serial number or IMEI..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setFilter('unlinked')}
              className={`px-3 py-2 text-sm font-medium transition ${
                filter === 'unlinked' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Unlinked Only
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-2 text-sm font-medium transition ${
                filter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Devices
            </button>
          </div>
          <button
            onClick={loadDevices}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Device list */}
      {filteredDevices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Cpu className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {filter === 'unlinked' ? 'No unlinked devices' : 'No devices found'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filter === 'unlinked'
              ? 'All connected devices are already linked to motorcycles. New devices will appear here automatically when they connect to the server.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className={`bg-white border rounded-xl p-5 transition ${
                device.motorcycle_id ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Device info */}
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      device.motorcycle_id ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    <Cpu className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono font-semibold text-slate-900 text-sm">{device.device_id}</p>
                      {device.status === 'online' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Offline
                        </span>
                      )}
                      {device.motorcycle_id ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <Link2 className="h-3 w-3" /> Linked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-3 w-3" /> Needs Assignment
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">

                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last seen: {formatTimeAgo(device.last_heartbeat || device.last_connection)}
                      </span>
                      {device.latest_location && (
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {device.latest_location.latitude.toFixed(4)}, {device.latest_location.longitude.toFixed(4)}
                          {device.latest_location.speed > 0 && ` · ${device.latest_location.speed.toFixed(0)} km/h`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!device.motorcycle_id ? (
                    <>
                      <button
                        onClick={() => setLinkingDevice(device)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                      >
                        <Link2 className="h-4 w-4" /> Link to Bike
                      </button>
                      <button
                        onClick={() => setRegisteringDevice(device)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                      >
                        <Plus className="h-4 w-4" /> Register New
                      </button>
                      <button
                        onClick={() => handleDeleteDevice(device)}
                        title="Delete device and all its data"
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleUnlink(device)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
                    >
                      <X className="h-4 w-4" /> Unlink
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link to existing bike modal */}
      {linkingDevice && (
        <LinkToBikeModal
          device={linkingDevice}
          onClose={() => setLinkingDevice(null)}
          onLink={handleLink}
        />
      )}

      {/* Register new bike modal */}
      {registeringDevice && (
        <RegisterNewBikeModal
          device={registeringDevice}
          onClose={() => setRegisteringDevice(null)}
          onRegister={handleRegisterNew}
        />
      )}
    </div>
  );
}

function LinkToBikeModal({
  device,
  onClose,
  onLink,
}: {
  device: DeviceWithLocation;
  onClose: () => void;
  onLink: (motorcycle: Motorcycle) => void;
}) {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [owners, setOwners] = useState<Record<string, OwnerLite>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: bikes, error } = await supabase
        .from('motorcycles')
        .select('*')
        .order('registration_number', { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const bikeRows = (bikes || []) as Motorcycle[];
      setMotorcycles(bikeRows);

      const ownerIds = [...new Set(bikeRows.map((b) => b.owner_id))];
      if (ownerIds.length > 0) {
        const { data: ownerRows } = await supabase
          .from('owners')
          .select('id, full_name, phone_number')
          .in('id', ownerIds);
        const map: Record<string, OwnerLite> = {};
        (ownerRows || []).forEach((o: OwnerLite) => {
          map[o.id] = o;
        });
        setOwners(map);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = motorcycles.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const ownerName = owners[m.owner_id]?.full_name?.toLowerCase() ?? '';
    return (
      m.registration_number.toLowerCase().includes(q) ||
      ownerName.includes(q) ||
      (m.make?.toLowerCase().includes(q) ?? false) ||
      (m.model?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-emerald-600" /> Link Device to Motorcycle
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Device <span className="font-mono font-semibold text-slate-700">{device.device_id}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by plate number, owner name, make..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bike className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No motorcycles found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => {
                const owner = owners[m.owner_id];
                const isCurrentlyLinked = m.tracking_device_id === device.device_id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onLink(m)}
                    className={`w-full text-left p-4 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isCurrentlyLinked
                        ? 'border-emerald-300 bg-emerald-50 cursor-default'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Bike className="h-5 w-5 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{m.registration_number}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {owner?.full_name || 'Unknown owner'}
                          {m.make && m.model ? ` · ${m.make} ${m.model}` : ''}
                        </p>
                      </div>
                    </div>
                    {isCurrentlyLinked ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full flex-shrink-0">
                        Current
                      </span>
                    ) : m.tracking_device_id ? (
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex-shrink-0" title={`Currently linked to ${m.tracking_device_id}`}>
                        Has tracker: {m.tracking_device_id.slice(-7)}
                      </span>
                    ) : (
                      <Link2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          {filtered.length} motorcycle{filtered.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </div>
  );
}

function RegisterNewBikeModal({
  device,
  onClose,
  onRegister,
}: {
  device: DeviceWithLocation;
  onClose: () => void;
  onRegister: (owner: OwnerLite, registrationNumber: string) => void;
}) {
  const [owners, setOwners] = useState<OwnerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<OwnerLite | null>(null);
  const [regNumber, setRegNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('owners')
        .select('id, full_name, phone_number')
        .order('full_name', { ascending: true });
      if (error) {
        console.error(error);
      } else {
        setOwners(data as OwnerLite[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = owners.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.full_name.toLowerCase().includes(q) || o.phone_number.toLowerCase().includes(q);
  });

  async function handleSubmit() {
    if (!selectedOwner) return;
    if (!regNumber.trim()) return;
    setSubmitting(true);
    await onRegister(selectedOwner, regNumber.trim());
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" /> Register New Motorcycle
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Device <span className="font-mono font-semibold text-slate-700">{device.device_id}</span> will be linked automatically
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Registration number */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Registration Number (Plate)</label>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="e.g. KMEA 123A"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-mono font-semibold uppercase focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Owner selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Owner</label>
            {selectedOwner ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{selectedOwner.full_name}</p>
                  <p className="text-xs text-slate-500">{selectedOwner.phone_number}</p>
                </div>
                <button
                  onClick={() => setSelectedOwner(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-medium"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or phone..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg">
                    {filtered.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-6">No owners found</p>
                    ) : (
                      filtered.map((o) => (
                        <button
                          key={o.id}
                          onClick={() => setSelectedOwner(o)}
                          className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 transition border-b border-slate-100 last:border-0"
                        >
                          <p className="font-medium text-slate-800 text-sm">{o.full_name}</p>
                          <p className="text-xs text-slate-500">{o.phone_number}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedOwner || !regNumber.trim() || submitting}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Register & Link
          </button>
        </div>
      </div>
    </div>
  );
}
