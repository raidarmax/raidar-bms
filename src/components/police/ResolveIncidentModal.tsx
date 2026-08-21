import { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import { supabase, type Incident, type PoliceOfficerWithStation, type TrafficOffence, type Rider, type Owner, type Motorcycle } from '../../lib/supabase';
import { PoliceAuthService } from '../../lib/policeAuth';
import { logIncidentResolution, RESOLUTION_OUTCOMES } from '../../lib/incidentResolutions';

type Props = {
  incident: Incident;
  officer: PoliceOfficerWithStation;
  onClose: () => void;
  onResolved: () => void;
};

export default function ResolveIncidentModal({ incident, officer, onClose, onResolved }: Props) {
  const [outcome, setOutcome] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fine-related state (only used when outcome === 'fined')
  const [offences, setOffences] = useState<TrafficOffence[]>([]);
  const [selectedOffence, setSelectedOffence] = useState<TrafficOffence | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [motorcycle, setMotorcycle] = useState<Motorcycle | null>(null);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderNationalId, setRiderNationalId] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [locationDesc, setLocationDesc] = useState(incident.location || '');
  const [fineNotes, setFineNotes] = useState('');

  useEffect(() => {
    loadRelatedParties();
    loadOffences();
  }, [incident.id]);

  const loadRelatedParties = async () => {
    if (incident.rider_id) {
      const { data } = await supabase.from('riders').select('*').eq('id', incident.rider_id).maybeSingle();
      if (data) {
        setRider(data);
        setRiderName(data.name);
        setRiderPhone(data.phone_number || '');
        setRiderNationalId(data.id_number || '');
      }
    }
    if (incident.motorcycle_id) {
      const { data: m } = await supabase
        .from('motorcycles')
        .select('*, owner:owners(*)')
        .eq('id', incident.motorcycle_id)
        .maybeSingle();
      if (m) {
        setMotorcycle(m as any);
        const o = (m as any).owner;
        if (o) {
          setOwner(o);
          setOwnerPhone(o.phone_number || '');
          if (!incident.rider_id) {
            setRiderName(o.full_name || '');
            setRiderPhone(o.phone_number || '');
            setRiderNationalId(o.national_id || '');
          }
        }
      }
    }
  };

  const loadOffences = async () => {
    const { data } = await supabase
      .from('traffic_offences')
      .select('*')
      .eq('is_active', true)
      .order('offence_code');
    setOffences(data || []);
  };

  const filteredOffences = offences.filter((o) => {
    if (!o.applicable_incident_types || o.applicable_incident_types.length === 0) return true;
    return o.applicable_incident_types.includes(incident.incident_type);
  });
  const preferredOffences = filteredOffences.length > 0 ? filteredOffences : offences;

  const issueFineFromIncident = async () => {
    if (!selectedOffence) throw new Error('Please select an offence');
    if (!riderName.trim() || !riderPhone.trim()) throw new Error('Rider name and phone are required');

    const year = new Date().getFullYear();
    const { count } = await supabase.from('fines').select('id', { count: 'exact', head: true });
    const fineRef = `FN-${year}-${String((count || 0) + 1).padStart(5, '0')}`;

    const { data: insertedFine, error: insertError } = await supabase.from('fines').insert({
      fine_reference: fineRef,
      offence_id: selectedOffence.id,
      issued_by_officer_id: officer.id,
      station_id: officer.station_id,
      rider_id: rider?.id || null,
      owner_id: owner?.id || null,
      motorcycle_id: motorcycle?.id || null,
      rider_name: riderName,
      rider_phone: riderPhone,
      rider_national_id: riderNationalId || null,
      owner_phone: ownerPhone || null,
      fine_amount: selectedOffence.fine_amount,
      location_description: locationDesc || null,
      county_id: incident.county_id,
      constituency_id: incident.constituency_id,
      ward_id: incident.ward_id,
      notes: fineNotes || `Issued from incident ${incident.id.slice(0, 8)}`,
      incident_id: incident.id,
      origin: 'from_incident',
    }).select().maybeSingle();

    if (insertError) throw insertError;

    if (rider?.id && insertedFine) {
      await supabase.from('rider_notifications').insert({
        rider_id: rider.id,
        type: 'fine_issued',
        title: 'Traffic Fine Issued From Incident',
        message: `You have been issued fine ${fineRef} of KES ${selectedOffence.fine_amount.toLocaleString()} for "${selectedOffence.offence_name}" arising from a reported incident. Please pay within 14 days.`,
        metadata: {
          fine_id: insertedFine.id,
          fine_reference: fineRef,
          fine_amount: selectedOffence.fine_amount,
          offence_name: selectedOffence.offence_name,
          station_name: officer.station.station_name,
          incident_id: incident.id,
        },
      });
    }

    try {
      await supabase.functions.invoke('send-fine-sms', {
        body: {
          fine_reference: fineRef,
          rider_phone: riderPhone,
          owner_phone: ownerPhone || null,
          rider_name: riderName,
          offence_name: selectedOffence.offence_name,
          fine_amount: selectedOffence.fine_amount,
          station_name: officer.station.station_name,
          officer_service_number: officer.service_number,
        },
      });
    } catch (smsErr) {
      console.error('SMS send failed:', smsErr);
    }

    await PoliceAuthService.logActivity(officer.id, 'issue_fine', 'fine', insertedFine?.id ?? null, {
      fine_reference: fineRef,
      offence: selectedOffence.offence_name,
      amount: selectedOffence.fine_amount,
      from_incident: incident.id,
    });

    return { fineRef, fineId: insertedFine?.id ?? null };
  };

  const handleResolve = async () => {
    setError('');
    if (!outcome) { setError('Please select an outcome'); return; }
    if (outcome !== 'fined' && !summary.trim()) { setError('Please provide a resolution summary'); return; }

    setSubmitting(true);
    try {
      let fineInfo: { fineRef: string; fineId: string | null } | null = null;
      if (outcome === 'fined') {
        fineInfo = await issueFineFromIncident();
      }

      const nowIso = new Date().toISOString();
      const finalSummary = outcome === 'fined'
        ? (summary.trim() || `Fine ${fineInfo?.fineRef} issued for ${selectedOffence?.offence_name}.`)
        : summary.trim();

      const { error: updErr } = await supabase.from('incidents').update({
        status: 'resolved',
        police_status: 'resolved',
        resolution_outcome: outcome,
        resolution_summary: finalSummary,
        resolved_by_officer_id: officer.id,
        resolved_at: nowIso,
        updated_at: nowIso,
      }).eq('id', incident.id);
      if (updErr) throw updErr;

      if (fineInfo) {
        await logIncidentResolution({
          incidentId: incident.id,
          actionType: 'fine_issued',
          actorType: 'officer',
          actorId: officer.id,
          actorName: officer.full_name,
          notes: `Fine ${fineInfo.fineRef} issued (${selectedOffence?.offence_name}, KES ${selectedOffence?.fine_amount.toLocaleString()}).`,
          metadata: {
            fine_id: fineInfo.fineId,
            fine_reference: fineInfo.fineRef,
            offence_id: selectedOffence?.id,
            offence_name: selectedOffence?.offence_name,
            amount: selectedOffence?.fine_amount,
          },
        });
      }

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'resolved',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        fromStatus: incident.police_status,
        toStatus: 'resolved',
        notes: finalSummary,
        metadata: { outcome },
      });

      await PoliceAuthService.logActivity(officer.id, 'update_incident', 'incident', incident.id, {
        action: 'resolved',
        outcome,
      });

      onResolved();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-gray-900">Resolve Case</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 text-slate-500 flex-shrink-0" />
            <span>
              <span className="font-semibold text-slate-800 capitalize">{incident.incident_type.replace(/_/g, ' ')}</span> reported by {incident.reporter_name}.
              The outcome you pick here is what the rider will see — pick carefully.
            </span>
          </div>

          {/* Outcome radios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Outcome *</label>
            <div className="grid gap-2">
              {RESOLUTION_OUTCOMES.map((o) => (
                <label
                  key={o.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    outcome === o.value
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={o.value}
                    checked={outcome === o.value}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      {o.value === 'fined' && <DollarSign className="w-3.5 h-3.5 text-emerald-600" />}
                      {o.label}
                    </p>
                    <p className="text-xs text-gray-500 leading-snug">{o.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Fine sub-form */}
          {outcome === 'fined' && (
            <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50/40 space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-emerald-900">Issue Fine From This Incident</h4>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offence *</label>
                <select
                  value={selectedOffence?.id || ''}
                  onChange={(e) => setSelectedOffence(preferredOffences.find(o => o.id === e.target.value) || offences.find(o => o.id === e.target.value) || null)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select offence</option>
                  {filteredOffences.length > 0 && (
                    <optgroup label={`Recommended for "${incident.incident_type.replace(/_/g, ' ')}"`}>
                      {filteredOffences.map((o) => (
                        <option key={o.id} value={o.id}>{o.offence_name} - KES {o.fine_amount.toLocaleString()}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="All offences">
                    {offences.filter(o => !filteredOffences.some(f => f.id === o.id)).map((o) => (
                      <option key={o.id} value={o.id}>{o.offence_name} - KES {o.fine_amount.toLocaleString()}</option>
                    ))}
                  </optgroup>
                </select>
                {selectedOffence && (
                  <p className="text-sm text-emerald-700 font-semibold mt-1">Fine Amount: KES {selectedOffence.fine_amount.toLocaleString()}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rider Name *</label>
                  <input value={riderName} onChange={(e) => setRiderName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Rider Phone *</label>
                  <input value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} placeholder="+254..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">National ID</label>
                  <input value={riderNationalId} onChange={(e) => setRiderNationalId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Owner Phone</label>
                  <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="If different" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Location Description</label>
                <input value={locationDesc} onChange={(e) => setLocationDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fine Notes</label>
                <textarea value={fineNotes} onChange={(e) => setFineNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Optional context for the fine..." />
              </div>
            </div>
          )}

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Resolution Summary {outcome !== 'fined' && '*'}
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder={outcome === 'fined' ? 'Optional — will default to fine details' : 'Explain what happened and how it was resolved. Visible to the rider.'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleResolve}
              disabled={submitting || !outcome}
              className="flex-1 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? 'Resolving...' : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {outcome === 'fined' ? 'Issue Fine & Resolve' : 'Mark Resolved'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
