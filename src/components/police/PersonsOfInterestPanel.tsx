import { useState } from 'react';
import { UserPlus, Link2, Trash2, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, type IncidentPersonOfInterest, type PoliceOfficerWithStation } from '../../lib/supabase';
import { logIncidentResolution } from '../../lib/incidentResolutions';

type Props = {
  incidentId: string;
  officer: PoliceOfficerWithStation;
  personsOfInterest: IncidentPersonOfInterest[];
  locked: boolean;
  onChanged: () => void;
};

export default function PersonsOfInterestPanel({ incidentId, officer, personsOfInterest, locked, onChanged }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [relationship, setRelationship] = useState('actual_rider');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const resetForm = () => {
    setName(''); setPhone(''); setIdNumber('');
    setRelationship('actual_rider'); setNotes('');
    setMsg('');
  };

  const submit = async () => {
    if (!name.trim()) {
      setMsg('Name is required.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      let linkedRiderId: string | null = null;
      let linkedOwnerId: string | null = null;
      const idTrim = idNumber.trim();
      const phoneTrim = phone.trim();

      if (idTrim) {
        const [{ data: matchRider }, { data: matchOwner }] = await Promise.all([
          supabase.from('riders').select('id').eq('id_number', idTrim).maybeSingle(),
          supabase.from('owners').select('id').eq('national_id', idTrim).maybeSingle(),
        ]);
        if (matchRider) linkedRiderId = matchRider.id;
        if (matchOwner) linkedOwnerId = matchOwner.id;
      }
      if (!linkedRiderId && phoneTrim) {
        const { data } = await supabase.from('riders').select('id').eq('phone_number', phoneTrim).maybeSingle();
        if (data) linkedRiderId = data.id;
      }
      if (!linkedOwnerId && phoneTrim) {
        const { data } = await supabase.from('owners').select('id').eq('phone_number', phoneTrim).maybeSingle();
        if (data) linkedOwnerId = data.id;
      }

      const { data: inserted, error } = await supabase
        .from('incident_persons_of_interest')
        .insert({
          incident_id: incidentId,
          full_name: name.trim(),
          phone_number: phoneTrim || null,
          id_number: idTrim || null,
          relationship: relationship || null,
          notes: notes.trim() || null,
          linked_rider_id: linkedRiderId,
          linked_owner_id: linkedOwnerId,
          added_by_officer_id: officer.id,
        })
        .select()
        .single();
      if (error) throw error;

      const linkNote =
        linkedRiderId && linkedOwnerId ? ' Linked to an existing rider and owner account.' :
        linkedRiderId ? ' Linked to an existing rider account.' :
        linkedOwnerId ? ' Linked to an existing owner account.' : '';

      await logIncidentResolution({
        incidentId,
        actionType: 'person_of_interest_added',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        notes: `Added ${name.trim()} as person of interest (${relationship.replace(/_/g, ' ')}).${linkNote}`,
        metadata: {
          poi_id: inserted.id,
          full_name: name.trim(),
          phone_number: phoneTrim || null,
          id_number: idTrim || null,
          relationship,
          linked_rider_id: linkedRiderId,
          linked_owner_id: linkedOwnerId,
        },
      });

      setMsg(linkedRiderId || linkedOwnerId ? 'Added and linked to existing account.' : 'Added to the case.');
      resetForm();
      setShowForm(false);
      onChanged();
    } catch (err: any) {
      setMsg(err?.message || 'Failed to add person of interest.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (poi: IncidentPersonOfInterest) => {
    await supabase.from('incident_persons_of_interest').delete().eq('id', poi.id);
    await logIncidentResolution({
      incidentId,
      actionType: 'person_of_interest_removed',
      actorType: 'officer',
      actorId: officer.id,
      actorName: officer.full_name,
      notes: `Removed ${poi.full_name} from persons of interest.`,
      metadata: { poi_id: poi.id, full_name: poi.full_name },
    });
    onChanged();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-900">Persons of Interest</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {personsOfInterest.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <p className="text-[11px] text-slate-500 leading-snug">
            Anyone the rider or witnesses mention. Matches to BMS accounts by ID or phone are linked automatically.
          </p>

          {personsOfInterest.length > 0 && (
            <ul className="space-y-1.5">
              {personsOfInterest.map((p) => (
                <li key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-semibold text-slate-900">{p.full_name}</p>
                        {p.relationship && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase tracking-wide">
                            {p.relationship.replace(/_/g, ' ')}
                          </span>
                        )}
                        {p.linked_rider_id && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 flex items-center gap-0.5">
                            <Link2 className="h-2.5 w-2.5" /> Rider
                          </span>
                        )}
                        {p.linked_owner_id && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-0.5">
                            <Link2 className="h-2.5 w-2.5" /> Owner
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {p.phone_number || 'No phone'}{p.id_number ? ` \u00b7 ID ${p.id_number}` : ''}
                      </p>
                      {p.notes && (
                        <p className="text-[10px] text-slate-500 mt-0.5 italic">{p.notes}</p>
                      )}
                    </div>
                    {!locked && (
                      <button
                        onClick={() => remove(p)}
                        className="text-slate-400 hover:text-red-600 p-0.5 rounded"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!locked && !showForm && (
            <button
              onClick={() => { setShowForm(true); setMsg(''); }}
              className="w-full px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 flex items-center justify-center gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add person
            </button>
          )}

          {msg && !showForm && (
            <div className="text-[11px] px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {msg}
            </div>
          )}

          {showForm && !locked && (
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50 space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Kamau"
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07..."
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">ID</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="ID number"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Relationship</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="actual_rider">Actual rider on bike</option>
                  <option value="witness">Witness</option>
                  <option value="suspect">Suspect</option>
                  <option value="passenger">Passenger</option>
                  <option value="victim">Victim</option>
                  <option value="informant">Informant</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs resize-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Context (optional)"
                />
              </div>
              {msg && (
                <div className="text-[11px] px-2 py-1 rounded bg-red-50 border border-red-200 text-red-700">
                  {msg}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={saving || !name.trim()}
                  className="flex-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {saving ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                  ) : (
                    <><UserPlus className="h-3 w-3" /> Add to case</>
                  )}
                </button>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
