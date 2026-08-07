import { useState, useEffect } from 'react';
import { X, Bike, User, FileText, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MotorcycleIncidentsSection from './MotorcycleIncidentsSection';
import DocumentRevalidateButton from './DocumentRevalidateButton';

type BikeDetails = {
  motorcycle: {
    id: string;
    registration_number: string;
    tracking_device_id: string | null;
    insurance_policy_number: string | null;
    insurance_expiry: string | null;
    logbook_url: string | null;
    kra_pin_url: string | null;
    insurance_cover_url: string | null;
    bike_photo_url: string | null;
    owner_id: string;
  };
  owner: {
    id: string;
    full_name: string;
    phone_number: string;
    national_id: string;
    next_of_kin_name: string;
    next_of_kin_phone: string;
  };
  rider: {
    id: string;
    name: string;
    id_number: string;
    phone_number: string | null;
    county_registration_number: string | null;
    sacco_id: string | null;
    stage_name: string | null;
    photo_url: string | null;
    license_url: string | null;
    license_expiry: string | null;
    good_conduct_url: string | null;
    id_copy_url: string | null;
  } | null;
};

type BikeDetailsModalProps = {
  motorcycleId: string;
  onClose: () => void;
};

export default function BikeDetailsModal({ motorcycleId, onClose }: BikeDetailsModalProps) {
  const [details, setDetails] = useState<BikeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadBikeDetails();
  }, [motorcycleId]);

  const loadBikeDetails = async () => {
    setLoading(true);
    try {
      const { data: motorcycleData, error: motorcycleError } = await supabase
        .from('motorcycles')
        .select(`
          id,
          registration_number,
          tracking_device_id,
          insurance_policy_number,
          insurance_expiry,
          logbook_url,
          kra_pin_url,
          insurance_cover_url,
          bike_photo_url,
          owner_id
        `)
        .eq('id', motorcycleId)
        .maybeSingle();

      if (motorcycleError) throw motorcycleError;
      if (!motorcycleData) throw new Error('Motorcycle not found');

      const { data: ownerData, error: ownerError } = await supabase
        .from('owners')
        .select('id, full_name, phone_number, national_id, next_of_kin_name, next_of_kin_phone')
        .eq('id', motorcycleData.owner_id)
        .maybeSingle();

      if (ownerError) throw ownerError;
      if (!ownerData) throw new Error('Owner not found');

      const { data: riderData } = await supabase
        .from('riders')
        .select(`
          id,
          name,
          id_number,
          phone_number,
          county_registration_number,
          sacco_id,
          stage_name,
          photo_url,
          license_url,
          license_expiry,
          good_conduct_url,
          id_copy_url
        `)
        .eq('motorcycle_id', motorcycleId)
        .maybeSingle();

      setDetails({
        motorcycle: motorcycleData,
        owner: ownerData,
        rider: riderData || null,
      });
    } catch (error) {
      console.error('Error loading bike details:', error);
      alert('Failed to load bike details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">Failed to load bike details</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <Bike className="h-6 w-6 text-emerald-600" />
            <h2 className="text-2xl font-bold text-slate-900">Bike Details</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-emerald-900 mb-3 flex items-center">
              <Bike className="h-5 w-5 mr-2" />
              Motorcycle Information
            </h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-emerald-700 font-medium">Registration:</span>
                <span className="ml-2 font-semibold text-emerald-900">
                  {details.motorcycle.registration_number}
                </span>
              </div>
              <div>
                <span className="text-emerald-700 font-medium">Serial Number:</span>
                <span className="ml-2 font-semibold text-emerald-900">
                  {details.motorcycle.tracking_device_id || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Owner Information
            </h3>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-blue-700 font-medium">Name:</span>
                <span className="ml-2 font-semibold text-blue-900">
                  {details.owner.full_name}
                </span>
              </div>
              {expanded && (
                <>
                  <div>
                    <span className="text-blue-700 font-medium">Phone:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {details.owner.phone_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">National ID:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {details.owner.national_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Next of Kin:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {details.owner.next_of_kin_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Next of Kin Phone:</span>
                    <span className="ml-2 font-semibold text-blue-900">
                      {details.owner.next_of_kin_phone}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {details.rider ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-orange-900 mb-3 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Rider Information
              </h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-orange-700 font-medium">Name:</span>
                  <span className="ml-2 font-semibold text-orange-900">
                    {details.rider.name}
                  </span>
                </div>
                {expanded && (
                  <>
                    <div>
                      <span className="text-orange-700 font-medium">ID Number:</span>
                      <span className="ml-2 font-semibold text-orange-900">
                        {details.rider.id_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-700 font-medium">Phone:</span>
                      <span className="ml-2 font-semibold text-orange-900">
                        {details.rider.phone_number || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-700 font-medium">County Reg:</span>
                      <span className="ml-2 font-semibold text-orange-900">
                        {details.rider.county_registration_number || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-700 font-medium">Sacco ID:</span>
                      <span className="ml-2 font-semibold text-orange-900">
                        {details.rider.sacco_id || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-700 font-medium">Stage:</span>
                      <span className="ml-2 font-semibold text-orange-900">
                        {details.rider.stage_name || 'N/A'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {expanded && details.rider.photo_url && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-orange-700 mb-2">Rider Photo</p>
                  <img
                    src={details.rider.photo_url}
                    alt={details.rider.name}
                    className="w-32 h-32 rounded-lg object-cover border-2 border-orange-200"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center">
              <User className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">No rider assigned to this motorcycle</p>
            </div>
          )}

          <MotorcycleIncidentsSection motorcycleId={details.motorcycle.id} />

          {expanded && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-slate-600" />
                Documents
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Motorcycle Documents</p>
                  <div className="space-y-3">
                    {details.motorcycle.bike_photo_url && (
                      <DocRow label="Bike Photo (Side)" url={details.motorcycle.bike_photo_url}>
                        <DocumentRevalidateButton
                          userType="owner" userId={details.motorcycle.owner_id}
                          documentType="bike_photo_side"
                          fileUrl={details.motorcycle.bike_photo_url} fileName="bike_photo_side"
                          expectedName={details.owner?.full_name} expectedIdNumber={details.owner?.national_id}
                        />
                      </DocRow>
                    )}
                    {details.motorcycle.logbook_url && (
                      <DocRow label="Logbook" url={details.motorcycle.logbook_url}>
                        <DocumentRevalidateButton
                          userType="owner" userId={details.motorcycle.owner_id}
                          documentType="logbook"
                          fileUrl={details.motorcycle.logbook_url} fileName="logbook"
                          expectedName={details.owner?.full_name} expectedIdNumber={details.owner?.national_id}
                        />
                      </DocRow>
                    )}
                    {details.motorcycle.kra_pin_url && (
                      <DocRow label="KRA PIN Certificate" url={details.motorcycle.kra_pin_url}>
                        <DocumentRevalidateButton
                          userType="owner" userId={details.motorcycle.owner_id}
                          documentType="kra_pin_doc"
                          fileUrl={details.motorcycle.kra_pin_url} fileName="kra_pin_doc"
                          expectedName={details.owner?.full_name} expectedIdNumber={details.owner?.national_id}
                        />
                      </DocRow>
                    )}
                    {details.motorcycle.insurance_cover_url && (
                      <DocRow label="Insurance Cover" url={details.motorcycle.insurance_cover_url}>
                        <DocumentRevalidateButton
                          userType="owner" userId={details.motorcycle.owner_id}
                          documentType="insurance_cover"
                          fileUrl={details.motorcycle.insurance_cover_url} fileName="insurance_cover"
                          knownExpiryDate={details.motorcycle.insurance_expiry ?? null}
                        />
                      </DocRow>
                    )}
                    {!details.motorcycle.logbook_url && !details.motorcycle.kra_pin_url && !details.motorcycle.insurance_cover_url && !details.motorcycle.bike_photo_url && (
                      <p className="text-sm text-slate-400">No motorcycle documents uploaded</p>
                    )}
                  </div>
                </div>

                {details.rider && (
                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Rider Documents</p>
                    <div className="space-y-3">
                      {details.rider.license_url && (
                        <DocRow label="Driving License" url={details.rider.license_url}>
                          <DocumentRevalidateButton
                            userType="rider" userId={details.rider.id}
                            documentType="driving_license"
                            fileUrl={details.rider.license_url} fileName="license"
                            expectedName={details.rider.name} expectedIdNumber={details.rider.id_number}
                            knownExpiryDate={details.rider.license_expiry ?? null}
                          />
                        </DocRow>
                      )}
                      {details.rider.good_conduct_url && (
                        <DocRow label="Good Conduct Certificate" url={details.rider.good_conduct_url}>
                          <DocumentRevalidateButton
                            userType="rider" userId={details.rider.id}
                            documentType="good_conduct"
                            fileUrl={details.rider.good_conduct_url} fileName="good_conduct"
                            expectedName={details.rider.name} expectedIdNumber={details.rider.id_number}
                          />
                        </DocRow>
                      )}
                      {details.rider.id_copy_url && (
                        <DocRow label="National ID Copy" url={details.rider.id_copy_url}>
                          <DocumentRevalidateButton
                            userType="rider" userId={details.rider.id}
                            documentType="national_id"
                            fileUrl={details.rider.id_copy_url} fileName="id_copy"
                            expectedName={details.rider.name} expectedIdNumber={details.rider.id_number}
                          />
                        </DocRow>
                      )}
                      {!details.rider.license_url && !details.rider.good_conduct_url && !details.rider.id_copy_url && (
                        <p className="text-sm text-slate-400">No rider documents uploaded</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span>Show Less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>View Full Details</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocRow({ label, url, children }: { label: string; url: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 p-2.5 border border-slate-200 rounded-lg bg-white">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span>{label}</span>
      </a>
      {children}
    </div>
  );
}
