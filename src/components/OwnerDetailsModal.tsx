import { useState, useEffect } from 'react';
import { User, Phone, FileText, Users, Bike, Eye, ChevronRight } from 'lucide-react';
import { supabase, type Owner, type Motorcycle, type Rider } from '../lib/supabase';
import { RiderRatingChip } from './RiderRatingBadge';

type OwnerDetailsProps = {
  owner: Owner;
  onBack: () => void;
  onViewMotorcycle?: (motorcycle: Motorcycle) => void;
  onViewRider?: (rider: Rider) => void;
};

export default function OwnerDetailsModal({ owner, onBack, onViewMotorcycle, onViewRider }: OwnerDetailsProps) {
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOwnerMotorcycles();
  }, [owner.id]);

  const loadOwnerMotorcycles = async () => {
    setLoading(true);
    try {
      const { data: motorcyclesData } = await supabase
        .from('motorcycles')
        .select('*')
        .eq('owner_id', owner.id);

      const { data: ridersData } = await supabase
        .from('riders')
        .select('*')
        .eq('assignment_status', 'Assigned');

      const motorcyclesWithRiders = motorcyclesData?.map((motorcycle) => {
        const assignedRider = ridersData?.find((r) => r.motorcycle_id === motorcycle.id);
        return {
          ...motorcycle,
          rider: assignedRider,
        };
      });

      setMotorcycles(motorcyclesWithRiders || []);
    } catch (error) {
      console.error('Error loading owner motorcycles:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm">
        <button onClick={onBack} className="text-emerald-600 hover:text-emerald-700 font-medium">
          Owners
        </button>
        <ChevronRight className="h-4 w-4 text-slate-400 mx-2" />
        <span className="text-slate-700 font-medium">{owner.full_name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
          <User className="h-6 w-6 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{owner.full_name}</h2>
          <p className="text-sm text-slate-500">Owner Profile</p>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          Personal Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Full Name</label>
            <p className="text-base font-semibold text-slate-900 mt-0.5">{owner.full_name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">National ID</label>
            <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{owner.national_id}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phone Number</label>
            <p className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-600" />
              {owner.phone_number}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registration Date</label>
            <p className="text-base font-semibold text-slate-900 mt-0.5">
              {new Date(owner.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Next of Kin */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          Next of Kin
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name</label>
            <p className="text-base font-semibold text-slate-900 mt-0.5">{owner.next_of_kin_name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</label>
            <p className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-600" />
              {owner.next_of_kin_phone}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Relationship</label>
            <p className="text-base font-semibold text-slate-900 mt-0.5">{owner.next_of_kin_relationship}</p>
          </div>
        </div>
      </div>

      {/* Motorcycles */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
          <Bike className="h-5 w-5 text-emerald-600" />
          <h3 className="text-base font-semibold text-slate-900">
            Registered Motorcycles ({motorcycles.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            <span className="ml-3 text-sm text-slate-600">Loading motorcycles...</span>
          </div>
        ) : motorcycles.length === 0 ? (
          <div className="p-8 text-center">
            <Bike className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No motorcycles registered</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Registration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Serial No.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Assigned Rider</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {motorcycles.map((motorcycle: any) => (
                  <tr key={motorcycle.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Bike className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium text-slate-900">{motorcycle.registration_number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 hidden sm:table-cell">
                      {motorcycle.tracking_device_id || <span className="text-slate-400">N/A</span>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {motorcycle.rider ? (
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm text-slate-900 truncate">{motorcycle.rider.name}</p>
                              <RiderRatingChip
                                score={motorcycle.rider.rating_score}
                                tier={motorcycle.rider.rating_tier}
                                className="shrink-0"
                              />
                            </div>
                            <p className="text-xs text-slate-500">{motorcycle.rider.id_number}</p>
                          </div>
                          {onViewRider && (
                            <button
                              onClick={() => onViewRider(motorcycle.rider)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden lg:table-cell">
                      {new Date(motorcycle.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onViewMotorcycle && (
                        <button
                          onClick={() => onViewMotorcycle(motorcycle)}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">View</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
