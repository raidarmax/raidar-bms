import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../../theme';
import {
  ChevronLeftIcon,
  UserIcon,
  PhoneIcon,
  MotorcycleIcon,
} from '../../../components/icons/Icons';
import { KenyaPlate } from '../../../components/ui/KenyaPlate';
import { getSupabase } from '../../../services/supabase';
import { loadRiderBundle, type FetchStamp } from '../../../services/data';
import { DataFooter } from '../../../components/ui/DataFooter';
import { detailStyles as s, dateStr, isExpired } from './shared';

export default function SearchRiderScreen(props: any) {
  const routeKey = props?.route?.key || 'no-key';
  const riderId = props?.route?.params?.riderId || 'no-id';
  return <SearchRiderInner key={`${routeKey}::${riderId}`} {...props} />;
}

function SearchRiderInner({ route, navigation }: any) {
  const { riderId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [rider, setRider] = useState<any>(null);
  const [bike, setBike] = useState<any>(null);
  const [incidentCount, setIncidentCount] = useState(0);
  const [unpaidFines, setUnpaidFines] = useState(0);
  const [unpaidTotal, setUnpaidTotal] = useState(0);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setRider(null);
    setBike(null);
    setIncidentCount(0);
    setUnpaidFines(0);
    setUnpaidTotal(0);
    try {
      const bundle = await loadRiderBundle(riderId);
      if (reqId !== reqIdRef.current) return;
      if (!bundle) {
        setStamp({
          fetchedAt: Date.now(),
          rowCount: 0,
          filter: `rider:${String(riderId).slice(0, 8)}`,
          errorMessage: 'Rider not found',
        });
        setLoading(false);
        return;
      }
      setRider(bundle.rider);
      setBike(bundle.motorcycle);
      setIncidentCount(bundle.totalIncidents);
      setUnpaidFines(bundle.unpaidFinesCount);
      setUnpaidTotal(bundle.unpaidFinesTotal);
      setStamp(bundle.stamp);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setStamp({
        fetchedAt: Date.now(),
        rowCount: 0,
        filter: `rider:${String(riderId).slice(0, 8)}`,
        errorMessage: e?.message || 'Fetch failed',
      });
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    load();
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
  if (!rider) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
            <ChevronLeftIcon size={22} color={colors.gray[700]} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.emptyText}>Rider not found.</Text>
      </View>
    );
  }

  const licenseExpired = isExpired(rider.license_expiry);
  const tier = (rider.rating_tier || '').toString().toUpperCase();

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        {tier ? (
          <View style={[s.chip, { backgroundColor: colors.gray[100] }]}>
            <Text style={[s.chipText, { color: colors.gray[700] }]}>{tier}</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.heroRow}>
            {rider.photo_url ? (
              <Image
                source={{ uri: rider.photo_url }}
                style={{ width: 64, height: 64, borderRadius: 32 }}
              />
            ) : (
              <View style={[s.heroIcon, { backgroundColor: colors.blue[50] }]}>
                <UserIcon size={28} color={colors.blue[700]} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{rider.name || 'Rider'}</Text>
              {rider.bms_id ? (
                <Text style={s.heroSubtitle}>BMS {rider.bms_id}</Text>
              ) : null}
              {rider.stage_name ? (
                <Text style={[s.heroSubtitle, { color: colors.gray[400] }]}>
                  Stage: {rider.stage_name}
                </Text>
              ) : null}
            </View>
          </View>

          {rider.phone_number ? (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: colors.blue[600] }]}
              onPress={() => Linking.openURL(`tel:${rider.phone_number}`)}
            >
              <PhoneIcon size={16} color={colors.white} />
              <Text style={s.actionBtnText}>Call {rider.phone_number}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={s.statGrid}>
            <View style={s.statTile}>
              <Text style={s.statLabel}>RATING</Text>
              <Text style={s.statValue}>{rider.rating_score ?? '—'}</Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>INCIDENTS</Text>
              <Text style={s.statValue}>{incidentCount}</Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>UNPAID FINES</Text>
              <Text style={s.statValue}>{unpaidFines}</Text>
            </View>
            <View style={s.statTile}>
              <Text style={s.statLabel}>OWED</Text>
              <Text style={[s.statValue, { fontSize: 13 }]}>
                KES {unpaidTotal.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.sectionLabel}>Identity</Text>
        <View style={s.card}>
          <Row label="Full Name" value={rider.name || '—'} />
          <Row label="National ID" value={rider.id_number || '—'} />
          <Row label="Phone" value={rider.phone_number || '—'} />
          <Row
            label="License Class"
            value={rider.license_class || '—'}
          />
          <Row
            label="License Expiry"
            value={dateStr(rider.license_expiry)}
            highlight={licenseExpired ? colors.rose[600] : undefined}
            last
          />
        </View>

        {bike ? (
          <>
            <Text style={s.sectionLabel}>Current Motorcycle</Text>
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SearchBike', { motorcycleId: bike.id })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {bike.bike_photo_url ? (
                  <Image
                    source={{ uri: bike.bike_photo_url }}
                    style={{ width: 52, height: 52, borderRadius: borderRadius.md }}
                  />
                ) : (
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.green[50],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MotorcycleIcon size={24} color={colors.green[700]} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <KenyaPlate plate={bike.registration_number} size="md" />
                  <Text style={{ fontSize: 12, color: colors.gray[600] }}>
                    {[bike.make, bike.model].filter(Boolean).join(' ') || 'Motorcycle'}
                  </Text>
                </View>
                <View
                  style={[
                    s.chip,
                    {
                      backgroundColor:
                        bike.is_compliant ? colors.green[50] : colors.rose[50],
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.chipText,
                      {
                        color: bike.is_compliant ? colors.green[700] : colors.rose[700],
                      },
                    ]}
                  >
                    {bike.is_compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {(rider.next_of_kin_name || rider.next_of_kin_phone) && (
          <>
            <Text style={s.sectionLabel}>Next of Kin</Text>
            <View style={s.card}>
              <Row label="Name" value={rider.next_of_kin_name || '—'} />
              <Row label="Phone" value={rider.next_of_kin_phone || '—'} last />
            </View>
          </>
        )}

        <DataFooter
          stamp={stamp}
          onRefresh={load}
          hint={`Rider ${rider?.id?.slice(0, 8) || ''}`}
        />
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  value,
  last,
  highlight,
}: {
  label: string;
  value: string;
  last?: boolean;
  highlight?: string;
}) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text
        style={[s.rowValue, highlight ? { color: highlight } : null]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}
