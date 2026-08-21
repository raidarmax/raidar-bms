import { useState, useEffect } from 'react';
import { User, Phone, FileText, Bike, Eye, ExternalLink, ChevronRight, AlertCircle } from 'lucide-react';
import BmsIdLink from './BmsIdLink';
import { supabase, type Rider, type Motorcycle, type Owner } from '../lib/supabase';
import DocumentLink from './DocumentLink';
import { getLicenseExpiryStatus } from '../lib/licenseExpiry';
import RiderRatingCard, { RiderRatingChip } from './RiderRatingBadge';
import DocumentRevalidateButton from './DocumentRevalidateButton';

type RiderDetailsProps = {
  rider: Rider;
  onBack: () => void;
  onViewMotorcycle?: (motorcycle: Motorcycle) => void;
  onViewOwner?: (owner: Owner) => void;
};

export default function RiderDetailsModal({ rider, onBack, onViewMotorcycle, onViewOwner }: RiderDetailsProps) {
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRiderDetails();
  }, [rider.id]);

  const loadRiderDetails = async () => {
    setLoading(true);
    try {
      if (rider.motorcycle_id) {
        const { data: motorcycleData } = await supabase
          .from('motorcycles')
          .select('*')
          .eq('id', rider.motorcycle_id)
          .maybeSingle();

        setMotorcycle(motorcycleData);

        if (motorcycleData?.owner_id) {
          const { data: ownerData } = await supabase
            .from('owners')
            .select('*')
            .eq('id', motorcycleData.owner_id)
            .maybeSingle();

          setOwner(ownerData);
        }
      }
    } catch (error) {
      console.error('Error loading rider details:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm">
        <button onClick={onBack} className="text-emerald-600 hover:text-emerald-700 font-medium">
          Riders
        </button>
        <ChevronRight className="h-4 w-4 text-slate-400 mx-2" />
        <span className="text-slate-700 font-medium">{rider.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        {rider.photo_url ? (
          <img src={rider.photo_url} alt={rider.name} className="w-14 h-14 rounded-xl object-cover border-2 border-slate-200" />
        ) : (
          <div className="h-14 w-14 bg-emerald-100 rounded-xl flex items-center justify-center">
            <User className="h-7 w-7 text-emerald-700" />
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{rider.name}</h2>
          <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
            {rider.bms_id ? (
              <BmsIdLink
                bmsId={rider.bms_id}
                riderName={rider.name}
                idNumber={rider.id_number}
                phoneNumber={rider.phone_number}
                countyReg={rider.county_registration_number}
                photoUrl={rider.photo_url}
                motorcycle={motorcycle?.registration_number}
                owner={owner?.full_name}
              />
            ) : 'Rider Profile'}
            <RiderRatingChip score={rider.rating_score} tier={rider.rating_tier} />
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
          <span className="ml-3 text-sm text-slate-600">Loading details...</span>
        </div>
      ) : (
        <>
          {(() => {
            const s = getLicenseExpiryStatus(rider.license_expiry);
            if (!s || (!s.isExpired && !s.isExpiringSoon)) return null;
            return (
              <div className={`rounded-xl border p-4 flex items-start gap-3 ${s.isExpired ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">
                    {s.isExpired ? 'Driving license has expired' : 'Driving license expiring soon'}
                  </p>
                  <p className="text-xs mt-0.5">{s.label} — expires on {new Date(rider.license_expiry!).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })()}
          {/* Rider Rating */}
          <RiderRatingCard
            stats={{
              rating_score: rider.rating_score,
              rating_tier: rider.rating_tier,
              pending_incident_count: rider.pending_incident_count,
              confirmed_incident_count: rider.confirmed_incident_count,
              total_incident_count: rider.total_incident_count,
              total_fines_count: rider.total_fines_count,
              unpaid_fines_count: rider.unpaid_fines_count,
              license_verified: rider.license_verified,
              license_expiry: rider.license_expiry,
              id_verified: rider.id_verified,
              payment_status: rider.payment_status === 'completed' ? 'Paid' : 'Pending',
              photo_url: rider.photo_url,
              next_of_kin_name: rider.next_of_kin_name,
              next_of_kin_phone: rider.next_of_kin_phone,
              good_conduct_url: rider.good_conduct_url,
              id_copy_url: rider.id_copy_url,
              license_url: rider.license_url,
              kra_pin: rider.kra_pin,
              kra_pin_verified: rider.kra_pin_verified,
              sacco_id: rider.sacco_id,
              bms_id: rider.bms_id,
              assignment_status: rider.assignment_status,
              created_at: rider.created_at,
            }}
          />

          {/* Rider Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Full Name</label>
                <p className="text-base font-semibold text-slate-900 mt-0.5">{rider.name}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">ID Number</label>
                <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{rider.id_number}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</label>
                <p className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  {rider.phone_number}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">BMS ID</label>
                <div className="mt-0.5">
                  {rider.bms_id ? (
                    <BmsIdLink
                      bmsId={rider.bms_id}
                      riderName={rider.name}
                      idNumber={rider.id_number}
                      phoneNumber={rider.phone_number}
                      countyReg={rider.county_registration_number}
                      photoUrl={rider.photo_url}
                      motorcycle={motorcycle?.registration_number}
                      owner={owner?.full_name}
                      className="text-base font-semibold"
                    />
                  ) : (
                    <p className="text-base font-semibold text-slate-400 font-sans">Not assigned</p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">County Registration</label>
                <p className="text-base font-semibold text-slate-900 mt-0.5">
                  {rider.county_registration_number || <span className="text-slate-400">N/A</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">SACCO ID</label>
                <p className="text-base font-semibold text-slate-900 mt-0.5">
                  {rider.sacco_id || <span className="text-slate-400">N/A</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Stage Name</label>
                <p className="text-base font-semibold text-slate-900 mt-0.5">
                  {rider.stage_name || <span className="text-slate-400">N/A</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assignment Status</label>
                <span className={`inline-flex mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${rider.assignment_status === 'Assigned' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {rider.assignment_status}
                </span>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">License Number</label>
                <p className="text-base font-semibold text-slate-900 mt-0.5">
                  {rider.license_number || <span className="text-slate-400">N/A</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">License Expiry</label>
                {rider.license_expiry ? (
                  <div className="mt-0.5">
                    <p className="text-base font-semibold text-slate-900">
                      {new Date(rider.license_expiry).toLocaleDateString()}
                    </p>
                    {(() => {
                      const s = getLicenseExpiryStatus(rider.license_expiry);
                      if (!s) return null;
                      return (
                        <span className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-md font-semibold border ${s.className}`}>
                          <AlertCircle className="h-3 w-3" />
                          {s.label}
                        </span>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-base font-semibold text-slate-400 mt-0.5">Not set</p>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h3 className="text-base font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Next of Kin</label>
                <p className="text-base font-semibold text-blue-900 mt-0.5">
                  {rider.next_of_kin_name || <span className="text-slate-400">Not provided</span>}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">Phone</label>
                <p className="text-base font-semibold text-blue-900 mt-0.5">
                  {rider.next_of_kin_phone || <span className="text-slate-400">Not provided</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Documents
            </h3>
            <div className="space-y-3">
              {rider.license_url ? (
                <div className="flex flex-col gap-1.5 p-2.5 border border-slate-200 rounded-lg">
                  <DocumentLink
                    fileUrl={rider.license_url}
                    label="View Driving License"
                    userType="rider"
                    userId={rider.id}
                    documentType="driving_license"
                  />
                  <DocumentRevalidateButton
                    userType="rider" userId={rider.id}
                    documentType="driving_license"
                    fileUrl={rider.license_url} fileName="license"
                    expectedName={rider.name} expectedIdNumber={rider.id_number}
                    knownExpiryDate={rider.license_expiry ?? null}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-400">No license uploaded</p>
              )}
              {rider.good_conduct_url ? (
                <div className="flex flex-col gap-1.5 p-2.5 border border-slate-200 rounded-lg">
                  <DocumentLink
                    fileUrl={rider.good_conduct_url}
                    label="View Good Conduct Certificate"
                    userType="rider"
                    userId={rider.id}
                    documentType="good_conduct"
                  />
                  <DocumentRevalidateButton
                    userType="rider" userId={rider.id}
                    documentType="good_conduct"
                    fileUrl={rider.good_conduct_url} fileName="good_conduct"
                    expectedName={rider.name} expectedIdNumber={rider.id_number}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-400">No good conduct certificate uploaded</p>
              )}
              {rider.id_copy_url ? (
                <div className="flex flex-col gap-1.5 p-2.5 border border-slate-200 rounded-lg">
                  <DocumentLink
                    fileUrl={rider.id_copy_url}
                    label="View ID Copy"
                    userType="rider"
                    userId={rider.id}
                    documentType="national_id"
                  />
                  <DocumentRevalidateButton
                    userType="rider" userId={rider.id}
                    documentType="national_id"
                    fileUrl={rider.id_copy_url} fileName="id_copy"
                    expectedName={rider.name} expectedIdNumber={rider.id_number}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-400">No ID copy uploaded</p>
              )}
            </div>
          </div>

          {/* Motorcycle */}
          {motorcycle && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Bike className="h-5 w-5 text-emerald-600" />
                  Associated Motorcycle
                </h3>
                {onViewMotorcycle && (
                  <button
                    onClick={() => onViewMotorcycle(motorcycle)}
                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  >
                    <Eye className="h-4 w-4" /> View Details
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registration</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">{motorcycle.registration_number}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Serial Number</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">
                    {motorcycle.tracking_device_id || <span className="text-slate-400">N/A</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Insurance</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">
                    {motorcycle.insurance_policy_number || <span className="text-slate-400">N/A</span>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Owner */}
          {owner && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600" />
                  Owner
                </h3>
                {onViewOwner && (
                  <button
                    onClick={() => onViewOwner(owner)}
                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  >
                    <Eye className="h-4 w-4" /> View Details
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">{owner.full_name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">National ID</label>
                  <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{owner.national_id}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">{owner.phone_number}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
