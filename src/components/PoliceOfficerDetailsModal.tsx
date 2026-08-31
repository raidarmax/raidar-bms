import { useEffect, useState } from 'react';
import {
  X,
  Shield,
  Phone,
  Mail,
  Building2,
  CreditCard,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  UserCog,
  Receipt,
} from 'lucide-react';
import { supabase, type PoliceOfficer } from '../lib/supabase';

type OfficerWithStation = PoliceOfficer & { station_name?: string; county_name?: string };

type Props = {
  officer: OfficerWithStation;
  onClose: () => void;
};

type FineStats = {
  total: number;
  issued: number;
  paid: number;
  overdue: number;
  totalAmount: number;
};

type StationInfo = {
  station_name: string;
  station_code: string;
  station_type: string;
  physical_address: string | null;
  phone_number: string | null;
  county_name: string | null;
};

export default function PoliceOfficerDetailsModal({ officer, onClose }: Props) {
  const [fineStats, setFineStats] = useState<FineStats>({
    total: 0,
    issued: 0,
    paid: 0,
    overdue: 0,
    totalAmount: 0,
  });
  const [stationInfo, setStationInfo] = useState<StationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [registeredBy, setRegisteredBy] = useState<string | null>(null);

  useEffect(() => {
    loadDetails();
  }, [officer.id]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [finesRes, stationRes, registrarRes] = await Promise.all([
        supabase
          .from('fines')
          .select('status, fine_amount')
          .eq('issued_by_officer_id', officer.id),
        officer.station_id
          ? supabase
              .from('police_stations')
              .select('station_name, station_code, station_type, physical_address, phone_number, county:kenya_counties(county_name)')
              .eq('id', officer.station_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        officer.registered_by
          ? supabase
              .from('system_users')
              .select('full_name')
              .eq('id', officer.registered_by)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (finesRes.data) {
        const fines = finesRes.data;
        setFineStats({
          total: fines.length,
          issued: fines.filter(f => f.status === 'issued').length,
          paid: fines.filter(f => f.status === 'paid').length,
          overdue: fines.filter(f => f.status === 'overdue').length,
          totalAmount: fines.reduce((sum, f) => sum + Number(f.fine_amount || 0), 0),
        });
      }

      if (stationRes.data) {
        const s = stationRes.data as any;
        setStationInfo({
          station_name: s.station_name,
          station_code: s.station_code,
          station_type: s.station_type,
          physical_address: s.physical_address,
          phone_number: s.phone_number,
          county_name: s.county?.county_name || null,
        });
      }

      if (registrarRes.data) {
        setRegisteredBy((registrarRes.data as any).full_name);
      }
    } catch (e) {
      console.error('Failed to load officer details:', e);
    } finally {
      setLoading(false);
    }
  };

  const initials = officer.full_name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : 'Never');
  const formatDateTime = (d: string | null) =>
    d ? new Date(d).toLocaleString() : 'Never';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 pr-10">
            {officer.profile_photo_url ? (
              <img
                src={officer.profile_photo_url}
                alt={officer.full_name}
                className="h-20 w-20 rounded-full object-cover border-4 border-white/30 shrink-0"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-2xl font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold truncate">{officer.full_name}</h2>
                {officer.is_station_admin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-md text-xs font-semibold">
                    <Shield className="w-3.5 h-3.5" />
                    Station Admin
                  </span>
                )}
              </div>
              <p className="text-blue-100 text-sm mt-1 capitalize">
                {officer.rank.replace(/_/g, ' ')}
                {officer.badge_number && <span className="ml-2">Badge #{officer.badge_number}</span>}
              </p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    officer.is_active ? 'bg-emerald-500/20 text-emerald-100' : 'bg-red-500/30 text-red-100'
                  }`}
                >
                  {officer.is_active ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {officer.is_active ? 'Active' : 'Inactive'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    officer.id_verified ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/30 text-amber-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  ID {officer.id_verified ? 'Verified' : 'Unverified'}
                </span>
                {officer.must_change_password && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/30 text-amber-100">
                    <Lock className="w-3.5 h-3.5" />
                    Must Change Password
                  </span>
                )}
                {officer.locked_until && new Date(officer.locked_until) > new Date() && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/30 text-red-100">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Locked
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Fine stats */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-600" />
              Enforcement Activity
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <p className="text-xl font-bold text-slate-900">
                  {loading ? '...' : fineStats.total}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Fines Issued</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xl font-bold text-amber-700">
                  {loading ? '...' : fineStats.issued}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Pending</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xl font-bold text-emerald-700">
                  {loading ? '...' : fineStats.paid}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Paid</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xl font-bold text-red-700">
                  {loading ? '...' : fineStats.overdue}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Overdue</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 col-span-2 sm:col-span-1">
                <p className="text-xl font-bold text-blue-700">
                  {loading ? '...' : `KSh ${fineStats.totalAmount.toLocaleString()}`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Total Value</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identification */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                Identification
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                <DetailRow label="Service Number" value={officer.service_number} mono />
                <DetailRow label="National ID" value={officer.national_id} mono />
                <DetailRow label="Rank" value={officer.rank.replace(/_/g, ' ')} capitalize />
                {officer.badge_number && (
                  <DetailRow label="Badge Number" value={officer.badge_number} mono />
                )}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                Contact
              </h3>
              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                <DetailRow
                  label="Phone Number"
                  value={officer.phone_number}
                  icon={<Phone className="w-3.5 h-3.5 text-slate-400" />}
                />
                <DetailRow
                  label="Email"
                  value={officer.email || 'Not provided'}
                  icon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
                />
              </div>
            </div>
          </div>

          {/* Station Assignment */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Station Assignment
            </h3>
            {stationInfo ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-900">
                      {stationInfo.station_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Code: <span className="font-mono">{stationInfo.station_code}</span>
                      <span className="mx-2">-</span>
                      <span className="capitalize">{stationInfo.station_type}</span>
                    </p>
                    {stationInfo.county_name && (
                      <p className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {stationInfo.county_name}
                        {stationInfo.physical_address && (
                          <span className="text-slate-500">- {stationInfo.physical_address}</span>
                        )}
                      </p>
                    )}
                    {stationInfo.phone_number && (
                      <p className="text-sm text-slate-600 mt-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {stationInfo.phone_number}
                      </p>
                    )}
                  </div>
                  {officer.is_station_admin && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md">
                      <Shield className="w-3.5 h-3.5" />
                      Station Administrator
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500">
                No station assigned
              </div>
            )}
          </div>

          {/* Account */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-blue-600" />
              Account
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              <DetailRow
                label="Last Login"
                value={formatDateTime(officer.last_login_at)}
                icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
              />
              <DetailRow
                label="Failed Login Attempts"
                value={String(officer.failed_login_attempts || 0)}
              />
              <DetailRow
                label="Account Created"
                value={formatDate(officer.created_at)}
                icon={<Calendar className="w-3.5 h-3.5 text-slate-400" />}
              />
              {registeredBy && (
                <DetailRow label="Registered By" value={registeredBy} />
              )}
              <DetailRow
                label="Password Reset Required"
                value={officer.must_change_password ? 'Yes' : 'No'}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  capitalize,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
      <span className="text-xs font-medium text-slate-500 shrink-0">{label}</span>
      <span
        className={`text-sm text-slate-900 font-medium flex items-center gap-1.5 text-right ${
          mono ? 'font-mono' : ''
        } ${capitalize ? 'capitalize' : ''}`}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
