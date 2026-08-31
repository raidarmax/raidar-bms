import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import {
  XIcon,
  ShieldIcon,
  UserIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  FileTextIcon,
  CalendarIcon,
  ClockIcon,
} from '../../components/icons/Icons';
import {
  assignOfficerToIncident,
  claimIncidentAsOfficer,
  claimIncidentAsManager,
  addPersonOfInterest,
  issueSummon,
  addIncidentNote,
  resolveIncident,
  closeIncident,
  fetchStationOfficers,
} from '../../services/data';
import type { PoliceOfficer, PoliceOfficerWithStation, Rider, Owner, Incident } from '../../services/supabase';
import { showToast } from '../../components/ui/Toast';

const POI_RELATIONSHIPS = [
  { key: 'actual_rider', label: 'Actual rider' },
  { key: 'witness', label: 'Witness' },
  { key: 'suspect', label: 'Suspect' },
  { key: 'passenger', label: 'Passenger' },
  { key: 'victim', label: 'Victim' },
  { key: 'informant', label: 'Informant' },
  { key: 'other', label: 'Other' },
];

const RESOLUTION_OUTCOMES = [
  { key: 'warning_issued', label: 'Warning issued', tone: colors.amber },
  { key: 'fined', label: 'Fine issued', tone: colors.blue },
  { key: 'dismissed', label: 'Dismissed', tone: colors.gray },
  { key: 'referred', label: 'Referred', tone: colors.orange },
  { key: 'no_action', label: 'No action', tone: colors.gray },
  { key: 'educated', label: 'Educated', tone: colors.green },
];

type ModalShellProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  primaryTone?: 'brand' | 'danger';
};

function ModalShell({
  visible, onClose, title, subtitle, children,
  primaryLabel, onPrimary, primaryLoading, primaryDisabled, primaryTone = 'brand',
}: ModalShellProps) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle && <Text style={styles.sheetSub}>{subtitle}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <XIcon size={18} color={colors.gray[500]} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ maxHeight: '78%' }}
            contentContainerStyle={{ padding: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {primaryLabel && onPrimary && (
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={[styles.primaryBtn, primaryTone === 'danger' && { backgroundColor: colors.red[600] },
                  (primaryDisabled || primaryLoading) && { opacity: 0.5 }]}
                onPress={onPrimary}
                disabled={primaryDisabled || primaryLoading}
                activeOpacity={0.8}
              >
                {primaryLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ------------- Assign Modal ------------- */

export function AssignModal({
  visible,
  onClose,
  incidentId,
  officer,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
  officer: PoliceOfficerWithStation;
  onDone: () => void;
}) {
  const [officers, setOfficers] = useState<PoliceOfficer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [claimingSelf, setClaimingSelf] = useState(false);
  const [claimingManager, setClaimingManager] = useState(false);
  const isManager = !!officer.is_station_admin;

  useEffect(() => {
    if (!visible || !officer.station_id) return;
    setLoading(true);
    fetchStationOfficers(officer.station_id)
      .then(({ rows }) => setOfficers(rows.filter((o: any) => o.is_active !== false)))
      .catch(() => setOfficers([]))
      .finally(() => setLoading(false));
  }, [visible, officer.station_id]);

  const selfClaim = async () => {
    setClaimingSelf(true);
    try {
      await claimIncidentAsOfficer(incidentId, { id: officer.id, full_name: officer.full_name });
      showToast('Case claimed', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to claim', 'error');
    } finally {
      setClaimingSelf(false);
    }
  };

  const managerClaim = async () => {
    setClaimingManager(true);
    try {
      await claimIncidentAsManager(
        incidentId,
        { id: officer.id, full_name: officer.full_name, station_id: officer.station_id },
        false,
      );
      showToast('Case claimed by station manager', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to claim', 'error');
    } finally {
      setClaimingManager(false);
    }
  };

  const assignTo = async (target: PoliceOfficer) => {
    setBusyId(target.id);
    try {
      await assignOfficerToIncident(
        incidentId,
        { id: target.id, full_name: target.full_name },
        { id: officer.id, full_name: officer.full_name },
      );
      showToast(`Assigned to ${target.full_name}`, 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to assign', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title={isManager ? 'Assign or claim case' : 'Claim this case'}
      subtitle={isManager
        ? 'Claim it, self-assign or assign to another officer at your station.'
        : 'Take ownership of this case and start investigating.'}
    >
      <TouchableOpacity
        style={[styles.actionCard, claimingSelf && { opacity: 0.6 }]}
        onPress={selfClaim}
        disabled={claimingSelf}
      >
        <View style={[styles.actionIcon, { backgroundColor: colors.brand[50] }]}>
          <ShieldIcon size={20} color={colors.brand[600]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionCardTitle}>Assign to myself</Text>
          <Text style={styles.actionCardSub}>Marks case as investigating</Text>
        </View>
        {claimingSelf && <ActivityIndicator size="small" color={colors.brand[500]} />}
      </TouchableOpacity>

      {isManager && (
        <TouchableOpacity
          style={[styles.actionCard, claimingManager && { opacity: 0.6 }]}
          onPress={managerClaim}
          disabled={claimingManager}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.amber[50] }]}>
            <CheckCircleIcon size={20} color={colors.amber[700]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionCardTitle}>Claim as station manager</Text>
            <Text style={styles.actionCardSub}>Reserve case oversight without assigning</Text>
          </View>
          {claimingManager && <ActivityIndicator size="small" color={colors.amber[600]} />}
        </TouchableOpacity>
      )}

      {isManager && (
        <>
          <Text style={[styles.groupLabel, { marginTop: spacing.lg }]}>Assign to officer</Text>
          {loading ? (
            <View style={{ padding: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.brand[500]} />
            </View>
          ) : officers.length === 0 ? (
            <Text style={styles.mutedLine}>No other officers at this station.</Text>
          ) : (
            officers
              .filter((o) => o.id !== officer.id)
              .map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={[styles.officerRow, busyId === o.id && { opacity: 0.6 }]}
                  onPress={() => assignTo(o)}
                  disabled={busyId !== null}
                  activeOpacity={0.7}
                >
                  <View style={styles.officerAvatar}>
                    <UserIcon size={16} color={colors.gray[600]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.officerName}>{o.full_name}</Text>
                    <Text style={styles.officerSub}>
                      {[o.rank, o.service_number].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {busyId === o.id && <ActivityIndicator size="small" color={colors.brand[500]} />}
                </TouchableOpacity>
              ))
          )}
        </>
      )}
    </ModalShell>
  );
}

/* ------------- Add POI Modal ------------- */

export function AddPOIModal({
  visible, onClose, incidentId, officer, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
  officer: PoliceOfficerWithStation;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [relationship, setRelationship] = useState('witness');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName(''); setPhone(''); setIdNumber(''); setRelationship('witness'); setNotes('');
    }
  }, [visible]);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addPersonOfInterest(
        incidentId,
        { id: officer.id, full_name: officer.full_name },
        {
          full_name: name.trim(),
          phone_number: phone.trim() || null,
          id_number: idNumber.trim() || null,
          relationship,
          notes: notes.trim() || null,
        },
      );
      showToast('Person of interest added', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to add', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Add person of interest"
      subtitle="Link a rider, witness, suspect or other person to this case."
      primaryLabel="Add person"
      onPrimary={submit}
      primaryLoading={saving}
      primaryDisabled={!name.trim()}
    >
      <Text style={styles.fieldLabel}>Relationship</Text>
      <View style={styles.chipsWrap}>
        {POI_RELATIONSHIPS.map((r) => {
          const active = relationship === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => setRelationship(r.key)}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Full name *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Enter full name"
        placeholderTextColor={colors.gray[400]}
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>Phone number</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="e.g. 0712 345 678"
        placeholderTextColor={colors.gray[400]}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>National ID</Text>
      <TextInput
        value={idNumber}
        onChangeText={setIdNumber}
        placeholder="Optional"
        placeholderTextColor={colors.gray[400]}
        keyboardType="number-pad"
        style={styles.input}
      />

      <Text style={styles.fieldLabel}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything relevant to the case..."
        placeholderTextColor={colors.gray[400]}
        multiline
        style={[styles.input, styles.inputMulti]}
      />

      <Text style={styles.helperText}>
        We'll try to link this person to an existing rider or owner using their phone or ID.
      </Text>
    </ModalShell>
  );
}

/* ------------- Issue Summon Modal ------------- */

export function IssueSummonModal({
  visible, onClose, incidentId, incident, officer, rider, owner, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
  incident: Incident;
  officer: PoliceOfficerWithStation;
  rider: Rider | null;
  owner: Owner | null;
  onDone: () => void;
}) {
  const [personType, setPersonType] = useState<'rider' | 'owner' | 'reporter' | 'other'>('rider');
  const [customName, setCustomName] = useState('');
  const [customPhone, setCustomPhone] = useState('');
  const [customId, setCustomId] = useState('');
  const [summonDate, setSummonDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [summonTime, setSummonTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPersonType(rider ? 'rider' : owner ? 'owner' : 'other');
      setCustomName(''); setCustomPhone(''); setCustomId('');
      setReason(''); setNotes(''); setSendSms(true);
    }
  }, [visible, rider, owner]);

  const resolvePerson = () => {
    if (personType === 'rider' && rider) {
      return { name: rider.name, phone: rider.phone_number || '', id: rider.id_number || '', person_id: rider.id };
    }
    if (personType === 'owner' && owner) {
      return { name: owner.full_name, phone: owner.phone_number || '', id: owner.national_id || '', person_id: owner.id };
    }
    if (personType === 'reporter') {
      return { name: incident.reporter_name || '', phone: incident.reporter_phone || '', id: '', person_id: null };
    }
    return { name: customName, phone: customPhone, id: customId, person_id: null };
  };

  const submit = async () => {
    const p = resolvePerson();
    if (!p.name.trim() || !reason.trim() || !summonDate) return;
    setSaving(true);
    try {
      await issueSummon(
        incidentId,
        { id: officer.id, full_name: officer.full_name, station_id: officer.station_id },
        {
          person_type: personType,
          person_id: p.person_id,
          person_name: p.name,
          person_phone: p.phone || null,
          person_id_number: p.id || null,
          summon_date: summonDate,
          summon_time: summonTime,
          reason,
          notes: notes || null,
          station_name: officer.station?.station_name,
          case_number: incident.case_number,
          send_sms: sendSms && !!p.phone,
        },
      );
      showToast('Summons issued', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to issue summons', 'error');
    } finally {
      setSaving(false);
    }
  };

  const person = resolvePerson();
  const canSubmit = person.name.trim() && reason.trim() && summonDate;

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Issue summons"
      subtitle="Formally call a person to appear at your station."
      primaryLabel="Issue summons"
      onPrimary={submit}
      primaryLoading={saving}
      primaryDisabled={!canSubmit}
    >
      <Text style={styles.fieldLabel}>Who to summon</Text>
      <View style={styles.chipsWrap}>
        {[
          { key: 'rider', label: rider ? `Rider: ${rider.name}` : 'Rider', disabled: !rider },
          { key: 'owner', label: owner ? `Owner: ${owner.full_name}` : 'Owner', disabled: !owner },
          { key: 'reporter', label: 'Reporter', disabled: !incident.reporter_name },
          { key: 'other', label: 'Other', disabled: false },
        ].map((r) => {
          const active = personType === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              onPress={() => !r.disabled && setPersonType(r.key as any)}
              style={[
                styles.chip,
                active && styles.chipActive,
                r.disabled && { opacity: 0.4 },
              ]}
              disabled={r.disabled}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {personType === 'other' ? (
        <>
          <Text style={styles.fieldLabel}>Full name *</Text>
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            placeholder="Enter name"
            placeholderTextColor={colors.gray[400]}
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            value={customPhone}
            onChangeText={setCustomPhone}
            placeholder="Phone (for SMS)"
            placeholderTextColor={colors.gray[400]}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Text style={styles.fieldLabel}>National ID</Text>
          <TextInput
            value={customId}
            onChangeText={setCustomId}
            placeholder="Optional"
            placeholderTextColor={colors.gray[400]}
            keyboardType="number-pad"
            style={styles.input}
          />
        </>
      ) : (
        <View style={styles.previewCard}>
          <UserIcon size={16} color={colors.gray[500]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName}>{person.name || 'No name available'}</Text>
            {person.phone ? <Text style={styles.previewSub}>{person.phone}</Text> : null}
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Date *</Text>
          <View style={styles.inputWithIcon}>
            <CalendarIcon size={14} color={colors.gray[500]} />
            <TextInput
              value={summonDate}
              onChangeText={setSummonDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.gray[400]}
              style={{ flex: 1, fontSize: 15, color: colors.gray[900], padding: 0 }}
            />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLabel}>Time</Text>
          <View style={styles.inputWithIcon}>
            <ClockIcon size={14} color={colors.gray[500]} />
            <TextInput
              value={summonTime}
              onChangeText={setSummonTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.gray[400]}
              style={{ flex: 1, fontSize: 15, color: colors.gray[900], padding: 0 }}
            />
          </View>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Reason *</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Reason for summons..."
        placeholderTextColor={colors.gray[400]}
        multiline
        style={[styles.input, styles.inputMulti]}
      />

      <Text style={styles.fieldLabel}>Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Additional info (optional)"
        placeholderTextColor={colors.gray[400]}
        multiline
        style={[styles.input, { minHeight: 60, textAlignVertical: 'top', paddingTop: spacing.md }]}
      />

      <View style={styles.smsToggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.smsToggleTitle}>Send SMS to {person.name?.split(' ')[0] || 'person'}</Text>
          <Text style={styles.smsToggleSub}>
            {person.phone ? `To ${person.phone}` : 'No phone number available'}
          </Text>
        </View>
        <Switch
          value={sendSms && !!person.phone}
          onValueChange={setSendSms}
          disabled={!person.phone}
          trackColor={{ true: colors.brand[500], false: colors.gray[300] }}
          thumbColor={colors.white}
        />
      </View>
    </ModalShell>
  );
}

/* ------------- Add Note Modal ------------- */

export function AddNoteModal({
  visible, onClose, incidentId, officer, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
  officer: PoliceOfficerWithStation;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) setNote('');
  }, [visible]);

  const submit = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addIncidentNote(incidentId, { id: officer.id, full_name: officer.full_name }, note);
      showToast('Note added', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to add note', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Add case note"
      subtitle="Log an update to the case timeline."
      primaryLabel="Add note"
      onPrimary={submit}
      primaryLoading={saving}
      primaryDisabled={!note.trim()}
    >
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What did you observe or update?"
        placeholderTextColor={colors.gray[400]}
        multiline
        autoFocus
        style={[styles.input, { minHeight: 140, textAlignVertical: 'top', paddingTop: spacing.md }]}
      />
    </ModalShell>
  );
}

/* ------------- Resolve Modal ------------- */

export function ResolveModal({
  visible, onClose, incidentId, officer, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
  officer: PoliceOfficerWithStation;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState('warning_issued');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) { setOutcome('warning_issued'); setSummary(''); }
  }, [visible]);

  const submit = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await resolveIncident(incidentId, { id: officer.id, full_name: officer.full_name }, { outcome, summary });
      showToast('Case resolved', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to resolve', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Resolve case"
      subtitle="Record the outcome and a summary for the case file."
      primaryLabel="Resolve case"
      onPrimary={submit}
      primaryLoading={saving}
      primaryDisabled={!summary.trim()}
    >
      <Text style={styles.fieldLabel}>Outcome</Text>
      {RESOLUTION_OUTCOMES.map((o) => {
        const active = outcome === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => setOutcome(o.key)}
            style={[styles.radioRow, active && { borderColor: o.tone[500], backgroundColor: o.tone[50] }]}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.radioDot,
                { borderColor: active ? o.tone[500] : colors.gray[300] },
                active && { backgroundColor: o.tone[500] },
              ]}
            />
            <Text style={[styles.radioLabel, active && { color: o.tone[700], fontWeight: '700' }]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.fieldLabel}>Resolution summary *</Text>
      <TextInput
        value={summary}
        onChangeText={setSummary}
        placeholder="Describe what happened and how it was resolved..."
        placeholderTextColor={colors.gray[400]}
        multiline
        style={[styles.input, { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md }]}
      />
    </ModalShell>
  );
}

/* ------------- Close Modal ------------- */

export function CloseCaseModal({
  visible, onClose, incidentId, officer, onDone,
}: {
  visible: boolean;
  onClose: () => void;
  incidentId: string;
  officer: PoliceOfficerWithStation;
  onDone: () => void;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) setNote('');
  }, [visible]);

  const submit = async () => {
    setSaving(true);
    try {
      await closeIncident(incidentId, { id: officer.id, full_name: officer.full_name }, note.trim() || undefined);
      showToast('Case closed', 'success');
      onDone();
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to close', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      visible={visible}
      onClose={onClose}
      title="Close case"
      subtitle="Closing a case finalises it. Add a closing note if useful."
      primaryLabel="Close case"
      onPrimary={submit}
      primaryLoading={saving}
      primaryTone="danger"
    >
      <View style={styles.warningBanner}>
        <AlertTriangleIcon size={16} color={colors.amber[700]} />
        <Text style={styles.warningText}>
          You should usually resolve a case before closing it. Closed cases are archived.
        </Text>
      </View>

      <Text style={styles.fieldLabel}>Closing note (optional)</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a closing remark..."
        placeholderTextColor={colors.gray[400]}
        multiline
        style={[styles.input, { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.md }]}
      />
    </ModalShell>
  );
}

/* ------------- Styles ------------- */

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%', ...shadows.lg,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  sheetTitle: { ...typography.h2, color: colors.gray[900] },
  sheetSub: { ...typography.caption, color: colors.gray[500], marginTop: 2, textTransform: 'none', letterSpacing: 0 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
  },
  sheetFooter: {
    padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.gray[100],
  },
  primaryBtn: {
    backgroundColor: colors.brand[600], paddingVertical: spacing.md, borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  primaryBtnText: { ...typography.button, color: colors.white },

  groupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.gray[500], letterSpacing: 0.6,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: colors.gray[600], letterSpacing: 0.4,
    marginTop: spacing.md, marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1, borderColor: colors.gray[200], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15,
    color: colors.gray[900], backgroundColor: colors.white,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: spacing.md },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.gray[200], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.white,
  },
  helperText: { ...typography.caption, color: colors.gray[500], marginTop: spacing.md, textTransform: 'none', letterSpacing: 0 },

  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.gray[200], borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  actionCardTitle: { fontSize: 15, fontWeight: '600', color: colors.gray[900] },
  actionCardSub: { ...typography.caption, color: colors.gray[500], marginTop: 2, textTransform: 'none', letterSpacing: 0 },

  officerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray[100], marginBottom: 6,
  },
  officerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gray[100],
    alignItems: 'center', justifyContent: 'center',
  },
  officerName: { fontSize: 14, fontWeight: '600', color: colors.gray[900] },
  officerSub: { ...typography.caption, color: colors.gray[500], marginTop: 1, textTransform: 'none', letterSpacing: 0 },
  mutedLine: { ...typography.bodySmall, color: colors.gray[400], fontStyle: 'italic', padding: spacing.md },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  chipActive: { backgroundColor: colors.brand[600] },
  chipText: { fontSize: 12, color: colors.gray[700], fontWeight: '600' },
  chipTextActive: { color: colors.white },

  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.gray[50], borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray[100], marginBottom: spacing.sm,
  },
  previewName: { fontSize: 14, fontWeight: '600', color: colors.gray[900] },
  previewSub: { ...typography.caption, color: colors.gray[500], marginTop: 1, textTransform: 'none', letterSpacing: 0 },

  smsToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.gray[50], borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  smsToggleTitle: { fontSize: 14, fontWeight: '600', color: colors.gray[900] },
  smsToggleSub: { ...typography.caption, color: colors.gray[500], marginTop: 1, textTransform: 'none', letterSpacing: 0 },

  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.gray[200], marginBottom: 6, backgroundColor: colors.white,
  },
  radioDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.gray[300],
  },
  radioLabel: { fontSize: 14, color: colors.gray[700] },

  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.amber[50], borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.amber[100], marginBottom: spacing.md,
  },
  warningText: { flex: 1, fontSize: 12, color: colors.amber[700], lineHeight: 17 },
});
