import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../../theme';
import {
  ChevronLeftIcon,
  MotorcycleIcon,
  MapPinIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from '../../../components/icons/Icons';
import { KenyaPlate } from '../../../components/ui/KenyaPlate';
import { getSupabase } from '../../../services/supabase';
import { loadBikeBundle, type FetchStamp } from '../../../services/data';
import { DataFooter } from '../../../components/ui/DataFooter';
import { detailStyles as s, humanize, dateStr, isExpired } from './shared';

export default function SearchBikeScreen(props: any) {
  const routeKey = props?.route?.key || 'no-key';
  const motorcycleId = props?.route?.params?.motorcycleId || 'no-id';
  return <SearchBikeInner key={`${routeKey}::${motorcycleId}`} {...props} />;
}

function SearchBikeInner({ route, navigation }: any) {
  const { motorcycleId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bike, setBike] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [rider, setRider] = useState<any>(null);
  const [latest, setLatest] = useState<any>(null);
  const [incidentCount, setIncidentCount] = useState(0);
  const [finesTotal, setFinesTotal] = useState(0);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setBike(null);
    setOwner(null);
    setRider(null);
    setLatest(null);
    setIncidentCount(0);
    setFinesTotal(0);
    try {
      const bundle = await loadBikeBundle(motorcycleId);
      if (reqId !== reqIdRef.current) return;
      if (!bundle) {
        setStamp({
          fetchedAt: Date.now(),
          rowCount: 0,
          filter: `bike:${String(motorcycleId).slice(0, 8)}`,
          errorMessage: 'Motorcycle not found',
        });
        setLoading(false);
        return;
      }
      setBike(bundle.motorcycle);
      setOwner(bundle.owner);
      setRider(bundle.assignedRider);
      setIncidentCount(bundle.totalIncidents);
      setFinesTotal(bundle.unpaidFinesTotal);
      setStamp(bundle.stamp);

      const supabase = getSupabase();
      const { data: trackRows } = await supabase
        .from('tracking_data')
        .select('latitude, longitude, speed, recorded_at')
        .eq('motorcycle_id', bundle.motorcycle.id)
        .order('recorded_at', { ascending: false })
        .limit(1);
      if (reqId !== reqIdRef.current) return;
      setLatest((trackRows && trackRows[0]) || null);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setStamp({
        fetchedAt: Date.now(),
        rowCount: 0,
        filter: `bike:${String(motorcycleId).slice(0, 8)}`,
        errorMessage: e?.message || 'Fetch failed',
      });
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [motorcycleId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
            <ChevronLeftIcon size={22} color={colors.gray[700]} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <View style={s.loading}>
          <ActivityIndicator color={colors.brand[500]} size="large" />
        </View>
      </View>
    );
  }

  if (!bike) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
            <ChevronLeftIcon size={22} color={colors.gray[700]} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.emptyText}>Motorcycle not found.</Text>
      </View>
    );
  }

  const compliant = bike.is_compliant === true;
  const insuranceExpired = isExpired(bike.insurance_expiry);
  const inspectionExpired = isExpired(bike.inspection_expiry);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        <View
          style={[
            s.chip,
            { backgroundColor: compliant ? colors.green[50] : colors.rose[50] },
          ]}
        >
          <Text
            style={[
              s.chipText,
              { color: compliant ? colors.green[700] : colors.rose[700] },
            ]}
          >
            {compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand[500]} />
        }
      >
        <View style={s.hero}>
          <View style={s.heroRow}>
            {bike.bike_photo_url ? (
              <Image
                source={{ uri: bike.bike_photo_url }}
                style={{ width: 68, height: 68, borderRadius: borderRadius.md }}
              />
            ) : (
              <View style={[s.heroIcon, { backgroundColor: colors.green[50] }]}>
                <MotorcycleIcon size={28} color={colors.green[700]} />
              </View>
            )}
            <View style={{ flex: 1, gap: 8 }}>
              <KenyaPlate plate={bike.registration_number} size="md" />
              <Text style={s.heroSubtitle}>
                {[bike.make, bike.model].filter(Boolean).join(' ') || 'Motorcycle'}
              </Text>
              <Text style={[s.heroSubtitle, { color: colors.gray[400] }]}>
                Status: {humanize(bike.status || 'unknown')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.actionBtn}
            activeOpacity={0.9}
            onPress={() =>
              navigation.navigate('LiveTracking', {
                motorcycleId: bike.id,
                title: bike.registration_number,
              })
            }
          >
            <MapPinIcon size={16} color={colors.white} />
            <Text style={s.actionBtnText}>View Live Location on Map</Text>
          </TouchableOpacity>

          <View style={s.statGrid}>
            <View style={s.statTile}>
              <Text style={s.statLabel}>INCIDENTS</Text>
              <Text style={s.statValue}>{incidentCount}</Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>FINES</Text>
              <Text style={s.statValue}>KES {finesTotal.toLocaleString()}</Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>LAST SEEN</Text>
              <Text style={[s.statValue, { fontSize: 13 }]}>
                {latest?.recorded_at
                  ? new Date(latest.recorded_at).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'No GPS data'}
              </Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>SPEED</Text>
              <Text style={[s.statValue, { fontSize: 13 }]}>
                {latest?.speed != null ? `${Math.round(latest.speed)} km/h` : '—'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionLabel}>Compliance</Text>
        <View style={s.card}>
          <ComplianceRow
            label="Insurance"
            value={bike.insurance_provider || 'Not recorded'}
            secondary={`Expires ${dateStr(bike.insurance_expiry)}`}
            ok={!!bike.insurance_provider && !insuranceExpired}
          />
          <ComplianceRow
            label="NTSA Inspection"
            value={bike.inspection_certificate_number || 'Not recorded'}
            secondary={`Expires ${dateStr(bike.inspection_expiry)}`}
            ok={!!bike.inspection_certificate_number && !inspectionExpired}
          />
          <ComplianceRow
            label="Tracking Device"
            value={bike.tracking_device_id || 'Not linked'}
            ok={!!bike.tracking_device_id}
            last
          />
        </View>

        <Text style={s.sectionLabel}>Identity</Text>
        <View style={s.card}>
          <Row label="Registration" value={bike.registration_number || '—'} />
          <Row label="Make" value={bike.make || '—'} />
          <Row label="Model" value={bike.model || '—'} />
          <Row label="Operating Area" value={bike.operating_area || '—'} last />
        </View>

        {owner ? (
          <>
            <Text style={s.sectionLabel}>Owner</Text>
            <View style={s.card}>
              <Row label="Name" value={owner.name || owner.full_name || '—'} />
              <Row label="Phone" value={owner.phone_number || '—'} />
              <Row label="ID" value={owner.national_id || owner.id_number || '—'} last />
            </View>
          </>
        ) : null}

        {rider ? (
          <>
            <Text style={s.sectionLabel}>Assigned Rider</Text>
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SearchRider', { riderId: rider.id })}
            >
              <Row label="Name" value={rider.name || '—'} />
              <Row label="BMS ID" value={rider.bms_id || '—'} />
              <Row label="Phone" value={rider.phone_number || '—'} />
              <Row
                label="Rating"
                value={
                  rider.rating_score != null
                    ? `${rider.rating_score}${rider.rating_tier ? ` · ${rider.rating_tier}` : ''}`
                    : '—'
                }
                last
              />
            </TouchableOpacity>
          </>
        ) : null}

        <DataFooter stamp={stamp} onRefresh={load} hint={`Bike ${bike?.id?.slice(0, 8) || ''}`} />
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ComplianceRow({
  label,
  value,
  secondary,
  ok,
  last,
}: {
  label: string;
  value: string;
  secondary?: string;
  ok: boolean;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {ok ? (
          <CheckCircleIcon size={16} color={colors.green[600]} />
        ) : (
          <AlertTriangleIcon size={16} color={colors.rose[600]} />
        )}
        <Text style={s.rowLabel}>{label}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text style={s.rowValue}>{value}</Text>
        {secondary ? (
          <Text style={{ fontSize: 11, color: ok ? colors.gray[400] : colors.rose[600] }}>
            {secondary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
