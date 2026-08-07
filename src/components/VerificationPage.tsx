import { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Clock, Bike, User, FileText, AlertTriangle } from 'lucide-react';
import { supabase, type Owner, type Motorcycle, type Rider, type Verification } from '../lib/supabase';
import IncidentReportModal from './IncidentReportModal';
import AuthHeader from './AuthHeader';

type VerificationPageProps = {
  onNavigate: (page: string) => void;
  initialQrId?: string;
};

export default function VerificationPage({ onNavigate, initialQrId }: VerificationPageProps) {
  const [qrId, setQrId] = useState(initialQrId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationData, setVerificationData] = useState<{
    owner: Owner | null;
    motorcycle: Motorcycle | null;
    rider: Rider | null;
    verification: Verification | null;
  } | null>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [reportUnregistered, setReportUnregistered] = useState(false);

  useEffect(() => {
    if (initialQrId) {
      handleVerify(initialQrId);
    }
  }, [initialQrId]);

  const handleVerify = async (id: string = qrId) => {
    if (!id.trim()) {
      setError('Please enter a motorcycle registration or rider ID number');
      return;
    }

    setLoading(true);
    setError('');
    setVerificationData(null);

    try {
      let ownerId: string | null = null;
      let motorcycle: Motorcycle | null = null;
      let rider: Rider | null = null;

      const searchTerm = id.trim().replace(/\s+/g, '');

      const { data: allMotorcycles } = await supabase
        .from('motorcycles')
        .select('*');

      const motorcycleByReg = allMotorcycles?.find(m =>
        m.registration_number.replace(/\s+/g, '').toLowerCase() === searchTerm.toLowerCase()
      );

      if (motorcycleByReg) {
        motorcycle = motorcycleByReg;
        ownerId = motorcycleByReg.owner_id;

        const { data: riderData } = await supabase
          .from('riders')
          .select('*')
          .eq('motorcycle_id', motorcycleByReg.id)
          .maybeSingle();

        if (riderData) {
          rider = riderData;
        } else {
          const { data: anyRiderData } = await supabase
            .from('riders')
            .select('*')
            .eq('owner_id', ownerId)
            .maybeSingle();
          rider = anyRiderData;
        }
      } else {
        const { data: riderByIdNumber } = await supabase
          .from('riders')
          .select('*')
          .ilike('id_number', id.trim())
          .maybeSingle();

        if (riderByIdNumber) {
          rider = riderByIdNumber;
          ownerId = riderByIdNumber.owner_id;

          if ((riderByIdNumber as any).motorcycle_id) {
            const { data: motorcycleData } = await supabase
              .from('motorcycles')
              .select('*')
              .eq('id', (riderByIdNumber as any).motorcycle_id)
              .maybeSingle();
            if (motorcycleData) {
              motorcycle = motorcycleData;
            }
          }

          if (!motorcycle) {
            const { data: motorcycleData } = await supabase
              .from('motorcycles')
              .select('*')
              .eq('owner_id', ownerId)
              .maybeSingle();
            if (motorcycleData) {
              motorcycle = motorcycleData;
            }
          }
        }
      }

      if (!ownerId) {
        setError('No registration found with this motorcycle registration or rider ID number');
        setLoading(false);
        return;
      }

      const { data: owner, error: ownerError } = await supabase
        .from('owners')
        .select('*')
        .eq('id', ownerId)
        .maybeSingle();

      if (ownerError) throw ownerError;

      const { data: verification, error: verificationError } = await supabase
        .from('verifications')
        .select('*')
        .eq('owner_id', ownerId)
        .maybeSingle();

      if (verificationError) throw verificationError;

      if (motorcycle || owner || rider) {
        setVerificationData({
          owner: owner || null,
          motorcycle: motorcycle || null,
          rider: rider || null,
          verification: verification || null,
        });
      } else {
        setError('No registration data found');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Failed to verify registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const concealPhoneNumber = (phone: string) => {
    if (!phone || phone.length < 4) return phone;
    const visibleStart = phone.substring(0, 3);
    const visibleEnd = phone.substring(phone.length - 2);
    const concealed = '*'.repeat(phone.length - 5);
    return `${visibleStart}${concealed}${visibleEnd}`;
  };

  const concealIdNumber = (id: string) => {
    if (!id || id.length < 4) return id;
    const visibleStart = id.substring(0, 2);
    const visibleEnd = id.substring(id.length - 2);
    const concealed = '*'.repeat(id.length - 4);
    return `${visibleStart}${concealed}${visibleEnd}`;
  };

  const concealSaccoId = (saccoId: string) => {
    if (!saccoId || saccoId.length < 4) return saccoId;
    const visibleStart = saccoId.substring(0, 2);
    const concealed = '*'.repeat(saccoId.length - 2);
    return `${visibleStart}${concealed}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return (
          <div className="flex items-center space-x-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Verified</span>
          </div>
        );
      case 'Rejected':
        return (
          <div className="flex items-center space-x-2 bg-red-100 text-red-800 px-4 py-2 rounded-full">
            <XCircle className="h-5 w-5" />
            <span className="font-semibold">Rejected</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Pending Verification</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="verify" />

      {/* Page content */}
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Verify Registration</h1>
          <p className="text-slate-600 mb-8">
            Enter motorcycle registration number or rider ID number to verify bodaboda details
          </p>

          <div className="flex gap-4 mb-8">
            <input
              type="text"
              value={qrId}
              onChange={(e) => setQrId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Enter motorcycle registration (e.g., KAA 123A) or rider ID number"
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={() => handleVerify()}
              disabled={loading}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center"
            >
              <Search className="h-5 w-5 mr-2" />
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {error && (
            <div className="mb-8 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center">
                <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                {error}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-amber-900 mb-2 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Report an Unregistered Motorcycle
                </h3>
                <p className="text-amber-800 mb-4 text-sm">
                  If you witnessed an incident involving an unregistered motorcycle, you can still report it.
                </p>
                <button
                  onClick={() => {
                    setReportUnregistered(true);
                    setShowIncidentModal(true);
                  }}
                  className="px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition flex items-center"
                >
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Report Unregistered Incident
                </button>
              </div>
            </div>
          )}

          {verificationData && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Registration Found</h2>
                    <p className="text-sm text-slate-500">
                      {verificationData.motorcycle && `Motorcycle: ${verificationData.motorcycle.registration_number}`}
                      {verificationData.rider && ` | Rider: ${verificationData.rider.name}`}
                    </p>
                  </div>
                  {verificationData.verification && getStatusBadge(verificationData.verification.status)}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {verificationData.motorcycle?.is_compliant ? (
                    <span className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <CheckCircle className="h-4 w-4" />
                      <span>All Documents Complete</span>
                    </span>
                  ) : verificationData.motorcycle ? (
                    <span className="flex items-center space-x-2 bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <XCircle className="h-4 w-4" />
                      <span>Incomplete Documents</span>
                    </span>
                  ) : null}

                  {!verificationData.motorcycle && (
                    <span className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <XCircle className="h-4 w-4" />
                      <span>No Motorcycle Data</span>
                    </span>
                  )}

                  {!verificationData.rider && (
                    <span className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <XCircle className="h-4 w-4" />
                      <span>No Rider Assigned</span>
                    </span>
                  )}

                  {!verificationData.owner && (
                    <span className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <XCircle className="h-4 w-4" />
                      <span>No Owner Data</span>
                    </span>
                  )}

                  {!verificationData.verification && (
                    <span className="flex items-center space-x-2 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-sm font-semibold">
                      <XCircle className="h-4 w-4" />
                      <span>No Verification Record</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`rounded-full p-2 ${verificationData.owner ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <User className={`h-6 w-6 ${verificationData.owner ? 'text-emerald-600' : 'text-amber-600'}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Owner Information</h3>
                  {!verificationData.owner && (
                    <span className="text-amber-600 text-sm font-semibold ml-auto">Missing</span>
                  )}
                </div>
                {verificationData.owner ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600">Full Name</p>
                      <p className="font-semibold text-slate-900">{verificationData.owner.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Phone Number</p>
                      <p className="font-semibold text-slate-900">{concealPhoneNumber(verificationData.owner.phone_number)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">National ID</p>
                      <p className="font-semibold text-slate-900">{concealIdNumber(verificationData.owner.national_id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Next of Kin</p>
                      <p className="font-semibold text-slate-900">{verificationData.owner.next_of_kin_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Next of Kin Phone</p>
                      <p className="font-semibold text-slate-900">{verificationData.owner.next_of_kin_phone}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 font-semibold flex items-center">
                      <XCircle className="h-5 w-5 mr-2" />
                      Owner information not found
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      The owner data for this registration is missing from the system
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`rounded-full p-2 ${verificationData.motorcycle ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <Bike className={`h-6 w-6 ${verificationData.motorcycle ? 'text-emerald-600' : 'text-amber-600'}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Motorcycle Information</h3>
                  {!verificationData.motorcycle && (
                    <span className="text-amber-600 text-sm font-semibold ml-auto">Missing</span>
                  )}
                </div>
                {verificationData.motorcycle ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Registration Number</p>
                        <p className="font-semibold text-slate-900">{verificationData.motorcycle.registration_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Serial Number</p>
                        {verificationData.motorcycle.tracking_device_id ? (
                          <p className="font-semibold text-slate-900">{verificationData.motorcycle.tracking_device_id}</p>
                        ) : (
                          <p className="font-semibold text-amber-600 flex items-center">
                            <XCircle className="h-4 w-4 mr-1" />
                            Not Provided
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Insurance Policy Number</p>
                        {(verificationData.motorcycle as any).insurance_policy_number ? (
                          <p className="font-semibold text-slate-900">
                            {(verificationData.motorcycle as any).insurance_policy_number}
                          </p>
                        ) : (
                          <p className="font-semibold text-red-600 flex items-center">
                            <XCircle className="h-4 w-4 mr-1" />
                            Missing Valid Insurance
                          </p>
                        )}
                      </div>
                    </div>
                    {(!verificationData.motorcycle.tracking_device_id || !(verificationData.motorcycle as any).insurance_policy_number) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                        <p className="text-amber-800 font-semibold text-sm flex items-center">
                          <XCircle className="h-4 w-4 mr-2" />
                          Incomplete motorcycle documentation
                        </p>
                        <ul className="text-amber-700 text-sm mt-2 ml-6 list-disc">
                          {!verificationData.motorcycle.tracking_device_id && <li>Tracking device ID not registered</li>}
                          {!(verificationData.motorcycle as any).insurance_policy_number && <li>Insurance policy number missing</li>}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 font-semibold flex items-center">
                      <XCircle className="h-5 w-5 mr-2" />
                      Motorcycle information not found
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      The motorcycle data for this registration is missing from the system
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`rounded-full p-2 ${verificationData.rider ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    <FileText className={`h-6 w-6 ${verificationData.rider ? 'text-emerald-600' : 'text-amber-600'}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Rider Information</h3>
                  {!verificationData.rider && (
                    <span className="text-amber-600 text-sm font-semibold ml-auto">Not Assigned</span>
                  )}
                </div>
                {verificationData.rider ? (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Rider Name</p>
                        <p className="font-semibold text-slate-900">{verificationData.rider.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">ID Number</p>
                        <p className="font-semibold text-slate-900">{concealIdNumber(verificationData.rider.id_number)}</p>
                      </div>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mt-4">
                      <p className="text-sm font-bold text-blue-900 mb-3 flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Emergency Contact Information
                      </p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-blue-700">Next of Kin</p>
                          {verificationData.rider.next_of_kin_name ? (
                            <p className="font-semibold text-blue-900">{verificationData.rider.next_of_kin_name}</p>
                          ) : (
                            <p className="font-semibold text-amber-600 flex items-center">
                              <XCircle className="h-4 w-4 mr-1" />
                              Not Provided
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-blue-700">Contact Phone</p>
                          {verificationData.rider.next_of_kin_phone ? (
                            <p className="font-semibold text-blue-900">{verificationData.rider.next_of_kin_phone}</p>
                          ) : (
                            <p className="font-semibold text-amber-600 flex items-center">
                              <XCircle className="h-4 w-4 mr-1" />
                              Not Provided
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-slate-600">County Registration</p>
                        {verificationData.rider.county_registration_number ? (
                          <p className="font-semibold text-slate-900">{verificationData.rider.county_registration_number}</p>
                        ) : (
                          <p className="font-semibold text-amber-600 flex items-center">
                            <XCircle className="h-4 w-4 mr-1" />
                            Not Provided
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Stage Name</p>
                        {verificationData.rider.stage_name ? (
                          <p className="font-semibold text-slate-900">{verificationData.rider.stage_name}</p>
                        ) : (
                          <p className="font-semibold text-amber-600 flex items-center">
                            <XCircle className="h-4 w-4 mr-1" />
                            Not Provided
                          </p>
                        )}
                      </div>
                      {verificationData.rider.sacco_id && (
                        <div>
                          <p className="text-sm text-slate-600">Sacco ID</p>
                          <p className="font-semibold text-slate-900">{concealSaccoId(verificationData.rider.sacco_id)}</p>
                        </div>
                      )}
                    </div>
                    {verificationData.rider.photo_url && (
                      <div className="mt-4">
                        <p className="text-sm text-slate-600 mb-2">Rider Photo</p>
                        <img
                          src={verificationData.rider.photo_url}
                          alt="Rider"
                          className="w-32 h-32 object-cover rounded-lg border-2 border-slate-200"
                        />
                      </div>
                    )}
                    {(!verificationData.rider.county_registration_number || !verificationData.rider.stage_name || !verificationData.rider.photo_url) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                        <p className="text-amber-800 font-semibold text-sm flex items-center">
                          <XCircle className="h-4 w-4 mr-2" />
                          Incomplete rider information
                        </p>
                        <ul className="text-amber-700 text-sm mt-2 ml-6 list-disc">
                          {!verificationData.rider.county_registration_number && <li>County registration number not provided</li>}
                          {!verificationData.rider.stage_name && <li>Stage name not provided</li>}
                          {!verificationData.rider.photo_url && <li>Rider photo not uploaded</li>}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-amber-800 font-semibold flex items-center">
                      <XCircle className="h-5 w-5 mr-2" />
                      No rider assigned
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      This motorcycle does not have a rider assigned yet
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-xl font-bold text-red-900 mb-3 flex items-center">
                  <AlertTriangle className="h-6 w-6 mr-2" />
                  Report an Incident
                </h3>
                <p className="text-red-800 mb-4 text-sm">
                  If you witnessed or experienced an incident involving this motorcycle, report it here.
                </p>
                <button
                  onClick={() => {
                    setReportUnregistered(false);
                    setShowIncidentModal(true);
                  }}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition flex items-center"
                >
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  Report Incident
                </button>
              </div>

              {verificationData.verification ? (
                <>
                  {verificationData.verification.status === 'Verified' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
                      <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-emerald-900 mb-2">This Registration is Verified</h3>
                      <p className="text-emerald-700">
                        This bodaboda has been verified by admin and is compliant with all requirements.
                      </p>
                    </div>
                  )}

                  {verificationData.verification.status === 'Pending' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                      <Clock className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-amber-900 mb-2">Verification Pending</h3>
                      <p className="text-amber-700">
                        This registration is awaiting admin verification. Please check back later.
                      </p>
                    </div>
                  )}

                  {verificationData.verification.status === 'Rejected' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                      <XCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-red-900 mb-2">Registration Rejected</h3>
                      <p className="text-red-700">
                        This registration has been rejected. Please contact support for more information.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                  <XCircle className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-amber-900 mb-2">No Verification Record</h3>
                  <p className="text-amber-700">
                    This registration does not have a verification record in the system yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 pt-16 pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png" alt="Government of Kenya" className="h-10 w-10 object-contain brightness-0 invert" />
                <div>
                  <p className="text-white font-bold text-base leading-none">BMS</p>
                  <p className="text-slate-500 text-xs mt-0.5">Boda Management System</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Kenya's digital platform for bodaboda registration, compliance, tracking, and law enforcement integration.
              </p>
              <p className="text-xs text-slate-600">
                Powered by <span className="text-emerald-400 font-semibold">Hiram Technologies</span>
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Portals</h4>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: 'Register', page: 'registration-choice' },
                  { label: 'Owner Login', page: 'user-login' },
                  { label: 'Rider Login', page: 'rider-login' },
                  { label: 'Police Portal', page: 'police' },
                  { label: 'Admin Portal', page: 'admin' },
                ].map(({ label, page }) => (
                  <button key={page} onClick={() => onNavigate(page)}
                    className="block hover:text-emerald-400 transition-colors text-left">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Features</h4>
              <div className="space-y-2.5 text-sm">
                {['QR Code Verification', 'GPS Tracking', 'Incident Reporting', 'Fines Management', 'SMS Notifications', 'Audit Logs'].map((f) => (
                  <p key={f} className="text-slate-500">{f}</p>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Contact</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Email</p>
                  <p className="text-slate-300">support@hiramtech.co.ke</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Phone</p>
                  <p className="text-slate-300">+254 700 000 000</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Location</p>
                  <p className="text-slate-300">Nairobi, Kenya</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-slate-600">&copy; {new Date().getFullYear()} BMS — Boda Management System. All rights reserved.</p>
            <p className="text-slate-600">
              Built by <span className="text-emerald-400 font-semibold">Hiram Technologies</span>
            </p>
          </div>
        </div>
      </footer>

      {showIncidentModal && (
        <IncidentReportModal
          motorcycleId={reportUnregistered ? undefined : verificationData?.motorcycle?.id}
          riderId={reportUnregistered ? undefined : verificationData?.rider?.id}
          ownerId={reportUnregistered ? undefined : verificationData?.owner?.id}
          motorcycleReg={reportUnregistered ? undefined : verificationData?.motorcycle?.registration_number}
          riderName={reportUnregistered ? undefined : verificationData?.rider?.name}
          isUnregistered={reportUnregistered}
          onClose={() => {
            setShowIncidentModal(false);
            setReportUnregistered(false);
          }}
          onSuccess={() => {
            setShowIncidentModal(false);
            setReportUnregistered(false);
          }}
        />
      )}
    </div>
  );
}
