import { useEffect, useMemo, useState } from 'react';
import { Send, ChevronDown, ChevronUp, MessageCircle, Loader2, X, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  supabase,
  type IncidentMessage,
  type PoliceOfficer,
  type PoliceOfficerWithStation,
  type Rider,
  type Owner,
  type Incident,
} from '../../lib/supabase';
import { logIncidentResolution } from '../../lib/incidentResolutions';
import PartyAvatar, { type AvatarKind } from './PartyAvatar';

type Props = {
  incident: Incident;
  officer: PoliceOfficerWithStation;
  rider: Rider | null;
  owner: Owner | null;
  locked: boolean;
};

type Recipient = {
  key: string;
  type: 'rider' | 'owner' | 'reporter' | 'officer' | 'senior_officer';
  id: string | null;
  name: string;
  phone: string | null;
  role: string;
  kind: AvatarKind;
  photoUrl: string | null;
  tone: string;
};

export default function CaseMessagesPanel({ incident, officer, rider, owner, locked }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [messages, setMessages] = useState<IncidentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [seniorOfficers, setSeniorOfficers] = useState<PoliceOfficer[]>([]);
  const [stationOfficers, setStationOfficers] = useState<PoliceOfficer[]>([]);
  const [selectedRecipientKey, setSelectedRecipientKey] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('incident_messages')
        .select('*')
        .eq('incident_id', incident.id)
        .order('created_at', { ascending: false });
      setMessages((data as IncidentMessage[]) || []);
      setLoading(false);
    })();
  }, [incident.id]);

  useEffect(() => {
    (async () => {
      const [seniorsRes, stationRes] = await Promise.all([
        supabase
          .from('police_officers')
          .select('*')
          .eq('is_active', true)
          .eq('is_station_admin', true)
          .neq('id', officer.id)
          .order('full_name')
          .limit(20),
        supabase
          .from('police_officers')
          .select('*')
          .eq('station_id', officer.station_id)
          .eq('is_active', true)
          .neq('id', officer.id)
          .order('full_name'),
      ]);
      setSeniorOfficers((seniorsRes.data as PoliceOfficer[]) || []);
      setStationOfficers((stationRes.data as PoliceOfficer[]) || []);
    })();
  }, [officer.id, officer.station_id]);

  const recipients: Recipient[] = useMemo(() => {
    const out: Recipient[] = [];
    if (incident.reporter_name) {
      out.push({
        key: `reporter-${incident.reporter_phone}`,
        type: 'reporter',
        id: null,
        name: incident.reporter_name,
        phone: incident.reporter_phone,
        role: 'Reporter',
        kind: 'reporter',
        photoUrl: null,
        tone: 'text-rose-600 bg-rose-50 border-rose-200',
      });
    }
    if (rider) {
      out.push({
        key: `rider-${rider.id}`,
        type: 'rider',
        id: rider.id,
        name: rider.name,
        phone: rider.phone_number,
        role: 'Rider on case',
        kind: 'rider',
        photoUrl: rider.photo_url,
        tone: 'text-blue-600 bg-blue-50 border-blue-200',
      });
    }
    if (owner) {
      out.push({
        key: `owner-${owner.id}`,
        type: 'owner',
        id: owner.id,
        name: owner.full_name,
        phone: owner.phone_number,
        role: 'Motorcycle owner',
        kind: 'owner',
        photoUrl: owner.profile_photo_url,
        tone: 'text-teal-600 bg-teal-50 border-teal-200',
      });
    }
    for (const so of stationOfficers) {
      out.push({
        key: `officer-${so.id}`,
        type: 'officer',
        id: so.id,
        name: so.full_name,
        phone: so.phone_number,
        role: `${so.rank.replace(/_/g, ' ')} at ${officer.station.station_name}`,
        kind: 'officer',
        photoUrl: so.profile_photo_url,
        tone: 'text-slate-600 bg-slate-50 border-slate-200',
      });
    }
    for (const so of seniorOfficers) {
      out.push({
        key: `senior-${so.id}`,
        type: 'senior_officer',
        id: so.id,
        name: so.full_name,
        phone: so.phone_number,
        role: `Station manager - ${so.rank.replace(/_/g, ' ')}`,
        kind: 'senior_officer',
        photoUrl: so.profile_photo_url,
        tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      });
    }
    return out;
  }, [incident.reporter_name, incident.reporter_phone, rider, owner, stationOfficers, seniorOfficers, officer.station.station_name]);

  const openComposer = () => {
    setShowComposer(true);
    setSubject('');
    setBody('');
    setSendMsg('');
    setSelectedRecipientKey('');
  };

  const closeComposer = () => {
    setShowComposer(false);
    setSubject('');
    setBody('');
    setSendMsg('');
    setSelectedRecipientKey('');
  };

  const submit = async () => {
    const recipient = recipients.find((r) => r.key === selectedRecipientKey);
    if (!recipient || !body.trim()) return;
    setSending(true);
    setSendMsg('');
    try {
      const { data: inserted, error } = await supabase
        .from('incident_messages')
        .insert({
          incident_id: incident.id,
          from_officer_id: officer.id,
          from_officer_name: officer.full_name,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          recipient_name: recipient.name,
          recipient_phone: recipient.phone,
          subject: subject.trim() || null,
          body: body.trim(),
          channel: sendSms && recipient.phone ? 'both' : 'in_app',
          sms_sent: false,
        })
        .select()
        .single();
      if (error) throw error;

      await logIncidentResolution({
        incidentId: incident.id,
        actionType: 'message_sent',
        actorType: 'officer',
        actorId: officer.id,
        actorName: officer.full_name,
        notes: `Sent message to ${recipient.name} (${recipient.role}).${subject.trim() ? ` Subject: ${subject.trim()}.` : ''}`,
        metadata: {
          message_id: inserted.id,
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          recipient_name: recipient.name,
          channel: sendSms && recipient.phone ? 'both' : 'in_app',
        },
      });

      setMessages((prev) => [inserted as IncidentMessage, ...prev]);
      setSendMsg(`Message sent to ${recipient.name}.`);
      setBody('');
      setSubject('');
      setSelectedRecipientKey('');
      setTimeout(() => setShowComposer(false), 800);
    } catch (err: any) {
      setSendMsg(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const selectedRecipient = recipients.find((r) => r.key === selectedRecipientKey);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-bold text-slate-900">Case Messages</p>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {messages.length}
          </span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <p className="text-[11px] text-slate-500 leading-snug">
            Message anyone involved in this case - the reporter, rider, owner, another officer, or a station manager. Every message is logged in the case timeline.
          </p>

          {!locked && !showComposer && (
            <button
              onClick={openComposer}
              className="w-full px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 flex items-center justify-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              New message
            </button>
          )}

          {showComposer && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Compose</p>
                <button onClick={closeComposer} className="text-slate-400 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Recipient</label>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {recipients.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No recipients available.</p>
                  ) : (
                    recipients.map((r) => {
                      const isActive = selectedRecipientKey === r.key;
                      return (
                        <button
                          key={r.key}
                          onClick={() => setSelectedRecipientKey(r.key)}
                          className={`w-full text-left rounded-lg border p-2 flex items-center gap-2 transition ${
                            isActive
                              ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-100'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <PartyAvatar kind={r.kind} photoUrl={r.photoUrl} name={r.name} size="sm" rounded="lg" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900 truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-500 truncate">{r.role}</p>
                          </div>
                          {r.phone && (
                            <span className="text-[10px] text-slate-500 flex-shrink-0">{r.phone}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Subject (optional)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Request additional statement"
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1 uppercase tracking-wider">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={3}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs resize-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type your message..."
                />
              </div>

              {selectedRecipient?.phone && (
                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Also record SMS delivery to {selectedRecipient.phone}
                </label>
              )}

              {sendMsg && (
                <div className={`text-[11px] px-2 py-1 rounded flex items-center gap-1 ${
                  sendMsg.includes('sent to') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {sendMsg.includes('sent to') ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {sendMsg}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={sending || !selectedRecipientKey || !body.trim()}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {sending ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="h-3.5 w-3.5" /> Send message</>
                  )}
                </button>
                <button
                  onClick={closeComposer}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-3 text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-2">No messages yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {messages.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-900">{m.from_officer_name || 'Officer'}</span>
                    <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                    <span className="font-semibold text-slate-900">{m.recipient_name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                      {m.recipient_type.replace('_', ' ')}
                    </span>
                    {m.channel !== 'in_app' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase tracking-wider">
                        {m.channel}
                      </span>
                    )}
                  </div>
                  {m.subject && (
                    <p className="text-xs font-semibold text-slate-900 mt-1">{m.subject}</p>
                  )}
                  <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-snug">{m.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleString('en-KE', {
                      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
