import { useState } from 'react';
import { X, Send, AlertTriangle, CheckCircle, Loader2, Calendar, Clock, FileText, Users, Plus, Trash2, Link2 } from 'lucide-react';
import { supabase, type Incident, type PoliceOfficerWithStation, type Rider, type Owner, type IncidentPersonOfInterest } from '../../lib/supabase';
import { logIncidentResolution } from '../../lib/incidentResolutions';

type Recipient = {
  key: string;
  personType: 'rider' | 'owner' | 'reporter' | 'other';
  personId: string | null;
  name: string;
  phone: string;
  idNumber: string;
  sourceLabel: string;
  selected: boolean;
  removable: boolean;
};

type Props = {
  incident: Incident;
  officer: PoliceOfficerWithStation;
  rider?: Rider | null;
  owner?: Owner | null;
  personsOfInterest?: IncidentPersonOfInterest[];
  onClose: () => void;
  onIssued: () => void;
};

const REASON_PRESETS = [
  'Provide statement about the incident',
  'Answer questions regarding the case',
  'Present required documents (license, logbook, insurance)',
  'Attend disciplinary hearing',
  'Collect impounded motorcycle / property',
  'Confirm identity and address',
];

export default function SummonModal({ incident, officer, rider, owner, personsOfInterest, onClose, onIssued }: Props) {
  const buildInitialRecipients = (): Recipient[] => {
    const list: Recipient[] = [];
    if (rider) {
      list.push({
        key: `rider-${rider.id}`,
        personType: 'rider',
        personId: rider.id,
        name: rider.name,
        phone: rider.phone_number || '',
        idNumber: rider.id_number || '',
        sourceLabel: 'Rider on file',
        selected: true,
        removable: false,
      });
    }
    if (owner) {
      list.push({
        key: `owner-${owner.id}`,
        personType: 'owner',
        personId: owner.id,
        name: owner.full_name,
        phone: owner.phone_number,
        idNumber: owner.national_id || '',
        sourceLabel: 'Owner on file',
        selected: false,
        removable: false,
      });
    }
    list.push({
      key: 'reporter',
      personType: 'reporter',
      personId: null,
      name: incident.reporter_name,
      phone: incident.reporter_phone,
      idNumber: '',
      sourceLabel: 'Reporter',
      selected: false,
      removable: false,
    });
    for (const poi of personsOfInterest || []) {
      list.push({
        key: `poi-${poi.id}`,
        personType: 'other',
        personId: poi.linked_rider_id || poi.linked_owner_id || null,
        name: poi.full_name,
        phone: poi.phone_number || '',
        idNumber: poi.id_number || '',
        sourceLabel: poi.relationship
          ? `Person of interest · ${poi.relationship.replace(/_/g, ' ')}`
          : 'Person of interest',
        selected: false,
        removable: false,
      });
    }
    return list;
  };

  const [recipients, setRecipients] = useState<Recipient[]>(buildInitialRecipients());
  const today = new Date();
  const defaultDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [summonDate, setSummonDate] = useState(defaultDate);
  const [summonTime, setSummonTime] = useState('10:00');
  const [reason, setReason] = useState(REASON_PRESETS[0]);
  const [notes, setNotes] = useState('');
  const [sendSms, setSendSms] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleRecipient = (key: string) => {
    setRecipients((rs) => rs.map((r) => (r.key === key ? { ...r, selected: !r.selected } : r)));
  };

  const updateRecipient = (key: string, patch: Partial<Recipient>) => {
    setRecipients((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRecipient = (key: string) => {
    setRecipients((rs) => rs.filter((r) => r.key !== key));
  };

  const addCustomRecipient = () => {
    const key = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setRecipients((rs) => [
      ...rs,
      {
        key,
        personType: 'other',
        personId: null,
        name: '',
        phone: '',
        idNumber: '',
        sourceLabel: 'Custom',
        selected: true,
        removable: true,
      },
    ]);
  };

  const selectedRecipients = recipients.filter((r) => r.selected);

  const handleSubmit = async () => {
    setError('');
    if (selectedRecipients.length === 0) return setError('Select at least one recipient.');
    for (const r of selectedRecipients) {
      if (!r.name.trim()) return setError(`Name is required for ${r.sourceLabel}.`);
      if (!r.phone.trim()) return setError(`Phone number is required for ${r.name || r.sourceLabel}.`);
    }
    if (!summonDate) return setError('Summon date is required.');
    if (!reason.trim()) return setError('Reason is required.');

    setSubmitting(true);
    try {
      const summaries: string[] = [];
      let smsDelivered = 0;
      let smsFailed = 0;

      for (const r of selectedRecipients) {
        const { data: inserted, error: insErr } = await supabase
          .from('incident_summons')
          .insert({
            incident_id: incident.id,
            issued_by_officer_id: officer.id,
            station_id: officer.station_id,
            person_type: r.personType,
            person_id: r.personId,
            person_name: r.name.trim(),
            person_phone: r.phone.trim(),
            person_id_number: r.idNumber.trim() || null,
            summon_date: summonDate,
            summon_time: summonTime || null,
            reason: reason.trim(),
            notes: notes.trim() || null,
            status: 'pending',
          })
          .select()
          .single();

        if (insErr) throw insErr;

        let smsOk = false;
        let smsError = '';
        if (sendSms) {
          try {
            const { data: smsData, error: smsErr } = await supabase.functions.invoke('send-summons-sms', {
              body: {
                summons_id: inserted.id,
                person_phone: r.phone.trim(),
                person_name: r.name.trim(),
                station_name: officer.station.station_name,
                station_phone: officer.station.phone_number || null,
                summon_date: summonDate,
                summon_time: summonTime || null,
                reason: reason.trim(),
                case_number: incident.case_number || null,
              },
            });
            if (smsErr) throw smsErr;
            smsOk = !!(smsData && (smsData as any).success);
            if (!smsOk) smsError = (smsData as any)?.error || 'SMS delivery failed';
          } catch (err: any) {
            smsError = err?.message || 'SMS delivery failed';
          }
          if (smsOk) smsDelivered += 1;
          else smsFailed += 1;
        }

        summaries.push(
          `${r.name.trim()}${sendSms ? (smsOk ? ' (SMS delivered)' : ` (SMS failed: ${smsError})`) : ''}`
        );
      }

      const notesLine = `Summoned ${selectedRecipients.length} ${selectedRecipients.length === 1 ? 'person' : 'people'} to ${officer.station.station_name} on ${summonDate}${summonTime ? ' at ' + summonTime : ''}. Reason: ${reason.trim()}. Recipients: ${summaries.join('; ')}.`;

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'summons_issued',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        notes: notesLine,
        metadata: {
          recipient_count: selectedRecipients.length,
          recipients: selectedRecipients.map((r) => ({
            person_type: r.personType,
            person_name: r.name.trim(),
            person_phone: r.phone.trim(),
            person_id: r.personId,
            source: r.sourceLabel,
          })),
          summon_date: summonDate,
          summon_time: summonTime || null,
          station_id: officer.station_id,
          sms_requested: sendSms,
          sms_delivered: smsDelivered,
          sms_failed: smsFailed,
        },
      });

      onIssued();
    } catch (err: any) {
      setError(err?.message || 'Failed to issue summons.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-red-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Issue Summons</h3>
              <p className="text-xs text-slate-500">
                Summon to {officer.station.station_name}
                {incident.case_number && <span className="font-mono ml-2">({incident.case_number})</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Recipients ({selectedRecipients.length} selected)
              </label>
              <button
                type="button"
                onClick={addCustomRecipient}
                className="text-[11px] font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add custom recipient
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">Select all persons who should attend. Each will receive their own summons and SMS.</p>

            <div className="space-y-2">
              {recipients.map((r) => (
                <div
                  key={r.key}
                  className={`rounded-lg border p-3 transition ${
                    r.selected ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => toggleRecipient(r.key)}
                      className="w-4 h-4 mt-1 text-red-600 rounded border-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {r.sourceLabel}
                        </span>
                        {r.personId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                            <Link2 className="h-2.5 w-2.5" /> linked account
                          </span>
                        )}
                        {r.removable && (
                          <button
                            type="button"
                            onClick={() => removeRecipient(r.key)}
                            className="ml-auto text-slate-400 hover:text-red-600"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {r.selected ? (
                        <div className="grid sm:grid-cols-3 gap-2 mt-2">
                          <input
                            type="text"
                            value={r.name}
                            onChange={(e) => updateRecipient(r.key, { name: e.target.value })}
                            placeholder="Full name"
                            className="px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-red-500"
                          />
                          <input
                            type="tel"
                            value={r.phone}
                            onChange={(e) => updateRecipient(r.key, { phone: e.target.value })}
                            placeholder="Phone number"
                            className="px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-red-500"
                          />
                          <input
                            type="text"
                            value={r.idNumber}
                            onChange={(e) => updateRecipient(r.key, { idNumber: e.target.value })}
                            placeholder="National ID (optional)"
                            className="px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-red-500"
                          />
                        </div>
                      ) : (
                        <div className="mt-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">{r.name || 'Unnamed'}</p>
                          <p className="text-xs text-slate-500">{r.phone || 'No phone'}{r.idNumber ? ` \u00b7 ID ${r.idNumber}` : ''}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Appearance Date
              </label>
              <input
                type="date"
                value={summonDate}
                onChange={(e) => setSummonDate(e.target.value)}
                min={today.toISOString().slice(0, 10)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Appearance Time
              </label>
              <input
                type="time"
                value={summonTime}
                onChange={(e) => setSummonTime(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Reason for Summons
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {REASON_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                    reason === r ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Reason communicated to each person..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Internal notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Not shared with recipients..."
            />
          </div>

          <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-red-600 rounded border-slate-300"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Send SMS notification to each recipient</p>
              <p className="text-xs text-slate-500 leading-snug">
                Each selected recipient will receive their own SMS with the summons details.
              </p>
            </div>
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedRecipients.length === 0}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Issuing summons...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Issue {selectedRecipients.length} Summons{selectedRecipients.length === 1 ? '' : 'es'}{sendSms ? ' & Send SMS' : ''}
              </>
            )}
            {selectedRecipients.length > 0 && !submitting && (
              <CheckCircle className="h-4 w-4 opacity-70" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
