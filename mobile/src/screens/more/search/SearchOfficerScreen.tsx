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
import { colors, spacing } from '../../../theme';
import { ChevronLeftIcon, ShieldIcon, PhoneIcon } from '../../../components/icons/Icons';
import { getSupabase } from '../../../services/supabase';
import { loadOfficerBundle, type FetchStamp } from '../../../services/data';
import { DataFooter } from '../../../components/ui/DataFooter';
import { detailStyles as s, dateStr } from './shared';

export default function SearchOfficerScreen(props: any) {
  const routeKey = props?.route?.key || 'no-key';
  const officerId = props?.route?.params?.officerId || 'no-id';
  return <SearchOfficerInner key={`${routeKey}::${officerId}`} {...props} />;
}

function SearchOfficerInner({ route, navigation }: any) {
  const { officerId } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [officer, setOfficer] = useState<any>(null);
  const [station, setStation] = useState<any>(null);
  const [stamp, setStamp] = useState<FetchStamp | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setOfficer(null);
    setStation(null);
    try {
      const bundle = await loadOfficerBundle(officerId);
      if (reqId !== reqIdRef.current) return;
      if (!bundle) {
        setStamp({
          fetchedAt: Date.now(),
          rowCount: 0,
          filter: `officer:${String(officerId).slice(0, 8)}`,
          errorMessage: 'Officer not found',
        });
        setLoading(false);
        return;
      }
      setOfficer(bundle.officer);
      setStation(bundle.station);
      setStamp(bundle.stamp);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setStamp({
        fetchedAt: Date.now(),
        rowCount: 0,
        filter: `officer:${String(officerId).slice(0, 8)}`,
        errorMessage: e?.message || 'Fetch failed',
      });
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [officerId]);

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
  if (!officer) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
            <ChevronLeftIcon size={22} color={colors.gray[700]} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.emptyText}>Officer not found.</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
          <ChevronLeftIcon size={22} color={colors.gray[700]} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
        {officer.is_station_admin ? (
          <View style={[s.chip, { backgroundColor: colors.brand[50] }]}>
            <Text style={[s.chipText, { color: colors.brand[700] }]}>STATION ADMIN</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}>
          <View style={s.heroRow}>
            {officer.profile_photo_url ? (
              <Image
                source={{ uri: officer.profile_photo_url }}
                style={{ width: 64, height: 64, borderRadius: 32 }}
              />
            ) : (
              <View style={[s.heroIcon, { backgroundColor: colors.brand[50] }]}>
                <ShieldIcon size={28} color={colors.brand[700]} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>{officer.full_name || 'Officer'}</Text>
              <Text style={s.heroSubtitle}>{officer.rank || 'Police Officer'}</Text>
              {officer.service_number ? (
                <Text style={[s.heroSubtitle, { color: colors.gray[400] }]}>
                  Service {officer.service_number}
                </Text>
              ) : null}
            </View>
          </View>

          {officer.phone_number ? (
            <TouchableOpacity
              style={s.actionBtn}
              onPress={() => Linking.openURL(`tel:${officer.phone_number}`)}
            >
              <PhoneIcon size={16} color={colors.white} />
              <Text style={s.actionBtnText}>Call {officer.phone_number}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={s.sectionLabel}>Officer Details</Text>
        <View style={s.card}>
          <Row label="Full Name" value={officer.full_name || '—'} />
          <Row label="Rank" value={officer.rank || '—'} />
          <Row label="Service Number" value={officer.service_number || '—'} />
          <Row label="Badge Number" value={officer.badge_number || '—'} />
          <Row label="Phone" value={officer.phone_number || '—'} />
          <Row label="Email" value={officer.email || '—'} />
          <Row label="Last Login" value={dateStr(officer.last_login_at)} last />
        </View>

        {station ? (
          <>
            <Text style={s.sectionLabel}>Assigned Station</Text>
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SearchStation', { stationId: station.id })}
            >
              <Row label="Station" value={station.station_name || '—'} />
              <Row label="Code" value={station.station_code || '—'} />
              <Row label="Type" value={station.station_type || '—'} />
              <Row label="Phone" value={station.phone_number || '—'} last />
            </TouchableOpacity>
          </>
        ) : null}

        <DataFooter stamp={stamp} onRefresh={load} hint={`Officer ${officer?.id?.slice(0, 8) || ''}`} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
