import { useState, useEffect } from 'react';
import { Users, Plus, Shield, X } from 'lucide-react';
import { supabase, type PoliceOfficerWithStation, type PoliceOfficer } from '../../lib/supabase';
import { PoliceAuthService, POLICE_RANKS } from '../../lib/policeAuth';
import GovernmentVerificationField, { type VerifyResult } from '../GovernmentVerificationField';

type Props = { officer: PoliceOfficerWithStation };

export default function PoliceOfficers({ officer }: Props) {
  const [officers, setOfficers] = useState<PoliceOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => { loadOfficers(); }, []);

  const loadOfficers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('police_officers')
      .select('*')
      .eq('station_id', officer.station_id)
      .order('created_at', { ascending: false });
    setOfficers(data || []);
    setLoading(false);
  };

  const toggleOfficerStatus = async (targetOfficer: PoliceOfficer) => {
    await supabase
      .from('police_officers')
      .update({ is_active: !targetOfficer.is_active })
      .eq('id', targetOfficer.id);
    await PoliceAuthService.logActivity(officer.id, 'register_officer', 'police_officer', targetOfficer.id, {
      action: targetOfficer.is_active ? 'deactivated' : 'activated',
    });
    loadOfficers();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{officers.length} officer{officers.length !== 1 ? 's' : ''} at this station</p>
        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Register Officer
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading officers...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Officer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Service No.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {officers.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {o.is_station_admin && <Shield className="w-4 h-4 text-blue-500" />}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{o.full_name}</p>
                        <p className="text-xs text-gray-500">{o.phone_number}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{o.service_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 capitalize">{o.rank.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${o.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {o.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {o.last_login_at ? new Date(o.last_login_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    {o.id !== officer.id && (
                      <button
                        onClick={() => toggleOfficerStatus(o)}
                        className={`text-xs px-3 py-1 rounded-lg font-medium ${o.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                      >
                        {o.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showRegisterModal && (
        <RegisterOfficerModal
          stationAdmin={officer}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => { setShowRegisterModal(false); loadOfficers(); }}
        />
      )}
    </div>
  );
}

function RegisterOfficerModal({ stationAdmin, onClose, onSuccess }: {
  stationAdmin: PoliceOfficerWithStation;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    service_number: '',
    national_id: '',
    full_name: '',
    phone_number: '',
    email: '',
    rank: 'constable',
    badge_number: '',
  });
  const [idVerResult, setIdVerResult] = useState<VerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.service_number || !formData.national_id || !formData.full_name || !formData.phone_number) {
      setError('Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await PoliceAuthService.registerOfficer({
        service_number: formData.service_number,
        national_id: formData.national_id,
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        email: formData.email || undefined,
        rank: formData.rank,
        badge_number: formData.badge_number || undefined,
        station_id: stationAdmin.station_id,
        id_verified: idVerResult?.verified || false,
        registered_by: stationAdmin.id,
      });

      setTempPassword((result as any)._tempPassword);

      await PoliceAuthService.logActivity(stationAdmin.id, 'register_officer', 'police_officer', result.id, {
        officer_name: formData.full_name,
        service_number: formData.service_number,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (tempPassword) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Officer Registered</h3>
          <p className="text-sm text-gray-500 mt-2">{formData.full_name} ({formData.service_number})</p>
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800 font-medium">Temporary Password</p>
            <p className="text-lg font-mono font-bold text-amber-900 mt-1">{tempPassword}</p>
            <p className="text-xs text-amber-700 mt-2">Share this securely with the officer. They must change it on first login.</p>
          </div>
          <button onClick={onSuccess} className="mt-6 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold text-gray-900">Register New Officer</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Number *</label>
              <input
                value={formData.service_number}
                onChange={(e) => setFormData(prev => ({ ...prev, service_number: e.target.value.toUpperCase() }))}
                placeholder="AP/12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rank *</label>
              <select
                value={formData.rank}
                onChange={(e) => setFormData(prev => ({ ...prev, rank: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {POLICE_RANKS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <GovernmentVerificationField
            type="national_id"
            value={formData.national_id}
            onChange={(val) => setFormData(prev => ({ ...prev, national_id: val }))}
            onVerified={(result) => {
              setIdVerResult(result);
              if (result.verified && result.name) {
                setFormData(prev => ({ ...prev, full_name: result.name! }));
              }
            }}
            label="National ID *"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input
                value={formData.phone_number}
                onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                placeholder="+254..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Badge Number</label>
            <input
              value={formData.badge_number}
              onChange={(e) => setFormData(prev => ({ ...prev, badge_number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Registering...' : 'Register Officer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
