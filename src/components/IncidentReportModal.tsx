import { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendOtp, verifyOtp } from '../lib/otp';
import LocalitySelector from './LocalitySelector';

type IncidentReportModalProps = {
  motorcycleId?: string;
  riderId?: string;
  ownerId?: string;
  motorcycleReg?: string;
  riderName?: string;
  isUnregistered?: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const INCIDENT_TYPES = [
  { value: 'accident', label: 'Accident' },
  { value: 'crime', label: 'Crime' },
  { value: 'traffic_violation', label: 'Traffic Violation' },
  { value: 'theft', label: 'Theft' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'speeding', label: 'Speeding' },
  { value: 'reckless_driving', label: 'Reckless Driving' },
  { value: 'no_helmet', label: 'No Helmet' },
  { value: 'overloading', label: 'Overloading' },
  { value: 'other', label: 'Other' },
];

const getEATDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getMaxEATDateTime = () => {
  return getEATDateTime();
};

export default function IncidentReportModal({
  motorcycleId,
  riderId,
  ownerId,
  motorcycleReg,
  riderName,
  isUnregistered = false,
  onClose,
  onSuccess,
}: IncidentReportModalProps) {
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [incidentDate, setIncidentDate] = useState(getEATDateTime());
  const [locality, setLocality] = useState<{ countyId: number | null; constituencyId: number | null; wardId: number | null }>({
    countyId: null, constituencyId: null, wardId: null,
  });
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [unregisteredDetails, setUnregisteredDetails] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEvidenceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendOtp = async () => {
    if (!reporterName.trim()) {
      setError('Please provide your name');
      return;
    }

    if (!reporterPhone.trim()) {
      setError('Please provide your phone number');
      return;
    }

    setSendingOtp(true);
    setError('');

    try {
      const result = await sendOtp(reporterPhone);
      if (!result.success) {
        setError(result.error ?? 'Failed to send OTP. Please check your phone number and try again.');
        return;
      }

      setShowOtpVerification(true);
      setResendCooldown(60);
    } catch (err) {
      console.error('Error sending OTP:', err);
      setError('Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError('Please enter the OTP');
      return;
    }

    setVerifyingOtp(true);
    setError('');

    try {
      const valid = await verifyOtp(reporterPhone, otp);
      if (valid) {
        setOtpVerified(true);
        setShowOtpVerification(false);
      } else {
        setError('Invalid or expired OTP. Please try again or request a new code.');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError('Failed to verify OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!incidentType) {
      setError('Please select an incident type');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a description');
      return;
    }

    if (isUnregistered && !unregisteredDetails.trim()) {
      setError('Please provide details about the unregistered motorcycle');
      return;
    }

    if (!reporterName.trim()) {
      setError('Please provide your name');
      return;
    }

    if (!reporterPhone.trim()) {
      setError('Please provide your phone number');
      return;
    }

    if (!otpVerified) {
      setError('Please verify your phone number with OTP first');
      return;
    }

    const selectedDate = new Date(incidentDate);
    const now = new Date();
    if (selectedDate > now) {
      setError('Incident date cannot be in the future');
      return;
    }

    setSubmitting(true);

    try {
      let locationString = '';
      if (locality.countyId) {
        const { data: county } = await supabase.from('kenya_counties').select('name').eq('id', locality.countyId).maybeSingle();
        if (county) locationString = county.name;
      }
      if (locality.constituencyId) {
        const { data: constituency } = await supabase.from('kenya_constituencies').select('name').eq('id', locality.constituencyId).maybeSingle();
        if (constituency) locationString += `, ${constituency.name}`;
      }
      if (locality.wardId) {
        const { data: ward } = await supabase.from('kenya_wards').select('name').eq('id', locality.wardId).maybeSingle();
        if (ward) locationString += `, ${ward.name}`;
      }
      if (locationDetail.trim()) {
        locationString += locationString ? ` - ${locationDetail.trim()}` : locationDetail.trim();
      }

      const { data: incident, error: insertError } = await supabase
        .from('incidents')
        .insert({
          motorcycle_id: isUnregistered ? null : motorcycleId,
          rider_id: isUnregistered ? null : riderId,
          owner_id: isUnregistered ? null : ownerId,
          incident_type: incidentType,
          description: description.trim(),
          incident_date: new Date(incidentDate).toISOString(),
          location: locationString || null,
          status: 'pending',
          reporter_name: reporterName.trim(),
          reporter_phone: reporterPhone.trim(),
          reporter_email: reporterEmail.trim() || null,
          unregistered_bike_details: isUnregistered ? unregisteredDetails.trim() : null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw insertError;
      }

      if (evidenceFiles.length > 0) {
        for (const file of evidenceFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${incident.id}_${Date.now()}.${fileExt}`;
          const filePath = `incidents/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

          await supabase.from('incident_evidence').insert({
            incident_id: incident.id,
            evidence_url: urlData.publicUrl,
            evidence_type: 'photo',
            uploaded_by: 'reporter',
          });
        }
      }

      if (!isUnregistered) {
        const notifications = [];

        if (riderId) {
          notifications.push({
            incident_id: incident.id,
            user_type: 'rider',
            user_id: riderId,
            is_read: false,
          });
        }

        if (ownerId) {
          notifications.push({
            incident_id: incident.id,
            user_type: 'owner',
            user_id: ownerId,
            is_read: false,
          });
        }

        if (notifications.length > 0) {
          await supabase.from('incident_notifications').insert(notifications);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting incident:', err);
      const errorMessage = err?.message || err?.error_description || 'Failed to submit incident. Please try again.';
      setError(errorMessage);
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-4">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Report Submitted</h3>
            <p className="text-slate-600">
              Thank you for reporting. The incident will be reviewed by administrators.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-2xl font-bold text-slate-900">Report Incident</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" disabled={submitting}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {!isUnregistered && motorcycleReg && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900">Reporting for:</p>
              <p className="text-blue-800">
                <span className="font-bold">{motorcycleReg}</span>
                {riderName && <span> | Rider: <span className="font-bold">{riderName}</span></span>}
              </p>
            </div>
          )}

          {isUnregistered && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-900 flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                Unregistered Motorcycle
              </p>
              <p className="text-amber-800 text-sm">
                Please provide as much detail as possible about the motorcycle.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Incident Type *
            </label>
            <select
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Select type</option>
              {INCIDENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {isUnregistered && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Motorcycle Details *
              </label>
              <textarea
                value={unregisteredDetails}
                onChange={(e) => setUnregisteredDetails(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="Color, make, model, any visible markings..."
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              What Happened? *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              rows={5}
              placeholder="Describe the incident in detail..."
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                max={getMaxEATDateTime()}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                required
              />
              <p className="text-xs text-slate-500 mt-1">Cannot be in the future</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Specific Location Detail
              </label>
              <input
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Road name, landmark, etc."
              />
            </div>
          </div>

          <LocalitySelector
            countyId={locality.countyId}
            constituencyId={locality.constituencyId}
            wardId={locality.wardId}
            onChange={setLocality}
            label="Incident Location"
            compact
          />

          <div className="border-t pt-6">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">Evidence (Optional)</h4>
            <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-500 cursor-pointer bg-slate-50">
              <div className="text-center">
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-semibold">Upload Photos</p>
                <p className="text-xs text-slate-500">JPG, PNG up to 10MB</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                disabled={submitting}
              />
            </label>

            {evidenceFiles.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {evidenceFiles.map((file, i) => (
                  <div key={i} className="relative group border border-slate-200 rounded-lg p-2 bg-slate-50">
                    <p className="text-sm text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100"
                      disabled={submitting}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-slate-900">Your Contact Information *</h4>
              {otpVerified && (
                <span className="flex items-center space-x-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-semibold">
                  <CheckCircle className="h-4 w-4" />
                  <span>Verified</span>
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => {
                    setReporterName(e.target.value);
                    setOtpVerified(false);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="Your full name"
                  required
                  disabled={otpVerified}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone *
                </label>
                <input
                  type="tel"
                  value={reporterPhone}
                  onChange={(e) => {
                    setReporterPhone(e.target.value);
                    setOtpVerified(false);
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="07XX XXX XXX"
                  required
                  disabled={otpVerified}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            {!otpVerified && (
              <button
                type="button"
                onClick={handleSendOtp}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center space-x-2"
                disabled={sendingOtp || !reporterName.trim() || !reporterPhone.trim()}
              >
                {sendingOtp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Sending OTP...</span>
                  </>
                ) : (
                  <>
                    <Phone className="h-5 w-5" />
                    <span>Verify Phone Number</span>
                  </>
                )}
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-800">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-slate-300"
              disabled={submitting || !otpVerified}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>

      {showOtpVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold">Verify Phone Number</h3>
              <button
                onClick={() => {
                  setShowOtpVerification(false);
                  setOtp('');
                  setError('');
                }}
                className="text-white hover:bg-blue-700 p-1 rounded-lg transition"
                disabled={verifyingOtp}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  An OTP has been sent to <strong>{reporterPhone}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Enter OTP *
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  disabled={verifyingOtp}
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center text-red-800 text-sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpVerification(false);
                    setOtp('');
                    setError('');
                  }}
                  className="flex-1 px-4 py-3 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300"
                  disabled={verifyingOtp}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-slate-300"
                  disabled={verifyingOtp || otp.length !== 6}
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSendOtp}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50"
                disabled={sendingOtp || verifyingOtp || resendCooldown > 0}
              >
                {sendingOtp ? 'Resending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
