import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { supabase, type KenyaCounty, type KenyaConstituency, type KenyaWard } from '../lib/supabase';

type LocalitySelectorProps = {
  countyId: number | null;
  constituencyId: number | null;
  wardId: number | null;
  onChange: (locality: { countyId: number | null; constituencyId: number | null; wardId: number | null }) => void;
  required?: boolean;
  label?: string;
  compact?: boolean;
};

export default function LocalitySelector({
  countyId,
  constituencyId,
  wardId,
  onChange,
  required = false,
  label = 'Operating Area',
  compact = false,
}: LocalitySelectorProps) {
  const [counties, setCounties] = useState<KenyaCounty[]>([]);
  const [constituencies, setConstituencies] = useState<KenyaConstituency[]>([]);
  const [wards, setWards] = useState<KenyaWard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCounties();
  }, []);

  useEffect(() => {
    if (countyId) {
      loadConstituencies(countyId);
    } else {
      setConstituencies([]);
      setWards([]);
    }
  }, [countyId]);

  useEffect(() => {
    if (constituencyId) {
      loadWards(constituencyId);
    } else {
      setWards([]);
    }
  }, [constituencyId]);

  const loadCounties = async () => {
    const { data } = await supabase
      .from('kenya_counties')
      .select('*')
      .order('county_name');
    setCounties(data || []);
    setLoading(false);
  };

  const loadConstituencies = async (cId: number) => {
    const { data } = await supabase
      .from('kenya_constituencies')
      .select('*')
      .eq('county_id', cId)
      .order('constituency_name');
    setConstituencies(data || []);
  };

  const loadWards = async (cId: number) => {
    const { data } = await supabase
      .from('kenya_wards')
      .select('*')
      .eq('constituency_id', cId)
      .order('ward_name');
    setWards(data || []);
  };

  const handleCountyChange = (value: string) => {
    const id = value ? parseInt(value) : null;
    onChange({ countyId: id, constituencyId: null, wardId: null });
  };

  const handleConstituencyChange = (value: string) => {
    const id = value ? parseInt(value) : null;
    onChange({ countyId, constituencyId: id, wardId: null });
  };

  const handleWardChange = (value: string) => {
    const id = value ? parseInt(value) : null;
    onChange({ countyId, constituencyId, wardId: id });
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading localities...</div>;
  }

  const selectClass = compact
    ? 'w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
    : 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MapPin className="w-4 h-4" />
          <span>{label}</span>
          {required && <span className="text-red-500">*</span>}
        </div>
      )}
      <div className={compact ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-1 md:grid-cols-3 gap-3'}>
        <div>
          {!compact && <label className="block text-xs font-medium text-gray-500 mb-1">County</label>}
          <select
            value={countyId || ''}
            onChange={(e) => handleCountyChange(e.target.value)}
            className={selectClass}
            required={required}
          >
            <option value="">Select County</option>
            {counties.map((c) => (
              <option key={c.id} value={c.id}>{c.county_name}</option>
            ))}
          </select>
        </div>
        <div>
          {!compact && <label className="block text-xs font-medium text-gray-500 mb-1">Constituency</label>}
          <select
            value={constituencyId || ''}
            onChange={(e) => handleConstituencyChange(e.target.value)}
            className={selectClass}
            disabled={!countyId}
          >
            <option value="">Select Constituency</option>
            {constituencies.map((c) => (
              <option key={c.id} value={c.id}>{c.constituency_name}</option>
            ))}
          </select>
        </div>
        <div>
          {!compact && <label className="block text-xs font-medium text-gray-500 mb-1">Ward</label>}
          <select
            value={wardId || ''}
            onChange={(e) => handleWardChange(e.target.value)}
            className={selectClass}
            disabled={!constituencyId}
          >
            <option value="">Select Ward</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.ward_name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
