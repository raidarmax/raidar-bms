import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { loadFineBundle, sendFineReminder, type FineBundle, type FetchStamp } from '../../services/data';
import { getSupabase } from '../../services/supabase';
import { DataFooter } from '../../components/ui/DataFooter';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { showToast } from '../../components/ui/Toast';
import {
  ReceiptIcon,
  ChevronLeftIcon,
  PhoneIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  UserIcon,
  ShieldIcon,
  RefreshIcon,
  XIcon,
} from '../../components/icons/Icons';

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
  issued: { label: 'Issued', bg: colors.amber[50], fg: colors.amber[700] },
  paid: { label: 'Paid', bg: colors.green[50], fg: colors.green[700] },
  overdue: { label: 'Overdue', bg: colors.red[50], fg: colors.red[700] },
  disputed: { label: 'Disputed', bg: colors.blue[50], fg: colors.blue[700] },
  cancelled: { label: 'Cancelled', bg: colors.gray[100], fg: colors.gray[600] },
};

function money(n: number | null | undefined) {
  if (n === null || n === undefined) return 'KES 0';
  return 'KES ' + Number(n).toLocaleString();
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export default function FineDetailScreen(props: any) {
  const routeKey = props?.route?.key || 'no-key';
  const fineId = props?.route?.params?.fineId || 'no-id';
  return (
    <ErrorBoundary label={`Fine ${String(fineId).slice(0, 12)}`}>
      <FineDetailInner key={`${routeKey}::${fineId}`} {...props} />
    </ErrorBoundary>
  );
}

function FineDetailInner({ route, navigation }: any) {
  const fineId: string = route?.params?.fineId || '';
  const insets = useSafeAreaInsets();

  const [bundle, setBundle] = useState<FineBundle | null>(null);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [confirmReminder, setConfirmReminder] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchFine = useCallback(async () => {
    setError(null);
    try {
      const result = await loadFineBundle(fineId);
      if (!result) {
        setBundle(null);
        setStamp({ fetchedAt: Date.now(), rowCount: 0, filter: `fine:${String(fineId).slice(0, 8)}`, errorMessage: 'Fine not found' });
        setError('This fine could not be found.');
        return;
      }
      setBundle(result);
      setStamp(result.stamp);
    } catch (e: any) {
      setError(e?.message || 'Failed to load fine');
      setStamp({ fetchedAt: Date.now(), rowCount: 0, filter: `fine:${String(fineId).slice(0, 8)}`, errorMessage: e?.message || 'Fetch failed' });
    }
  }, [fineId]);

  useEffect(() => {
    setLoading(true);
    fetchFine().finally(() => setLoading(false));
  }, [fetchFine]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFine();
    setRefreshing(false);
  }, [fetchFine]);

  const sendReminder = async () => {
    if (!bundle) return;
    setSendingReminder(true);
    try {
      await sendFineReminder({
        id: bundle.fine.id,
        fine_reference: bundle.fine.fine_reference,
        rider_phone: bundle.fine.rider_phone,
        rider_name: bundle.fine.rider_name,
        fine_amount: bundle.fine.fine_amount,
        reminder_count: bundle.fine.reminder_count,
        offence: bundle.fine.offence,
        station: bundle.station ? { station_name: bundle.station.station_name } : null,
        officer: bundle.issuingOfficer ? { service_number: bundle.issuingOfficer.service_number } : null,
      });
      showToast('Final reminder SMS sent', 'success');
      setConfirmReminder(false);
      await fetchFine();
    } catch (e: any) {
      showToast(e?.message || 'Failed to send reminder', 'error');
    } finally {
      setSendingReminder(false);
    }
  };

  const markPaid = async () => {
    if (!bundle || !paymentRef.trim()) return;
    setMarkingPaid(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('fines')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: paymentRef.trim(),
        })
        .eq('id', bundle.fine.id);
      if (error) throw error;
      showToast('Fine marked as paid', 'success');
      setMarkPaidOpen(false);
      setPaymentRef('');
      await fetchFine();
    } catch (e: any) {
      showToast(e?.message || 'Failed to mark paid', 'error');
    } finally {
      setMarkingPaid(false);
    }
  };

  const cancelFine = async () => {
    if (!bundle || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('fines')
        .update({
          status: 'cancelled',
          notes: (bundle.fine.notes || '').concat(
            (bundle.fine.notes ? '\n' : '') + `Cancelled: ${cancelReason.trim()}`,
          ),
        })
        .eq('id', bundle.fine.id);
      if (error) throw error;
      showToast('Fine cancelled', 'success');
      setCancelOpen(false);
      setCancelReason('');
      await fetchFine();
    } catch (e: any) {
      showToast(e?.message || 'Failed to cancel', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !bundle) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
        <Text style={styles.loadingText}>Loading fine details...</Text>
      </View>
    );
  }

  if (error || !bundle) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.errorIconBox}>
          <AlertTriangleIcon size={32} color={colors.red[500]} />
        </View>
        <Text style={styles.errorTitle}>Couldn't load fine</Text>
        <Text style={styles.errorText}>{error || 'The requested fine was not found.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchFine}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { fine } = bundle;
  const cfg = STATUS_CONFIG[fine.status] || STATUS_CONFIG.issued;
  const overdue = fine.status === 'overdue';
  const daysOver = overdue ? daysSince(fine.due_date) : 0;
  const editable = fine.status === 'issued' || fine.status === 'overdue';
  const alreadyReminded = !!fine.last_reminder_sent_at;

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray[50] }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.brand[700]} />

      <View
        style={[
          styles.hero,
          overdue ? { backgroundColor: colors.red[600] } : { backgroundColor: colors.brand[700] },
          { paddingTop: insets.top + spacing.md },
        ]}
      >
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ChevronLeftIcon size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.heroChip}>
            <ReceiptIcon size={13} color={overdue ? colors.red[600] : colors.brand[600]} />
            <Text style={[styles.heroChipText, { color: overdue ? colors.red[700] : colors.brand[700] }]}>
              Traffic Fine
            </Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <RefreshIcon size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
        <Text style={styles.heroRef}>{fine.fine_reference}</Text>
        <Text style={styles.heroAmount}>{money(fine.fine_amount)}</Text>
        <View style={styles.heroStatusRow}>
          <View style={[styles.heroStatusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.heroStatusText, { color: cfg.fg }]}>{cfg.label}</Text>
          </View>
          {overdue && daysOver > 0 && (
            <Text style={styles.heroOverdueLabel}>
              {daysOver} day{daysOver === 1 ? '' : 's'} past due
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />}
      >
        {overdue && (
          <View style={styles.overdueBanner}>
            <View style={styles.overdueBannerIcon}>
              <AlertTriangleIcon size={22} color={colors.red[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.overdueBannerTitle}>Payment overdue</Text>
              <Text style={styles.overdueBannerText}>
                {alreadyReminded
                  ? `Last reminder: ${fmtDateTime(fine.last_reminder_sent_at)}${
                      fine.reminder_count ? ` · ${fine.reminder_count} sent total` : ''
                    }`
                  : 'No reminder has been sent yet. Consider notifying the culprit.'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Offence</Text>
          <View style={styles.divider} />
          <Text style={styles.offenceName}>{fine.offence?.offence_name || 'Traffic violation'}</Text>
          {fine.offence?.offence_code && (
            <Text style={styles.offenceCode}>Code: {fine.offence.offence_code}</Text>
          )}
          {fine.location_description && (
            <View style={styles.metaRow}>
              <MapPinIcon size={15} color={colors.gray[500]} />
              <Text style={styles.metaText}>{fine.location_description}</Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <ClockIcon size={15} color={colors.gray[500]} />
            <Text style={styles.metaText}>Issued {fmtDateTime(fine.issued_at)}</Text>
          </View>
          <View style={styles.metaRow}>
            <ClockIcon size={15} color={overdue ? colors.red[500] : colors.gray[500]} />
            <Text style={[styles.metaText, overdue && { color: colors.red[700], fontWeight: '600' }]}>
              Due {fmtDate(fine.due_date)}
            </Text>
          </View>
          {fine.paid_at && (
            <View style={styles.metaRow}>
              <CheckCircleIcon size={15} color={colors.green[600]} />
              <Text style={[styles.metaText, { color: colors.green[700], fontWeight: '600' }]}>
                Paid {fmtDateTime(fine.paid_at)}
              </Text>
            </View>
          )}
          {fine.notes && (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{fine.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Rider</Text>
          <View style={styles.divider} />
          <View style={styles.personRow}>
            <View style={styles.avatarBig}><UserIcon size={22} color={colors.brand[600]} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{fine.rider_name}</Text>
              {fine.rider_national_id && (
                <Text style={styles.personSub}>ID: {fine.rider_national_id}</Text>
              )}
            </View>
            {fine.rider_phone && (
              <TouchableOpacity
                style={styles.circleAction}
                onPress={() => Linking.openURL(`tel:${fine.rider_phone}`)}
              >
                <PhoneIcon size={17} color={colors.brand[600]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Issued By</Text>
          <View style={styles.divider} />
          {bundle.issuingOfficer ? (
            <View style={styles.personRow}>
              <View style={[styles.avatarBig, { backgroundColor: colors.blue[50] }]}>
                <ShieldIcon size={22} color={colors.blue[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{bundle.issuingOfficer.full_name}</Text>
                <Text style={styles.personSub}>
                  {[bundle.issuingOfficer.rank, bundle.issuingOfficer.service_number]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyLine}>Officer information unavailable.</Text>
          )}
          {bundle.station && (
            <>
              <View style={styles.divider} />
              <View style={styles.personRow}>
                <View style={[styles.avatarBig, { backgroundColor: colors.gray[100] }]}>
                  <MapPinIcon size={20} color={colors.gray[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>{bundle.station.station_name}</Text>
                  {bundle.station.station_phone && (
                    <Text style={styles.personSub}>{bundle.station.station_phone}</Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>

        {editable && (
          <View style={styles.actionsCard}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.divider} />

            {overdue && (
              <TouchableOpacity
                style={[styles.actionRow, styles.actionRowDanger]}
                onPress={() => setConfirmReminder(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.red[100] }]}>
                  <AlertTriangleIcon size={18} color={colors.red[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionTitle, { color: colors.red[700] }]}>Send Final Reminder</Text>
                  <Text style={styles.actionSub}>
                    {alreadyReminded
                      ? 'Re-send overdue SMS to the rider'
                      : 'SMS the rider that this fine is overdue'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setMarkPaidOpen(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.green[50] }]}>
                <CheckCircleIcon size={18} color={colors.green[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Mark as Paid</Text>
                <Text style={styles.actionSub}>Record a payment reference</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setCancelOpen(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.gray[100] }]}>
                <XIcon size={18} color={colors.gray[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Cancel Fine</Text>
                <Text style={styles.actionSub}>Void this fine with a reason</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <DataFooter stamp={stamp} onRefresh={onRefresh} />
      </ScrollView>

      {/* Send reminder confirmation */}
      <Modal transparent visible={confirmReminder} animationType="fade" onRequestClose={() => setConfirmReminder(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIcon, { backgroundColor: colors.red[50] }]}>
              <AlertTriangleIcon size={24} color={colors.red[600]} />
            </View>
            <Text style={styles.modalTitle}>Send final reminder?</Text>
            <Text style={styles.modalText}>
              An SMS will be sent to {fine.rider_name} at {fine.rider_phone} asking them to settle{' '}
              {fine.fine_reference} ({money(fine.fine_amount)}) immediately.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => setConfirmReminder(false)}
                disabled={sendingReminder}
              >
                <Text style={styles.modalBtnGhostText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger, sendingReminder && { opacity: 0.7 }]}
                onPress={sendReminder}
                disabled={sendingReminder}
              >
                {sendingReminder ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Send reminder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mark paid */}
      <Modal transparent visible={markPaidOpen} animationType="fade" onRequestClose={() => setMarkPaidOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIcon, { backgroundColor: colors.green[50] }]}>
              <CheckCircleIcon size={24} color={colors.green[600]} />
            </View>
            <Text style={styles.modalTitle}>Mark this fine as paid</Text>
            <Text style={styles.modalText}>Record the M-Pesa or receipt number for {fine.fine_reference}.</Text>
            <TextInput
              value={paymentRef}
              onChangeText={setPaymentRef}
              placeholder="e.g. QGT4X8LM3P"
              placeholderTextColor={colors.gray[400]}
              autoCapitalize="characters"
              style={styles.textInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => { setMarkPaidOpen(false); setPaymentRef(''); }}
                disabled={markingPaid}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  (!paymentRef.trim() || markingPaid) && { opacity: 0.5 },
                ]}
                onPress={markPaid}
                disabled={!paymentRef.trim() || markingPaid}
              >
                {markingPaid ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Confirm payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cancel fine */}
      <Modal transparent visible={cancelOpen} animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIcon, { backgroundColor: colors.gray[100] }]}>
              <XIcon size={24} color={colors.gray[600]} />
            </View>
            <Text style={styles.modalTitle}>Cancel this fine</Text>
            <Text style={styles.modalText}>Provide a short reason. The fine will be marked as cancelled.</Text>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Reason for cancellation..."
              placeholderTextColor={colors.gray[400]}
              multiline
              style={[styles.textInput, { height: 90, textAlignVertical: 'top', paddingTop: spacing.md }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={() => { setCancelOpen(false); setCancelReason(''); }}
                disabled={cancelling}
              >
                <Text style={styles.modalBtnGhostText}>Keep fine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnDanger,
                  (!cancelReason.trim() || cancelling) && { opacity: 0.5 },
                ]}
                onPress={cancelFine}
                disabled={!cancelReason.trim() || cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnDangerText}>Cancel fine</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1, backgroundColor: colors.gray[50], alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl, gap: spacing.md,
  },
  loadingText: { ...typography.bodySmall, color: colors.gray[500] },
  errorIconBox: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.red[50],
    alignItems: 'center', justifyContent: 'center',
  },
  errorTitle: { ...typography.h2, color: colors.gray[900] },
  errorText: { ...typography.bodySmall, color: colors.gray[600], textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.brand[600], borderRadius: borderRadius.lg,
  },
  retryText: { ...typography.button, color: colors.white },

  hero: {
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  heroChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  heroRef: {
    fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '600', letterSpacing: 0.3, marginTop: 4,
  },
  heroAmount: {
    fontSize: 40, color: colors.white, fontWeight: '800', letterSpacing: -1, marginTop: 4,
  },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  heroStatusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  heroStatusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  heroOverdueLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  overdueBanner: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.red[50], borderWidth: 1, borderColor: colors.red[100],
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  overdueBannerIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  overdueBannerTitle: { fontSize: 14, fontWeight: '700', color: colors.red[700] },
  overdueBannerText: { fontSize: 12, color: colors.red[600], marginTop: 2, lineHeight: 17 },

  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.gray[200], marginBottom: spacing.md, ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: colors.gray[500], letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  divider: { height: 1, backgroundColor: colors.gray[100], marginVertical: spacing.md },
  offenceName: { fontSize: 17, fontWeight: '700', color: colors.gray[900], letterSpacing: -0.3 },
  offenceCode: { ...typography.caption, color: colors.gray[500], marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  metaText: { ...typography.bodySmall, color: colors.gray[700] },

  notesBox: {
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.gray[100],
  },
  notesLabel: {
    fontSize: 10, letterSpacing: 0.5, color: colors.gray[400], textTransform: 'uppercase',
    marginBottom: 4, fontWeight: '600',
  },
  notesText: { ...typography.body, color: colors.gray[800] },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarBig: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  personName: { fontSize: 15, fontWeight: '700', color: colors.gray[900] },
  personSub: { ...typography.caption, color: colors.gray[500], marginTop: 2, textTransform: 'none', letterSpacing: 0 },
  circleAction: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand[50],
    alignItems: 'center', justifyContent: 'center',
  },
  emptyLine: { ...typography.bodySmall, color: colors.gray[400], fontStyle: 'italic' },

  actionsCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.gray[200], marginBottom: spacing.md, ...shadows.sm,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.gray[100],
  },
  actionRowDanger: { backgroundColor: colors.red[50], marginHorizontal: -spacing.lg, paddingHorizontal: spacing.lg, borderBottomColor: colors.red[100] },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 15, fontWeight: '600', color: colors.gray[900] },
  actionSub: { ...typography.caption, color: colors.gray[500], marginTop: 2, textTransform: 'none', letterSpacing: 0 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, width: '100%',
    maxWidth: 400,
  },
  modalIcon: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.gray[900], marginBottom: spacing.xs },
  modalText: { ...typography.bodySmall, color: colors.gray[600], marginBottom: spacing.lg, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: colors.gray[100] },
  modalBtnGhostText: { ...typography.button, color: colors.gray[700] },
  modalBtnPrimary: { backgroundColor: colors.brand[600] },
  modalBtnPrimaryText: { ...typography.button, color: colors.white },
  modalBtnDanger: { backgroundColor: colors.red[600] },
  modalBtnDangerText: { ...typography.button, color: colors.white },

  textInput: {
    borderWidth: 1, borderColor: colors.gray[200], borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.gray[900],
    backgroundColor: colors.gray[50],
  },
});
