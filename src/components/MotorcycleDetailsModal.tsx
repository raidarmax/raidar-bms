import { useState, useEffect } from 'react';
import { Bike, User, FileText, MapPin, Shield, Calendar, CheckCircle, XCircle, Clock, AlertTriangle, Eye, ChevronRight, ExternalLink, ShieldAlert, Image as ImageIcon, Download } from 'lucide-react';
import { supabase, type Motorcycle, type Owner, type Rider, type Verification } from '../lib/supabase';
import TrackingModal from './TrackingModal';
import MotorcycleIncidentsSection, { isIncidentUnresolved } from './MotorcycleIncidentsSection';
import DocumentRevalidateButton from './DocumentRevalidateButton';
import type { DocumentType } from '../lib/documentValidation';

type MotorcycleDetailsProps = {
  motorcycle: Motorcycle;
  onBack: () => void;
  onViewOwner?: (owner: Owner) => void;
  onViewRider?: (rider: Rider) => void;
  onTrack?: (motorcycle: Motorcycle) => void;
};

export default function MotorcycleDetailsModal({ motorcycle, onBack, onViewOwner, onViewRider, onTrack }: MotorcycleDetailsProps) {
  const [owner, setOwner] = useState<Owner | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTracking, setShowTracking] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [unresolvedIncidents, setUnresolvedIncidents] = useState(0);

  useEffect(() => {
    loadMotorcycleDetails();
  }, [motorcycle.id]);

  const loadMotorcycleDetails = async () => {
    setLoading(true);
    try {
      const { data: ownerData } = await supabase
        .from('owners')
        .select('*')
        .eq('id', motorcycle.owner_id)
        .maybeSingle();

      const { data: riderData } = await supabase
        .from('riders')
        .select('*')
        .eq('motorcycle_id', motorcycle.id)
        .eq('assignment_status', 'Assigned')
        .maybeSingle();

      const { data: verificationData } = await supabase
        .from('verifications')
        .select('*')
        .eq('owner_id', motorcycle.owner_id)
        .maybeSingle();

      const { data: incidentsData } = await supabase
        .from('incidents')
        .select('status')
        .eq('motorcycle_id', motorcycle.id);

      setOwner(ownerData);
      setRider(riderData);
      setVerification(verificationData);
      setUnresolvedIncidents(
        (incidentsData || []).filter((i: { status: string }) => isIncidentUnresolved(i.status)).length
      );
    } catch (error) {
      console.error('Error loading motorcycle details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!confirm('Are you sure you want to verify this motorcycle? This action confirms all documents are valid.')) return;
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('motorcycles')
        .update({ status: 'verified', verified_at: new Date().toISOString() })
        .eq('id', motorcycle.id);
      if (error) throw error;
      alert('Motorcycle verified successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error verifying motorcycle:', error);
      alert('Failed to verify motorcycle');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const DocCheck = ({ label, hasDoc }: { label: string; hasDoc: boolean }) => (
    <div className="flex items-center gap-2">
      {hasDoc ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
      <span className={`text-sm ${hasDoc ? 'text-slate-900' : 'text-red-700'}`}>{label}</span>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm">
          <button onClick={onBack} className="text-emerald-600 hover:text-emerald-700 font-medium">
            Motorcycles
          </button>
          <ChevronRight className="h-4 w-4 text-slate-400 mx-2" />
          <span className="text-slate-700 font-medium">{motorcycle.registration_number}</span>
        </nav>

        {/* Header — with number plate */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <NumberPlate registration={motorcycle.registration_number} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Registered Motorcycle</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <h2 className="text-xl font-bold text-slate-900">
                  {motorcycle.make && motorcycle.model ? `${motorcycle.make} ${motorcycle.model}` : 'Motorcycle'}
                </h2>
                {unresolvedIncidents > 0 && (
                  <span
                    title={`${unresolvedIncidents} unresolved incident${unresolvedIncidents > 1 ? 's' : ''}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold border border-red-200"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {unresolvedIncidents} unresolved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Registered {new Date(motorcycle.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <button
            onClick={() => onTrack ? onTrack(motorcycle) : setShowTracking(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm"
          >
            <MapPin className="h-4 w-4" /> Track
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-600" />
            <span className="ml-3 text-sm text-slate-600">Loading details...</span>
          </div>
        ) : (
          <>
            {/* Status & Compliance */}
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-600" />
                Status & Compliance
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Verification</label>
                  <div className="mt-1">
                    {motorcycle.status === 'verified' ? (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-sm font-semibold">
                        <CheckCircle className="h-4 w-4" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-sm font-semibold">
                        <Clock className="h-4 w-4" /> Pending
                      </span>
                    )}
                  </div>
                  {motorcycle.status === 'verified' && motorcycle.verified_at && (
                    <p className="text-xs text-slate-500 mt-1">Verified {new Date(motorcycle.verified_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Compliance</label>
                  <div className="mt-1">
                    {motorcycle.is_compliant ? (
                      <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-semibold">
                        <CheckCircle className="h-4 w-4" /> Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-800 px-3 py-1 rounded-lg text-sm font-semibold">
                        <XCircle className="h-4 w-4" /> Incomplete
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Documents Checklist */}
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-3">Required Documents</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <DocCheck label="Motorcycle Photo" hasDoc={!!motorcycle.bike_photo_url} />
                  <DocCheck label="Logbook" hasDoc={!!motorcycle.logbook_url} />
                  <DocCheck label="KRA PIN Certificate" hasDoc={!!motorcycle.kra_pin_url} />
                  <DocCheck label="Insurance Cover" hasDoc={!!motorcycle.insurance_cover_url} />
                  <DocCheck label="Insurance Policy Number" hasDoc={!!motorcycle.insurance_policy_number} />
                  <DocCheck label="NTSA Inspection Certificate" hasDoc={!!motorcycle.inspection_certificate_url} />
                  <DocCheck label="Serial Number" hasDoc={!!motorcycle.tracking_device_id} />
                </div>
              </div>

              {motorcycle.status === 'pending' && motorcycle.is_compliant && (
                <button
                  onClick={handleVerify}
                  disabled={isUpdatingStatus}
                  className="mt-4 w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="h-5 w-5" />
                  {isUpdatingStatus ? 'Verifying...' : 'Mark as Verified'}
                </button>
              )}
              {motorcycle.status === 'pending' && !motorcycle.is_compliant && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">Cannot verify until all required documents are uploaded.</p>
                </div>
              )}
            </div>

            {/* Motorcycle Info */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Bike className="h-5 w-5 text-emerald-600" />
                Motorcycle Information
              </h3>

              {motorcycle.bike_photo_url && (
                <div className="mb-5">
                  <img src={motorcycle.bike_photo_url} alt="Motorcycle" className="w-full max-w-md h-56 object-cover rounded-lg border border-slate-200" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registration</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">{motorcycle.registration_number}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Make & Model</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">
                    {motorcycle.make && motorcycle.model ? `${motorcycle.make} ${motorcycle.model}` : <span className="text-slate-400">Not specified</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Serial Number</label>
                  <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">
                    {motorcycle.tracking_device_id || <span className="text-slate-400 font-sans">Not assigned</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Insurance Provider</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">
                    {motorcycle.insurance_provider || <span className="text-slate-400">N/A</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Policy Number</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">
                    {motorcycle.insurance_policy_number || <span className="text-slate-400">N/A</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Insurance Expiry</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    {motorcycle.insurance_expiry ? new Date(motorcycle.insurance_expiry).toLocaleDateString() : <span className="text-slate-400">N/A</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Inspection Certificate No.</label>
                  <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">
                    {motorcycle.inspection_certificate_number || <span className="text-slate-400 font-sans">N/A</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Inspection Expiry</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600" />
                    {motorcycle.inspection_expiry ? new Date(motorcycle.inspection_expiry).toLocaleDateString() : <span className="text-slate-400">N/A</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Registration Date</label>
                  <p className="text-base font-semibold text-slate-900 mt-0.5">{new Date(motorcycle.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Uploaded Documents
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DocumentLink
                  label="Motorcycle Photo (Side)"
                  url={motorcycle.bike_photo_url}
                  icon={<ImageIcon className="h-4 w-4" />}
                  isImage
                  revalidate={motorcycle.bike_photo_url ? {
                    userType: 'owner', userId: motorcycle.owner_id, documentType: 'bike_photo_side' as DocumentType,
                    fileUrl: motorcycle.bike_photo_url, fileName: 'bike_photo_side',
                    expectedName: owner?.full_name, expectedIdNumber: owner?.national_id,
                  } : undefined}
                />
                <DocumentLink
                  label="Logbook"
                  url={motorcycle.logbook_url}
                  icon={<FileText className="h-4 w-4" />}
                  revalidate={motorcycle.logbook_url ? {
                    userType: 'owner', userId: motorcycle.owner_id, documentType: 'logbook' as DocumentType,
                    fileUrl: motorcycle.logbook_url, fileName: 'logbook',
                    expectedName: owner?.full_name, expectedIdNumber: owner?.national_id,
                  } : undefined}
                />
                <DocumentLink
                  label="KRA PIN Certificate"
                  url={motorcycle.kra_pin_url}
                  icon={<FileText className="h-4 w-4" />}
                  revalidate={motorcycle.kra_pin_url ? {
                    userType: 'owner', userId: motorcycle.owner_id, documentType: 'kra_pin_doc' as DocumentType,
                    fileUrl: motorcycle.kra_pin_url, fileName: 'kra_pin_doc',
                    expectedName: owner?.full_name, expectedIdNumber: owner?.national_id,
                  } : undefined}
                />
                <DocumentLink
                  label="Insurance Cover"
                  url={motorcycle.insurance_cover_url}
                  icon={<FileText className="h-4 w-4" />}
                  revalidate={motorcycle.insurance_cover_url ? {
                    userType: 'owner', userId: motorcycle.owner_id, documentType: 'insurance_cover' as DocumentType,
                    fileUrl: motorcycle.insurance_cover_url, fileName: 'insurance_cover',
                    knownExpiryDate: motorcycle.insurance_expiry ?? null,
                  } : undefined}
                />
                <DocumentLink
                  label="NTSA Inspection Certificate"
                  url={motorcycle.inspection_certificate_url}
                  icon={<FileText className="h-4 w-4" />}
                />
              </div>
            </div>

            {/* Owner */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600" /> Owner
                </h3>
                {owner && onViewOwner && (
                  <button onClick={() => onViewOwner(owner)} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                    <Eye className="h-4 w-4" /> View Details
                  </button>
                )}
              </div>
              {owner ? (
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
              ) : (
                <p className="text-sm text-slate-500">Owner information not available</p>
              )}
            </div>

            {/* Rider */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-emerald-600" /> Assigned Rider
                </h3>
                {rider && onViewRider && (
                  <button onClick={() => onViewRider(rider)} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                    <Eye className="h-4 w-4" /> View Details
                  </button>
                )}
              </div>
              {rider ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name</label>
                    <p className="text-base font-semibold text-slate-900 mt-0.5">{rider.name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">ID Number</label>
                    <p className="text-base font-semibold text-slate-900 font-mono mt-0.5">{rider.id_number}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phone</label>
                    <p className="text-base font-semibold text-slate-900 mt-0.5">{rider.phone_number}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No rider assigned to this motorcycle</p>
              )}
            </div>

            {/* Incidents */}
            <MotorcycleIncidentsSection motorcycleId={motorcycle.id} />
          </>
        )}
      </div>

      {showTracking && (
        <TrackingModal motorcycle={motorcycle} onClose={() => setShowTracking(false)} />
      )}
    </>
  );
}

function NumberPlate({ registration }: { registration: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cleaned = (registration || '').toUpperCase().replace(/\s+/g, '');
  const splitIdx = cleaned.search(/\d/);
  const topRow = splitIdx > 0 ? cleaned.slice(0, splitIdx) : cleaned.slice(0, 4) || 'KMCY';
  const bottomRow = splitIdx > 0 ? cleaned.slice(splitIdx) : cleaned.slice(4) || '966Q';

  useEffect(() => {
    import('qrcode').then((QRCode) => {
      QRCode.default.toDataURL(cleaned, { width: 80, margin: 1, color: { dark: '#000', light: '#fff' } })
        .then(setQrDataUrl)
        .catch(() => {});
    });
  }, [cleaned]);

  const plateFont = '"Share Tech Mono", "Courier New", monospace';

  const rowStyle: React.CSSProperties = {
    fontFamily: plateFont,
    fontWeight: 400,
    fontSize: '2.4rem',
    color: '#0a0a0a',
    letterSpacing: '0.08em',
    display: 'block',
    lineHeight: 1.05,
    textShadow: '0 2px 0 rgba(0,0,0,0.18)',
    textAlign: 'center',
    WebkitTextStroke: '1.5px #0a0a0a',
  };

  return (
    <div className="shrink-0 select-none" aria-label={`Number plate: ${registration}`}>
      {/* Outer plastic frame */}
      <div
        style={{
          background: 'linear-gradient(160deg, #303030, #141414)',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.07)',
          display: 'inline-block',
        }}
      >
        {/* Amber plate surface */}
        <div
          style={{
            background: 'linear-gradient(170deg, #f8a81e 0%, #ed9a14 55%, #d98a10 100%)',
            borderRadius: '6px',
            width: '175px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 10px 6px',
            gap: '2px',
            boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.12)',
          }}
        >
          {/* Top row: flag + QR code */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '2px' }}>
            {/* Kenya flag — mini */}
            <div
              style={{
                display: 'flex', flexDirection: 'column', width: '20px',
                borderRadius: '2px', overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                flexShrink: 0,
              }}
            >
              <div style={{ height: '4px', background: '#000' }} />
              <div style={{ height: '1.5px', background: '#fff' }} />
              <div style={{ height: '4px', background: '#bb1600' }} />
              <div style={{ height: '1.5px', background: '#fff' }} />
              <div style={{ height: '4px', background: '#006b3f' }} />
            </div>
            {/* QR code — top right */}
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR ${cleaned}`}
                style={{
                  width: '15px', height: '15px', display: 'block',
                  borderRadius: '1px',
                }}
              />
            ) : (
              <div style={{ width: '15px', height: '15px', background: 'rgba(0,0,0,0.08)', borderRadius: '1px' }} />
            )}
          </div>

          {/* Row 1 — letters */}
          <span style={rowStyle}>{topRow}</span>
          {/* Row 2 — digits + suffix */}
          <span style={rowStyle}>{bottomRow}</span>

          {/* NTSA — bottom center */}
          <span
            style={{
              fontSize: '7px', fontWeight: 700, letterSpacing: '0.25em',
              color: '#000', opacity: 0.4, fontFamily: 'Arial, sans-serif',
              marginTop: '3px', lineHeight: 1,
            }}
          >
            NTSA
          </span>
        </div>
      </div>

    </div>
  );
}

function DocumentLink({
  label,
  url,
  icon,
  isImage,
  revalidate,
}: {
  label: string;
  url: string | null;
  icon: React.ReactNode;
  isImage?: boolean;
  revalidate?: React.ComponentProps<typeof DocumentRevalidateButton>;
}) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 p-3 border border-dashed border-slate-200 rounded-lg bg-slate-50">
        <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="text-xs text-slate-400">Not uploaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 border border-slate-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50/40 transition group">
      <div className="flex items-center gap-3">
        {isImage ? (
          <img
            src={url}
            alt={label}
            className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
          <p className="text-xs text-emerald-700">Available</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-white rounded-md transition"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href={url}
            download
            title="Download"
            className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-white rounded-md transition"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>
      {revalidate && (
        <DocumentRevalidateButton {...revalidate} />
      )}
    </div>
  );
}
